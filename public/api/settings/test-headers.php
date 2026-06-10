<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

$headers = function_exists('getallheaders') ? getallheaders() : [];

echo json_encode([
    'getenv_SUPABASE_URL' => getenv('SUPABASE_URL'),
    'getenv_SUPABASE_ANON_KEY' => getenv('SUPABASE_ANON_KEY') ? 'Set (Length: ' . strlen(getenv('SUPABASE_ANON_KEY')) . ')' : 'Not Set',
    'getenv_VITE_SUPABASE_PUBLISHABLE_KEY' => getenv('VITE_SUPABASE_PUBLISHABLE_KEY') ? 'Set (Length: ' . strlen(getenv('VITE_SUPABASE_PUBLISHABLE_KEY')) . ')' : 'Not Set',
    'SERVER_HTTP_AUTHORIZATION' => isset($_SERVER['HTTP_AUTHORIZATION']) ? 'Set (Length: ' . strlen($_SERVER['HTTP_AUTHORIZATION']) . ')' : 'Not Set',
    'SERVER_REDIRECT_HTTP_AUTHORIZATION' => isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) ? 'Set (Length: ' . strlen($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) . ')' : 'Not Set',
    'GETALLHEADERS_AUTHORIZATION' => isset($headers['Authorization']) ? 'Set' : (isset($headers['authorization']) ? 'Set (lowercase)' : 'Not Set'),
    'ALL_GETALLHEADERS' => $headers
]);
