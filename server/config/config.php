<?php
define('DB_HOST', 'localhost');
define('DB_NAME', 'xmdm_db');
define('DB_USER', 'xmdm_db');
define('DB_PASS', 'iatKSeExdC2b4TdX');
define('DB_CHARSET', 'utf8mb4');

define('JWT_SECRET', 'xmdm-super-secret-jwt-key-2024-production');
define('JWT_EXPIRE', 604800);

define('WECHAT_APPID', 'wx49afa7a807d406b4');
define('WECHAT_MCHID', '1701660804');
define('WECHAT_APIV3KEY', 'ZqqQSeOTYLRJCKisxEhdBgxRUmKjzMPq');
define('WECHAT_SERIAL_NO', '4ACD5B33F3C1D3742939084AF16548428A631AF9');
define('WECHAT_NOTIFY_URL', 'https://xmdm.ussn.cn/api/payment/notify.php');
define('WECHAT_PRIVATE_KEY_PATH', __DIR__ . '/../certs/apiclient_key.pem');

define('API_BASE_URL', 'https://xmdm.ussn.cn');

define('SMTP_HOST', 'smtp.qq.com');
define('SMTP_PORT', 465);
define('SMTP_USER', '2200186268@qq.com');
define('SMTP_PASS', 'rqpvowffnllgeajj');
define('SMTP_FROM', '2200186268@qq.com');
define('SMTP_FROM_NAME', '星梦动画');
