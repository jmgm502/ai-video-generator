<?php
require_once __DIR__ . '/../config/config.php';

class WechatPay {
    private $appId;
    private $mchId;
    private $apiV3Key;
    private $serialNo;
    private $privateKey;
    private $notifyUrl;
    
    public function __construct() {
        $this->appId = WECHAT_APPID;
        $this->mchId = WECHAT_MCHID;
        $this->apiV3Key = WECHAT_APIV3KEY;
        $this->serialNo = WECHAT_SERIAL_NO;
        $this->notifyUrl = WECHAT_NOTIFY_URL;
        
        if (file_exists(WECHAT_PRIVATE_KEY_PATH)) {
            $this->privateKey = file_get_contents(WECHAT_PRIVATE_KEY_PATH);
        } else {
            $this->privateKey = null;
        }
    }
    
    public function createNativeOrder($orderNo, $amount, $description) {
        $url = 'https://api.mch.weixin.qq.com/v3/pay/transactions/native';
        
        $params = [
            'appid' => $this->appId,
            'mchid' => $this->mchId,
            'description' => $description,
            'out_trade_no' => $orderNo,
            'notify_url' => $this->notifyUrl,
            'amount' => [
                'total' => intval($amount * 100),
                'currency' => 'CNY'
            ]
        ];
        
        $result = $this->request('POST', $url, $params);
        
        if (isset($result['code_url'])) {
            return [
                'success' => true,
                'code_url' => $result['code_url']
            ];
        }
        
        return [
            'success' => false,
            'message' => $result['message'] ?? '创建订单失败'
        ];
    }
    
    public function queryOrder($orderNo) {
        $url = "https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/{$orderNo}?mchid={$this->mchId}";
        
        $result = $this->request('GET', $url);
        
        return $result;
    }
    
    public function closeOrder($orderNo) {
        $url = "https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/{$orderNo}/close";
        
        $params = [
            'mchid' => $this->mchId
        ];
        
        return $this->request('POST', $url, $params);
    }
    
    public function decryptNotify($resource) {
        $ciphertext = base64_decode($resource['ciphertext']);
        $associatedData = $resource['associated_data'];
        $nonce = $resource['nonce'];
        
        $result = openssl_decrypt(
            substr($ciphertext, 0, -16),
            'aes-256-gcm',
            $this->apiV3Key,
            OPENSSL_RAW_DATA,
            $nonce,
            $tag = substr($ciphertext, -16),
            $associatedData
        );
        
        return json_decode($result, true);
    }
    
    public function verifySign($timestamp, $nonce, $body, $signature, $serial) {
        $message = "{$timestamp}\n{$nonce}\n{$body}\n";
        
        $publicKey = $this->getPublicKey($serial);
        if (!$publicKey) {
            return false;
        }
        
        $result = openssl_verify(
            $message,
            base64_decode($signature),
            $publicKey,
            OPENSSL_ALGO_SHA256
        );
        
        return $result === 1;
    }
    
    private function request($method, $url, $params = []) {
        if (!$this->privateKey) {
            return ['message' => '微信支付证书未配置'];
        }
        
        $body = $method === 'GET' ? '' : json_encode($params);
        $timestamp = time();
        $nonce = bin2hex(random_bytes(16));
        
        $urlParts = parse_url($url);
        $canonicalUrl = $urlParts['path'] . (isset($urlParts['query']) ? '?' . $urlParts['query'] : '');
        
        $message = "{$method}\n{$canonicalUrl}\n{$timestamp}\n{$nonce}\n{$body}\n";
        
        openssl_sign($message, $signature, $this->privateKey, OPENSSL_ALGO_SHA256);
        $sign = base64_encode($signature);
        
        $auth = sprintf(
            'WECHATPAY2-SHA256-RSA2048 mchid="%s",nonce_str="%s",timestamp="%d",serial_no="%s",signature="%s"',
            $this->mchId,
            $nonce,
            $timestamp,
            $this->serialNo,
            $sign
        );
        
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_USERAGENT => 'XMDM-Server/1.0',
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: application/json',
                'Authorization: ' . $auth
            ]
        ]);
        
        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        return json_decode($response, true) ?? [];
    }
    
    private function getPublicKey($serial) {
        static $cache = [];
        
        if (isset($cache[$serial])) {
            return $cache[$serial];
        }
        
        $certPath = __DIR__ . '/../certs/wechat_' . $serial . '.pem';
        if (file_exists($certPath)) {
            $cache[$serial] = openssl_pkey_get_public(file_get_contents($certPath));
            return $cache[$serial];
        }
        
        return null;
    }
}
