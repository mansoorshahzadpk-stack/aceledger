<?php
// Secure Master Password Recovery API Route for Hostinger deployment
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

// 1. Parse Authorization Header (with multi-method fallbacks for CGI/FPM)
$authHeader = '';
if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
} elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
} else {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    if (isset($headers['Authorization'])) {
        $authHeader = $headers['Authorization'];
    } elseif (isset($headers['authorization'])) {
        $authHeader = $headers['authorization'];
    }
}

if (empty($authHeader) || !preg_match('/Bearer\s(\S+)/i', $authHeader, $matches)) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized: Missing or invalid token']);
    exit;
}

$jwtToken = $matches[1];

// 2. Load Environment / Config
$configPath = dirname(__DIR__) . '/config.json';
$config = [];
if (file_exists($configPath)) {
    $config = json_decode(file_get_contents($configPath), true) ?: [];
}

$supabaseUrl = getenv('SUPABASE_URL') ?: ($config['SUPABASE_URL'] ?? 'https://hpnknjoxwzocenxuziwu.supabase.co');
$supabaseAnonKey = getenv('SUPABASE_ANON_KEY') ?: getenv('VITE_SUPABASE_PUBLISHABLE_KEY') ?: ($config['SUPABASE_ANON_KEY'] ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhwbmtuam94d3pvY2VueHV6aXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDkxOTMsImV4cCI6MjA5NTM4NTE5M30.PGao9Ta7s2_emo8NIXVnXLx_jkXtfxms4DiH886MPf8');

$smtpHost = getenv('SMTP_HOST');
$smtpPort = getenv('SMTP_PORT') ?: 587;
$smtpUser = getenv('SMTP_USER');
$smtpPass = getenv('SMTP_PASS');
$smtpFrom = getenv('SMTP_FROM') ?: 'noreply@aceledger.top';

$resendApiKey = getenv('RESEND_API_KEY');
$sendgridApiKey = getenv('SENDGRID_API_KEY');

// 3. Verify user against Supabase Auth
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, rtrim($supabaseUrl, '/') . '/auth/v1/user');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $jwtToken,
    'apikey: ' . $supabaseAnonKey
]);
$authResponse = curl_exec($ch);
$authStatusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($authStatusCode !== 200 || !$authResponse) {
    $debugLog = [
        'timestamp' => date('c'),
        'supabase_url' => $supabaseUrl,
        'anon_key_preview' => substr($supabaseAnonKey, 0, 15) . '...',
        'token_preview' => substr($jwtToken, 0, 15) . '...',
        'token_length' => strlen($jwtToken),
        'http_status' => $authStatusCode,
        'curl_error' => $curlError,
        'response_raw' => $authResponse,
        'response_decoded' => json_decode($authResponse, true)
    ];
    file_put_contents(__DIR__ . '/supabase_auth_debug.json', json_encode($debugLog, JSON_PRETTY_PRINT));

    http_response_code(401);
    echo json_encode([
        'error' => 'Unauthorized: Invalid session',
        'debug' => $debugLog
    ]);
    exit;
}


$userData = json_decode($authResponse, true);
$userId = isset($userData['id']) ? $userData['id'] : '';
$userEmail = isset($userData['email']) ? $userData['email'] : '';

if (empty($userId) || empty($userEmail)) {
    http_response_code(400);
    echo json_encode(['error' => 'Bad Request: Could not fetch user profile details']);
    exit;
}

// 4. Request Recovery Token via Supabase RPC
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, rtrim($supabaseUrl, '/') . '/rest/v1/rpc/request_master_password_recovery');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $jwtToken,
    'apikey: ' . $supabaseAnonKey,
    'Content-Type: application/json'
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'p_user_id' => $userId
]));
$rpcResponse = curl_exec($ch);
$rpcStatusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$rpcCurlError = curl_error($ch);
curl_close($ch);

if ($rpcStatusCode !== 200 || !$rpcResponse) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal Server Error: Failed to generate recovery token',
        'debug' => [
            'status' => $rpcStatusCode,
            'curl_error' => $rpcCurlError,
            'response' => $rpcResponse
        ]
    ]);
    exit;
}

$token = json_decode($rpcResponse, true);
if (empty($token) || is_array($token)) {
    http_response_code(500);
    echo json_encode(['error' => 'Internal Server Error: Recovery token format was invalid']);
    exit;
}

// 5. Construct Reset URL
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'aceledger.top';
$resetUrl = $protocol . $host . '/settings?reset_token=' . $token;

// 6. Build Premium HTML Recovery Email
$subject = 'Reset Master Password — Ace Ledger';
$messageBody = "
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Reset Master Password</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f5f6; margin: 0; padding: 0; color: #1f2937; }
        .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); border: 1px solid #e5e7eb; }
        .header { background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.025em; }
        .content { padding: 40px 30px; line-height: 1.6; }
        .content p { margin-top: 0; margin-bottom: 20px; font-size: 16px; color: #4b5563; }
        .btn-wrapper { text-align: center; margin: 30px 0; }
        .btn { display: inline-block; padding: 14px 28px; background-color: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.2); transition: background-color 0.2s; }
        .footer { background-color: #f9fafb; padding: 20px 30px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; }
        .warning { padding: 16px; background-color: #fef3c7; border-left: 4px solid #d97706; border-radius: 6px; margin: 24px 0; color: #92400e; font-size: 14px; }
        .link-text { word-break: break-all; color: #2563eb; }
    </style>
</head>
<body>
    <div class='wrapper'>
        <div class='header'>
            <h1>Ace Ledger</h1>
        </div>
        <div class='content'>
            <p>Hello,</p>
            <p>We received a request to reset the <strong>Master Password</strong> for your Ace Ledger settings. Privileged operations like audit log and amendment history deletion require this password.</p>
            
            <div class='warning'>
                <strong>Important:</strong> This recovery link will expire in <strong>15 minutes</strong> and is valid for a single use only. If you did not make this request, please ignore this email.
            </div>
            
            <div class='btn-wrapper'>
                <a href='{$resetUrl}' class='btn'>Reset Master Password</a>
            </div>
            
            <p>If the button doesn't work, copy and paste this URL into your browser:</p>
            <p class='link-text'><a href='{$resetUrl}'>{$resetUrl}</a></p>
        </div>
        <div class='footer'>
            <p>&copy; " . date('Y') . " Ace Ledger. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
";

// 7. Dispatch Email using SMTP / API / Fallback php mail()
$emailSent = false;
$methodUsed = '';

if (!empty($resendApiKey)) {
    // Dispatch via Resend REST API
    $methodUsed = 'Resend API';
    $ch = curl_init('https://api.resend.com/emails');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $resendApiKey,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'from' => $smtpFrom,
        'to' => [$userEmail],
        'subject' => $subject,
        'html' => $messageBody
    ]));
    $resendResponse = curl_exec($ch);
    $resendStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($resendStatus === 200 || $resendStatus === 201) {
        $emailSent = true;
    }
} elseif (!empty($sendgridApiKey)) {
    // Dispatch via SendGrid REST API
    $methodUsed = 'SendGrid API';
    $ch = curl_init('https://api.sendgrid.com/v3/mail/send');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $sendgridApiKey,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'personalizations' => [[
            'to' => [['email' => $userEmail]]
        ]],
        'from' => ['email' => $smtpFrom, 'name' => 'Ace Ledger'],
        'subject' => $subject,
        'content' => [
            ['type' => 'text/html', 'value' => $messageBody]
        ]
    ]));
    $sgResponse = curl_exec($ch);
    $sgStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($sgStatus === 202) {
        $emailSent = true;
    }
} elseif (!empty($smtpHost) && !empty($smtpUser) && !empty($smtpPass)) {
    // Custom SMTP transactional mailer function configuration
    $methodUsed = 'SMTP';
    
    // Inline socket-based light SMTP client to avoid loading heavy php dependencies
    $smtpSecure = getenv('SMTP_SECURE') ?: 'tls';
    $server = ($smtpSecure === 'ssl') ? 'ssl://' . $smtpHost : $smtpHost;
    
    $socket = @fsockopen($server, $smtpPort, $errno, $errstr, 15);
    if ($socket) {
        $response = fgets($socket, 515);
        
        // EHLO
        fwrite($socket, "EHLO " . $_SERVER['SERVER_NAME'] . "\r\n");
        $response = fgets($socket, 515);
        while (substr($response, 3, 1) === '-') {
            $response = fgets($socket, 515);
        }
        
        // STARTTLS if TLS
        if ($smtpSecure === 'tls') {
            fwrite($socket, "STARTTLS\r\n");
            $response = fgets($socket, 515);
            if (strpos($response, '220') !== false) {
                stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                // Resend EHLO after TLS
                fwrite($socket, "EHLO " . $_SERVER['SERVER_NAME'] . "\r\n");
                $response = fgets($socket, 515);
                while (substr($response, 3, 1) === '-') {
                    $response = fgets($socket, 515);
                }
            }
        }
        
        // AUTH LOGIN
        fwrite($socket, "AUTH LOGIN\r\n");
        $response = fgets($socket, 515);
        
        fwrite($socket, base64_encode($smtpUser) . "\r\n");
        $response = fgets($socket, 515);
        
        fwrite($socket, base64_encode($smtpPass) . "\r\n");
        $response = fgets($socket, 515);
        
        if (strpos($response, '235') !== false) {
            // Mail From
            fwrite($socket, "MAIL FROM:<" . $smtpFrom . ">\r\n");
            $response = fgets($socket, 515);
            
            // Recipient
            fwrite($socket, "RCPT TO:<" . $userEmail . ">\r\n");
            $response = fgets($socket, 515);
            
            // DATA
            fwrite($socket, "DATA\r\n");
            $response = fgets($socket, 515);
            
            $headersString = "MIME-Version: 1.0\r\n" .
                             "Content-Type: text/html; charset=UTF-8\r\n" .
                             "From: Ace Ledger <" . $smtpFrom . ">\r\n" .
                             "To: " . $userEmail . "\r\n" .
                             "Subject: " . $subject . "\r\n" .
                             "Date: " . date('r') . "\r\n" .
                             "Content-Transfer-Encoding: 8bit\r\n\r\n";
            
            fwrite($socket, $headersString . $messageBody . "\r\n.\r\n");
            $response = fgets($socket, 515);
            
            // QUIT
            fwrite($socket, "QUIT\r\n");
            fclose($socket);
            
            $emailSent = true;
        } else {
            fclose($socket);
        }
    }
}

// Fallback to PHP built-in mail() function (standard on Hostinger PHP shared hosting)
if (!$emailSent) {
    $methodUsed = 'PHP mail() Fallback';
    $headers = "MIME-Version: 1.0" . "\r\n";
    $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
    $headers .= "From: Ace Ledger <" . $smtpFrom . ">" . "\r\n";
    $headers .= "Reply-To: " . $smtpFrom . "\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion();

    if (@mail($userEmail, $subject, $messageBody, $headers)) {
        $emailSent = true;
    }
}

if ($emailSent) {
    echo json_encode([
        'success' => true,
        'message' => 'A secure master password reset link has been dispatched to ' . $userEmail . '.',
        'recipient' => $userEmail,
        'method' => $methodUsed
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to send recovery email. Please check your mail configurations.'
    ]);
}
