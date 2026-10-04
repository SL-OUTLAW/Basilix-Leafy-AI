SELECT 'CREATE DATABASE leafy_ai_backend OWNER leafy_ai'
WHERE NOT EXISTS (
    SELECT 1
    FROM pg_database
    WHERE datname = 'leafy_ai_backend'
)\gexec

\connect leafy_ai_backend

BEGIN;

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

CREATE INDEX IF NOT EXISTS idx_auth_sessions_active_user
    ON auth_sessions (user_id, expires_at)
    WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS feature_permissions (
    permission_key VARCHAR(100) PRIMARY KEY,
    access_level VARCHAR(30) NOT NULL DEFAULT 'ADMIN',
    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_feature_permissions_access
        CHECK (access_level IN ('ALL', 'OPERATOR', 'ADMIN'))
);

INSERT INTO feature_permissions (permission_key, access_level, description)
VALUES
    ('EMERGENCY_STOP', 'ADMIN', 'Activate emergency stop'),
    ('CLEAR_EMERGENCY_STOP', 'ADMIN', 'Clear emergency stop'),
    ('AI_TOGGLE', 'ADMIN', 'Enable or disable AI'),
    ('APPROVAL_REVIEW', 'ADMIN', 'Approve or reject protected actions'),
    ('MANUAL_CONTROLS', 'OPERATOR', 'Use manual farm controls'),
    ('DOSING_TARGETS', 'ADMIN', 'Set pH and EC dosing targets'),
    ('SCHEDULE_MANAGE', 'OPERATOR', 'Create, edit, enable or disable schedules'),
    ('GROW_CYCLE_MANAGE', 'OPERATOR', 'Manage grow cycles'),
    ('HARVEST_RECORD', 'OPERATOR', 'Record harvest data'),
    ('SETTINGS_MANAGE', 'ADMIN', 'Edit Engine settings')
ON CONFLICT (permission_key) DO NOTHING;

COMMIT;
