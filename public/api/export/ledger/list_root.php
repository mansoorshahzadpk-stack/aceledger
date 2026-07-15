<?php
header('Content-Type: text/plain');

$rootPath = realpath(__DIR__ . '/../../../../');
echo "Root Path: " . $rootPath . "\n\n";

if ($rootPath === false) {
    echo "Could not resolve parent path.\n";
    exit;
}

echo "=== FILE LIST OF public_html/ ===\n";
$files = scandir($rootPath);
foreach ($files as $file) {
    $fullPath = $rootPath . '/' . $file;
    $isDir = is_dir($fullPath) ? '[DIR]' : '     ';
    $size = is_file($fullPath) ? filesize($fullPath) . ' bytes' : '';
    echo "$isDir $file $size\n";
}

$htaccessPath = $rootPath . '/.htaccess';
if (file_exists($htaccessPath)) {
    echo "\n=== CONTENT OF public_html/.htaccess ===\n";
    echo file_get_contents($htaccessPath);
} else {
    echo "\nNo .htaccess found in public_html/\n";
}
