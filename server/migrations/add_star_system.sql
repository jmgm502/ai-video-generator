-- 积分系统数据库迁移脚本（MySQL 5.7 兼容版）
-- 执行时间：2026-05-08
-- 适用数据库：xmdm_db

-- 1. 扩展 users 表，添加积分和邀请码相关字段
-- 注意：MySQL 5.7 不支持 IF NOT EXISTS，需要手动检查

-- 添加 stars_balance 字段
SET @dbname = DATABASE();
SET @tablename = 'users';
SET @columnname = 'stars_balance';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT DEFAULT 10 COMMENT ''星星余额'' AFTER updated_at')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 添加 invite_code 字段
SET @columnname = 'invite_code';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(20) UNIQUE COMMENT ''邀请码'' AFTER stars_balance')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 添加 invited_by 字段
SET @columnname = 'invited_by';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT NULL COMMENT ''邀请人ID'' AFTER invite_code')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 添加 invite_count 字段
SET @columnname = 'invite_count';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT DEFAULT 0 COMMENT ''邀请人数'' AFTER invited_by')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2. 为已有用户生成邀请码（基于用户ID的哈希）
UPDATE `users` 
SET `invite_code` = CONCAT('XM', UPPER(SUBSTRING(MD5(CONCAT(id, 'xmdm_invite_salt_2026')), 1, 8)))
WHERE `invite_code` IS NULL;

-- 3. 创建积分日志表
CREATE TABLE IF NOT EXISTS `star_logs` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL,
  `change_amount` INT(11) NOT NULL COMMENT '变动数量，正数为增加，负数为消耗',
  `balance_after` INT(11) NOT NULL COMMENT '变动后余额',
  `type` VARCHAR(30) NOT NULL COMMENT '类型：register/checkin/invite/recharge/bonus等',
  `description` VARCHAR(200) DEFAULT NULL COMMENT '描述',
  `related_id` INT(11) DEFAULT NULL COMMENT '关联记录ID（如订单号）',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='积分日志表';

-- 4. 创建签到记录表
CREATE TABLE IF NOT EXISTS `checkin_records` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL,
  `checkin_date` DATE NOT NULL COMMENT '签到日期',
  `continuous_days` INT(11) DEFAULT 1 COMMENT '连续签到天数',
  `stars_earned` INT(11) DEFAULT 2 COMMENT '获得星星数',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_date` (`user_id`, `checkin_date`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='签到记录表';

-- 5. 插入初始积分日志（为已有用户创建注册赠送记录）
INSERT INTO `star_logs` (`user_id`, `change_amount`, `balance_after`, `type`, `description`)
SELECT 
  `id` AS user_id,
  10 AS change_amount,
  COALESCE(`stars_balance`, 10) AS balance_after,
  'register' AS type,
  '注册赠送新手礼包' AS description
FROM `users`
WHERE `id` NOT IN (SELECT DISTINCT user_id FROM star_logs WHERE type = 'register');
