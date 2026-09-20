BEGIN;

CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS vector;


CREATE TABLE IF NOT EXISTS sensors (
    sensor_id BIGSERIAL PRIMARY KEY,
    sensor_name VARCHAR(100) NOT NULL,
    sensor_type VARCHAR(50) NOT NULL,
    level_no INTEGER NOT NULL,
    sensor_no INTEGER NOT NULL,
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_sensors_level_no
        CHECK (level_no IN (0, 1, 2)),

    CONSTRAINT uq_sensors_number
        UNIQUE (
            sensor_type,
            level_no,
            sensor_no
        )
);

CREATE INDEX IF NOT EXISTS idx_sensors_type
    ON sensors (sensor_type);

CREATE INDEX IF NOT EXISTS idx_sensors_status
    ON sensors (status);

CREATE INDEX IF NOT EXISTS idx_sensors_level_no
    ON sensors (level_no);


INSERT INTO sensors (
    sensor_name,
    sensor_type,
    level_no,
    sensor_no,
    unit,
    status
)
VALUES
    (
        'WaterSensors pH',
        'ph',
        0,
        1,
        'pH',
        'ACTIVE'
    ),
    (
        'WaterSensors EC',
        'ec',
        0,
        1,
        'uS/cm',
        'ACTIVE'
    ),
    (
        'WaterSensors Water Temperature',
        'water_temperature',
        0,
        1,
        'degC',
        'ACTIVE'
    ),
    (
        'Ambient Temperature Sensor',
        'ambient_temperature',
        0,
        1,
        'degC',
        'ACTIVE'
    ),
    (
        'Humidity Sensor',
        'humidity',
        0,
        1,
        '%',
        'ACTIVE'
    ),
    (
        'Dew Point Sensor',
        'dew_point',
        0,
        1,
        'degC',
        'ACTIVE'
    ),
    (
        'Water Level Sensor',
        'water_level',
        0,
        1,
        'cm',
        'ACTIVE'
    )
ON CONFLICT (
    sensor_type,
    level_no,
    sensor_no
)
DO UPDATE SET
    sensor_name = EXCLUDED.sensor_name,
    unit = EXCLUDED.unit,
    status = EXCLUDED.status;


CREATE TABLE IF NOT EXISTS cameras (
    camera_id BIGSERIAL PRIMARY KEY,
    camera_name VARCHAR(100) NOT NULL,
    level_no INTEGER NOT NULL,
    ip_address VARCHAR(45),
    stream_url VARCHAR(500),
    rtsp_path VARCHAR(500),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_cameras_level_no
        CHECK (level_no IN (1, 2))
);

CREATE INDEX IF NOT EXISTS idx_cameras_status
    ON cameras (status);

CREATE INDEX IF NOT EXISTS idx_cameras_level_no
    ON cameras (level_no);


CREATE TABLE IF NOT EXISTS sensor_readings (
    reading_id BIGSERIAL,
    sensor_id BIGINT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    quality_status VARCHAR(20) NOT NULL,

    PRIMARY KEY (
        reading_id,
        recorded_at
    ),

    CONSTRAINT chk_sensor_readings_quality
        CHECK (
            quality_status IN (
                'VALID',
                'SUSPECT',
                'INVALID'
            )
        ),

    CONSTRAINT fk_sensor_readings_sensor
        FOREIGN KEY (sensor_id)
        REFERENCES sensors(sensor_id)
);

SELECT create_hypertable(
    'public.sensor_readings',
    'recorded_at',
    if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor_time
    ON sensor_readings (
        sensor_id,
        recorded_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_sensor_readings_recorded_at
    ON sensor_readings (
        recorded_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_sensor_readings_quality
    ON sensor_readings (
        quality_status
    );


CREATE TABLE IF NOT EXISTS plant_images (
    image_id BIGSERIAL PRIMARY KEY,
    camera_id BIGINT NOT NULL,
    image_path VARCHAR(500) NOT NULL,
    thumbnail_path VARCHAR(500),
    captured_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_plant_images_camera
        FOREIGN KEY (camera_id)
        REFERENCES cameras(camera_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_plant_images_camera_time
    ON plant_images (
        camera_id,
        captured_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_plant_images_captured_at
    ON plant_images (
        captured_at DESC
    );


CREATE TABLE IF NOT EXISTS plant_image_analysis (
    analysis_id BIGSERIAL PRIMARY KEY,
    image_id BIGINT NOT NULL,
    model_name VARCHAR(100),
    analysis JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_plant_image_analysis_image
        FOREIGN KEY (image_id)
        REFERENCES plant_images(image_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_plant_image_analysis_image
    ON plant_image_analysis (
        image_id
    );

CREATE INDEX IF NOT EXISTS idx_plant_image_analysis_created
    ON plant_image_analysis (
        created_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_plant_image_analysis_data
    ON plant_image_analysis
    USING GIN (
        analysis
    );


CREATE TABLE IF NOT EXISTS ai_recommendations (
    recommendation_id BIGSERIAL PRIMARY KEY,
    recommendation_type VARCHAR(50) NOT NULL,
    level_no INTEGER NOT NULL,
    recommendation_message TEXT NOT NULL,
    recommendation_reason TEXT NOT NULL,
    evidence JSONB,
    risk_level VARCHAR(20),
    requires_approval BOOLEAN,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    proposed_action JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_by BIGINT,
    reviewed_at TIMESTAMPTZ,

    CONSTRAINT chk_ai_recommendations_level_no
        CHECK (
            level_no IN (
                0,
                1,
                2
            )
        ),

    CONSTRAINT chk_ai_recommendations_risk_level
        CHECK (
            risk_level IS NULL
            OR risk_level IN (
                'LOW',
                'HIGH'
            )
        ),

    CONSTRAINT chk_ai_recommendations_status
        CHECK (
            status IN (
                'PENDING',
                'APPROVED',
                'REJECTED'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_status
    ON ai_recommendations (
        status
    );

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_risk
    ON ai_recommendations (
        risk_level
    );

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_level
    ON ai_recommendations (
        level_no
    );

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_type
    ON ai_recommendations (
        recommendation_type
    );

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_created
    ON ai_recommendations (
        created_at DESC
    );


CREATE TABLE IF NOT EXISTS farm_schedule (
    schedule_id BIGSERIAL PRIMARY KEY,
    task_name VARCHAR(100) NOT NULL,
    description TEXT,
    task_action VARCHAR(100) NOT NULL,
    level_no INTEGER NOT NULL,
    start_time TIME NOT NULL,
    interval_seconds INTEGER,
    duration_seconds INTEGER,
    target_value NUMERIC,
    unit VARCHAR(50),
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_by BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_farm_schedule_level_no
        CHECK (
            level_no IN (
                0,
                1,
                2
            )
        ),

    CONSTRAINT chk_farm_schedule_interval
        CHECK (
            interval_seconds IS NULL
            OR interval_seconds > 0
        ),

    CONSTRAINT chk_farm_schedule_duration
        CHECK (
            duration_seconds IS NULL
            OR duration_seconds > 0
        ),

    CONSTRAINT chk_farm_schedule_status
        CHECK (
            status IN (
                'ACTIVE',
                'ERROR'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_farm_schedule_start_time
    ON farm_schedule (
        start_time
    );

CREATE INDEX IF NOT EXISTS idx_farm_schedule_level
    ON farm_schedule (
        level_no
    );

CREATE INDEX IF NOT EXISTS idx_farm_schedule_action
    ON farm_schedule (
        task_action
    );

CREATE INDEX IF NOT EXISTS idx_farm_schedule_next_run
    ON farm_schedule (
        next_run_at
    )
    WHERE enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_farm_schedule_status
    ON farm_schedule (
        status
    );

CREATE INDEX IF NOT EXISTS idx_farm_schedule_enabled
    ON farm_schedule (
        enabled
    );


CREATE TABLE IF NOT EXISTS task_executions (
    execution_id BIGSERIAL PRIMARY KEY,
    schedule_id BIGINT NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL,
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_task_executions_status
        CHECK (
            status IN (
                'PENDING',
                'RUNNING',
                'COMPLETED',
                'FAILED',
                'SKIPPED',
                'BLOCKED',
                'AWAITING_APPROVAL'
            )
        ),

    CONSTRAINT fk_task_executions_schedule
        FOREIGN KEY (schedule_id)
        REFERENCES farm_schedule(schedule_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_executions_schedule
    ON task_executions (
        schedule_id
    );

CREATE INDEX IF NOT EXISTS idx_task_executions_scheduled_for
    ON task_executions (
        scheduled_for DESC
    );

CREATE INDEX IF NOT EXISTS idx_task_executions_status
    ON task_executions (
        status
    );

CREATE INDEX IF NOT EXISTS idx_task_executions_running
    ON task_executions (
        schedule_id,
        status
    )
    WHERE status IN (
        'PENDING',
        'RUNNING'
    );


CREATE TABLE IF NOT EXISTS approval_requests (
    approval_id BIGSERIAL PRIMARY KEY,
    recommendation_id BIGINT,
    action_type VARCHAR(100) NOT NULL,
    action_data JSONB NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    requested_by BIGINT,
    reviewed_by BIGINT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,

    CONSTRAINT chk_approval_requests_risk_level
        CHECK (
            risk_level IN (
                'LOW',
                'HIGH'
            )
        ),

    CONSTRAINT chk_approval_requests_status
        CHECK (
            status IN (
                'PENDING',
                'APPROVED',
                'REJECTED'
            )
        ),

    CONSTRAINT fk_approval_requests_recommendation
        FOREIGN KEY (recommendation_id)
        REFERENCES ai_recommendations(recommendation_id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_recommendation
    ON approval_requests (
        recommendation_id
    );

CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_by
    ON approval_requests (
        requested_by
    );

CREATE INDEX IF NOT EXISTS idx_approval_requests_reviewed_by
    ON approval_requests (
        reviewed_by
    );

CREATE INDEX IF NOT EXISTS idx_approval_requests_status
    ON approval_requests (
        status
    );

CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_at
    ON approval_requests (
        requested_at DESC
    );


CREATE TABLE IF NOT EXISTS notifications (
    notification_id BIGSERIAL PRIMARY KEY,
    notification_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(100),
    entity_id BIGINT,
    metadata JSONB,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,

    CONSTRAINT chk_notifications_severity
        CHECK (
            severity IN (
                'INFO',
                'WARN',
                'CRITICAL'
            )
        ),

    CONSTRAINT chk_notifications_status
        CHECK (
            status IN (
                'OPEN',
                'RESOLVED'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_notifications_created
    ON notifications (
        created_at DESC
    );

CREATE INDEX IF NOT EXISTS idx_notifications_severity
    ON notifications (
        severity
    );

CREATE INDEX IF NOT EXISTS idx_notifications_status
    ON notifications (
        status
    );

CREATE INDEX IF NOT EXISTS idx_notifications_entity
    ON notifications (
        entity_type,
        entity_id
    );

CREATE INDEX IF NOT EXISTS idx_notifications_open
    ON notifications (
        created_at DESC
    )
    WHERE status = 'OPEN';


CREATE TABLE IF NOT EXISTS sensor_alert_state (
    sensor_id BIGINT PRIMARY KEY,
    alert_level VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    last_value DOUBLE PRECISION,
    last_quality_status VARCHAR(20),
    last_checked_at TIMESTAMPTZ,
    last_notification_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_sensor_alert_state_level
        CHECK (
            alert_level IN (
                'NORMAL',
                'WARN',
                'CRITICAL'
            )
        ),

    CONSTRAINT chk_sensor_alert_state_quality
        CHECK (
            last_quality_status IS NULL
            OR last_quality_status IN (
                'VALID',
                'SUSPECT',
                'INVALID'
            )
        ),

    CONSTRAINT fk_sensor_alert_state_sensor
        FOREIGN KEY (sensor_id)
        REFERENCES sensors(sensor_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sensor_alert_state_level
    ON sensor_alert_state (
        alert_level
    );

CREATE INDEX IF NOT EXISTS idx_sensor_alert_state_updated
    ON sensor_alert_state (
        updated_at DESC
    );


CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


INSERT INTO system_settings (
    setting_key,
    setting_value
)
VALUES
(
    'scheduler',
    '{
        "polling_rate": 5
    }'::jsonb
),
(
    'security',
    '{
        "sensor_check_interval_seconds": 5,
        "emergency_stop": false,
        "ai_enabled": true
    }'::jsonb
),
(
    'risk',
    '{
        "RUN_IRRIGATION": "HIGH",
        "SET_LIGHTING": "LOW",
        "SET_FAN": "LOW",
        "DOSE_PH": "HIGH",
        "DOSE_EC": "HIGH",
        "CREATE_SCHEDULE": "LOW",
        "UPDATE_SCHEDULE": "LOW",
        "ENABLE_SCHEDULE": "LOW",
        "DISABLE_SCHEDULE": "HIGH",
        "RUN_VISION_ANALYSIS": "LOW",
        "RUN_AI_ANALYSIS": "LOW"
    }'::jsonb
),
(
    'sensor_security_thresholds',
    '{
        "ph": {
            "enabled": true,
            "lower_limit": 5.5,
            "upper_limit": 6.5,
            "warning_distance": 0.3,
            "critical_distance": 0.1
        },
        "ec": {
            "enabled": true,
            "lower_limit": 1500,
            "upper_limit": 3000,
            "warning_distance": 250,
            "critical_distance": 100
        },
        "water_temperature": {
            "enabled": true,
            "lower_limit": 18,
            "upper_limit": 28,
            "warning_distance": 2,
            "critical_distance": 0.5
        },
        "ambient_temperature": {
            "enabled": true,
            "lower_limit": 15,
            "upper_limit": 32,
            "warning_distance": 3,
            "critical_distance": 1
        },
        "humidity": {
            "enabled": true,
            "lower_limit": 40,
            "upper_limit": 80,
            "warning_distance": 5,
            "critical_distance": 2
        },
        "dew_point": {
            "enabled": false,
            "lower_limit": 5,
            "upper_limit": 25,
            "warning_distance": 3,
            "critical_distance": 1
        },
        "water_level": {
            "enabled": true,
            "lower_limit": 20,
            "upper_limit": 100,
            "warning_distance": 10,
            "critical_distance": 5
        }
    }'::jsonb
),
(
    'notifications',
    '{
        "sensor_alert_cooldown_seconds": 300,
        "repeat_critical_notifications": false,
        "global_delivery": true
    }'::jsonb
)
ON CONFLICT (
    setting_key
)
DO UPDATE SET
    setting_value = EXCLUDED.setting_value;


COMMIT;