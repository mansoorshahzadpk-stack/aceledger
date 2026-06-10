<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

$headers = function_exists('getallheaders') ? getallheaders() : [];

echo json_encode([
    'SERVER_HTTP_AUTHORIZATION' => isset($_SERVER['HTTP_AUTHORIZATION']) ? 'Set (Length: ' . strlen($_SERVER['HTTP_AUTHORIZATION']) . ')' : 'Not Set',
    'SERVER_REDIRECT_HTTP_AUTHORIZATION' => isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) ? 'Set (Length: ' . strlen($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) . ')' : 'Not Set',
    'GETALLHEADERS_AUTHORIZATION' => isset($headers['Authorization']) ? 'Set' : (isset($headers['authorization']) ? 'Set (lowercase)' : 'Not Set'),
    'ALL_GETALLHEADERS' => $headers,
    'ALL_SERVER' => array_filter($_SERVER, function($key) {
        return strpos($key, 'AUTH') !== false || strpos($key, 'HTTP') !== false;
    }, ARRAY_FILTER_USE_KEY)
]);
