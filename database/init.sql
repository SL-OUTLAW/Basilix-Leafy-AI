-- ============================================================
-- BASILIX LEAFY AI
-- PostgreSQL 18 + TimescaleDB + pgvector
-- Database initialization
-- ============================================================

BEGIN;

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS vector;


-- ============================================================
-- 2. USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    user_id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email
    ON users (email);

CREATE INDEX IF NOT EXISTS idx_users_role
    ON users (role);


-- ============================================================
-- 3. FARMS
-- ============================================================

CREATE TABLE IF NOT EXISTS farms (
    farm_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    farm_name VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_farms_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_farms_user_id
    ON farms (user_id);


-- ============================================================
-- 4. SENSORS
-- ============================================================

CREATE TABLE IF NOT EXISTS sensors (
    sensor_id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL,
    sensor_type VARCHAR(50) NOT NULL,
    unit VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_sensors_farm
        FOREIGN KEY (farm_id)
        REFERENCES farms(farm_id)
);

CREATE INDEX IF NOT EXISTS idx_sensors_farm_id
    ON sensors (farm_id);


-- ============================================================
-- 5. CAMERAS
-- ============================================================

CREATE TABLE IF NOT EXISTS cameras (
    camera_id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL,
    camera_type VARCHAR(100),
    location_description VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_cameras_farm
        FOREIGN KEY (farm_id)
        REFERENCES farms(farm_id)
);

CREATE INDEX IF NOT EXISTS idx_cameras_farm_id
    ON cameras (farm_id);


-- ============================================================
-- 6. SENSOR READINGS
--    TimescaleDB hypertable
-- ============================================================

CREATE TABLE IF NOT EXISTS sensor_readings (
    reading_id BIGSERIAL,
    sensor_id BIGINT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    value DOUBLE PRECISION,
    quality_status TEXT,

    PRIMARY KEY (reading_id, recorded_at)
);

SELECT create_hypertable(
    'public.sensor_readings',
    'recorded_at',
    if_not_exists => TRUE
);

ALTER TABLE sensor_readings
    ADD CONSTRAINT fk_sensor_readings_sensor
    FOREIGN KEY (sensor_id)
    REFERENCES sensors(sensor_id);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor_time
    ON sensor_readings (sensor_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_recorded_at
    ON sensor_readings (recorded_at DESC);


-- ============================================================
-- 7. PLANT IMAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS plant_images (
    image_id BIGSERIAL PRIMARY KEY,
    camera_id BIGINT,
    farm_id BIGINT NOT NULL,
    image_path TEXT NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    analysis_status VARCHAR(30) DEFAULT 'pending',

    CONSTRAINT fk_plant_images_camera
        FOREIGN KEY (camera_id)
        REFERENCES cameras(camera_id),

    CONSTRAINT fk_plant_images_farm
        FOREIGN KEY (farm_id)
        REFERENCES farms(farm_id)
);

CREATE INDEX IF NOT EXISTS idx_plant_images_camera_id
    ON plant_images (camera_id);

CREATE INDEX IF NOT EXISTS idx_plant_images_farm_id
    ON plant_images (farm_id);

CREATE INDEX IF NOT EXISTS idx_plant_images_captured_at
    ON plant_images (captured_at DESC);


-- ============================================================
-- 8. AI RECOMMENDATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_recommendations (
    recommendation_id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL,
    recommendation_type VARCHAR(50),
    message TEXT NOT NULL,
    risk_level VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by BIGINT,

    CONSTRAINT fk_ai_recommendations_farm
        FOREIGN KEY (farm_id)
        REFERENCES farms(farm_id),

    CONSTRAINT fk_ai_recommendations_reviewer
        FOREIGN KEY (reviewed_by)
        REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_farm
    ON ai_recommendations (farm_id);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_status
    ON ai_recommendations (status);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_risk
    ON ai_recommendations (risk_level);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_created
    ON ai_recommendations (created_at DESC);


-- ============================================================
-- 9. SCHEDULES
-- ============================================================

CREATE TABLE IF NOT EXISTS schedules (
    schedule_id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL,
    schedule_name VARCHAR(100) NOT NULL,
    description TEXT,

    schedule_type VARCHAR(20) NOT NULL DEFAULT 'once',
    recurrence_rule TEXT,
    timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',

    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ,

    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    risk_level VARCHAR(20),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_schedules_farm
        FOREIGN KEY (farm_id)
        REFERENCES farms(farm_id),

    CONSTRAINT schedules_type_check
        CHECK (
            schedule_type IN ('once', 'interval', 'cron')
        )
);

CREATE INDEX IF NOT EXISTS idx_schedules_farm_id
    ON schedules (farm_id);

CREATE INDEX IF NOT EXISTS idx_schedules_next_run
    ON schedules (next_run_at)
    WHERE enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_schedules_status
    ON schedules (status);

CREATE INDEX IF NOT EXISTS idx_schedules_risk_level
    ON schedules (risk_level);


-- ============================================================
-- 10. APPROVALS
-- ============================================================

CREATE TABLE IF NOT EXISTS approvals (
    approval_id BIGSERIAL PRIMARY KEY,
    schedule_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    comment TEXT,

    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_approvals_schedule
        FOREIGN KEY (schedule_id)
        REFERENCES schedules(schedule_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_approvals_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_approvals_schedule
    ON approvals (schedule_id);

CREATE INDEX IF NOT EXISTS idx_approvals_user
    ON approvals (user_id);

CREATE INDEX IF NOT EXISTS idx_approvals_status
    ON approvals (status);


-- ============================================================
-- 11. NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    notification_id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL,
    schedule_id BIGINT,

    notification_type VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ,

    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id),

    CONSTRAINT fk_notifications_schedule
        FOREIGN KEY (schedule_id)
        REFERENCES schedules(schedule_id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON notifications (user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_schedule
    ON notifications (schedule_id);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON notifications (user_id, is_read, created_at DESC);


-- ============================================================
-- 12. AUDIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id BIGSERIAL PRIMARY KEY,

    user_id BIGINT,
    farm_id BIGINT,

    action TEXT NOT NULL,
    action_type VARCHAR(100) NOT NULL,

    description JSON NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_audit_logs_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id),

    CONSTRAINT fk_audit_logs_farm
        FOREIGN KEY (farm_id)
        REFERENCES farms(farm_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user
    ON audit_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_farm
    ON audit_logs (farm_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type
    ON audit_logs (action_type);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
    ON audit_logs (created_at DESC);

-- ============================================================
-- RAG DOCUMENTS
-- ============================================================

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


-- ============================================================
-- RAG DOCUMENT CHUNKS + EMBEDDINGS
-- ============================================================

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
-- ============================================================
-- 13. FARM MONITORING VIEW
-- ============================================================

CREATE OR REPLACE VIEW farm_monitoring_summary AS
SELECT
    f.farm_name,
    s.sensor_type,
    sr.value,
    s.unit,
    sr.recorded_at,

    CASE
        WHEN s.sensor_type = 'Temperature'
             AND (sr.value < 20 OR sr.value > 30)
            THEN 'ALERT'

        WHEN s.sensor_type = 'pH'
             AND (sr.value < 5.5 OR sr.value > 7.0)
            THEN 'ALERT'

        WHEN s.sensor_type = 'Humidity'
             AND (sr.value < 50 OR sr.value > 80)
            THEN 'ALERT'

        ELSE 'OK'
    END AS sensor_status,

    CASE
        WHEN s.sensor_type = 'Temperature'
             AND (sr.value < 20 OR sr.value > 30)
            THEN
                'Check greenhouse temperature and increase ventilation or cooling.'

        WHEN s.sensor_type = 'pH'
             AND (sr.value < 5.5 OR sr.value > 7.0)
            THEN
                'Check soil pH and consider adjusting soil acidity.'

        WHEN s.sensor_type = 'Humidity'
             AND (sr.value < 50 OR sr.value > 80)
            THEN
                'Check irrigation and ventilation to bring humidity back to the normal range.'

        ELSE
            'No action required.'
    END AS recommended_action

FROM sensor_readings sr
JOIN sensors s
    ON sr.sensor_id = s.sensor_id
JOIN farms f
    ON s.farm_id = f.farm_id
WHERE sr.recorded_at = (
    SELECT MAX(sr2.recorded_at)
    FROM sensor_readings sr2
    WHERE sr2.sensor_id = sr.sensor_id
);


-- ============================================================
-- 14. FARM DASHBOARD FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION get_farm_dashboard()
RETURNS TABLE (
    total_sensors BIGINT,
    sensors_ok BIGINT,
    sensors_alert BIGINT,
    total_recommendations BIGINT,
    pending_recommendations BIGINT,
    reviewed_recommendations BIGINT
)
LANGUAGE SQL
AS $$
    SELECT
        (
            SELECT COUNT(*)
            FROM farm_monitoring_summary
        ),

        (
            SELECT COUNT(*)
            FROM farm_monitoring_summary
            WHERE sensor_status = 'OK'
        ),

        (
            SELECT COUNT(*)
            FROM farm_monitoring_summary
            WHERE sensor_status = 'ALERT'
        ),

        (
            SELECT COUNT(*)
            FROM ai_recommendations
        ),

        (
            SELECT COUNT(*)
            FROM ai_recommendations
            WHERE LOWER(status) = 'pending'
        ),

        (
            SELECT COUNT(*)
            FROM ai_recommendations
            WHERE LOWER(status) = 'reviewed'
        );
$$;


COMMIT;
