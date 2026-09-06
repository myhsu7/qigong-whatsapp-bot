ALTER TABLE whatsapp_checkin_logs
    ADD COLUMN checkin_timezone VARCHAR(64),
    ADD COLUMN checkin_timezone_inferred BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE whatsapp_checkin_logs l
SET checkin_timezone = u.reminder_timezone
FROM whatsapp_users u
WHERE u.wa_id = l.wa_id;
ALTER TABLE whatsapp_checkin_logs
    ALTER COLUMN checkin_timezone SET DEFAULT 'Asia/Taipei',
    ALTER COLUMN checkin_timezone SET NOT NULL;

CREATE TABLE whatsapp_job_state (
    job_name VARCHAR(64) PRIMARY KEY,
    last_completed_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE whatsapp_badges (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    emoji VARCHAR(32) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE whatsapp_user_badges (
    wa_id TEXT NOT NULL REFERENCES whatsapp_users(wa_id) ON DELETE CASCADE,
    badge_id VARCHAR(64) NOT NULL REFERENCES whatsapp_badges(id),
    earned_year INTEGER NOT NULL DEFAULT 0,
    trigger_checkin_log_id BIGINT REFERENCES whatsapp_checkin_logs(id) ON DELETE SET NULL,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (wa_id, badge_id, earned_year)
);

CREATE INDEX whatsapp_user_badges_unlocked_idx ON whatsapp_user_badges (wa_id, unlocked_at);

INSERT INTO whatsapp_badges (id, name, emoji, description, category) VALUES
    ('streak_3', '入門', '🥉', '連續打卡 3 天', 'STREAK'),
    ('streak_7', '小成', '🥈', '連續打卡 7 天', 'STREAK'),
    ('streak_21', '結丹', '🥇', '連續打卡 21 天', 'STREAK'),
    ('streak_100', '百日築基', '💎', '連續打卡 100 天', 'STREAK'),
    ('total_10', '初芽', '🌱', '總計打卡 10 天', 'TOTAL'),
    ('total_100', '大樹', '🌳', '總計打卡 100 天', 'TOTAL'),
    ('time_morning', '晨露', '🌅', '連續 5 天在早上 5:00 - 7:00 打卡', 'TIME_BASED'),
    ('time_night', '夜靜', '🦉', '連續 5 天在晚上 9:00 - 11:00 打卡', 'TIME_BASED'),
    ('seasonal_summer_27', '夏練三伏', '☀️', '於當年三伏期間完成全程打卡', 'SEASONAL'),
    ('seasonal_winter_27', '冬練三九', '❄️', '冬至後連續 27 天打卡並練習龜壽功', 'SEASONAL'),
    ('combo_dayan', '大雁雙修', '🦢', '同日完成大雁功全套，可於每年重新解鎖', 'COMBO'),
    ('combo_wuqinxi', '五禽圓滿', '🐅', '同日完成五禽戲全套，可於每年重新解鎖', 'COMBO'),
    ('combo_huichun', '回春雙式', '🌿', '同日完成回春功全套，可於每年重新解鎖', 'COMBO'),
    ('combo_guishou', '龜壽全式', '🐢', '同日完成龜壽功全套，可於每年重新解鎖', 'COMBO'),
    ('combo_zhengyang', '正陽雙照', '☀️', '同日完成正陽功全套，可於每年重新解鎖', 'COMBO'),
    ('combo_jinggong', '靜功圓滿', '🧘', '同日完成靜功全套三法，可於每年重新解鎖', 'COMBO'),
    ('method_dayan_7', '大雁功｜雁行入雲', '🪶', '累計練習「大雁功」7 天', 'METHOD_DAYS'),
    ('method_dayan_30', '大雁功｜雁翥沖虛', '🪽', '累計練習「大雁功」30 天', 'METHOD_DAYS'),
    ('method_dayan_100', '大雁功｜雁歸太和', '🌤️', '累計練習「大雁功」100 天', 'METHOD_DAYS'),
    ('method_wuqinxi_7', '五禽戲｜五行啟藏', '🕊️', '累計練習「五禽戲」7 天', 'METHOD_DAYS'),
    ('method_wuqinxi_30', '五禽戲｜五靈調炁', '🐾', '累計練習「五禽戲」30 天', 'METHOD_DAYS'),
    ('method_wuqinxi_100', '五禽戲｜五禽歸真', '🦚', '累計練習「五禽戲」100 天', 'METHOD_DAYS'),
    ('method_huichun_7', '回春功｜春芽復炁', '🌱', '累計練習「回春功」7 天', 'METHOD_DAYS'),
    ('method_huichun_30', '回春功｜春和養真', '🍃', '累計練習「回春功」30 天', 'METHOD_DAYS'),
    ('method_huichun_100', '回春功｜回春長青', '🌿', '累計練習「回春功」100 天', 'METHOD_DAYS'),
    ('method_guishou_7', '龜壽功｜龜息守一', '🐢', '累計練習「龜壽功」7 天', 'METHOD_DAYS'),
    ('method_guishou_30', '龜壽功｜龜鶴養元', '🪷', '累計練習「龜壽功」30 天', 'METHOD_DAYS'),
    ('method_guishou_100', '龜壽功｜壽炁綿長', '🏞️', '累計練習「龜壽功」100 天', 'METHOD_DAYS'),
    ('method_zhengyang_7', '正陽功｜朝陽啟炁', '🌅', '累計練習「正陽功」7 天', 'METHOD_DAYS'),
    ('method_zhengyang_30', '正陽功｜正陽養正', '☀️', '累計練習「正陽功」30 天', 'METHOD_DAYS'),
    ('method_zhengyang_100', '正陽功｜陽和充盈', '🌞', '累計練習「正陽功」100 天', 'METHOD_DAYS'),
    ('method_huanghai_7', '晃海功｜晃海聽潮', '🌊', '累計練習「神奇晃海功」7 天', 'METHOD_DAYS'),
    ('method_huanghai_30', '晃海功｜海定神凝', '🌌', '累計練習「神奇晃海功」30 天', 'METHOD_DAYS'),
    ('method_huanghai_100', '晃海功｜海天一炁', '🌐', '累計練習「神奇晃海功」100 天', 'METHOD_DAYS'),
    ('method_lotus_7', '蓮花養心法｜蓮心初照', '🪷', '累計練習「蓮花養心法」7 天', 'METHOD_DAYS'),
    ('method_lotus_30', '蓮花養心法｜蓮臺澄心', '💮', '累計練習「蓮花養心法」30 天', 'METHOD_DAYS'),
    ('method_lotus_100', '蓮花養心法｜蓮華見性', '🌺', '累計練習「蓮花養心法」100 天', 'METHOD_DAYS'),
    ('method_heqi_7', '和氣舒壓法｜和氣舒懷', '🍀', '累計練習「和氣舒壓法」7 天', 'METHOD_DAYS'),
    ('method_heqi_30', '和氣舒壓法｜和光同塵', '🌫️', '累計練習「和氣舒壓法」30 天', 'METHOD_DAYS'),
    ('method_heqi_100', '和氣舒壓法｜氣和神泰', '🌈', '累計練習「和氣舒壓法」100 天', 'METHOD_DAYS'),
    ('method_sanwo_7', '三窩功｜三窩聚炁', '🌀', '累計練習「三窩功」7 天', 'METHOD_DAYS'),
    ('method_sanwo_30', '三窩功｜三田歸元', '🫧', '累計練習「三窩功」30 天', 'METHOD_DAYS'),
    ('method_sanwo_100', '三窩功｜窩藏元和', '🪨', '累計練習「三窩功」100 天', 'METHOD_DAYS'),
    ('method_liuyin_7', '六音理臟法｜六音調藏', '🎵', '累計練習「六音理臟法」7 天', 'METHOD_DAYS'),
    ('method_liuyin_30', '六音理臟法｜六律和臟', '🎶', '累計練習「六音理臟法」30 天', 'METHOD_DAYS'),
    ('method_liuyin_100', '六音理臟法｜六炁周流', '🔔', '累計練習「六音理臟法」100 天', 'METHOD_DAYS'),
    ('method_jinggong_7', '靜功｜守靜入門', '🧘', '累計練習「靜功」7 天', 'METHOD_DAYS'),
    ('method_jinggong_30', '靜功｜澄心守一', '🪷', '累計練習「靜功」30 天', 'METHOD_DAYS'),
    ('method_jinggong_100', '靜功｜虛極靜篤', '🌌', '累計練習「靜功」100 天', 'METHOD_DAYS');
