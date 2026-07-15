<?php
header('Content-Type: text/plain');

$rootPath = realpath(__DIR__ . '/../../../../');
echo "Root Path: " . $rootPath . "\n\n";

if ($rootPath === false) {
    echo "Could not resolve parent path.\n";
    exit;
}

echo "=== FILE LIST OF public_html/app-assets/ ===\n";
$appAssetsPath = $rootPath . '/app-assets';
if (is_dir($appAssetsPath)) {
    $files = scandir($appAssetsPath);
    foreach ($files as $file) {
        if ($file === '.' || $file === '..') continue;
        $size = filesize($appAssetsPath . '/' . $file);
        echo "$file ($size bytes)\n";
    }
} else {
    echo "No public_html/app-assets/ folder found.\n";
}

echo "\n=== FILE LIST OF public_html/client/app-assets/ ===\n";
$clientAppAssetsPath = $rootPath . '/client/app-assets';
if (is_dir($clientAppAssetsPath)) {
    $files = scandir($clientAppAssetsPath);
    foreach ($files as $file) {
        if ($file === '.' || $file === '..') continue;
        $size = filesize($clientAppAssetsPath . '/' . $file);
        echo "$file ($size bytes)\n";
    }
} else {
    echo "No public_html/client/app-assets/ folder found.\n";
}
