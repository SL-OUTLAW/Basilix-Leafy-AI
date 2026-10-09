import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import (
    APIRouter,
    Header,
    HTTPException,
    Query,
    Request,
    status,
)
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from engine.api.rate_limit import limiter
from engine.hal.ai_vision.vision_tool import VisionAnalysis
from engine.managers import scheduler
from engine.logger.logger import audit_log
from engine.managers.db_manager import get_connection, run_query
from engine.managers.emergency_manager import (
    activate_emergency_stop,
    clear_emergency_stop,
    disable_ai,
    enable_ai,
)
from engine.managers.grow_cycle_manager import (
    cancel_grow_cycle,
    complete_grow_cycle,
    create_grow_cycle,
    get_active_grow_cycle,
    get_harvest_data,
    record_harvest,
    update_grow_cycle,
    delete_grow_cycle,
)
from engine.managers.notifications_manager import (
    get_notification,
    get_notifications,
    resolve_notification,
)
from engine.managers.settings_manager import manage_settings, reset_settings
from engine.managers.tool_manager import execute_tools as run_tools
from engine.security.approval_manager import (
    approve_request,
    reject_request,
)
from engine.security.emergency_stop import ai_enabled
from engine.security.engine_auth import (
    validate_ai_token,
    validate_webapp_token,
)
from engine.tools.sensor_history import sensor_history

router = APIRouter()


class ToolCall(BaseModel):
    tool_name: str
    arguments: dict[str, Any]


class ToolCallRequest(BaseModel):
    tool_calls: list[ToolCall]


class SettingsUpdate(BaseModel):
    settings: dict[str, Any]


class AuditLogCreate(BaseModel):
    action_type: str
    description: str
    user_id: int | None = None
    entity_type: str | None = None
    entity_id: int | None = None
    metadata: dict[str, Any] | None = None


class ScheduleCreate(BaseModel):
    task_name: str
    task_description: str | None = None
    task_action: str
    level_no: int
    start_time: str
    interval_seconds: int | None = None
    duration_seconds: int | None = None
    target_value: float | None = None
    unit: str | None = None


class ScheduleUpdate(BaseModel):
    task_name: str | None = None
    task_description: str | None = None
    task_action: str | None = None
    level_no: int | None = None
    start_time: str | None = None
    interval_seconds: int | None = None
    duration_seconds: int | None = None
    target_value: float | None = None
    unit: str | None = None


class ReviewRequest(BaseModel):
    review_note: str | None = None


class GrowCycleCreate(BaseModel):
    cycle_name: str
    notes: str | None = None


class GrowCycleUpdate(BaseModel):
    cycle_name: str | None = None
    notes: str | None = None


class CameraCreate(BaseModel):
    camera_name: str
    level_no: int = Field(ge=1, le=2)
    ip_address: str
    rtsp_path: str | None = None


class SettingsReset(BaseModel):
    setting_key: str | None = None


class HarvestCreate(BaseModel):
    harvest_weight_g: float = Field(ge=0)
    plant_count_harvested: int | None = Field(default=None, ge=0)
    quality_score: float | None = Field(default=None, ge=0, le=10)
    notes: str | None = None


class EnabledControl(BaseModel):
    enabled: bool


class LightingControl(EnabledControl):
    level_no: int


class TargetControl(BaseModel):
    target_value: float


VALID_USER_ROLES = {
    "OPERATOR",
    "ADMIN",
}


def _get_bearer_token(
    authorization: str | None,
) -> str:

    if authorization is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
        )

    scheme, _, token = authorization.partition(" ")

    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header",
        )

    return token


def _require_webapp_token(
    authorization: str | None,
) -> dict[str, Any]:

    token = _get_bearer_token(authorization)
    claims = validate_webapp_token(token)

    if not claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    return claims


def _require_ai_token(
    authorization: str | None,
) -> dict[str, Any]:

    token = _get_bearer_token(authorization)
    claims = validate_ai_token(token)

    if not claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    return claims


def _user_context(
    x_user_id: str | None,
    x_user_role: str | None,
    allowed_roles: set[str] | None = None,
) -> tuple[int, str]:

    try:
        user_id = int(x_user_id) if x_user_id is not None else None
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user context",
        ) from error

    role = (x_user_role or "").upper()

    if user_id is None or role not in VALID_USER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User context is required",
        )

    if allowed_roles is not None and role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient role",
        )

    return user_id, role


def _raise_bad_request(
    error: Exception,
) -> None:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=str(error),
    ) from error


def _serialize_schedule_row(
    row,
) -> dict[str, Any]:
    return {
        "schedule_id": row[0],
        "task_name": row[1],
        "description": row[2],
        "task_action": row[3],
        "level_no": row[4],
        "start_time": row[5].isoformat() if row[5] is not None else None,
        "interval_seconds": row[6],
        "duration_seconds": row[7],
        "target_value": float(row[8]) if row[8] is not None else None,
        "unit": row[9],
        "last_run_at": row[10].isoformat() if row[10] is not None else None,
        "next_run_at": row[11].isoformat() if row[11] is not None else None,
        "active_until_at": row[12].isoformat() if row[12] is not None else None,
        "enabled": row[13],
        "status": row[14],
        "created_at": row[15].isoformat() if row[15] is not None else None,
        "updated_at": row[16].isoformat() if row[16] is not None else None,
    }


async def _get_schedule(
    schedule_id: int,
) -> dict[str, Any] | None:

    rows = await run_query(
        """
        SELECT
            schedule_id,
            task_name,
            description,
            task_action,
            level_no,
            start_time,
            interval_seconds,
            duration_seconds,
            target_value,
            unit,
            last_run_at,
            next_run_at,
            active_until_at,
            enabled,
            status,
            created_at,
            updated_at
        FROM farm_schedule
        WHERE schedule_id = %s;
        """,
        (schedule_id,),
    )

    if not rows:
        return None

    return _serialize_schedule_row(rows[0])


@router.get("/health")
@limiter.limit("60/minute")
async def health(
    request: Request,
):
    return {
        "status": "ok",
    }


@router.post("/tools/execute")
@limiter.limit("60/minute")
async def execute_tools(
    request: Request,
    body: ToolCallRequest,
    authorization: str | None = Header(default=None),
):
    _require_ai_token(authorization)

    if not ai_enabled():
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="AI access is disabled",
        )

    results = await run_tools(body.tool_calls)

    return {
        "success": True,
        "results": results,
    }


@router.get("/farm/state")
@limiter.limit("120/minute")
async def get_farm_state(
    request: Request,
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    rows = await run_query("""
        SELECT
            (SELECT COUNT(*) FROM sensors),
            (
                SELECT COUNT(*)
                FROM sensors s
                WHERE s.status = 'ACTIVE'
                  AND EXISTS (
                      SELECT 1
                      FROM sensor_readings sr
                      WHERE sr.sensor_id = s.sensor_id
                        AND sr.quality_status = 'VALID'
                        AND sr.recorded_at >= NOW() - INTERVAL '60 seconds'
                  )
            ),
            (SELECT COUNT(*) FROM cameras),
            (SELECT COUNT(*) FROM cameras WHERE status = 'ACTIVE'),
            (SELECT COUNT(*) FROM notifications WHERE status = 'OPEN'),
            (
                SELECT COUNT(*)
                FROM notifications
                WHERE status = 'OPEN'
                  AND severity = 'CRITICAL'
            );
        """)

    active_cycle = await get_active_grow_cycle()
    security_settings = (await manage_settings()).get("security", {})
    row = rows[0] if rows else (0, 0, 0, 0, 0, 0)

    return {
        "success": True,
        "farm": {
            "sensors": row[0],
            "active_sensors": row[1],
            "cameras": row[2],
            "active_cameras": row[3],
            "open_notifications": row[4],
            "critical_notifications": row[5],
            "ai_enabled": bool(security_settings.get("ai_enabled", True)),
            "emergency_stop": bool(security_settings.get("emergency_stop", False)),
            "active_grow_cycle": active_cycle,
        },
    }


@router.get("/farm/sensors")
@limiter.limit("120/minute")
async def get_farm_sensors(
    request: Request,
    level_no: int | None = Query(default=None, ge=0, le=2),
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    rows = await run_query(
        """
        SELECT
            s.sensor_id,
            s.sensor_name,
            s.sensor_type,
            s.level_no,
            s.sensor_no,
            s.unit,
            s.status,
            latest.value,
            latest.quality_status,
            latest.recorded_at
        FROM sensors s
        LEFT JOIN LATERAL (
            SELECT
                sr.value,
                sr.quality_status,
                sr.recorded_at
            FROM sensor_readings sr
            WHERE sr.sensor_id = s.sensor_id
            ORDER BY sr.recorded_at DESC
            LIMIT 1
        ) latest ON TRUE
        WHERE (%s::integer IS NULL OR s.level_no = %s)
        ORDER BY s.level_no, s.sensor_type, s.sensor_no;
        """,
        (level_no, level_no),
    )

    sensors = [
        {
            "sensor_id": row[0],
            "sensor_name": row[1],
            "sensor_type": row[2],
            "level_no": row[3],
            "sensor_no": row[4],
            "unit": row[5],
            "status": row[6],
            "value": float(row[7]) if row[7] is not None else None,
            "quality_status": row[8],
            "recorded_at": row[9].isoformat() if row[9] is not None else None,
        }
        for row in rows
    ]

    return {
        "success": True,
        "sensors": sensors,
    }


@router.get("/farm/sensors/{sensor_type}/readings")
@limiter.limit("60/minute")
async def get_raw_sensor_readings(
    request: Request,
    sensor_type: str,
    start_time: datetime = Query(...),
    end_time: datetime = Query(...),
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    if start_time.tzinfo is None or end_time.tzinfo is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_time and end_time must include a timezone.",
        )

    start_time = start_time.astimezone(timezone.utc)
    end_time = end_time.astimezone(timezone.utc)

    if end_time <= start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_time must be after start_time.",
        )

    rows = await run_query(
        """
        SELECT
            sr.recorded_at,
            sr.value,
            sr.quality_status
        FROM sensor_readings sr
        JOIN sensors s
            ON s.sensor_id = sr.sensor_id
        WHERE s.sensor_type = %s
          AND sr.recorded_at >= %s
          AND sr.recorded_at <= %s
        ORDER BY sr.recorded_at ASC, sr.reading_id ASC;
        """,
        (
            sensor_type,
            start_time,
            end_time,
        ),
    )

    return {
        "success": True,
        "sensor_type": sensor_type,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "readings": [
            {
                "time": row[0].isoformat(),
                "value": float(row[1]),
                "quality_status": row[2],
            }
            for row in rows
        ],
    }


@router.get("/farm/sensors/{sensor_type}/history")
@limiter.limit("30/minute")
async def get_sensor_history(
    request: Request,
    sensor_type: str,
    time_range: str | None = Query(default="1h"),
    start_time: str | None = Query(default=None),
    end_time: str | None = Query(default=None),
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    arguments: dict[str, Any] = {
        "sensor_type": sensor_type,
    }

    if start_time is not None or end_time is not None:
        arguments["start_time"] = start_time
        arguments["end_time"] = end_time
    else:
        arguments["time_range"] = time_range

    try:
        history = await sensor_history(arguments)
    except ValueError as error:
        _raise_bad_request(error)

    return {
        "success": True,
        "history": history,
    }


@router.get("/farm/sensors/stream")
@limiter.limit("12/minute")
async def stream_farm_sensors(
    request: Request,
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    queue = request.app.state.hal.sensors.subscribe()

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break

                try:
                    payload = await asyncio.wait_for(
                        queue.get(),
                        timeout=25.0,
                    )

                    yield ("event: sensors\n" f"data: {json.dumps(payload)}\n\n")

                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"

        except asyncio.CancelledError:
            raise

        finally:
            request.app.state.hal.sensors.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/farm/cameras")
@limiter.limit("60/minute")
async def get_farm_cameras(
    request: Request,
    level_no: int | None = Query(default=None, ge=1, le=2),
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    rows = await run_query(
        """
        SELECT
            c.camera_id,
            c.camera_name,
            c.level_no,
            c.status,
            latest.image_id,
            latest.captured_at,
            analysis.analysis_id,
            analysis.created_at
        FROM cameras c
        LEFT JOIN LATERAL (
            SELECT pi.image_id, pi.captured_at
            FROM plant_images pi
            WHERE pi.camera_id = c.camera_id
            ORDER BY pi.captured_at DESC
            LIMIT 1
        ) latest ON TRUE
        LEFT JOIN LATERAL (
            SELECT pia.analysis_id, pia.created_at
            FROM plant_image_analysis pia
            JOIN plant_images pi ON pi.image_id = pia.image_id
            WHERE pi.camera_id = c.camera_id
            ORDER BY pia.created_at DESC
            LIMIT 1
        ) analysis ON TRUE
        WHERE (%s::integer IS NULL OR c.level_no = %s)
        ORDER BY c.level_no, c.camera_id;
        """,
        (level_no, level_no),
    )

    return {
        "success": True,
        "cameras": [
            {
                "camera_id": row[0],
                "camera_name": row[1],
                "level_no": row[2],
                "status": row[3],
                "latest_image_id": row[4],
                "last_capture_at": row[5].isoformat() if row[5] is not None else None,
                "latest_analysis_id": row[6],
                "latest_analysis_at": (
                    row[7].isoformat() if row[7] is not None else None
                ),
            }
            for row in rows
        ],
    }


@router.post("/farm/cameras", status_code=201)
@limiter.limit("20/minute")
async def create_camera(
    request: Request,
    body: CameraCreate,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    _user_context(x_user_id, x_user_role, {"ADMIN"})

    if not body.camera_name.strip():
        raise HTTPException(status_code=400, detail="camera_name is required")

    rows = await run_query(
        """
        INSERT INTO cameras (camera_name, level_no, ip_address, rtsp_path, status)
        VALUES (%s, %s, %s, %s, 'ACTIVE')
        RETURNING camera_id, camera_name, level_no, ip_address, rtsp_path, status, created_at;
        """,
        (body.camera_name.strip(), body.level_no, body.ip_address, body.rtsp_path),
    )
    await request.app.state.hal.cameras.load_cameras()
    row = rows[0]
    return {
        "success": True,
        "camera": {
            "camera_id": row[0],
            "camera_name": row[1],
            "level_no": row[2],
            "ip_address": row[3],
            "rtsp_path": row[4],
            "status": row[5],
            "created_at": row[6].isoformat(),
        },
    }


@router.get("/farm/cameras/{camera_id}/image")
@limiter.limit("60/minute")
async def get_camera_image(
    request: Request,
    camera_id: int,
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    rows = await run_query(
        """
        SELECT image_path
        FROM plant_images
        WHERE camera_id = %s
        ORDER BY captured_at DESC
        LIMIT 1;
        """,
        (camera_id,),
    )

    if not rows:
        raise HTTPException(status_code=404, detail="Camera image not found")

    image_path = Path(rows[0][0]).resolve()

    if not image_path.exists() or not image_path.is_file():
        raise HTTPException(status_code=404, detail="Camera image file not found")

    return FileResponse(
        path=image_path,
        media_type="image/jpeg",
        filename=f"camera-{camera_id}-latest.jpg",
    )


@router.get("/farm/cameras/{camera_id}/analysis")
@limiter.limit("60/minute")
async def get_camera_analysis(
    request: Request,
    camera_id: int,
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    rows = await run_query(
        """
        SELECT
            c.camera_id,
            c.camera_name,
            c.level_no,
            pi.image_id,
            pi.captured_at,
            pia.analysis_id,
            pia.created_at,
            pia.analysis
        FROM cameras c
        JOIN plant_images pi ON pi.camera_id = c.camera_id
        JOIN plant_image_analysis pia ON pia.image_id = pi.image_id
        WHERE c.camera_id = %s
        ORDER BY pia.created_at DESC
        LIMIT 1;
        """,
        (camera_id,),
    )

    if not rows:
        raise HTTPException(status_code=404, detail="Camera analysis not found")

    row = rows[0]

    return {
        "success": True,
        "analysis": {
            "camera_id": row[0],
            "camera_name": row[1],
            "level_no": row[2],
            "image_id": row[3],
            "captured_at": row[4].isoformat(),
            "analysis_id": row[5],
            "analysis_created_at": row[6].isoformat(),
            "analysis": row[7],
        },
    }


@router.get("/farm/schedule")
@limiter.limit("60/minute")
async def get_farm_schedule(
    request: Request,
    enabled: bool | None = Query(default=None),
    level_no: int | None = Query(default=None, ge=0, le=2),
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    rows = await run_query(
        """
        SELECT
            schedule_id,
            task_name,
            description,
            task_action,
            level_no,
            start_time,
            interval_seconds,
            duration_seconds,
            target_value,
            unit,
            last_run_at,
            next_run_at,
            active_until_at,
            enabled,
            status,
            created_at,
            updated_at
        FROM farm_schedule
        WHERE (%s::boolean IS NULL OR enabled = %s)
          AND (%s::integer IS NULL OR level_no = %s)
        ORDER BY level_no, start_time, schedule_id;
        """,
        (enabled, enabled, level_no, level_no),
    )

    return {
        "success": True,
        "schedules": [_serialize_schedule_row(row) for row in rows],
    }


@router.get("/farm/schedule/{schedule_id}")
@limiter.limit("60/minute")
async def get_schedule_by_id(
    request: Request,
    schedule_id: int,
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    schedule = await _get_schedule(schedule_id)

    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found")

    return {
        "success": True,
        "schedule": schedule,
    }


@router.post("/farm/schedule", status_code=201)
@limiter.limit("20/minute")
async def create_schedule(
    request: Request,
    body: ScheduleCreate,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    _user_context(x_user_id, x_user_role, {"OPERATOR", "ADMIN"})

    try:
        schedule_id = await scheduler.run_scheduled_task(
            {
                "action_type": "CREATE_SCHEDULE",
                "action_data": body.model_dump(exclude_none=True),
            }
        )
    except ValueError as error:
        _raise_bad_request(error)

    return {
        "success": True,
        "schedule": await _get_schedule(schedule_id),
    }


@router.patch("/farm/schedule/{schedule_id}")
@limiter.limit("20/minute")
async def update_schedule(
    request: Request,
    schedule_id: int,
    body: ScheduleUpdate,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    _user_context(x_user_id, x_user_role, {"OPERATOR", "ADMIN"})

    action_data = body.model_dump(exclude_unset=True)
    action_data["schedule_id"] = schedule_id

    try:
        updated_id = await scheduler.run_scheduled_task(
            {
                "action_type": "UPDATE_SCHEDULE",
                "action_data": action_data,
            }
        )
    except ValueError as error:
        _raise_bad_request(error)

    return {
        "success": True,
        "schedule": await _get_schedule(updated_id),
    }


@router.post("/farm/schedule/{schedule_id}/enable")
@limiter.limit("20/minute")
async def enable_schedule(
    request: Request,
    schedule_id: int,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    _user_context(x_user_id, x_user_role, {"OPERATOR", "ADMIN"})

    try:
        updated_id = await scheduler.run_scheduled_task(
            {
                "action_type": "ENABLE_SCHEDULE",
                "action_data": {"schedule_id": schedule_id},
            }
        )
    except ValueError as error:
        _raise_bad_request(error)

    return {
        "success": True,
        "schedule": await _get_schedule(updated_id),
    }


@router.post("/farm/schedule/{schedule_id}/disable")
@limiter.limit("20/minute")
async def disable_schedule_route(
    request: Request,
    schedule_id: int,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    _user_context(x_user_id, x_user_role, {"OPERATOR", "ADMIN"})

    try:
        updated_id = await scheduler.run_scheduled_task(
            {
                "action_type": "DISABLE_SCHEDULE",
                "action_data": {"schedule_id": schedule_id},
            }
        )
    except ValueError as error:
        _raise_bad_request(error)

    return {
        "success": True,
        "schedule": await _get_schedule(updated_id),
    }


@router.get("/farm/controls")
@limiter.limit("60/minute")
async def get_farm_controls(
    request: Request,
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    controls = request.app.state.hal.controls

    equipment = [
        "lighting_level_1",
        "lighting_level_2",
        "irrigation",
        "fan",
        "dose_ph",
        "dose_ec",
    ]

    states: dict[str, Any] = {}

    for name in equipment:
        try:
            states[name] = await controls.get_equipment_state(name)
        except Exception as error:
            states[name] = {
                "error": str(error),
            }

    return {
        "success": True,
        "controls": states,
    }


@router.post("/farm/controls/lighting")
@limiter.limit("30/minute")
async def control_lighting(
    request: Request,
    body: LightingControl,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    _user_context(x_user_id, x_user_role, {"OPERATOR", "ADMIN"})

    try:
        result = await request.app.state.hal.controls.set_lighting(
            level_no=body.level_no,
            enabled=body.enabled,
        )
    except ValueError as error:
        _raise_bad_request(error)

    return {"success": True, "result": result}


@router.post("/farm/controls/irrigation")
@limiter.limit("20/minute")
async def control_irrigation(
    request: Request,
    body: EnabledControl,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    _user_context(x_user_id, x_user_role, {"OPERATOR", "ADMIN"})

    result = await request.app.state.hal.controls.set_irrigation(
        enabled=body.enabled,
    )

    return {"success": True, "result": result}


@router.post("/farm/controls/fan")
@limiter.limit("30/minute")
async def control_fan(
    request: Request,
    body: EnabledControl,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    _user_context(x_user_id, x_user_role, {"OPERATOR", "ADMIN"})

    result = await request.app.state.hal.controls.set_fan(
        enabled=body.enabled,
    )

    return {"success": True, "result": result}


@router.post("/farm/controls/ph/target")
@limiter.limit("6/minute")
async def control_ph_target(
    request: Request,
    body: TargetControl,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    _user_context(x_user_id, x_user_role, {"OPERATOR", "ADMIN"})

    try:
        result = await request.app.state.hal.controls.dose_ph_to_target(
            target=body.target_value,
        )
    except (ValueError, RuntimeError) as error:
        _raise_bad_request(error)

    return {"success": True, "result": result}


@router.post("/farm/controls/ec/target")
@limiter.limit("6/minute")
async def control_ec_target(
    request: Request,
    body: TargetControl,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    _user_context(x_user_id, x_user_role, {"OPERATOR", "ADMIN"})

    try:
        result = await request.app.state.hal.controls.dose_ec_to_target(
            target=body.target_value,
        )
    except (ValueError, RuntimeError) as error:
        _raise_bad_request(error)

    return {"success": True, "result": result}


@router.get("/notifications")
@limiter.limit("60/minute")
async def list_notifications(
    request: Request,
    status_filter: str | None = Query(default=None, alias="status"),
    severity: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    try:
        notifications = await get_notifications(
            status=status_filter,
            severity=severity,
            limit=limit,
            offset=offset,
        )
    except ValueError as error:
        _raise_bad_request(error)

    return {"success": True, "notifications": notifications}


@router.get("/notifications/count")
@limiter.limit("60/minute")
async def notification_count(
    request: Request,
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)
    rows = await run_query("SELECT COUNT(*) FROM notifications;")
    return {"success": True, "count": rows[0][0] if rows else 0}


@router.get("/notifications/{notification_id}")
@limiter.limit("60/minute")
async def get_notification_route(
    request: Request,
    notification_id: int,
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    notification = await get_notification(notification_id)

    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")

    return {"success": True, "notification": notification}


@router.patch("/notifications/{notification_id}/resolve")
@limiter.limit("30/minute")
async def resolve_notification_route(
    request: Request,
    notification_id: int,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    _user_context(x_user_id, x_user_role, {"OPERATOR", "ADMIN"})

    resolved = await resolve_notification(notification_id)

    if not resolved:
        raise HTTPException(status_code=404, detail="Open notification not found")

    return {"success": True, "resolved": True}


@router.get("/ai/recommendations")
@limiter.limit("60/minute")
async def get_recommendations(
    request: Request,
    status_filter: str | None = Query(default=None, alias="status"),
    level_no: int | None = Query(default=None, ge=0, le=2),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    rows = await run_query(
        """
        SELECT
            recommendation_id,
            recommendation_type,
            level_no,
            recommendation_message,
            recommendation_reason,
            evidence,
            risk_level,
            requires_approval,
            status,
            proposed_action,
            created_at,
            reviewed_by,
            reviewed_at
        FROM ai_recommendations
        WHERE (%s::varchar IS NULL OR status = %s)
          AND (%s::integer IS NULL OR level_no = %s)
        ORDER BY created_at DESC, recommendation_id DESC
        LIMIT %s OFFSET %s;
        """,
        (
            status_filter,
            status_filter,
            level_no,
            level_no,
            limit,
            offset,
        ),
    )

    return {
        "success": True,
        "recommendations": [
            {
                "recommendation_id": row[0],
                "recommendation_type": row[1],
                "level_no": row[2],
                "recommendation_message": row[3],
                "recommendation_reason": row[4],
                "evidence": row[5],
                "risk_level": row[6],
                "requires_approval": row[7],
                "status": row[8],
                "proposed_action": row[9],
                "created_at": row[10].isoformat(),
                "reviewed_by": row[11],
                "reviewed_at": row[12].isoformat() if row[12] is not None else None,
            }
            for row in rows
        ],
    }


@router.get("/ai/activity")
@limiter.limit("60/minute")
async def get_ai_activity(
    request: Request,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    hours: int | None = Query(default=None, ge=1, le=720),
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    rows = await run_query(
        """
        SELECT * FROM (
            SELECT
                'RECOMMENDATION' AS activity_type,
                ar.recommendation_id AS entity_id,
                ar.status,
                ar.recommendation_message AS message,
                ar.created_at AS occurred_at,
                NULL::jsonb AS result,
                NULL::bigint AS schedule_id,
                NULL::varchar AS task_name,
                NULL::varchar AS task_action
            FROM ai_recommendations ar
            UNION ALL
            SELECT
                'TASK_EXECUTION' AS activity_type,
                te.execution_id AS entity_id,
                te.status,
                COALESCE(
                    te.error_message,
                    te.result->>'content',
                    te.result->'result'->>'content',
                    fs.task_name,
                    'Scheduled task execution'
                ) AS message,
                COALESCE(te.completed_at, te.started_at, te.created_at) AS occurred_at,
                te.result,
                te.schedule_id,
                fs.task_name,
                fs.task_action
            FROM task_executions te
            JOIN farm_schedule fs ON fs.schedule_id = te.schedule_id
        ) activity
        WHERE (%s::integer IS NULL OR occurred_at >= NOW() - make_interval(hours => %s))
        ORDER BY occurred_at DESC, entity_id DESC
        LIMIT %s OFFSET %s;
        """,
        (hours, hours, limit, offset),
    )

    return {
        "success": True,
        "activity": [
            {
                "activity_type": row[0],
                "entity_id": row[1],
                "status": row[2],
                "message": row[3],
                "occurred_at": row[4].isoformat(),
                "result": row[5],
                "schedule_id": row[6],
                "task_name": row[7],
                "task_action": row[8],
            }
            for row in rows
        ],
    }


@router.get("/approvals")
@limiter.limit("60/minute")
async def list_approvals(
    request: Request,
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    rows = await run_query(
        """
        SELECT
            approval_id,
            recommendation_id,
            action_type,
            action_data,
            risk_level,
            status,
            requested_by,
            reviewed_by,
            requested_at,
            reviewed_at,
            review_note
        FROM approval_requests
        WHERE (%s::varchar IS NULL OR status = %s)
        ORDER BY requested_at DESC, approval_id DESC
        LIMIT %s OFFSET %s;
        """,
        (status_filter, status_filter, limit, offset),
    )

    return {
        "success": True,
        "approvals": [
            {
                "approval_id": row[0],
                "recommendation_id": row[1],
                "action_type": row[2],
                "action_data": row[3],
                "risk_level": row[4],
                "status": row[5],
                "requested_by": row[6],
                "reviewed_by": row[7],
                "requested_at": row[8].isoformat(),
                "reviewed_at": row[9].isoformat() if row[9] is not None else None,
                "review_note": row[10],
            }
            for row in rows
        ],
    }


@router.get("/approvals/{approval_id}")
@limiter.limit("60/minute")
async def get_approval(
    request: Request,
    approval_id: int,
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    rows = await run_query(
        """
        SELECT
            approval_id,
            recommendation_id,
            action_type,
            action_data,
            risk_level,
            status,
            requested_by,
            reviewed_by,
            requested_at,
            reviewed_at,
            review_note
        FROM approval_requests
        WHERE approval_id = %s;
        """,
        (approval_id,),
    )

    if not rows:
        raise HTTPException(status_code=404, detail="Approval request not found")

    row = rows[0]

    return {
        "success": True,
        "approval": {
            "approval_id": row[0],
            "recommendation_id": row[1],
            "action_type": row[2],
            "action_data": row[3],
            "risk_level": row[4],
            "status": row[5],
            "requested_by": row[6],
            "reviewed_by": row[7],
            "requested_at": row[8].isoformat(),
            "reviewed_at": row[9].isoformat() if row[9] is not None else None,
            "review_note": row[10],
        },
    }


@router.post("/approvals/{approval_id}/approve")
@limiter.limit("20/minute")
async def approve_approval(
    request: Request,
    approval_id: int,
    body: ReviewRequest,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    user_id, _ = _user_context(x_user_id, x_user_role, {"OPERATOR", "ADMIN"})

    try:
        result = await approve_request(
            approval_id=approval_id,
            reviewed_by=user_id,
            review_note=body.review_note,
        )
    except ValueError as error:
        _raise_bad_request(error)
    async with get_connection() as conn:
        await audit_log(
            conn=conn,
            user_id=user_id,
            action_type="APPROVAL_APPROVED",
            entity_type="approval",
            entity_id=approval_id,
            description="A protected action was approved.",
            metadata={"status": "APPROVED"},
        )

    return {"success": True, "approval": result}


@router.post("/approvals/{approval_id}/reject")
@limiter.limit("20/minute")
async def reject_approval(
    request: Request,
    approval_id: int,
    body: ReviewRequest,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    user_id, _ = _user_context(x_user_id, x_user_role, {"OPERATOR", "ADMIN"})

    try:
        result = await reject_request(
            approval_id=approval_id,
            reviewed_by=user_id,
            review_note=body.review_note,
        )
    except ValueError as error:
        _raise_bad_request(error)
    async with get_connection() as conn:
        await audit_log(
            conn=conn,
            user_id=user_id,
            action_type="APPROVAL_REJECTED",
            entity_type="approval",
            entity_id=approval_id,
            description="A protected action was rejected.",
            metadata={"status": "REJECTED"},
        )

    return {"success": True, "approval": result}


@router.get("/safety/activity")
@limiter.limit("60/minute")
async def get_safety_activity(
    request: Request,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    hours: int = Query(default=24, ge=1, le=720),
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)
    rows = await run_query(
        """
        SELECT * FROM (
            SELECT 'APPROVAL' AS source, approval_id AS entity_id, status, action_type AS action,
                   COALESCE(review_note, 'Approval request ' || lower(status)) AS description,
                   COALESCE(reviewed_at, requested_at) AS occurred_at, risk_level, action_data AS details
            FROM approval_requests
            WHERE status IN ('APPROVED', 'REJECTED')
            UNION ALL
            SELECT 'EXECUTION', te.execution_id, te.status, fs.task_action,
                   COALESCE(te.error_message, fs.task_name || ' ' || lower(te.status)),
                   COALESCE(te.completed_at, te.started_at, te.created_at),
                   NULL::varchar, te.result
            FROM task_executions te
            JOIN farm_schedule fs ON fs.schedule_id = te.schedule_id
            WHERE te.status IN ('FAILED', 'SKIPPED', 'BLOCKED', 'AWAITING_APPROVAL')
               OR (
                    te.status = 'COMPLETED'
                    AND COALESCE((SELECT setting_value->>fs.task_action FROM system_settings WHERE setting_key = 'risk'), 'LOW') = 'HIGH'
               )
            UNION ALL
            SELECT 'AUDIT', log_id, COALESCE(metadata->>'status', 'RECORDED'), action_type, description,
                   created_at, NULL::varchar, metadata
            FROM audit_logs
            WHERE action_type LIKE 'SECURITY_%%'
               OR action_type LIKE 'EMERGENCY_%%'
               OR action_type LIKE 'AI_%%'
               OR action_type LIKE '%%BLOCK%%'
        ) safety_activity
        WHERE occurred_at >= NOW() - make_interval(hours => %s)
        ORDER BY occurred_at DESC, entity_id DESC
        LIMIT %s OFFSET %s;
        """,
        (hours, limit, offset),
    )
    return {
        "success": True,
        "activity": [
            {
                "source": r[0],
                "entity_id": r[1],
                "status": r[2],
                "action": r[3],
                "description": r[4],
                "occurred_at": r[5].isoformat(),
                "risk_level": r[6],
                "details": r[7],
            }
            for r in rows
        ],
    }


@router.get("/safety/state")
@limiter.limit("60/minute")
async def get_safety_state(
    request: Request,
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)
    security_settings = (await manage_settings()).get("security", {})

    return {
        "success": True,
        "safety": security_settings,
    }


@router.get("/safety/configuration")
@limiter.limit("30/minute")
async def get_safety_configuration(
    request: Request,
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)
    all_settings = await manage_settings()

    keys = (
        "risk",
        "sensor_security_thresholds",
        "notifications",
        "dosing_ph",
        "dosing_ec",
        "farm_controls",
    )

    return {
        "success": True,
        "configuration": {key: all_settings.get(key, {}) for key in keys},
    }


@router.post("/safety/emergency-stop")
@limiter.limit("10/minute")
async def emergency_stop_route(
    request: Request,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    user_id, _ = _user_context(x_user_id, x_user_role, {"OPERATOR", "ADMIN"})
    await activate_emergency_stop()
    async with get_connection() as conn:
        await audit_log(
            conn=conn,
            user_id=user_id,
            action_type="EMERGENCY_STOP_ACTIVATED",
            entity_type="safety",
            description="Emergency stop was activated.",
            metadata={"status": "EXECUTED"},
        )

    return {"success": True, "emergency_stop": True, "ai_enabled": False}


@router.post("/safety/emergency-stop/clear")
@limiter.limit("10/minute")
async def clear_emergency_stop_route(
    request: Request,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    user_id, _ = _user_context(x_user_id, x_user_role, {"OPERATOR", "ADMIN"})
    await clear_emergency_stop()
    async with get_connection() as conn:
        await audit_log(
            conn=conn,
            user_id=user_id,
            action_type="EMERGENCY_STOP_CLEARED",
            entity_type="safety",
            description="Emergency stop was cleared.",
            metadata={"status": "EXECUTED"},
        )

    return {"success": True, "emergency_stop": False, "ai_enabled": False}


@router.post("/safety/ai/enable")
@limiter.limit("10/minute")
async def enable_ai_route(
    request: Request,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    user_id, _ = _user_context(x_user_id, x_user_role, {"OPERATOR", "ADMIN"})
    await enable_ai()

    current = (await manage_settings()).get("security", {})

    if not current.get("ai_enabled", False):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="AI cannot be enabled while emergency stop is active",
        )

    async with get_connection() as conn:
        await audit_log(
            conn=conn,
            user_id=user_id,
            action_type="AI_ENABLED",
            entity_type="safety",
            description="Leafy AI was enabled.",
            metadata={"status": "EXECUTED"},
        )
    return {"success": True, "ai_enabled": True}


@router.post("/safety/ai/disable")
@limiter.limit("10/minute")
async def disable_ai_route(
    request: Request,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    user_id, _ = _user_context(x_user_id, x_user_role, {"OPERATOR", "ADMIN"})
    await disable_ai()
    async with get_connection() as conn:
        await audit_log(
            conn=conn,
            user_id=user_id,
            action_type="AI_DISABLED",
            entity_type="safety",
            description="Leafy AI was disabled.",
            metadata={"status": "EXECUTED"},
        )

    return {"success": True, "ai_enabled": False}


@router.post("/audit-logs", status_code=201)
@limiter.limit("120/minute")
async def create_audit_log(
    request: Request,
    body: AuditLogCreate,
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)
    metadata = dict(body.metadata or {})
    metadata["source_service"] = "webapp_backend"
    async with get_connection() as conn:
        log_id = await audit_log(
            conn=conn,
            action_type=body.action_type,
            description=body.description,
            user_id=body.user_id,
            entity_type=body.entity_type,
            entity_id=body.entity_id,
            metadata=metadata,
        )
    return {"success": True, "log_id": log_id}


@router.get("/audit-logs")
@limiter.limit("30/minute")
async def get_audit_logs(
    request: Request,
    action_type: str | None = Query(default=None),
    user_id: int | None = Query(default=None),
    entity_type: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    rows = await run_query(
        """
        SELECT
            log_id,
            user_id,
            action_type,
            entity_type,
            entity_id,
            description,
            metadata,
            created_at
        FROM audit_logs
        WHERE (%s::varchar IS NULL OR action_type = %s)
          AND (%s::bigint IS NULL OR user_id = %s)
          AND (%s::varchar IS NULL OR entity_type = %s)
        ORDER BY created_at DESC, log_id DESC
        LIMIT %s OFFSET %s;
        """,
        (
            action_type,
            action_type,
            user_id,
            user_id,
            entity_type,
            entity_type,
            limit,
            offset,
        ),
    )

    return {
        "success": True,
        "logs": [
            {
                "log_id": row[0],
                "user_id": row[1],
                "action_type": row[2],
                "entity_type": row[3],
                "entity_id": row[4],
                "description": row[5],
                "metadata": row[6],
                "created_at": row[7].isoformat(),
            }
            for row in rows
        ],
        "limit": limit,
        "offset": offset,
    }


@router.get("/grow-cycles")
@limiter.limit("30/minute")
async def list_grow_cycles(
    request: Request,
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    rows = await run_query(
        """
        SELECT
            grow_cycle_id,
            cycle_name,
            started_at,
            completed_at,
            status,
            notes,
            created_at,
            updated_at
        FROM grow_cycles
        WHERE (%s::varchar IS NULL OR status = %s)
        ORDER BY started_at DESC
        LIMIT %s OFFSET %s;
        """,
        (status_filter, status_filter, limit, offset),
    )

    return {
        "success": True,
        "grow_cycles": [
            {
                "grow_cycle_id": row[0],
                "cycle_name": row[1],
                "started_at": row[2].isoformat(),
                "completed_at": row[3].isoformat() if row[3] is not None else None,
                "status": row[4],
                "notes": row[5],
                "created_at": row[6].isoformat(),
                "updated_at": row[7].isoformat(),
            }
            for row in rows
        ],
    }


@router.get("/grow-cycles/active")
@limiter.limit("60/minute")
async def active_grow_cycle(
    request: Request,
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    return {
        "success": True,
        "grow_cycle": await get_active_grow_cycle(),
    }


@router.post("/grow-cycles", status_code=201)
@limiter.limit("10/minute")
async def create_grow_cycle_route(
    request: Request,
    body: GrowCycleCreate,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    _user_context(x_user_id, x_user_role, {"OPERATOR", "ADMIN"})

    try:
        cycle = await create_grow_cycle(
            cycle_name=body.cycle_name,
            notes=body.notes,
        )
    except ValueError as error:
        _raise_bad_request(error)

    return {"success": True, "grow_cycle": cycle}


@router.get("/grow-cycles/{grow_cycle_id}")
@limiter.limit("30/minute")
async def get_grow_cycle(
    request: Request,
    grow_cycle_id: int,
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    rows = await run_query(
        """
        SELECT
            grow_cycle_id,
            cycle_name,
            started_at,
            completed_at,
            status,
            notes,
            created_at,
            updated_at
        FROM grow_cycles
        WHERE grow_cycle_id = %s;
        """,
        (grow_cycle_id,),
    )

    if not rows:
        raise HTTPException(status_code=404, detail="Grow cycle not found")

    row = rows[0]

    return {
        "success": True,
        "grow_cycle": {
            "grow_cycle_id": row[0],
            "cycle_name": row[1],
            "started_at": row[2].isoformat(),
            "completed_at": row[3].isoformat() if row[3] is not None else None,
            "status": row[4],
            "notes": row[5],
            "created_at": row[6].isoformat(),
            "updated_at": row[7].isoformat(),
        },
    }


@router.patch("/grow-cycles/{grow_cycle_id}")
@limiter.limit("20/minute")
async def update_grow_cycle_route(
    request: Request,
    grow_cycle_id: int,
    body: GrowCycleUpdate,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    _user_context(x_user_id, x_user_role, {"OPERATOR", "ADMIN"})
    try:
        result = await update_grow_cycle(grow_cycle_id, body.cycle_name, body.notes)
    except ValueError as error:
        _raise_bad_request(error)
    return {"success": True, "grow_cycle": result}


@router.delete("/grow-cycles/{grow_cycle_id}")
@limiter.limit("10/minute")
async def delete_grow_cycle_route(
    request: Request,
    grow_cycle_id: int,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    _user_context(x_user_id, x_user_role, {"OPERATOR", "ADMIN"})
    if not await delete_grow_cycle(grow_cycle_id):
        raise HTTPException(status_code=404, detail="Grow cycle not found")
    return {"success": True, "deleted": True}


@router.post("/grow-cycles/{grow_cycle_id}/complete")
@limiter.limit("10/minute")
async def complete_grow_cycle_route(
    request: Request,
    grow_cycle_id: int,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    _user_context(x_user_id, x_user_role, {"OPERATOR", "ADMIN"})

    try:
        result = await complete_grow_cycle(grow_cycle_id)
    except ValueError as error:
        _raise_bad_request(error)

    return {"success": True, "grow_cycle": result}


@router.post("/grow-cycles/{grow_cycle_id}/cancel")
@limiter.limit("10/minute")
async def cancel_grow_cycle_route(
    request: Request,
    grow_cycle_id: int,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    _user_context(x_user_id, x_user_role, {"ADMIN"})

    try:
        result = await cancel_grow_cycle(grow_cycle_id)
    except ValueError as error:
        _raise_bad_request(error)

    return {"success": True, "grow_cycle": result}


@router.post("/grow-cycles/{grow_cycle_id}/harvests", status_code=201)
@limiter.limit("20/minute")
async def create_harvest(
    request: Request,
    grow_cycle_id: int,
    body: HarvestCreate,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    _user_context(x_user_id, x_user_role, {"OPERATOR", "ADMIN"})

    active = await get_active_grow_cycle()

    if active is None or active["grow_cycle_id"] != grow_cycle_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Harvests can only be recorded against the active grow cycle",
        )

    try:
        harvest = await record_harvest(
            harvest_weight_g=body.harvest_weight_g,
            plant_count_harvested=body.plant_count_harvested,
            quality_score=body.quality_score,
            notes=body.notes,
        )
    except ValueError as error:
        _raise_bad_request(error)

    return {"success": True, "harvest": harvest}


@router.get("/grow-cycles/{grow_cycle_id}/harvests")
@limiter.limit("30/minute")
async def list_cycle_harvests(
    request: Request,
    grow_cycle_id: int,
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    rows = await run_query(
        """
        SELECT
            harvest_id,
            grow_cycle_id,
            harvested_at,
            harvest_weight_g,
            plant_count_harvested,
            quality_score,
            notes,
            created_at
        FROM harvest_records
        WHERE grow_cycle_id = %s
        ORDER BY harvested_at DESC, harvest_id DESC;
        """,
        (grow_cycle_id,),
    )

    return {
        "success": True,
        "harvests": [
            {
                "harvest_id": row[0],
                "grow_cycle_id": row[1],
                "harvested_at": row[2].isoformat(),
                "harvest_weight_g": float(row[3]),
                "plant_count_harvested": row[4],
                "quality_score": float(row[5]) if row[5] is not None else None,
                "notes": row[6],
                "created_at": row[7].isoformat(),
            }
            for row in rows
        ],
    }


@router.get("/harvest/history")
@limiter.limit("30/minute")
async def harvest_history(
    request: Request,
    limit: int = Query(default=10, ge=1, le=50),
    include_active: bool = Query(default=False),
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    return {
        "success": True,
        "history": await get_harvest_data(
            limit=limit,
            include_active=include_active,
        ),
    }


@router.get("/task-executions/summary")
@limiter.limit("60/minute")
async def get_task_execution_summary(
    request: Request,
    hours: int = Query(default=24, ge=1, le=720),
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    rows = await run_query(
        """
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed,
            COUNT(*) FILTER (WHERE status IN ('FAILED', 'BLOCKED', 'SKIPPED')) AS failed,
            COUNT(*) FILTER (WHERE status IN ('PENDING', 'RUNNING', 'AWAITING_APPROVAL')) AS active
        FROM task_executions
        WHERE COALESCE(completed_at, started_at, created_at)
            >= NOW() - make_interval(hours => %s);
        """,
        (hours,),
    )

    row = rows[0] if rows else (0, 0, 0, 0)

    return {
        "success": True,
        "summary": {
            "hours": hours,
            "total": row[0],
            "completed": row[1],
            "failed": row[2],
            "active": row[3],
        },
    }


@router.get("/task-executions")
@limiter.limit("60/minute")
async def list_task_executions(
    request: Request,
    status_filter: str | None = Query(default=None, alias="status"),
    schedule_id: int | None = Query(default=None),
    task_action: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    rows = await run_query(
        """
        SELECT
            te.execution_id,
            te.schedule_id,
            te.scheduled_for,
            te.started_at,
            te.completed_at,
            te.status,
            te.result,
            te.error_message,
            te.created_at,
            fs.task_name,
            fs.task_action
        FROM task_executions te
        JOIN farm_schedule fs ON fs.schedule_id = te.schedule_id
        WHERE (%s::varchar IS NULL OR te.status = %s)
          AND (%s::bigint IS NULL OR te.schedule_id = %s)
          AND (%s::varchar IS NULL OR fs.task_action = %s)
        ORDER BY te.scheduled_for DESC, te.execution_id DESC
        LIMIT %s OFFSET %s;
        """,
        (
            status_filter,
            status_filter,
            schedule_id,
            schedule_id,
            task_action,
            task_action,
            limit,
            offset,
        ),
    )

    return {
        "success": True,
        "executions": [
            {
                "execution_id": row[0],
                "schedule_id": row[1],
                "scheduled_for": row[2].isoformat(),
                "started_at": row[3].isoformat() if row[3] is not None else None,
                "completed_at": row[4].isoformat() if row[4] is not None else None,
                "status": row[5],
                "result": row[6],
                "error_message": row[7],
                "created_at": row[8].isoformat(),
                "task_name": row[9],
                "task_action": row[10],
            }
            for row in rows
        ],
    }


@router.get("/task-executions/{execution_id}")
@limiter.limit("60/minute")
async def get_task_execution(
    request: Request,
    execution_id: int,
    authorization: str | None = Header(default=None),
):
    _require_webapp_token(authorization)

    rows = await run_query(
        """
        SELECT
            execution_id,
            schedule_id,
            scheduled_for,
            started_at,
            completed_at,
            status,
            result,
            error_message,
            created_at
        FROM task_executions
        WHERE execution_id = %s;
        """,
        (execution_id,),
    )

    if not rows:
        raise HTTPException(status_code=404, detail="Task execution not found")

    row = rows[0]

    return {
        "success": True,
        "execution": {
            "execution_id": row[0],
            "schedule_id": row[1],
            "scheduled_for": row[2].isoformat(),
            "started_at": row[3].isoformat() if row[3] is not None else None,
            "completed_at": row[4].isoformat() if row[4] is not None else None,
            "status": row[5],
            "result": row[6],
            "error_message": row[7],
            "created_at": row[8].isoformat(),
        },
    }


@router.get("/settings")
@limiter.limit("30/minute")
async def get_settings(
    request: Request,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    _user_context(x_user_id, x_user_role, {"ADMIN"})

    return {
        "success": True,
        "settings": await manage_settings(),
    }


@router.post("/settings/reload")
@limiter.limit("10/minute")
async def reload_system_settings(
    request: Request,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    _user_context(x_user_id, x_user_role, {"ADMIN"})

    return {
        "success": True,
        "settings": await manage_settings(),
    }


@router.post("/settings/reset")
@limiter.limit("10/minute")
async def reset_system_settings(
    request: Request,
    body: SettingsReset,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    _user_context(x_user_id, x_user_role, {"ADMIN"})
    try:
        result = await reset_settings(body.setting_key)
    except ValueError as error:
        _raise_bad_request(error)
    return {"success": True, "settings": result}


@router.patch("/settings/update")
@limiter.limit("10/minute")
async def update_system_settings(
    request: Request,
    body: SettingsUpdate,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_webapp_token(authorization)
    _user_context(x_user_id, x_user_role, {"ADMIN"})

    return {
        "success": True,
        "settings": await manage_settings(body.settings),
    }
