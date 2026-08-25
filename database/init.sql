
-- BASILIX LEAFY AI
-- PostgreSQL 18 + TimescaleDB + pgvector
-- Database initialization

BEGIN;

-- 1. EXTENSIONS

CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS vector;


-- 2. USERS

CREATE TABLE IF NOT EXISTS users (
    user_id BIGSERIAL PRIMARY KEY,

    google_sub VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500),

    role VARCHAR(50) NOT NULL DEFAULT 'user',

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    last_login_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email
    ON users (email);

CREATE INDEX IF NOT EXISTS idx_users_google_sub
    ON users (google_sub);

CREATE INDEX IF NOT EXISTS idx_users_role
    ON users (role);


-- ALLOWED USERS

CREATE TABLE IF NOT EXISTS allowed_users (
    allowed_user_id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    added_by BIGINT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_allowed_users_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id),

    CONSTRAINT fk_allowed_users_added_by
        FOREIGN KEY (added_by)
        REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_allowed_users_user_id
    ON allowed_users (user_id);

CREATE INDEX IF NOT EXISTS idx_allowed_users_email
    ON allowed_users (email);

CREATE INDEX IF NOT EXISTS idx_allowed_users_added_by
    ON allowed_users (added_by);



-- 4. SENSORS

CREATE TABLE IF NOT EXISTS sensors (
    sensor_id BIGSERIAL PRIMARY KEY,

    sensor_name VARCHAR(100) NOT NULL,
    sensor_type VARCHAR(50) NOT NULL,
    level INTEGER NOT NULL,
    sensor_no INTEGER NOT NULL,

    unit VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sensors_type
    ON sensors (sensor_type);

CREATE INDEX IF NOT EXISTS idx_sensors_status
    ON sensors (status);

CREATE INDEX IF NOT EXISTS idx_sensors_level
    ON sensors (level);

-- 5. CAMERAS

CREATE TABLE IF NOT EXISTS cameras (
    camera_id BIGSERIAL PRIMARY KEY,

    camera_name VARCHAR(100) NOT NULL,
    level_no INTEGER NOT NULL,

    ip_address VARCHAR(45),
    stream_url VARCHAR(500),
    rtsp_path VARCHAR(500),

    status VARCHAR(30) NOT NULL DEFAULT 'active',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cameras_status
    ON cameras (status);

CREATE INDEX IF NOT EXISTS idx_cameras_level_no
    ON cameras (level_no);


-- 6. SENSOR READINGS

CREATE TABLE IF NOT EXISTS sensor_readings (
    reading_id BIGSERIAL,
    sensor_id BIGINT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,

    value DOUBLE PRECISION,
    quality_status TEXT NOT NULL,

    PRIMARY KEY (reading_id, recorded_at),

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


-- 7. PLANT IMAGES

CREATE TABLE IF NOT EXISTS plant_images (
    image_id BIGSERIAL PRIMARY KEY,

    camera_id BIGINT NOT NULL,

    image_path VARCHAR(500) NOT NULL,
    thumbnail_path VARCHAR(500) NOT NULL,

    captured_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_plant_images_camera
        FOREIGN KEY (camera_id)
        REFERENCES cameras(camera_id)
);

CREATE INDEX IF NOT EXISTS idx_plant_images_camera_id
    ON plant_images (camera_id);

CREATE INDEX IF NOT EXISTS idx_plant_images_captured_at
    ON plant_images (captured_at DESC);



-- 8. AI RECOMMENDATIONS

CREATE TABLE IF NOT EXISTS ai_recommendations (
    recommendation_id BIGSERIAL PRIMARY KEY,

    recommendation_type VARCHAR(50) NOT NULL,
    recommendation_message TEXT NOT NULL,
    reason TEXT NOT NULL,

    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,

    status VARCHAR(30) NOT NULL DEFAULT 'pending',

    proposed_action JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    reviewed_by BIGINT,
    reviewed_at TIMESTAMPTZ,

    CONSTRAINT fk_ai_recommendations_reviewer
        FOREIGN KEY (reviewed_by)
        REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_status
    ON ai_recommendations (status);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_created
    ON ai_recommendations (created_at DESC);



-- 9. FARM SCHEDULE

CREATE TABLE IF NOT EXISTS farm_schedule (
    schedule_id BIGSERIAL PRIMARY KEY,

    task_name VARCHAR(100) NOT NULL,
    description TEXT,
    task_action VARCHAR(255) NOT NULL,

    level_no INTEGER NOT NULL,
    schedule_type VARCHAR(30) NOT NULL,

    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,

    interval_seconds INTEGER,

    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,

    target_value NUMERIC,
    unit VARCHAR(50),

    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,

    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',

    created_by BIGINT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_farm_schedule_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_farm_schedule_created_by
    ON farm_schedule (created_by);

CREATE INDEX IF NOT EXISTS idx_farm_schedule_next_run
    ON farm_schedule (next_run_at)
    WHERE enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_farm_schedule_status
    ON farm_schedule (status);


-- TASK EXECUTIONS

CREATE TABLE IF NOT EXISTS task_executions (
    execution_id BIGSERIAL PRIMARY KEY,

    schedule_id BIGINT NOT NULL,

    scheduled_for TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    status VARCHAR(30) NOT NULL,

    result JSONB,
    error_message TEXT,

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

-- 10. APPROVAL REQUESTS

CREATE TABLE IF NOT EXISTS approval_requests (
    approval_id BIGSERIAL PRIMARY KEY,

    action_type VARCHAR(100) NOT NULL,
    action_data JSONB NOT NULL,

    status VARCHAR(30) NOT NULL,

    requested_by BIGINT NOT NULL,
    reviewed_by BIGINT,

    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,

    review_note TEXT,

    CONSTRAINT fk_approval_requests_requested_by
        FOREIGN KEY (requested_by)
        REFERENCES users(user_id),

    CONSTRAINT fk_approval_requests_reviewed_by
        FOREIGN KEY (reviewed_by)
        REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_by
    ON approval_requests (requested_by);

CREATE INDEX IF NOT EXISTS idx_approval_requests_reviewed_by
    ON approval_requests (reviewed_by);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status
    ON approval_requests (status);

CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_at
    ON approval_requests (requested_at DESC);


-- 11. NOTIFICATIONS

CREATE TABLE IF NOT EXISTS notifications (
    notification_id BIGSERIAL PRIMARY KEY,

    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_type
    ON notifications (type);

CREATE INDEX IF NOT EXISTS idx_notifications_severity
    ON notifications (severity);

CREATE INDEX IF NOT EXISTS idx_notifications_created
    ON notifications (created_at DESC);


-- USER NOTIFICATIONS

CREATE TABLE IF NOT EXISTS user_notifications (
    notification_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,

    status VARCHAR(30) NOT NULL,
    read_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (notification_id, user_id),

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





-- 12. AUDIT LOGS

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
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user
    ON audit_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type
    ON audit_logs (action_type);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
    ON audit_logs (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
    ON audit_logs (created_at DESC);


-- RAG DOCUMENTS

CREATE TABLE IF NOT EXISTS rag_documents (
    document_id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    source VARCHAR(500),
    document_type VARCHAR(100),
    content_hash VARCHAR(128),
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


-- RAG DOCUMENT CHUNKS + EMBEDDINGS

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
