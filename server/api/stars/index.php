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
    case 'GET:balance':
        getBalance($pdo);
        break;
    case 'GET:logs':
        getStarLogs($pdo);
        break;
    case 'POST:checkin':
        checkin($pdo);
        break;
    case 'GET:checkin-status':
        getCheckinStatus($pdo);
        break;
    case 'GET:checkin-history':
        getCheckinHistory($pdo);
        break;
    case 'GET:invite-info':
        getInviteInfo($pdo);
        break;
    case 'POST:recharge':
        createRechargeOrder($pdo, $wechatPay, $input);
        break;
    case 'POST:recharge-notify':
        handleRechargeCallback($pdo, $wechatPay);
        break;
    case 'GET:recharge-order':
        getRechargeOrder($pdo, $wechatPay);
        break;
    default:
        jsonError('接口不存在', 404);
}

function getBalance($pdo) {
    $auth = requireAuth();
    
    $stmt = $pdo->prepare('SELECT stars_balance FROM users WHERE id = ?');
    $stmt->execute([$auth['userId']]);
    $user = $stmt->fetch();
    
    jsonSuccess([
        'balance' => intval($user['stars_balance'] ?? 0)
    ]);
}

function getStarLogs($pdo) {
    $auth = requireAuth();
    
    $page = intval($_GET['page'] ?? 1);
    $pageSize = intval($_GET['pageSize'] ?? 20);
    $offset = ($page - 1) * $pageSize;
    
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM star_logs WHERE user_id = ?');
    $stmt->execute([$auth['userId']]);
    $total = $stmt->fetchColumn();
    
    $stmt = $pdo->prepare('
        SELECT id, change_amount, balance_after, type, description, created_at 
        FROM star_logs 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
    ');
    $stmt->execute([$auth['userId'], $pageSize, $offset]);
    $logs = $stmt->fetchAll();
    
    jsonSuccess([
        'list' => $logs,
        'pagination' => [
            'page' => $page,
            'pageSize' => $pageSize,
            'total' => intval($total)
        ]
    ]);
}

function checkin($pdo) {
    $auth = requireAuth();
    
    $today = date('Y-m-d');
    
    $stmt = $pdo->prepare('SELECT id FROM checkin_records WHERE user_id = ? AND checkin_date = ?');
    $stmt->execute([$auth['userId'], $today]);
    if ($stmt->fetch()) {
        jsonError('今天已经签到过了');
    }
    
    $yesterday = date('Y-m-d', strtotime('-1 day'));
    $stmt = $pdo->prepare('SELECT continuous_days FROM checkin_records WHERE user_id = ? AND checkin_date = ?');
    $stmt->execute([$auth['userId'], $yesterday]);
    $yesterdayRecord = $stmt->fetch();
    
    $continuousDays = $yesterdayRecord ? intval($yesterdayRecord['continuous_days']) + 1 : 1;
    
    $baseStars = 2;
    $bonusStars = 0;
    
    if ($continuousDays == 7) {
        $bonusStars = 10;
    } elseif ($continuousDays == 30) {
        $bonusStars = 50;
    }
    
    $totalStars = $baseStars + $bonusStars;
    
    $pdo->beginTransaction();
    
    try {
        $stmt = $pdo->prepare('UPDATE users SET stars_balance = stars_balance + ? WHERE id = ?');
        $stmt->execute([$totalStars, $auth['userId']]);
        
        $stmt = $pdo->prepare('SELECT stars_balance FROM users WHERE id = ?');
        $stmt->execute([$auth['userId']]);
        $newBalance = intval($stmt->fetch()['stars_balance']);
        
        $description = '每日签到';
        if ($bonusStars > 0) {
            $description .= " (连续{$continuousDays}天，奖励{$bonusStars}⭐)";
        }
        
        $stmt = $pdo->prepare('
            INSERT INTO star_logs (user_id, change_amount, balance_after, type, description) 
            VALUES (?, ?, ?, "checkin", ?)
        ');
        $stmt->execute([$auth['userId'], $totalStars, $newBalance, $description]);
        
        $stmt = $pdo->prepare('
            INSERT INTO checkin_records (user_id, checkin_date, continuous_days, stars_earned) 
            VALUES (?, ?, ?, ?)
        ');
        $stmt->execute([$auth['userId'], $today, $continuousDays, $totalStars]);
        
        $pdo->commit();
        
        jsonSuccess([
            'starsEarned' => $totalStars,
            'continuousDays' => $continuousDays,
            'bonusStars' => $bonusStars,
            'newBalance' => $newBalance
        ], '签到成功');
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonError('签到失败');
    }
}

function getCheckinStatus($pdo) {
    $auth = requireAuth();
    
    $today = date('Y-m-d');
    $stmt = $pdo->prepare('SELECT id FROM checkin_records WHERE user_id = ? AND checkin_date = ?');
    $stmt->execute([$auth['userId'], $today]);
    $hasCheckedIn = (bool) $stmt->fetch();
    
    $yesterday = date('Y-m-d', strtotime('-1 day'));
    $stmt = $pdo->prepare('SELECT continuous_days FROM checkin_records WHERE user_id = ? AND checkin_date = ?');
    $stmt->execute([$auth['userId'], $yesterday]);
    $yesterdayRecord = $stmt->fetch();
    
    $continuousDays = $yesterdayRecord ? intval($yesterdayRecord['continuous_days']) : 0;
    
    $stmt = $pdo->prepare('
        SELECT continuous_days, stars_earned 
        FROM checkin_records 
        WHERE user_id = ? 
        ORDER BY checkin_date DESC 
        LIMIT 1
    ');
    $stmt->execute([$auth['userId']]);
    $latestRecord = $stmt->fetch();
    
    $currentContinuousDays = $latestRecord ? intval($latestRecord['continuous_days']) : 0;
    
    jsonSuccess([
        'hasCheckedIn' => $hasCheckedIn,
        'continuousDays' => $currentContinuousDays,
        'todayDate' => $today
    ]);
}

function getCheckinHistory($pdo) {
    $auth = requireAuth();
    
    $month = $_GET['month'] ?? date('Y-m');
    
    $stmt = $pdo->prepare('
        SELECT checkin_date, continuous_days, stars_earned 
        FROM checkin_records 
        WHERE user_id = ? AND DATE_FORMAT(checkin_date, "%Y-%m") = ?
        ORDER BY checkin_date DESC
    ');
    $stmt->execute([$auth['userId'], $month]);
    $records = $stmt->fetchAll();
    
    jsonSuccess([
        'month' => $month,
        'records' => $records
    ]);
}

function getInviteInfo($pdo) {
    $auth = requireAuth();
    
    $stmt = $pdo->prepare('SELECT invite_code, invite_count FROM users WHERE id = ?');
    $stmt->execute([$auth['userId']]);
    $user = $stmt->fetch();
    
    if (!$user || !$user['invite_code']) {
        $inviteCode = generateInviteCode();
        $stmt = $pdo->prepare('UPDATE users SET invite_code = ? WHERE id = ?');
        $stmt->execute([$inviteCode, $auth['userId']]);
        $user['invite_code'] = $inviteCode;
    }
    
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM users WHERE invited_by = ?');
    $stmt->execute([$auth['userId']]);
    $inviteCount = intval($stmt->fetchColumn());
    
    $stmt = $pdo->prepare('
        SELECT u.id, u.email, u.nickname, u.created_at 
        FROM users u 
        WHERE u.invited_by = ? 
        ORDER BY u.created_at DESC
    ');
    $stmt->execute([$auth['userId']]);
    $invitedUsers = $stmt->fetchAll();
    
    jsonSuccess([
        'inviteCode' => $user['invite_code'],
        'inviteCount' => $inviteCount,
        'invitedUsers' => $invitedUsers
    ]);
}

function generateInviteCode() {
    return 'XM' . strtoupper(substr(md5(uniqid() . time() . rand()), 0, 8));
}

function createRechargeOrder($pdo, $wechatPay, $input) {
    $auth = requireAuth($input);
    
    $amount = floatval($input['amount'] ?? 0);
    
    if ($amount <= 0) {
        jsonError('充值金额必须大于0');
    }
    
    if ($amount < 1) {
        jsonError('最低充值金额为1元');
    }
    
    $stars = intval($amount * 10);
    $orderNo = generateOrderNo();
    $productName = "星星充值-{$stars}⭐";
    
    $pdo->beginTransaction();
    
    try {
        $stmt = $pdo->prepare('
            INSERT INTO orders (order_no, user_id, amount, payment_method, status, product_type) 
            VALUES (?, ?, ?, "wechat", "pending", "stars_recharge")
        ');
        $stmt->execute([$orderNo, $auth['userId'], $amount]);
        
        $pdo->commit();
        
        $result = $wechatPay->createNativeOrder($orderNo, $amount, $productName);
        
        if ($result['success']) {
            jsonSuccess([
                'orderNo' => $orderNo,
                'amount' => $amount,
                'stars' => $stars,
                'codeUrl' => $result['code_url']
            ], '订单创建成功');
        } else {
            jsonError($result['message']);
        }
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonError('创建订单失败: ' . $e->getMessage());
    }
}

function handleRechargeCallback($pdo, $wechatPay) {
    $xml = file_get_contents('php://input');
    $data = $wechatPay->xmlToArray($xml);
    
    if ($wechatPay->verifySign($data) && $data['return_code'] == 'SUCCESS' && $data['result_code'] == 'SUCCESS') {
        $orderNo = $data['out_trade_no'];
        
        $stmt = $pdo->prepare('SELECT * FROM orders WHERE order_no = ? AND status = "pending"');
        $stmt->execute([$orderNo]);
        $order = $stmt->fetch();
        
        if ($order && $order['product_type'] == 'stars_recharge') {
            $pdo->beginTransaction();
            
            try {
                $stmt = $pdo->prepare('UPDATE orders SET status = "paid", trade_no = ?, paid_at = NOW() WHERE order_no = ?');
                $stmt->execute([$data['transaction_id'], $orderNo]);
                
                $stars = intval(floatval($order['amount']) * 10);
                
                $stmt = $pdo->prepare('UPDATE users SET stars_balance = stars_balance + ? WHERE id = ?');
                $stmt->execute([$stars, $order['user_id']]);
                
                $stmt = $pdo->prepare('SELECT stars_balance FROM users WHERE id = ?');
                $stmt->execute([$order['user_id']]);
                $newBalance = intval($stmt->fetch()['stars_balance']);
                
                $stmt = $pdo->prepare('
                    INSERT INTO star_logs (user_id, change_amount, balance_after, type, description) 
                    VALUES (?, ?, ?, "recharge", ?)
                ');
                $description = "充值{$order['amount']}元获得{$stars}⭐";
                $stmt->execute([$order['user_id'], $stars, $newBalance, $description]);
                
                $pdo->commit();
                
                echo $wechatPay->arrayToXml(['return_code' => 'SUCCESS', 'return_msg' => 'OK']);
            } catch (Exception $e) {
                $pdo->rollBack();
                echo $wechatPay->arrayToXml(['return_code' => 'FAIL', 'return_msg' => '处理失败']);
            }
        } else {
            echo $wechatPay->arrayToXml(['return_code' => 'SUCCESS', 'return_msg' => 'OK']);
        }
    } else {
        echo $wechatPay->arrayToXml(['return_code' => 'FAIL', 'return_msg' => '签名验证失败']);
    }
}

function getRechargeOrder($pdo, $wechatPay) {
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
        
        error_log('Stars WechatPay Query Result: ' . json_encode($paymentStatus));
        
        if (isset($paymentStatus['trade_state']) && $paymentStatus['trade_state'] === 'SUCCESS') {
            $transactionId = $paymentStatus['transaction_id'] ?? '';
            
            $pdo->beginTransaction();
            try {
                $stmt = $pdo->prepare('UPDATE orders SET status = "paid", trade_no = ?, paid_at = NOW() WHERE order_no = ?');
                $stmt->execute([$transactionId, $orderNo]);
                
                $stars = intval(floatval($order['amount']) * 10);
                
                $stmt = $pdo->prepare('UPDATE users SET stars_balance = stars_balance + ? WHERE id = ?');
                $stmt->execute([$stars, $order['user_id']]);
                
                $stmt = $pdo->prepare('SELECT stars_balance FROM users WHERE id = ?');
                $stmt->execute([$order['user_id']]);
                $newBalance = intval($stmt->fetch()['stars_balance']);
                
                $stmt = $pdo->prepare('
                    INSERT INTO star_logs (user_id, change_amount, balance_after, type, description) 
                    VALUES (?, ?, ?, "recharge", ?)
                ');
                $description = "充值{$order['amount']}元获得{$stars}⭐";
                $stmt->execute([$order['user_id'], $stars, $newBalance, $description]);
                
                $pdo->commit();
                
                $order['status'] = 'paid';
                $order['paid_at'] = date('Y-m-d H:i:s');
            } catch (Exception $e) {
                $pdo->rollBack();
                error_log('Stars Recharge Error: ' . $e->getMessage());
            }
        } elseif (isset($paymentStatus['trade_state']) && $paymentStatus['trade_state'] === 'CLOSED') {
            $stmt = $pdo->prepare('UPDATE orders SET status = "closed" WHERE order_no = ?');
            $stmt->execute([$orderNo]);
            $order['status'] = 'closed';
        } elseif (isset($paymentStatus['message'])) {
            error_log('Stars WechatPay Error: ' . $paymentStatus['message']);
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
