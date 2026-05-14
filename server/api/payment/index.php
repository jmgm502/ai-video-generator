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
require_once __DIR__ . '/../../includes/wechat.php';

$pdo = Database::getInstance();
$wechatPay = new WechatPay();

$method = $_SERVER['REQUEST_METHOD'];
$path = isset($_GET['action']) ? $_GET['action'] : '';

$input = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($method . ':' . $path) {
    case 'GET:products':
        getProducts($pdo);
        break;
    case 'POST:create':
        createOrder($pdo, $wechatPay, $input);
        break;
    case 'GET:orders':
        getOrders($pdo);
        break;
    case 'GET:order':
        getOrder($pdo, $wechatPay);
        break;
    case 'GET:test':
        testWechatPay($wechatPay);
        break;
    default:
        jsonError('接口不存在', 404);
}

function testWechatPay($wechatPay) {
    $certPath = __DIR__ . '/../../certs/apiclient_key.pem';
    $certExists = file_exists($certPath);
    $certReadable = $certExists && is_readable($certPath);
    
    $result = [
        'cert_exists' => $certExists,
        'cert_readable' => $certReadable,
        'cert_path' => $certPath,
    ];
    
    if ($certExists && $certReadable) {
        $testOrderNo = 'TEST' . time();
        $queryResult = $wechatPay->queryOrder($testOrderNo);
        $result['api_test'] = $queryResult;
    }
    
    jsonSuccess($result);
}

function getProducts($pdo) {
    $stmt = $pdo->query('SELECT id, name, description, price, tokens, duration, type FROM products WHERE is_active = 1 ORDER BY price ASC');
    $products = $stmt->fetchAll();
    
    jsonSuccess(['list' => $products]);
}

function createOrder($pdo, $wechatPay, $input) {
    $auth = requireAuth($input);
    
    $productId = intval($input['productId'] ?? 0);
    
    if ($productId <= 0) {
        jsonError('请选择商品');
    }
    
    $stmt = $pdo->prepare('SELECT * FROM products WHERE id = ? AND is_active = 1');
    $stmt->execute([$productId]);
    $product = $stmt->fetch();
    
    if (!$product) {
        jsonError('商品不存在');
    }
    
    $orderNo = generateOrderNo();
    $amount = floatval($product['price']);
    
    $pdo->beginTransaction();
    
    try {
        $stmt = $pdo->prepare('INSERT INTO orders (order_no, user_id, amount, payment_method, status, product_type) VALUES (?, ?, ?, "wechat", "pending", ?)');
        $stmt->execute([$orderNo, $auth['userId'], $amount, $product['type']]);
        
        $pdo->commit();
        
        $result = $wechatPay->createNativeOrder($orderNo, $amount, $product['name']);
        
        if ($result['success']) {
            jsonSuccess([
                'orderNo' => $orderNo,
                'amount' => $amount,
                'codeUrl' => $result['code_url']
            ], '订单创建成功');
        } else {
            jsonError($result['message']);
        }
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonError('创建订单失败');
    }
}

function getOrders($pdo) {
    $auth = requireAuth();
    
    $page = intval($_GET['page'] ?? 1);
    $pageSize = intval($_GET['pageSize'] ?? 10);
    $offset = ($page - 1) * $pageSize;
    
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM orders WHERE user_id = ?');
    $stmt->execute([$auth['userId']]);
    $total = $stmt->fetchColumn();
    
    $stmt = $pdo->prepare('SELECT order_no, amount, status, product_type, paid_at, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?');
    $stmt->execute([$auth['userId'], $pageSize, $offset]);
    $orders = $stmt->fetchAll();
    
    jsonSuccess([
        'list' => $orders,
        'pagination' => [
            'page' => $page,
            'pageSize' => $pageSize,
            'total' => intval($total)
        ]
    ]);
}

function getOrder($pdo, $wechatPay) {
    $auth = requireAuth();
    
    $orderNo = $_GET['orderNo'] ?? '';
    
    if (empty($orderNo)) {
        jsonError('订单号不能为空');
    }
    
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE order_no = ? AND user_id = ?');
    $stmt->execute([$orderNo, $auth['userId']]);
    $order = $stmt->fetch();
    
    if (!$order) {
        jsonError('订单不存在', 404);
    }
    
    if ($order['status'] === 'pending') {
        $paymentStatus = $wechatPay->queryOrder($orderNo);
        
        error_log('WechatPay Query Result: ' . json_encode($paymentStatus));
        
        if (isset($paymentStatus['trade_state']) && $paymentStatus['trade_state'] === 'SUCCESS') {
            $transactionId = $paymentStatus['transaction_id'] ?? '';
            
            $pdo->beginTransaction();
            try {
                $stmt = $pdo->prepare('UPDATE orders SET status = "paid", trade_no = ?, paid_at = NOW() WHERE order_no = ?');
                $stmt->execute([$transactionId, $orderNo]);
                
                handleProductDelivery($pdo, $order);
                
                $pdo->commit();
                
                $order['status'] = 'paid';
                $order['paid_at'] = date('Y-m-d H:i:s');
            } catch (Exception $e) {
                $pdo->rollBack();
                error_log('HandleProductDelivery Error: ' . $e->getMessage());
            }
        } elseif (isset($paymentStatus['trade_state']) && $paymentStatus['trade_state'] === 'CLOSED') {
            $stmt = $pdo->prepare('UPDATE orders SET status = "closed" WHERE order_no = ?');
            $stmt->execute([$orderNo]);
            $order['status'] = 'closed';
        } elseif (isset($paymentStatus['message'])) {
            error_log('WechatPay Error: ' . $paymentStatus['message']);
        }
        
        jsonSuccess([
            'orderNo' => $order['order_no'],
            'amount' => floatval($order['amount']),
            'status' => $order['status'],
            'productType' => $order['product_type'],
            'paidAt' => $order['paid_at'],
            'createdAt' => $order['created_at'],
            'paymentStatus' => [
                'tradeState' => $paymentStatus['trade_state'] ?? 'UNKNOWN',
                'tradeStateDesc' => $paymentStatus['trade_state_desc'] ?? ($paymentStatus['message'] ?? '')
            ]
        ]);
    }
    
    jsonSuccess([
        'orderNo' => $order['order_no'],
        'amount' => floatval($order['amount']),
        'status' => $order['status'],
        'productType' => $order['product_type'],
        'paidAt' => $order['paid_at'],
        'createdAt' => $order['created_at']
    ]);
}

function handleProductDelivery($pdo, $order) {
    $productType = $order['product_type'];
    $userId = $order['user_id'];
    
    if ($productType === 'vip_monthly') {
        $stmt = $pdo->prepare('SELECT vip_expire_at FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        
        $baseTime = $user['vip_expire_at'] && strtotime($user['vip_expire_at']) > time() 
            ? strtotime($user['vip_expire_at']) 
            : time();
        $expireAt = date('Y-m-d H:i:s', strtotime('+1 month', $baseTime));
        
        $stmt = $pdo->prepare('UPDATE users SET user_group = "vip", vip_expire_at = ? WHERE id = ?');
        $stmt->execute([$expireAt, $userId]);
    } elseif ($productType === 'vip_quarterly') {
        $stmt = $pdo->prepare('SELECT vip_expire_at FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        
        $baseTime = $user['vip_expire_at'] && strtotime($user['vip_expire_at']) > time() 
            ? strtotime($user['vip_expire_at']) 
            : time();
        $expireAt = date('Y-m-d H:i:s', strtotime('+3 months', $baseTime));
        
        $stmt = $pdo->prepare('UPDATE users SET user_group = "vip", vip_expire_at = ? WHERE id = ?');
        $stmt->execute([$expireAt, $userId]);
    } elseif ($productType === 'vip_yearly') {
        $stmt = $pdo->prepare('SELECT vip_expire_at FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        
        $baseTime = $user['vip_expire_at'] && strtotime($user['vip_expire_at']) > time() 
            ? strtotime($user['vip_expire_at']) 
            : time();
        $expireAt = date('Y-m-d H:i:s', strtotime('+1 year', $baseTime));
        
        $stmt = $pdo->prepare('UPDATE users SET user_group = "vip", vip_expire_at = ? WHERE id = ?');
        $stmt->execute([$expireAt, $userId]);
    } elseif ($productType === 'tokens') {
        $amount = floatval($order['amount']);
        $tokens = intval($amount);
        $stmt = $pdo->prepare('UPDATE api_keys SET tokens_balance = tokens_balance + ? WHERE user_id = ?');
        $stmt->execute([$tokens, $userId]);
    }
}
