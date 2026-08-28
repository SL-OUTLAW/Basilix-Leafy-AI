BEGIN;

CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
    user_id BIGSERIAL PRIMARY KEY,
    google_sub VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500),
    role VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_users_role
        CHECK (role IN ('OPERATOR', 'ADMIN'))
);

CREATE INDEX IF NOT EXISTS idx_users_email
    ON users (email);

CREATE INDEX IF NOT EXISTS idx_users_google_sub
    ON users (google_sub);

CREATE INDEX IF NOT EXISTS idx_users_role
    ON users (role);


CREATE TABLE IF NOT EXISTS allowed_users (
    allowed_user_id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    added_by BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_allowed_users_role
        CHECK (role IN ('OPERATOR', 'ADMIN')),

    CONSTRAINT fk_allowed_users_added_by
        FOREIGN KEY (added_by)
        REFERENCES users(user_id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_allowed_users_email
    ON allowed_users (email);

CREATE INDEX IF NOT EXISTS idx_allowed_users_added_by
    ON allowed_users (added_by);

CREATE INDEX IF NOT EXISTS idx_allowed_users_enabled
    ON allowed_users (enabled);


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
        UNIQUE (sensor_type, level_no, sensor_no)
);

CREATE INDEX IF NOT EXISTS idx_sensors_type
    ON sensors (sensor_type);

CREATE INDEX IF NOT EXISTS idx_sensors_status
    ON sensors (status);

CREATE INDEX IF NOT EXISTS idx_sensors_level_no
    ON sensors (level_no);


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

    PRIMARY KEY (reading_id, recorded_at),

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
    ON sensor_readings (sensor_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_recorded_at
    ON sensor_readings (recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_quality
    ON sensor_readings (quality_status);


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
    ON plant_images (camera_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_plant_images_captured_at
    ON plant_images (captured_at DESC);


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
    ON plant_image_analysis (image_id);

CREATE INDEX IF NOT EXISTS idx_plant_image_analysis_created
    ON plant_image_analysis (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plant_image_analysis_data
    ON plant_image_analysis
    USING GIN (analysis);


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
        CHECK (level_no IN (0, 1, 2)),

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
        ),

    CONSTRAINT fk_ai_recommendations_reviewer
        FOREIGN KEY (reviewed_by)
        REFERENCES users(user_id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_status
    ON ai_recommendations (status);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_risk
    ON ai_recommendations (risk_level);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_level
    ON ai_recommendations (level_no);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_type
    ON ai_recommendations (recommendation_type);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_created
    ON ai_recommendations (created_at DESC);


CREATE TABLE IF NOT EXISTS farm_schedule (
    schedule_id BIGSERIAL PRIMARY KEY,
    task_name VARCHAR(100) NOT NULL,
    description TEXT,
    task_action VARCHAR(100) NOT NULL,
    level_no INTEGER NOT NULL,
    start_time TIME NOT NULL,
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
        CHECK (level_no IN (0, 1, 2)),

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
        ),

    CONSTRAINT fk_farm_schedule_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(user_id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_farm_schedule_start_time
    ON farm_schedule (start_time);

CREATE INDEX IF NOT EXISTS idx_farm_schedule_level
    ON farm_schedule (level_no);

CREATE INDEX IF NOT EXISTS idx_farm_schedule_action
    ON farm_schedule (task_action);

CREATE INDEX IF NOT EXISTS idx_farm_schedule_next_run
    ON farm_schedule (next_run_at)
    WHERE enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_farm_schedule_status
    ON farm_schedule (status);

CREATE INDEX IF NOT EXISTS idx_farm_schedule_enabled
    ON farm_schedule (enabled);


CREATE TABLE IF NOT EXISTS task_executions (
    execution_id BIGSERIAL PRIMARY KEY,
    schedule_id BIGINT NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL,
    result JSONB,
    error_message TEXT,

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
    ON task_executions (schedule_id);

CREATE INDEX IF NOT EXISTS idx_task_executions_scheduled_for
    ON task_executions (scheduled_for DESC);

CREATE INDEX IF NOT EXISTS idx_task_executions_status
    ON task_executions (status);


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
        ON DELETE SET NULL,

    CONSTRAINT fk_approval_requests_requested_by
        FOREIGN KEY (requested_by)
        REFERENCES users(user_id)
        ON DELETE SET NULL,

    CONSTRAINT fk_approval_requests_reviewed_by
        FOREIGN KEY (reviewed_by)
        REFERENCES users(user_id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_recommendation
    ON approval_requests (recommendation_id);

CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_by
    ON approval_requests (requested_by);

CREATE INDEX IF NOT EXISTS idx_approval_requests_reviewed_by
    ON approval_requests (reviewed_by);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status
    ON approval_requests (status);

CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_at
    ON approval_requests (requested_at DESC);


CREATE TABLE IF NOT EXISTS notifications (
    notification_id BIGSERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_notifications_type
        CHECK (
            type IN (
                'SENSOR_ALERT',
                'SENSOR_OFFLINE',
                'CAMERA_ALERT',
                'CAMERA_OFFLINE',
                'TASK_COMPLETED',
                'TASK_FAILED',
                'AI_RECOMMENDATION',
                'APPROVAL_REQUIRED',
                'APPROVAL_APPROVED',
                'APPROVAL_REJECTED',
                'SYSTEM'
            )
        ),

    CONSTRAINT chk_notifications_severity
        CHECK (
            severity IN (
                'INFO',
                'WARNING',
                'CRITICAL'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_notifications_type
    ON notifications (type);

CREATE INDEX IF NOT EXISTS idx_notifications_severity
    ON notifications (severity);

CREATE INDEX IF NOT EXISTS idx_notifications_created
    ON notifications (created_at DESC);


CREATE TABLE IF NOT EXISTS user_notifications (
    notification_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'UNREAD',
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (notification_id, user_id),

    CONSTRAINT chk_user_notifications_status
        CHECK (
            status IN (
                'UNREAD',
                'READ'
            )
        ),

    CONSTRAINT fk_user_notifications_notification
        FOREIGN KEY (notification_id)
        REFERENCES notifications(notification_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_notifications_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user
    ON user_notifications (user_id);

CREATE INDEX IF NOT EXISTS idx_user_notifications_status
    ON user_notifications (status);

CREATE INDEX IF NOT EXISTS idx_user_notifications_created
    ON user_notifications (created_at DESC);


CREATE TABLE IF NOT EXISTS audit_logs (
    log_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    action_type VARCHAR(100) NOT NULL,
    entity_id BIGINT,
    entity_type VARCHAR(100),
    description TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_audit_logs_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user
    ON audit_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type
    ON audit_logs (action_type);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
    ON audit_logs (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
    ON audit_logs (created_at DESC);


CREATE TABLE IF NOT EXISTS rag_documents (
    document_id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    source VARCHAR(500),
    document_type VARCHAR(100),
    content_hash VARCHAR(128) UNIQUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_documents_source
    ON rag_documents (source);

CREATE INDEX IF NOT EXISTS idx_rag_documents_type
    ON rag_documents (document_type);

CREATE INDEX IF NOT EXISTS idx_rag_documents_metadata
    ON rag_documents
    USING GIN (metadata);


CREATE TABLE IF NOT EXISTS rag_document_chunks (
    chunk_id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding vector(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_rag_chunks_document
        FOREIGN KEY (document_id)
        REFERENCES rag_documents(document_id)
        ON DELETE CASCADE,

    CONSTRAINT uq_rag_document_chunk
        UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_document
    ON rag_document_chunks (document_id);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_metadata
    ON rag_document_chunks
    USING GIN (metadata);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_hnsw
    ON rag_document_chunks
    USING hnsw (embedding vector_cosine_ops);

COMMIT;