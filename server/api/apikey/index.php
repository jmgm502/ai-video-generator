<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/jwt.php';

$pdo = Database::getInstance();

$method = $_SERVER['REQUEST_METHOD'];
$path = isset($_GET['action']) ? $_GET['action'] : '';

$input = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($method . ':' . $path) {
    case 'GET:key':
        getApiKey($pdo);
        break;
    case 'POST:regenerate':
        regenerateApiKey($pdo);
        break;
    case 'GET:balance':
        getBalance($pdo);
        break;
    default:
        jsonError('接口不存在', 404);
}

function getApiKey($pdo) {
    $auth = requireAuth();
    
    $stmt = $pdo->prepare('SELECT api_key, tokens_balance, created_at FROM api_keys WHERE user_id = ? AND is_active = 1');
    $stmt->execute([$auth['userId']]);
    $apiKey = $stmt->fetch();
    
    if (!$apiKey) {
        $apiKey = createApiKeyForUser($pdo, $auth['userId']);
    }
    
    jsonSuccess($apiKey);
}

function regenerateApiKey($pdo) {
    $auth = requireAuth();
    
    $stmt = $pdo->prepare('UPDATE api_keys SET is_active = 0 WHERE user_id = ?');
    $stmt->execute([$auth['userId']]);
    
    $apiKey = createApiKeyForUser($pdo, $auth['userId']);
    
    jsonSuccess($apiKey, 'API密钥已重新生成');
}

function getBalance($pdo) {
    $auth = requireAuth();
    
    $stmt = $pdo->prepare('SELECT tokens_balance FROM api_keys WHERE user_id = ? AND is_active = 1');
    $stmt->execute([$auth['userId']]);
    $result = $stmt->fetch();
    
    jsonSuccess(['balance' => intval($result['tokens_balance'] ?? 0)]);
}

function createApiKeyForUser($pdo, $userId) {
    $apiKey = generateApiKey();
    $apiSecret = generateApiSecret();
    
    $stmt = $pdo->prepare('INSERT INTO api_keys (user_id, api_key, api_secret, tokens_balance) VALUES (?, ?, ?, 100)');
    $stmt->execute([$userId, $apiKey, $apiSecret]);
    
    return [
        'apiKey' => $apiKey,
        'tokensBalance' => 100,
        'createdAt' => date('Y-m-d H:i:s')
    ];
}
