ALTER TABLE whatsapp_users
    ADD COLUMN language_selected BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing users were already served in Traditional Chinese before language selection existed.
UPDATE whatsapp_users SET language_selected = TRUE;

ALTER TABLE practice_methods
    ADD COLUMN name_zh_cn VARCHAR(255);

UPDATE practice_methods SET name_zh_cn = CASE code
    WHEN 'dayan' THEN '大雁功'
    WHEN 'dayan_chu' THEN '大雁初'
    WHEN 'dayan_gao' THEN '大雁高'
    WHEN 'wuqinxi' THEN '五禽戏'
    WHEN 'wuqinxi_he' THEN '鹤戏'
    WHEN 'wuqinxi_yuan' THEN '猿戏'
    WHEN 'wuqinxi_hu' THEN '虎戏'
    WHEN 'wuqinxi_xiong' THEN '熊戏'
    WHEN 'wuqinxi_lu' THEN '鹿戏'
    WHEN 'huichun' THEN '回春功'
    WHEN 'huichun_chu' THEN '回春初'
    WHEN 'huichun_zhong' THEN '回春中'
    WHEN 'guishou' THEN '龟寿功'
    WHEN 'guishou_bagua' THEN '八卦功'
    WHEN 'guishou_qiankun' THEN '乾坤功'
    WHEN 'guishou_fengxiang_guishuo' THEN '凤翔与龟缩'
    WHEN 'zhengyang' THEN '正阳功'
    WHEN 'zhengyang_morning' THEN '晨功'
    WHEN 'zhengyang_night' THEN '夜功'
    WHEN 'huanghai' THEN '神奇晃海功'
    WHEN 'lotus' THEN '莲花养心法'
    WHEN 'heqi' THEN '和气舒压法'
    WHEN 'sanwo' THEN '三窝功'
    WHEN 'liuyin' THEN '六音理脏法'
    WHEN 'jinggong' THEN '静功'
    WHEN 'jinggong_zhoutian' THEN '周天静功'
    WHEN 'jinggong_qixing' THEN '七星心法'
    WHEN 'jinggong_songjing' THEN '松静功'
    ELSE name_zh
END;

ALTER TABLE practice_methods
    ALTER COLUMN name_zh_cn SET NOT NULL;

ALTER TABLE whatsapp_users
    ADD CONSTRAINT whatsapp_users_language_code_check
    CHECK (language_code IN ('zh_TW', 'zh_CN', 'en'));
