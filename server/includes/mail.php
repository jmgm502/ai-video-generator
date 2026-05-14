<?php
require_once __DIR__ . '/../config/config.php';

class Mailer {
    private static $socket;
    
    private static function readResponse() {
        $response = '';
        while ($line = fgets(self::$socket, 515)) {
            $response .= $line;
            if (substr($line, 3, 1) === ' ') {
                break;
            }
        }
        return $response;
    }
    
    private static function sendCommand($cmd) {
        fwrite(self::$socket, $cmd . "\r\n");
        return self::readResponse();
    }
    
    public static function send($to, $subject, $body) {
        self::$socket = @fsockopen(
            'ssl://' . SMTP_HOST,
            SMTP_PORT,
            $errno,
            $errstr,
            30
        );
        
        if (!self::$socket) {
            return ['success' => false, 'message' => "连接SMTP服务器失败: $errstr ($errno)"];
        }
        
        $response = self::readResponse();
        if (substr($response, 0, 3) !== '220') {
            fclose(self::$socket);
            return ['success' => false, 'message' => 'SMTP服务器响应异常: ' . $response];
        }
        
        $response = self::sendCommand('EHLO ' . SMTP_HOST);
        if (substr($response, 0, 3) !== '250') {
            fclose(self::$socket);
            return ['success' => false, 'message' => 'EHLO失败: ' . $response];
        }
        
        $response = self::sendCommand('AUTH LOGIN');
        if (substr($response, 0, 3) !== '334') {
            fclose(self::$socket);
            return ['success' => false, 'message' => 'AUTH LOGIN失败: ' . $response];
        }
        
        $response = self::sendCommand(base64_encode(SMTP_USER));
        if (substr($response, 0, 3) !== '334') {
            fclose(self::$socket);
            return ['success' => false, 'message' => '用户名认证失败: ' . $response];
        }
        
        $response = self::sendCommand(base64_encode(SMTP_PASS));
        if (substr($response, 0, 3) !== '235') {
            fclose(self::$socket);
            return ['success' => false, 'message' => '密码认证失败: ' . $response];
        }
        
        $response = self::sendCommand('MAIL FROM: <' . SMTP_FROM . '>');
        if (substr($response, 0, 3) !== '250') {
            fclose(self::$socket);
            return ['success' => false, 'message' => 'MAIL FROM失败: ' . $response];
        }
        
        $response = self::sendCommand('RCPT TO: <' . $to . '>');
        if (substr($response, 0, 3) !== '250') {
            fclose(self::$socket);
            return ['success' => false, 'message' => 'RCPT TO失败: ' . $response];
        }
        
        $response = self::sendCommand('DATA');
        if (substr($response, 0, 3) !== '354') {
            fclose(self::$socket);
            return ['success' => false, 'message' => 'DATA命令失败: ' . $response];
        }
        
        $headers = [
            'From: ' . SMTP_FROM_NAME . ' <' . SMTP_FROM . '>',
            'To: ' . $to,
            'Subject: =?UTF-8?B?' . base64_encode($subject) . '?=',
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            ''
        ];
        
        $email = implode("\r\n", $headers) . "\r\n\r\n" . chunk_split(base64_encode($body)) . "\r\n.";
        
        $response = self::sendCommand($email);
        if (substr($response, 0, 3) !== '250') {
            fclose(self::$socket);
            return ['success' => false, 'message' => '邮件发送失败: ' . $response];
        }
        
        self::sendCommand('QUIT');
        fclose(self::$socket);
        
        return ['success' => true];
    }
}

function sendVerifyCode($email, $code, $type = 'register') {
    if ($type === 'reset') {
        $subject = '星梦动画 - 重置密码验证码';
        $actionText = '您正在重置星梦动画账号密码';
        $tipText = '如非本人操作，请忽略此邮件，您的账号依然安全。';
    } else {
        $subject = '星梦动画 - 邮箱验证码';
        $actionText = '您正在注册星梦动画账号';
        $tipText = '如果您没有请求此验证码，请忽略此邮件。';
    }
    
    $body = '
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
    </head>
    <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
            <h2 style="color: #333; text-align: center;">星梦动画</h2>
            <p style="color: #333; font-size: 16px;">您好！</p>
            <p style="color: #333; font-size: 16px;">' . $actionText . '，验证码如下：</p>
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 32px; font-weight: bold; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; letter-spacing: 5px;">
                ' . $code . '
            </div>
            <p style="color: #666; font-size: 14px;">验证码有效期为5分钟，请尽快使用。</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                ' . $tipText . '
            </p>
        </div>
    </body>
    </html>
    ';
    
    return Mailer::send($email, $subject, $body);
}
