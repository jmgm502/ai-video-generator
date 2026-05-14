<?php
require_once __DIR__ . '/../config/config.php';

class JWT {
    public static function encode($payload) {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload['exp'] = time() + JWT_EXPIRE;
        $payload['iat'] = time();
        
        $base64Header = self::base64UrlEncode($header);
        $base64Payload = self::base64UrlEncode(json_encode($payload));
        
        $signature = hash_hmac('sha256', $base64Header . '.' . $base64Payload, JWT_SECRET, true);
        $base64Signature = self::base64UrlEncode($signature);
        
        return $base64Header . '.' . $base64Payload . '.' . $base64Signature;
    }
    
    public static function decode($token) {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return false;
        }
        
        list($base64Header, $base64Payload, $base64Signature) = $parts;
        
        $signature = self::base64UrlDecode($base64Signature);
        $expectedSignature = hash_hmac('sha256', $base64Header . '.' . $base64Payload, JWT_SECRET, true);
        
        if (!hash_equals($expectedSignature, $signature)) {
            return false;
        }
        
        $payload = json_decode(self::base64UrlDecode($base64Payload), true);
        
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            return false;
        }
        
        return $payload;
    }
    
    private static function base64UrlEncode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
    
    private static function base64UrlDecode($data) {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}

/**
 * 读取 Authorization（Bearer）。兼容 Apache Rewrite、FastCGI、大小写差异。
 */
function getAuthorizationHeaderValue() {
    $auth = '';
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (is_array($headers)) {
            foreach ($headers as $key => $value) {
                if (strcasecmp((string) $key, 'Authorization') === 0) {
                    $auth = (string) $value;
                    break;
                }
            }
        }
    }
    if ($auth === '' && !empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $auth = (string) $_SERVER['HTTP_AUTHORIZATION'];
    }
    if ($auth === '' && !empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $auth = (string) $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    return $auth;
}

/**
 * 取原始 JWT 字符串：优先 Authorization: Bearer；否则 X-Auth-Token（部分反代会剥掉 Authorization）。
 */
function getJwtTokenStringFromRequest() {
    $authHeader = getAuthorizationHeaderValue();
    if ($authHeader !== '' && preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
        return trim($matches[1]);
    }

    if (!empty($_SERVER['HTTP_X_AUTH_TOKEN'])) {
        return trim((string) $_SERVER['HTTP_X_AUTH_TOKEN']);
    }

    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (is_array($headers)) {
            foreach ($headers as $key => $value) {
                if (strcasecmp((string) $key, 'X-Auth-Token') === 0) {
                    return trim((string) $value);
                }
            }
        }
    }

    return '';
}

/**
 * 解析当前请求的 JWT 载荷。顺序：请求头（Bearer / X-Auth-Token）→ JSON body accessToken → GET accessToken。
 * body 与 query 作备用，避免部分环境剥掉 Authorization 且与旧版 CORS 预检兼容（无需新增 Allow-Headers）。
 *
 * @param array|null $jsonBody 已解析的 php://input JSON（仅 POST 等带体的接口传入）
 */
function resolveAuthUser(?array $jsonBody = null) {
    $token = getJwtTokenStringFromRequest();
    if ($token === '' && is_array($jsonBody) && isset($jsonBody['accessToken']) && $jsonBody['accessToken'] !== '') {
        $token = trim((string) $jsonBody['accessToken']);
    }
    if ($token === '' && !empty($_GET['accessToken'])) {
        $token = trim((string) $_GET['accessToken']);
    }
    if ($token === '') {
        return null;
    }

    $payload = JWT::decode($token);

    if (!$payload || !isset($payload['userId'])) {
        return null;
    }

    return $payload;
}

function getAuthUser() {
    return resolveAuthUser(null);
}

function requireAuth(?array $jsonBody = null) {
    $user = resolveAuthUser($jsonBody);
    if (!$user) {
        jsonError('未授权访问', 401);
    }
    return $user;
}
