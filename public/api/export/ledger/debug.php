<?php
header('Content-Type: application/json');

// 1. Authenticate using Bearer JWT Token or Query Parameter
$jwtToken = $_GET['token'] ?? '';
if (empty($jwtToken)) {
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

    if (!empty($authHeader) && preg_match('/Bearer\s(\S+)/i', $authHeader, $matches)) {
        $jwtToken = $matches[1];
    }
}

if (empty($jwtToken)) {
    http_response_code(401);
    echo json_encode(['error' => 'Missing or invalid token']);
    exit;
}

$id = $_GET['id'] ?? '';
$business_id = $_GET['business_id'] ?? '';

if (empty($id) || empty($business_id)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing parameters']);
    exit;
}

// Load Supabase credentials
$configPath = __DIR__ . '/../../settings/config.json';
if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Configuration not found']);
    exit;
}
$config = json_decode(file_get_contents($configPath), true);
$supabaseUrl = $config['SUPABASE_URL'] ?? '';
$supabaseAnonKey = $config['SUPABASE_ANON_KEY'] ?? '';

function supabase_get($url, $token, $anonKey) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'apikey: ' . $anonKey,
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json'
    ]);
    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$status, json_decode($response, true)];
}

// Fetch Invoices
$urlInvs = $supabaseUrl . '/rest/v1/invoices?client_id=eq.' . urlencode($id) . '&business_id=eq.' . urlencode($business_id) . '&select=id,invoice_number,issue_date,total,status';
list($statusInvs, $invoices) = supabase_get($urlInvs, $jwtToken, $supabaseAnonKey);

// Fetch Payments
$urlPays = $supabaseUrl . '/rest/v1/client_payments?client_id=eq.' . urlencode($id) . '&business_id=eq.' . urlencode($business_id) . '&select=id,ref,payment_date,amount,method,status';
list($statusPays, $payments) = supabase_get($urlPays, $jwtToken, $supabaseAnonKey);

echo json_encode([
    'client_id' => $id,
    'business_id' => $business_id,
    'invoices' => [
        'status' => $statusInvs,
        'data' => $invoices
    ],
    'payments' => [
        'status' => $statusPays,
        'data' => $payments
    ]
], JSON_PRETTY_PRINT);
