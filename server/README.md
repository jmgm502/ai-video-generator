# 星梦动画服务端 - PHP版

## 项目结构

```
server/
├── api/
│   ├── auth/
│   │   └── index.php      # 用户认证接口
│   ├── payment/
│   │   ├── index.php      # 支付接口
│   │   └── notify.php     # 微信支付回调
│   └── apikey/
│       └── index.php      # API密钥管理
├── config/
│   └── config.php         # 配置文件
├── includes/
│   ├── functions.php      # 公共函数
│   ├── jwt.php            # JWT认证
│   └── wechat.php         # 微信支付
├── certs/
│   ├── apiclient_key.pem  # 微信支付私钥（需上传）
│   └── apiclient_cert.pem # 微信支付公钥（需上传）
├── database.sql           # 数据库初始化
└── nginx.conf             # Nginx配置参考
```

## 部署步骤

### 1. 上传文件

将 `server` 目录下所有文件上传到：
```
/www/wwwroot/xmdm.ussn.cn/
```

### 2. 导入数据库

在宝塔面板 → 数据库 → 选择 `xmdm_db` → 导入 `database.sql`

或通过命令行：
```bash
mysql -u xmdm_db -piatKSeExdC2b4TdX xmdm_db < /www/wwwroot/xmdm.ussn.cn/database.sql
```

### 3. 上传微信支付证书

从微信商户平台下载的证书文件，上传到：
```
/www/wwwroot/xmdm.ussn.cn/certs/
├── apiclient_key.pem    # 私钥
└── apiclient_cert.pem   # 公钥
```

设置权限：
```bash
chmod 600 /www/wwwroot/xmdm.ussn.cn/certs/*.pem
```

### 4. 设置目录权限

```bash
chown -R www:www /www/wwwroot/xmdm.ussn.cn
chmod -R 755 /www/wwwroot/xmdm.ussn.cn
```

### 5. 配置Nginx（重要）

宝塔面板 → 网站 → xmdm.ussn.cn → 设置 → 配置文件

在 `server {}` 块中添加以下配置：

```nginx
# API路由配置
location /api/auth {
    try_files $uri $uri/ /api/auth/index.php?$query_string;
}

location /api/payment {
    try_files $uri $uri/ /api/payment/index.php?$query_string;
}

location /api/apikey {
    try_files $uri $uri/ /api/apikey/index.php?$query_string;
}

# PHP处理
location ~ ^/api/.+\.php$ {
    fastcgi_pass unix:/tmp/php-cgi-82.sock;
    fastcgi_index index.php;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    include fastcgi_params;
}
```

注意：`fastcgi_pass` 的路径根据PHP版本可能不同：
- PHP 7.4: `/tmp/php-cgi-74.sock`
- PHP 8.0: `/tmp/php-cgi-80.sock`
- PHP 8.1: `/tmp/php-cgi-81.sock`
- PHP 8.2: `/tmp/php-cgi-82.sock`

保存后重载Nginx配置：
```bash
nginx -t && nginx -s reload
```

### 6. 测试API

```bash
# 测试商品列表
curl https://xmdm.ussn.cn/api/payment/products

# 测试注册
curl -X POST https://xmdm.ussn.cn/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'
```

## API接口

### 认证接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/profile` | GET | 获取用户信息 |
| `/api/auth/profile` | PUT | 更新用户信息 |
| `/api/auth/change-password` | POST | 修改密码 |

### 支付接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/payment/products` | GET | 获取商品列表 |
| `/api/payment/create` | POST | 创建支付订单 |
| `/api/payment/notify` | POST | 微信支付回调 |
| `/api/payment/order` | GET | 查询订单状态 |
| `/api/payment/orders` | GET | 获取订单列表 |

### API密钥接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/apikey/key` | GET | 获取API密钥 |
| `/api/apikey/regenerate` | POST | 重新生成密钥 |
| `/api/apikey/balance` | GET | 获取余额 |

## 注意事项

1. 确保PHP版本 >= 7.4
2. 确保已安装PDO扩展
3. 确保已安装OpenSSL扩展
4. 微信支付证书文件权限设置为600
5. 生产环境建议关闭错误显示
