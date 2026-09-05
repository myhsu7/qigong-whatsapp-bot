UPDATE practice_methods SET name_en = CASE code
    WHEN 'dayan' THEN 'EnerQi Dayan'
    WHEN 'dayan_chu' THEN 'EnerQi Dayan Beginner'
    WHEN 'dayan_gao' THEN 'EnerQi Dayan Advanced'
    WHEN 'huichun' THEN 'YoungQi Huichun'
    WHEN 'huichun_chu' THEN 'YoungQi Huichun Beginner'
    WHEN 'huichun_zhong' THEN 'YoungQi Huichun Intermediate'
    WHEN 'wuqinxi' THEN 'Five Animal Frolics Wuqinxi'
    WHEN 'guishou' THEN 'Longevity Guishou'
    WHEN 'zhengyang' THEN 'VitalQi'
    WHEN 'huanghai' THEN 'FlowQi-Neuro'
    WHEN 'lotus' THEN 'LotusQi'
    WHEN 'heqi' THEN 'HarmonyQi'
    WHEN 'jinggong_zhoutian' THEN 'Circulatory Tranquility Technique Zhoutian'
    WHEN 'jinggong_qixing' THEN 'Bio-Alignment Technique Qixing'
    WHEN 'liuyin' THEN 'DetoxQi Liuyin'
    ELSE name_en
END
WHERE code IN (
    'dayan',
    'dayan_chu',
    'dayan_gao',
    'huichun',
    'huichun_chu',
    'huichun_zhong',
    'wuqinxi',
    'guishou',
    'zhengyang',
    'huanghai',
    'lotus',
    'heqi',
    'jinggong_zhoutian',
    'jinggong_qixing',
    'liuyin'
);

INSERT INTO practice_methods (
    code,
    name_zh,
    name_zh_cn,
    name_en,
    estimated_minutes,
    sort_order,
    method_type
) VALUES (
    'wujing_shenghua',
    '五靜昇華',
    '五静升华',
    'Stillness 5',
    20,
    105,
    'leaf'
);
