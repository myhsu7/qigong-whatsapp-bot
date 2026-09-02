CREATE TABLE whatsapp_users (
    wa_id TEXT PRIMARY KEY,
    profile_name VARCHAR(255),
    language_code VARCHAR(32) NOT NULL DEFAULT 'zh_TW',
    last_inbound_at TIMESTAMPTZ,
    reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_hour SMALLINT NOT NULL DEFAULT 20 CHECK (reminder_hour BETWEEN 0 AND 23),
    reminder_timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Taipei',
    reminder_opted_in_at TIMESTAMPTZ,
    reminder_opted_out_at TIMESTAMPTZ,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE practice_methods (
    id SERIAL PRIMARY KEY,
    code VARCHAR(64) UNIQUE NOT NULL,
    name_zh VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    estimated_minutes INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    parent_id INTEGER REFERENCES practice_methods(id),
    method_type VARCHAR(16) NOT NULL CHECK (method_type IN ('group', 'leaf')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE whatsapp_checkin_logs (
    id BIGSERIAL PRIMARY KEY,
    wa_id TEXT NOT NULL REFERENCES whatsapp_users(wa_id),
    checkin_date DATE NOT NULL,
    reflection_note TEXT,
    body_feeling_note TEXT,
    note TEXT,
    source VARCHAR(32) NOT NULL DEFAULT 'webapp',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (wa_id, checkin_date)
);

CREATE INDEX whatsapp_checkin_logs_date_idx ON whatsapp_checkin_logs (checkin_date);
CREATE INDEX whatsapp_checkin_logs_user_date_idx ON whatsapp_checkin_logs (wa_id, checkin_date DESC);

CREATE TABLE whatsapp_checkin_method_selections (
    checkin_log_id BIGINT NOT NULL REFERENCES whatsapp_checkin_logs(id) ON DELETE CASCADE,
    practice_method_id INTEGER NOT NULL REFERENCES practice_methods(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (checkin_log_id, practice_method_id)
);

CREATE INDEX whatsapp_method_selections_method_idx ON whatsapp_checkin_method_selections (practice_method_id);

CREATE TABLE whatsapp_webhook_inbox (
    id BIGSERIAL PRIMARY KEY,
    event_key TEXT UNIQUE NOT NULL,
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    claimed_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
);

CREATE INDEX whatsapp_webhook_pending_idx ON whatsapp_webhook_inbox (received_at) WHERE processed_at IS NULL;

CREATE TABLE whatsapp_inbound_messages (
    message_id TEXT PRIMARY KEY,
    inbox_id BIGINT REFERENCES whatsapp_webhook_inbox(id) ON DELETE SET NULL,
    wa_id TEXT NOT NULL REFERENCES whatsapp_users(wa_id),
    payload JSONB NOT NULL,
    claimed_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX whatsapp_inbound_pending_idx ON whatsapp_inbound_messages (received_at) WHERE processed_at IS NULL;

CREATE TABLE whatsapp_outbound_messages (
    id BIGSERIAL PRIMARY KEY,
    wa_id TEXT NOT NULL REFERENCES whatsapp_users(wa_id),
    message_type VARCHAR(32) NOT NULL,
    template_name VARCHAR(255),
    idempotency_key TEXT UNIQUE,
    meta_message_id TEXT UNIQUE,
    accepted_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error_code TEXT,
    error_details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE whatsapp_magic_links (
    id BIGSERIAL PRIMARY KEY,
    token_hash TEXT UNIQUE NOT NULL,
    wa_id TEXT NOT NULL REFERENCES whatsapp_users(wa_id),
    purpose VARCHAR(32) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX whatsapp_magic_links_expiry_idx ON whatsapp_magic_links (expires_at) WHERE consumed_at IS NULL;

CREATE TABLE whatsapp_web_sessions (
    session_hash TEXT PRIMARY KEY,
    wa_id TEXT NOT NULL REFERENCES whatsapp_users(wa_id),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX whatsapp_web_sessions_expiry_idx ON whatsapp_web_sessions (expires_at) WHERE revoked_at IS NULL;

CREATE TABLE whatsapp_reminder_deliveries (
    id BIGSERIAL PRIMARY KEY,
    wa_id TEXT NOT NULL REFERENCES whatsapp_users(wa_id),
    local_date DATE NOT NULL,
    reminder_kind VARCHAR(32) NOT NULL DEFAULT 'daily',
    template_name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    meta_message_id TEXT,
    error_details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (wa_id, local_date, reminder_kind)
);

CREATE INDEX whatsapp_users_reminder_idx ON whatsapp_users (reminder_hour) WHERE reminder_enabled = TRUE AND is_blocked = FALSE;

INSERT INTO practice_methods (code, name_zh, name_en, estimated_minutes, sort_order, method_type) VALUES
    ('dayan', '大雁功', 'Dayan Qigong', 20, 10, 'group'),
    ('wuqinxi', '五禽戲', 'Wuqinxi', 20, 20, 'group'),
    ('huichun', '回春功', 'Huichun Gong', 20, 30, 'group'),
    ('guishou', '龜壽功', 'Guishou Gong', 20, 40, 'group'),
    ('zhengyang', '正陽功', 'Zhengyang Gong', 20, 50, 'group'),
    ('huanghai', '神奇晃海功', 'Magic Swaying Sea Gong', 20, 60, 'leaf'),
    ('lotus', '蓮花養心法', 'Lotus Heart Nourishing Method', 20, 70, 'leaf'),
    ('heqi', '和氣舒壓法', 'Heqi Relaxation Method', 20, 80, 'leaf'),
    ('sanwo', '三窩功', 'Sanwo Gong', 20, 90, 'leaf'),
    ('liuyin', '六音理臟法', 'Liuyin Organ Tuning Method', 20, 100, 'leaf'),
    ('jinggong', '靜功', 'Quiet Practice', 20, 110, 'group');

INSERT INTO practice_methods (code, name_zh, name_en, estimated_minutes, sort_order, parent_id, method_type)
SELECT child.code, child.name_zh, child.name_en, 10, child.sort_order, parent.id, 'leaf'
FROM (VALUES
    ('dayan_chu', '大雁初', 'Dayan Form 1', 11, 'dayan'),
    ('dayan_gao', '大雁高', 'Dayan Form 2', 12, 'dayan'),
    ('wuqinxi_he', '鶴戲', 'Crane Form', 21, 'wuqinxi'),
    ('wuqinxi_yuan', '猿戲', 'Monkey Form', 22, 'wuqinxi'),
    ('wuqinxi_hu', '虎戲', 'Tiger Form', 23, 'wuqinxi'),
    ('wuqinxi_xiong', '熊戲', 'Bear Form', 24, 'wuqinxi'),
    ('wuqinxi_lu', '鹿戲', 'Deer Form', 25, 'wuqinxi'),
    ('huichun_chu', '回春初', 'Huichun Form 1', 31, 'huichun'),
    ('huichun_zhong', '回春中', 'Huichun Form 2', 32, 'huichun'),
    ('guishou_bagua', '八卦功', 'Bagua Practice', 41, 'guishou'),
    ('guishou_qiankun', '乾坤功', 'Qiankun Practice', 42, 'guishou'),
    ('guishou_fengxiang_guishuo', '鳳翔與龜縮', 'Phoenix and Turtle Form', 43, 'guishou'),
    ('zhengyang_morning', '晨功', 'Morning Practice', 51, 'zhengyang'),
    ('zhengyang_night', '夜功', 'Night Practice', 52, 'zhengyang'),
    ('jinggong_zhoutian', '周天靜功', 'Zhoutian Quiet Practice', 111, 'jinggong'),
    ('jinggong_qixing', '七星心法', 'Seven Star Method', 112, 'jinggong'),
    ('jinggong_songjing', '鬆靜功', 'Songjing Practice', 113, 'jinggong')
) AS child(code, name_zh, name_en, sort_order, parent_code)
JOIN practice_methods parent ON parent.code = child.parent_code;
