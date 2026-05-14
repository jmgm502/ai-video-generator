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
require_once __DIR__ . '/../../includes/mail.php';

$pdo = Database::getInstance();

$method = $_SERVER['REQUEST_METHOD'];
$path = isset($_GET['action']) ? $_GET['action'] : '';

$input = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($method . ':' . $path) {
    case 'POST:register':
        register($pdo, $input);
        break;
    case 'POST:login':
        login($pdo, $input);
        break;
    case 'POST:send-code':
        sendCode($pdo, $input);
        break;
    case 'POST:reset-password':
        resetPassword($pdo, $input);
        break;
    case 'GET:profile':
        getProfile($pdo);
        break;
    case 'PUT:profile':
        updateProfile($pdo, $input);
        break;
    case 'POST:change-password':
        changePassword($pdo, $input);
        break;
    default:
        jsonError('接口不存在', 404);
}

function sendCode($pdo, $input) {
    $email = trim($input['email'] ?? '');
    $type = trim($input['type'] ?? 'register');
    
    if (empty($email)) {
        jsonError('邮箱不能为空');
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonError('邮箱格式不正确');
    }
    
    if ($type === 'register') {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            jsonError('该邮箱已被注册');
        }
    }
    
    if ($type === 'reset') {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$email]);
        if (!$stmt->fetch()) {
            jsonError('该邮箱未注册');
        }
    }
    
    $stmt = $pdo->prepare('SELECT id FROM verify_codes WHERE email = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        jsonError('验证码发送太频繁，请稍后再试');
    }
    
    $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $expiresAt = date('Y-m-d H:i:s', strtotime('+5 minutes'));
    
    $stmt = $pdo->prepare('INSERT INTO verify_codes (email, code, type, expires_at) VALUES (?, ?, ?, ?)');
    $stmt->execute([$email, $code, $type, $expiresAt]);
    
    $result = sendVerifyCode($email, $code, $type);
    
    if ($result['success']) {
        jsonSuccess([], '验证码已发送到您的邮箱');
    } else {
        jsonError('验证码发送失败: ' . ($result['message'] ?? '未知错误'));
    }
}

function verifyCode($pdo, $email, $code, $type = 'register') {
    $stmt = $pdo->prepare('SELECT * FROM verify_codes WHERE email = ? AND code = ? AND type = ? AND used = 0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1');
    $stmt->execute([$email, $code, $type]);
    $record = $stmt->fetch();
    
    if (!$record) {
        return false;
    }
    
    $stmt = $pdo->prepare('UPDATE verify_codes SET used = 1 WHERE id = ?');
    $stmt->execute([$record['id']]);
    
    return true;
}

function resetPassword($pdo, $input) {
    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';
    $verifyCode = trim($input['verifyCode'] ?? '');
    
    if (empty($email) || empty($password)) {
        jsonError('邮箱和密码不能为空');
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonError('邮箱格式不正确');
    }
    
    if (strlen($password) < 6) {
        jsonError('密码长度至少6位');
    }
    
    if (empty($verifyCode)) {
        jsonError('请输入验证码');
    }
    
    if (!verifyCode($pdo, $email, $verifyCode, 'reset')) {
        jsonError('验证码错误或已过期');
    }
    
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if (!$stmt->fetch()) {
        jsonError('该邮箱未注册');
    }
    
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE email = ?');
    $stmt->execute([$passwordHash, $email]);
    
    jsonSuccess([], '密码重置成功');
}

function generateInviteCode() {
    return 'XM' . strtoupper(substr(md5(uniqid() . time() . rand()), 0, 8));
}

function register($pdo, $input) {
    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';
    $nickname = trim($input['nickname'] ?? '');
    $verifyCode = trim($input['verifyCode'] ?? '');
    $inviteCode = trim($input['inviteCode'] ?? '');
    
    if (empty($email) || empty($password)) {
        jsonError('邮箱和密码不能为空');
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonError('邮箱格式不正确');
    }
    
    if (strlen($password) < 6) {
        jsonError('密码长度至少6位');
    }
    
    if (empty($verifyCode)) {
        jsonError('请输入验证码');
    }
    
    if (!verifyCode($pdo, $email, $verifyCode, 'register')) {
        jsonError('验证码错误或已过期');
    }
    
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        jsonError('该邮箱已被注册');
    }
    
    $invitedBy = null;
    $inviteBonus = 0;
    
    if (!empty($inviteCode)) {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE invite_code = ?');
        $stmt->execute([$inviteCode]);
        $inviter = $stmt->fetch();
        
        if (!$inviter) {
            jsonError('邀请码不存在');
        }
        
        $invitedBy = $inviter['id'];
        $inviteBonus = 20;
    }
    
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    $nickname = $nickname ?: explode('@', $email)[0];
    $initialStars = 10 + $inviteBonus;
    $userInviteCode = generateInviteCode();
    
    $pdo->beginTransaction();
    
    try {
        $stmt = $pdo->prepare('
            INSERT INTO users (email, password_hash, nickname, stars_balance, invite_code, invited_by) 
            VALUES (?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([$email, $passwordHash, $nickname, $initialStars, $userInviteCode, $invitedBy]);
        $userId = $pdo->lastInsertId();
        
        if ($invitedBy) {
            $stmt = $pdo->prepare('UPDATE users SET invite_count = invite_count + 1 WHERE id = ?');
            $stmt->execute([$invitedBy]);
        }
        
        $apiKey = generateApiKey();
        $apiSecret = generateApiSecret();
        $stmt = $pdo->prepare('INSERT INTO api_keys (user_id, api_key, api_secret, tokens_balance) VALUES (?, ?, ?, 100)');
        $stmt->execute([$userId, $apiKey, $apiSecret]);
        
        $logDescription = '注册赠送新手礼包';
        if ($inviteBonus > 0) {
            $logDescription .= " (使用邀请码+{$inviteBonus}⭐)";
        }
        
        $stmt = $pdo->prepare('
            INSERT INTO star_logs (user_id, change_amount, balance_after, type, description) 
            VALUES (?, ?, ?, "register", ?)
        ');
        $stmt->execute([$userId, $initialStars, $initialStars, $logDescription]);
        
        $pdo->commit();
        
        $token = JWT::encode(['userId' => $userId]);
        
        jsonSuccess([
            'user' => [
                'id' => $userId,
                'email' => $email,
                'username' => $nickname,
                'userGroup' => 'free',
                'starsBalance' => $initialStars,
                'createdAt' => date('Y-m-d H:i:s'),
                'lastLoginAt' => null
            ],
            'token' => $token
        ], '注册成功');
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonError('注册失败');
    }
}

function login($pdo, $input) {
    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';
    
    if (empty($email) || empty($password)) {
        jsonError('邮箱和密码不能为空');
    }
    
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    
    if (!$user || !password_verify($password, $user['password_hash'])) {
        jsonError('邮箱或密码错误');
    }
    
    $stmt = $pdo->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?');
    $stmt->execute([$user['id']]);
    
    $lastLoginAt = date('Y-m-d H:i:s');
    
    $token = JWT::encode(['userId' => $user['id']]);
    
    jsonSuccess([
        'user' => [
            'id' => $user['id'],
            'email' => $user['email'],
            'username' => $user['nickname'],
            'avatar' => $user['avatar'],
            'userGroup' => $user['user_group'],
            'vipExpireAt' => $user['vip_expire_at'],
            'createdAt' => $user['created_at'],
            'lastLoginAt' => $lastLoginAt
        ],
        'token' => $token
    ], '登录成功');
}

function getProfile($pdo) {
    $auth = requireAuth();
    
    $stmt = $pdo->prepare('SELECT id, email, nickname, avatar, user_group, vip_expire_at, created_at, last_login_at FROM users WHERE id = ?');
    $stmt->execute([$auth['userId']]);
    $user = $stmt->fetch();
    
    if (!$user) {
        jsonError('用户不存在', 404);
    }
    
    jsonSuccess(['user' => [
        'id' => $user['id'],
        'username' => $user['nickname'] ?: $user['email'],
        'email' => $user['email'],
        'avatar' => $user['avatar'],
        'userGroup' => $user['user_group'],
        'vipExpireAt' => $user['vip_expire_at'],
        'createdAt' => $user['created_at'],
        'lastLoginAt' => $user['last_login_at']
    ]]);
}

function updateProfile($pdo, $input) {
    $auth = requireAuth();
    
    $nickname = trim($input['nickname'] ?? '');
    $avatar = trim($input['avatar'] ?? '');
    
    $updates = [];
    $params = [];
    
    if ($nickname) {
        $updates[] = 'nickname = ?';
        $params[] = $nickname;
    }
    
    if ($avatar) {
        $updates[] = 'avatar = ?';
        $params[] = $avatar;
    }
    
    if (empty($updates)) {
        jsonError('没有要更新的内容');
    }
    
    $params[] = $auth['userId'];
    $sql = 'UPDATE users SET ' . implode(', ', $updates) . ' WHERE id = ?';
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    
    jsonSuccess([], '更新成功');
}

function changePassword($pdo, $input) {
    $auth = requireAuth();
    
    $oldPassword = $input['oldPassword'] ?? '';
    $newPassword = $input['newPassword'] ?? '';
    
    if (empty($oldPassword) || empty($newPassword)) {
        jsonError('请输入原密码和新密码');
    }
    
    if (strlen($newPassword) < 6) {
        jsonError('新密码长度至少6位');
    }
    
    $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
    $stmt->execute([$auth['userId']]);
    $user = $stmt->fetch();
    
    if (!password_verify($oldPassword, $user['password_hash'])) {
        jsonError('原密码错误');
    }
    
    $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    $stmt->execute([$passwordHash, $auth['userId']]);
    
    jsonSuccess([], '密码修改成功');
}
