<?php
header('Content-Type: text/plain');

$clientPath = realpath(__DIR__ . '/../../../');
echo "Client Path: " . $clientPath . "\n\n";

if ($clientPath === false) {
    echo "Could not resolve client path.\n";
    exit;
}

echo "=== FILE LIST OF public_html/client/ ===\n";
$files = scandir($clientPath);
foreach ($files as $file) {
    $fullPath = $clientPath . '/' . $file;
    $isDir = is_dir($fullPath) ? '[DIR]' : '     ';
    $size = is_file($fullPath) ? filesize($fullPath) . ' bytes' : '';
    echo "$isDir $file $size\n";
}

$htaccessPath = $clientPath . '/.htaccess';
if (file_exists($htaccessPath)) {
    echo "\n=== CONTENT OF public_html/client/.htaccess ===\n";
    echo file_get_contents($htaccessPath);
} else {
    echo "\nNo .htaccess found in public_html/client/\n";
}
