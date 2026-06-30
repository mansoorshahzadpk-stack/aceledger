<?php
// Purge files and folders owned by the web server user (nobody)
@unlink(__DIR__ . '/index.html');
@unlink(__DIR__ . '/.htaccess');

function deleteDirRecursive($dirPath) {
    if (!is_dir($dirPath)) return;
    $files = array_diff(scandir($dirPath), array('.', '..'));
    foreach ($files as $file) {
        $path = $dirPath . '/' . $file;
        is_dir($path) ? deleteDirRecursive($path) : @unlink($path);
    }
    return @rmdir($dirPath);
}

deleteDirRecursive(__DIR__ . '/app-assets');
deleteDirRecursive(__DIR__ . '/assets');

@unlink(__FILE__);
echo 'Success';
?>
