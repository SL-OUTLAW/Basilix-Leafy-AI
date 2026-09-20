CREATE DATABASE leafy_ai_backend;

\connect leafy_ai_backend
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

CREATE TABLE IF NOT EXISTS auth_sessions (
    session_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    remember_me BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_auth_sessions_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
    ON auth_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires
    ON auth_sessions (expires_at);

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
