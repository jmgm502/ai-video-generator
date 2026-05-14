<?php
require_once __DIR__ . '/../config/config.php';

class Database {
    private static $instance = null;
    private $conn;
    
    private function __construct() {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ];
            $this->conn = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            jsonResponse(500, ['success' => false, 'message' => '数据库连接失败']);
        }
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance->conn;
    }
}

function jsonResponse($code, $data) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonSuccess($data = [], $message = '操作成功') {
    jsonResponse(200, [
        'success' => true,
        'message' => $message,
        'data' => $data
    ]);
}

function jsonError($message = '操作失败', $code = 400) {
    jsonResponse($code, [
        'success' => false,
        'message' => $message
    ]);
}

function generateOrderNo() {
    $timestamp = strtoupper(base_convert(time(), 10, 36));
    $random = strtoupper(substr(md5(uniqid()), 0, 6));
    return 'XM' . $timestamp . $random;
}

function generateApiKey() {
    return md5(uniqid() . time() . rand());
}

function generateApiSecret() {
    return md5(uniqid() . time() . rand() . 'secret');
}
