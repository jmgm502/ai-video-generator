<?php
require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/wechat.php';

$pdo = Database::getInstance();
$wechatPay = new WechatPay();

$headers = getallheaders();
$timestamp = $headers['Wechatpay-Timestamp'] ?? '';
$nonce = $headers['Wechatpay-Nonce'] ?? '';
$signature = $headers['Wechatpay-Signature'] ?? '';
$serial = $headers['Wechatpay-Serial'] ?? '';

$body = file_get_contents('php://input');

$isValid = $wechatPay->verifySign($timestamp, $nonce, $body, $signature, $serial);

if (!$isValid) {
    echo json_encode(['code' => 'FAIL', 'message' => '签名验证失败']);
    exit;
}

$notification = json_decode($body, true);
$resource = $notification['resource'] ?? [];

$paymentResult = $wechatPay->decryptNotify($resource);

if ($paymentResult['trade_state'] === 'SUCCESS') {
    $orderNo = $paymentResult['out_trade_no'];
    $transactionId = $paymentResult['transaction_id'];
    
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE order_no = ?');
    $stmt->execute([$orderNo]);
    $order = $stmt->fetch();
    
    if (!$order) {
        echo json_encode(['code' => 'FAIL', 'message' => '订单不存在']);
        exit;
    }
    
    if ($order['status'] === 'paid') {
        echo json_encode(['code' => 'SUCCESS', 'message' => '成功']);
        exit;
    }
    
    $pdo->beginTransaction();
    
    try {
        $stmt = $pdo->prepare('UPDATE orders SET status = "paid", trade_no = ?, paid_at = NOW() WHERE order_no = ?');
        $stmt->execute([$transactionId, $orderNo]);
        
        handleProductDelivery($pdo, $order);
        
        $pdo->commit();
        
        echo json_encode(['code' => 'SUCCESS', 'message' => '成功']);
    } catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode(['code' => 'FAIL', 'message' => '处理失败']);
    }
} else {
    echo json_encode(['code' => 'FAIL', 'message' => '支付未成功']);
}

function handleProductDelivery($pdo, $order) {
    $productType = $order['product_type'];
    $userId = $order['user_id'];
    $amount = floatval($order['amount']);
    
    if ($productType === 'tokens') {
        $tokens = intval($amount);
        $stmt = $pdo->prepare('UPDATE api_keys SET tokens_balance = tokens_balance + ? WHERE user_id = ?');
        $stmt->execute([$tokens, $userId]);
    } elseif ($productType === 'vip_monthly') {
        $expireAt = date('Y-m-d H:i:s', strtotime('+1 month'));
        $stmt = $pdo->prepare('UPDATE users SET user_group = "vip", vip_expire_at = ? WHERE id = ?');
        $stmt->execute([$expireAt, $userId]);
    } elseif ($productType === 'vip_quarterly') {
        $expireAt = date('Y-m-d H:i:s', strtotime('+3 months'));
        $stmt = $pdo->prepare('UPDATE users SET user_group = "vip", vip_expire_at = ? WHERE id = ?');
        $stmt->execute([$expireAt, $userId]);
    } elseif ($productType === 'vip_yearly') {
        $expireAt = date('Y-m-d H:i:s', strtotime('+1 year'));
        $stmt = $pdo->prepare('UPDATE users SET user_group = "vip", vip_expire_at = ? WHERE id = ?');
        $stmt->execute([$expireAt, $userId]);
    }
}
