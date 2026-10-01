BEGIN;

CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS vector;


CREATE TABLE sensors (
    sensor_id BIGSERIAL PRIMARY KEY,
    sensor_name VARCHAR(100) NOT NULL,
    sensor_type VARCHAR(50) NOT NULL,
    level_no INTEGER NOT NULL,
    sensor_no INTEGER NOT NULL,
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_sensors_level_no
        CHECK (
            level_no IN (
                0,
                1,
                2
            )
        ),

    CONSTRAINT uq_sensors_number
        UNIQUE (
            sensor_type,
            level_no,
            sensor_no
        )
);


CREATE INDEX idx_sensors_type
    ON sensors (
        sensor_type
    );

CREATE INDEX idx_sensors_status
    ON sensors (
        status
    );

CREATE INDEX idx_sensors_level_no
    ON sensors (
        level_no
    );


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
    );


CREATE TABLE cameras (
    camera_id BIGSERIAL PRIMARY KEY,
    camera_name VARCHAR(100) NOT NULL,
    level_no INTEGER NOT NULL,
    ip_address VARCHAR(45),
    stream_url VARCHAR(500),
    rtsp_path VARCHAR(500),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_cameras_level_no
        CHECK (
            level_no IN (
                1,
                2
            )
        )
);


CREATE INDEX idx_cameras_status
    ON cameras (
        status
    );

CREATE INDEX idx_cameras_level_no
    ON cameras (
        level_no
    );


CREATE TABLE sensor_readings (
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
        FOREIGN KEY (
            sensor_id
        )
        REFERENCES sensors (
            sensor_id
        )
);


SELECT create_hypertable(
    'public.sensor_readings',
    'recorded_at',
    if_not_exists => TRUE
);


CREATE INDEX idx_sensor_readings_sensor_time
    ON sensor_readings (
        sensor_id,
        recorded_at DESC
    );

CREATE INDEX idx_sensor_readings_recorded_at
    ON sensor_readings (
        recorded_at DESC
    );

CREATE INDEX idx_sensor_readings_quality
    ON sensor_readings (
        quality_status
    );


CREATE TABLE plant_images (
    image_id BIGSERIAL PRIMARY KEY,
    camera_id BIGINT NOT NULL,
    image_path VARCHAR(500) NOT NULL,
    thumbnail_path VARCHAR(500),
    captured_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_plant_images_camera
        FOREIGN KEY (
            camera_id
        )
        REFERENCES cameras (
            camera_id
        )
        ON DELETE CASCADE
);


CREATE INDEX idx_plant_images_camera_time
    ON plant_images (
        camera_id,
        captured_at DESC
    );

CREATE INDEX idx_plant_images_captured_at
    ON plant_images (
        captured_at DESC
    );


CREATE TABLE plant_image_analysis (
    analysis_id BIGSERIAL PRIMARY KEY,
    image_id BIGINT NOT NULL,
    model_name VARCHAR(100),
    analysis JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_plant_image_analysis_image
        FOREIGN KEY (
            image_id
        )
        REFERENCES plant_images (
            image_id
        )
        ON DELETE CASCADE
);


CREATE INDEX idx_plant_image_analysis_image
    ON plant_image_analysis (
        image_id
    );

CREATE INDEX idx_plant_image_analysis_created
    ON plant_image_analysis (
        created_at DESC
    );

CREATE INDEX idx_plant_image_analysis_data
    ON plant_image_analysis
    USING GIN (
        analysis
    );


CREATE TABLE ai_recommendations (
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


CREATE INDEX idx_ai_recommendations_status
    ON ai_recommendations (
        status
    );

CREATE INDEX idx_ai_recommendations_risk
    ON ai_recommendations (
        risk_level
    );

CREATE INDEX idx_ai_recommendations_level
    ON ai_recommendations (
        level_no
    );

CREATE INDEX idx_ai_recommendations_type
    ON ai_recommendations (
        recommendation_type
    );

CREATE INDEX idx_ai_recommendations_created
    ON ai_recommendations (
        created_at DESC
    );


CREATE TABLE farm_schedule (
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
    active_until_at TIMESTAMPTZ,
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


CREATE INDEX idx_farm_schedule_start_time
    ON farm_schedule (
        start_time
    );

CREATE INDEX idx_farm_schedule_level
    ON farm_schedule (
        level_no
    );

CREATE INDEX idx_farm_schedule_action
    ON farm_schedule (
        task_action
    );

CREATE INDEX idx_farm_schedule_next_run
    ON farm_schedule (
        next_run_at
    )
    WHERE enabled = TRUE;

CREATE INDEX idx_farm_schedule_active_until
    ON farm_schedule (
        active_until_at
    )
    WHERE active_until_at IS NOT NULL;


CREATE INDEX idx_farm_schedule_status
    ON farm_schedule (
        status
    );

CREATE INDEX idx_farm_schedule_enabled
    ON farm_schedule (
        enabled
    );


CREATE TABLE grow_cycles (
    grow_cycle_id BIGSERIAL PRIMARY KEY,
    cycle_name VARCHAR(150) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_grow_cycle_status
        CHECK (
            status IN (
                'ACTIVE',
                'COMPLETED',
                'CANCELLED'
            )
        )
);


CREATE UNIQUE INDEX uq_active_grow_cycle
    ON grow_cycles (
        status
    )
    WHERE status = 'ACTIVE';

CREATE INDEX idx_grow_cycles_started_at
    ON grow_cycles (
        started_at DESC
    );

CREATE INDEX idx_grow_cycles_completed_at
    ON grow_cycles (
        completed_at DESC
    );


CREATE TABLE grow_cycle_schedule_history (
    grow_cycle_schedule_id BIGSERIAL PRIMARY KEY,
    grow_cycle_id BIGINT NOT NULL,
    schedule_id BIGINT,
    task_name VARCHAR(100),
    description TEXT,
    task_action VARCHAR(100) NOT NULL,
    level_no INTEGER,
    start_time TIME,
    interval_seconds INTEGER,
    duration_seconds INTEGER,
    target_value NUMERIC,
    unit VARCHAR(50),
    enabled BOOLEAN NOT NULL,
    status VARCHAR(30),
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_grow_cycle_schedule_level_no
        CHECK (
            level_no IS NULL
            OR level_no IN (
                0,
                1,
                2
            )
        ),

    CONSTRAINT chk_grow_cycle_schedule_interval
        CHECK (
            interval_seconds IS NULL
            OR interval_seconds > 0
        ),

    CONSTRAINT chk_grow_cycle_schedule_duration
        CHECK (
            duration_seconds IS NULL
            OR duration_seconds > 0
        ),

    CONSTRAINT fk_grow_cycle_schedule_history_cycle
        FOREIGN KEY (
            grow_cycle_id
        )
        REFERENCES grow_cycles (
            grow_cycle_id
        )
        ON DELETE CASCADE,

    CONSTRAINT fk_grow_cycle_schedule_history_schedule
        FOREIGN KEY (
            schedule_id
        )
        REFERENCES farm_schedule (
            schedule_id
        )
        ON DELETE SET NULL
);


CREATE INDEX idx_grow_cycle_schedule_history_cycle
    ON grow_cycle_schedule_history (
        grow_cycle_id,
        valid_from
    );

CREATE INDEX idx_grow_cycle_schedule_history_schedule
    ON grow_cycle_schedule_history (
        schedule_id
    );

CREATE INDEX idx_grow_cycle_schedule_history_open
    ON grow_cycle_schedule_history (
        grow_cycle_id,
        schedule_id
    )
    WHERE valid_until IS NULL;


CREATE TABLE harvest_records (
    harvest_id BIGSERIAL PRIMARY KEY,
    grow_cycle_id BIGINT NOT NULL,
    harvested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    harvest_weight_g NUMERIC NOT NULL,
    plant_count_harvested INTEGER,
    quality_score NUMERIC,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_harvest_weight
        CHECK (
            harvest_weight_g >= 0
        ),

    CONSTRAINT chk_harvest_plant_count
        CHECK (
            plant_count_harvested IS NULL
            OR plant_count_harvested >= 0
        ),

    CONSTRAINT chk_harvest_quality
        CHECK (
            quality_score IS NULL
            OR (
                quality_score >= 0
                AND quality_score <= 10
            )
        ),

    CONSTRAINT fk_harvest_records_cycle
        FOREIGN KEY (
            grow_cycle_id
        )
        REFERENCES grow_cycles (
            grow_cycle_id
        )
        ON DELETE CASCADE
);


CREATE INDEX idx_harvest_records_cycle_time
    ON harvest_records (
        grow_cycle_id,
        harvested_at DESC
    );

CREATE INDEX idx_harvest_records_harvested_at
    ON harvest_records (
        harvested_at DESC
    );


CREATE TABLE task_executions (
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
        FOREIGN KEY (
            schedule_id
        )
        REFERENCES farm_schedule (
            schedule_id
        )
        ON DELETE CASCADE
);


CREATE INDEX idx_task_executions_schedule
    ON task_executions (
        schedule_id
    );

CREATE INDEX idx_task_executions_scheduled_for
    ON task_executions (
        scheduled_for DESC
    );

CREATE INDEX idx_task_executions_status
    ON task_executions (
        status
    );

CREATE INDEX idx_task_executions_running
    ON task_executions (
        schedule_id,
        status
    )
    WHERE status IN (
        'PENDING',
        'RUNNING'
    );


CREATE TABLE approval_requests (
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
        FOREIGN KEY (
            recommendation_id
        )
        REFERENCES ai_recommendations (
            recommendation_id
        )
        ON DELETE SET NULL
);


CREATE INDEX idx_approval_requests_recommendation
    ON approval_requests (
        recommendation_id
    );

CREATE INDEX idx_approval_requests_requested_by
    ON approval_requests (
        requested_by
    );

CREATE INDEX idx_approval_requests_reviewed_by
    ON approval_requests (
        reviewed_by
    );

CREATE INDEX idx_approval_requests_status
    ON approval_requests (
        status
    );

CREATE INDEX idx_approval_requests_requested_at
    ON approval_requests (
        requested_at DESC
    );


CREATE TABLE notifications (
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


CREATE INDEX idx_notifications_created
    ON notifications (
        created_at DESC
    );

CREATE INDEX idx_notifications_severity
    ON notifications (
        severity
    );

CREATE INDEX idx_notifications_status
    ON notifications (
        status
    );

CREATE INDEX idx_notifications_entity
    ON notifications (
        entity_type,
        entity_id
    );

CREATE INDEX idx_notifications_open
    ON notifications (
        created_at DESC
    )
    WHERE status = 'OPEN';


CREATE TABLE sensor_alert_state (
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
        FOREIGN KEY (
            sensor_id
        )
        REFERENCES sensors (
            sensor_id
        )
        ON DELETE CASCADE
);


CREATE INDEX idx_sensor_alert_state_level
    ON sensor_alert_state (
        alert_level
    );

CREATE INDEX idx_sensor_alert_state_updated
    ON sensor_alert_state (
        updated_at DESC
    );


CREATE TABLE audit_logs (
    log_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    action_type VARCHAR(100) NOT NULL,
    entity_id BIGINT,
    entity_type VARCHAR(100),
    description TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX idx_audit_logs_user
    ON audit_logs (
        user_id
    );

CREATE INDEX idx_audit_logs_action_type
    ON audit_logs (
        action_type
    );

CREATE INDEX idx_audit_logs_entity
    ON audit_logs (
        entity_type,
        entity_id
    );

CREATE INDEX idx_audit_logs_created
    ON audit_logs (
        created_at DESC
    );


CREATE TABLE rag_documents (
    document_id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    source VARCHAR(500),
    document_type VARCHAR(100),
    content_hash VARCHAR(128) UNIQUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX idx_rag_documents_source
    ON rag_documents (
        source
    );

CREATE INDEX idx_rag_documents_type
    ON rag_documents (
        document_type
    );

CREATE INDEX idx_rag_documents_metadata
    ON rag_documents
    USING GIN (
        metadata
    );


CREATE TABLE rag_document_chunks (
    chunk_id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding vector(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_rag_chunks_document
        FOREIGN KEY (
            document_id
        )
        REFERENCES rag_documents (
            document_id
        )
        ON DELETE CASCADE,

    CONSTRAINT uq_rag_document_chunk
        UNIQUE (
            document_id,
            chunk_index
        )
);


CREATE INDEX idx_rag_chunks_document
    ON rag_document_chunks (
        document_id
    );

CREATE INDEX idx_rag_chunks_metadata
    ON rag_document_chunks
    USING GIN (
        metadata
    );

CREATE INDEX idx_rag_chunks_embedding_hnsw
    ON rag_document_chunks
    USING hnsw (
        embedding vector_cosine_ops
    );


CREATE TABLE system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


INSERT INTO system_settings (
    setting_key,
    setting_value,
    updated_at
)
VALUES
(
    'scheduler',
    '{
        "polling_rate": 5
    }'::jsonb,
    '2026-09-20 16:21:59.619+10'::timestamptz
),
(
    'security',
    '{
        "ai_enabled": true,
        "emergency_stop": false,
        "sensor_check_interval_seconds": 5
    }'::jsonb,
    '2026-09-20 16:21:59.619+10'::timestamptz
),
(
    'risk',
    '{
        "DOSE_EC": "HIGH",
        "DOSE_PH": "HIGH",
        "SET_FAN": "LOW",
        "SET_LIGHTING": "LOW",
        "RUN_IRRIGATION": "HIGH",
        "CREATE_SCHEDULE": "LOW",
        "ENABLE_SCHEDULE": "LOW",
        "RUN_AI_ANALYSIS": "LOW",
        "UPDATE_SCHEDULE": "LOW",
        "DISABLE_SCHEDULE": "HIGH",
        "RUN_VISION_ANALYSIS": "LOW"
    }'::jsonb,
    '2026-09-20 16:21:59.619+10'::timestamptz
),
(
    'sensor_security_thresholds',
    '{
        "ec": {
            "enabled": true,
            "lower_limit": 1500,
            "upper_limit": 3000,
            "warning_distance": 250,
            "critical_distance": 100
        },
        "ph": {
            "enabled": true,
            "lower_limit": 5.5,
            "upper_limit": 6.5,
            "warning_distance": 0.3,
            "critical_distance": 0.1
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
        }
    }'::jsonb,
    '2026-09-20 16:21:59.619+10'::timestamptz
),
(
    'notifications',
    '{
        "global_delivery": true,
        "repeat_critical_notifications": false,
        "sensor_alert_cooldown_seconds": 300
    }'::jsonb,
    '2026-09-20 16:21:59.619+10'::timestamptz
),
(
    'vision',
    '{
        "polling_rate": 60
    }'::jsonb,
    '2026-09-28 06:42:49.471+10'::timestamptz
),
(
    'cameras',
    '{
        "polling_rate": 10
    }'::jsonb,
    '2026-09-20 16:21:59.619+10'::timestamptz
),
(
    'sensors',
    '{
        "polling_rate": 10
    }'::jsonb,
    '2026-09-20 16:21:59.619+10'::timestamptz
),
(
    'farm_controls',
    '{
        "outlet_mapping": {
            "fan": 5,
            "dose_ec": 6,
            "dose_ph": 3,
            "irrigation": 2,
            "lighting_level_1": 1,
            "lighting_level_2": 4
        }
    }'::jsonb,
    '2026-09-29 15:15:25.119+10'::timestamptz
),
(
    'dosing_ph',
    '{
        "enabled": true,
        "direction": "UP",
        "max_cycles": 12,
        "dose_seconds": 10,
        "settle_seconds": 300,
        "target_tolerance": 0.1,
        "max_total_dose_seconds": 120
    }'::jsonb,
    '2026-10-01 14:44:33.042+10'::timestamptz
),
(
    'dosing_ec',
    '{
        "enabled": true,
        "direction": "UP",
        "max_cycles": 12,
        "dose_seconds": 10,
        "settle_seconds": 300,
        "target_tolerance": 100,
        "max_total_dose_seconds": 120
    }'::jsonb,
    '2026-10-01 14:44:33.042+10'::timestamptz
);


COMMIT;