<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// 1. Authenticate using Bearer JWT Token
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
    echo json_encode(['error' => 'Missing or invalid token']);
    exit;
}
$jwtToken = $matches[1];

// 2. Load Supabase credentials
$configPath = __DIR__ . '/../../settings/config.json';
if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Server configuration missing']);
    exit;
}
$config = json_decode(file_get_contents($configPath), true);
$supabaseUrl = $config['SUPABASE_URL'];
$supabaseAnonKey = $config['SUPABASE_ANON_KEY'];

// 3. Verify user authentication
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $supabaseUrl . '/auth/v1/user');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $jwtToken,
    'apikey: ' . $supabaseAnonKey
]);
$userRes = curl_exec($ch);
$statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($statusCode !== 200) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized token']);
    exit;
}

// 4. Parse request parameters
$type = $_GET['type'] ?? '';
$id = $_GET['id'] ?? '';
$format = $_GET['format'] ?? '';
$business_id = $_GET['business_id'] ?? '';

if (empty($type) || empty($format) || empty($business_id)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required parameters']);
    exit;
}

function supabase_get($url, $jwtToken, $anonKey) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $jwtToken,
        'apikey: ' . $anonKey
    ]);
    $res = curl_exec($ch);
    $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$statusCode, json_decode($res, true) ?: []];
}

$entries = [];
$title = "Financial Ledger";

if ($type === 'client') {
    // Fetch Client Name
    $url = $supabaseUrl . '/rest/v1/clients?id=eq.' . urlencode($id) . '&select=name';
    list($status, $clients) = supabase_get($url, $jwtToken, $supabaseAnonKey);
    $clientName = ($status === 200 && is_array($clients) && !empty($clients)) ? $clients[0]['name'] : 'Client';
    $title = "Financial Ledger - " . $clientName;

    // Fetch posted Invoices
    $url = $supabaseUrl . '/rest/v1/invoices?client_id=eq.' . urlencode($id) . '&business_id=eq.' . urlencode($business_id) . '&status=eq.posted&select=id,invoice_number,issue_date,total';
    list($status, $invoices) = supabase_get($url, $jwtToken, $supabaseAnonKey);
    if (!is_array($invoices) || isset($invoices['message']) || isset($invoices['code'])) {
        $invoices = [];
    }
    
    // Fetch posted Client Payments Received
    $url = $supabaseUrl . '/rest/v1/client_payments?client_id=eq.' . urlencode($id) . '&business_id=eq.' . urlencode($business_id) . '&status=eq.posted&select=id,ref,payment_date,amount,method';
    list($status, $payments) = supabase_get($url, $jwtToken, $supabaseAnonKey);
    if (!is_array($payments) || isset($payments['message']) || isset($payments['code'])) {
        $payments = [];
    }

    // Map Invoices (Debit)
    foreach ($invoices as $inv) {
        $entries[] = [
            'date' => $inv['issue_date'],
            'reference' => $inv['invoice_number'],
            'description' => 'Invoice Issued',
            'debit' => (float)$inv['total'],
            'credit' => 0.0
        ];
    }

    // Map Payments Received (Credit)
    foreach ($payments as $pay) {
        $ref = !empty($pay['ref']) ? " - Ref: " . $pay['ref'] : "";
        $entries[] = [
            'date' => $pay['payment_date'],
            'reference' => 'PAY-' . substr($pay['id'], 0, 8),
            'description' => 'Payment Received (' . ucfirst($pay['method']) . ')' . $ref,
            'debit' => 0.0,
            'credit' => (float)$pay['amount']
        ];
    }

} elseif ($type === 'vendor') {
    // Fetch Vendor Name
    $url = $supabaseUrl . '/rest/v1/vendors?id=eq.' . urlencode($id) . '&select=name';
    list($status, $vendors) = supabase_get($url, $jwtToken, $supabaseAnonKey);
    $vendorName = ($status === 200 && is_array($vendors) && !empty($vendors)) ? $vendors[0]['name'] : 'Vendor';
    $title = "Financial Ledger - " . $vendorName;

    // Fetch posted GRNs
    $url = $supabaseUrl . '/rest/v1/vendor_grns?vendor_id=eq.' . urlencode($id) . '&business_id=eq.' . urlencode($business_id) . '&status=eq.posted&select=id,grn_number,grn_date,total_amount';
    list($status, $grns) = supabase_get($url, $jwtToken, $supabaseAnonKey);
    if (!is_array($grns) || isset($grns['message']) || isset($grns['code'])) {
        $grns = [];
    }

    // Fetch posted Vendor Payments
    $url = $supabaseUrl . '/rest/v1/vendor_payments?vendor_id=eq.' . urlencode($id) . '&business_id=eq.' . urlencode($business_id) . '&status=eq.posted&select=id,reference,payment_date,amount,method';
    list($status, $payments) = supabase_get($url, $jwtToken, $supabaseAnonKey);
    if (!is_array($payments) || isset($payments['message']) || isset($payments['code'])) {
        $payments = [];
    }

    // Map GRNs (Credit)
    foreach ($grns as $grn) {
        $entries[] = [
            'date' => $grn['grn_date'],
            'reference' => $grn['grn_number'],
            'description' => 'Goods Received note',
            'debit' => 0.0,
            'credit' => (float)$grn['total_amount']
        ];
    }

    // Map Payments to Vendor (Debit)
    foreach ($payments as $pay) {
        $ref = !empty($pay['reference']) ? " - Ref: " . $pay['reference'] : "";
        $entries[] = [
            'date' => $pay['payment_date'],
            'reference' => 'PAY-' . substr($pay['id'], 0, 8),
            'description' => 'Payment to Vendor (' . ucfirst($pay['method']) . ')' . $ref,
            'debit' => (float)$pay['amount'],
            'credit' => 0.0
        ];
    }

} elseif ($type === 'general') {
    $title = "General Ledger Statement";

    // Fetch Ledger Transactions
    $url = $supabaseUrl . '/rest/v1/ledger_transactions?business_id=eq.' . urlencode($business_id) . '&select=id,transaction_date,category,description,type,amount';
    list($status, $txs) = supabase_get($url, $jwtToken, $supabaseAnonKey);
    if (!is_array($txs) || isset($txs['message']) || isset($txs['code'])) {
        $txs = [];
    }

    foreach ($txs as $tx) {
        $isDebit = strtolower($tx['type']) === 'debit';
        $entries[] = [
            'date' => $tx['transaction_date'],
            'reference' => $tx['category'],
            'description' => $tx['description'] ?: 'Transaction',
            'debit' => $isDebit ? (float)$tx['amount'] : 0.0,
            'credit' => !$isDebit ? (float)$tx['amount'] : 0.0
        ];
    }
} else {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid type specified']);
    exit;
}

// 5. Chronological sorting
usort($entries, function($a, $b) {
    $dateCompare = strcmp($a['date'], $b['date']);
    if ($dateCompare !== 0) return $dateCompare;
    return strcmp($a['reference'], $b['reference']);
});

// 6. Running Balance computation
$balance = 0.0;
$totalDebit = 0.0;
$totalCredit = 0.0;
foreach ($entries as &$e) {
    $totalDebit += $e['debit'];
    $totalCredit += $e['credit'];
    if ($type === 'vendor') {
        // Vendor accounts increase balance with Credit (Payable) and decrease with Debit (Payment)
        $balance += ($e['credit'] - $e['debit']);
    } else {
        // Client / General accounts increase balance with Debit and decrease with Credit
        $balance += ($e['debit'] - $e['credit']);
    }
    $e['balance'] = $balance;
}

// 7. Format output downloads
if ($format === 'csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="financial_ledger_' . $type . '.csv"');
    $output = fopen('php://output', 'w');
    fputcsv($output, ['Date', 'Reference #', 'Description / Party', 'Debit (+)', 'Credit (-)', 'Running Balance']);
    foreach ($entries as $e) {
        fputcsv($output, [
            $e['date'],
            $e['reference'],
            $e['description'],
            number_format($e['debit'], 2, '.', ''),
            number_format($e['credit'], 2, '.', ''),
            number_format($e['balance'], 2, '.', '')
        ]);
    }
    fclose($output);
    exit;
}

if ($format === 'xlsx' || $format === 'xls') {
    header('Content-Type: application/vnd.ms-excel');
    header('Content-Disposition: attachment; filename="financial_ledger_' . $type . '.xls"');
    echo '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
    echo '<head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><style>';
    echo 'table { border-collapse: collapse; width: 100%; font-family: sans-serif; }';
    echo 'th { background-color: #7c2d12; color: #ffffff; border: 1px solid #7c2d12; padding: 10px; font-weight: bold; text-align: left; }';
    echo 'td { border: 1px solid #e5e7eb; padding: 8px; }';
    echo '.number { text-align: right; }';
    echo '.total-row { font-weight: bold; background-color: #f3f4f6; }';
    echo '</style></head><body>';
    echo '<h2>' . htmlspecialchars($title) . '</h2>';
    echo '<table><thead><tr>';
    echo '<th>Date</th><th>Reference #</th><th>Description / Party</th><th>Debit (+)</th><th>Credit (-)</th><th>Running Balance</th>';
    echo '</tr></thead><tbody>';
    foreach ($entries as $e) {
        echo '<tr>';
        echo '<td>' . htmlspecialchars($e['date']) . '</td>';
        echo '<td>' . htmlspecialchars($e['reference']) . '</td>';
        echo '<td>' . htmlspecialchars($e['description']) . '</td>';
        echo '<td class="number">' . number_format($e['debit'], 2) . '</td>';
        echo '<td class="number">' . number_format($e['credit'], 2) . '</td>';
        echo '<td class="number">' . number_format($e['balance'], 2) . '</td>';
        echo '</tr>';
    }
    echo '<tr class="total-row">';
    echo '<td colspan="3">Totals</td>';
    echo '<td class="number">' . number_format($totalDebit, 2) . '</td>';
    echo '<td class="number">' . number_format($totalCredit, 2) . '</td>';
    echo '<td class="number">' . number_format($balance, 2) . '</td>';
    echo '</tr>';
    echo '</tbody></table></body></html>';
    exit;
}

if ($format === 'pdf') {
    header('Content-Type: text/html; charset=utf-8');
    ?>
    <!DOCTYPE html>
    <html>
    <head>
        <title><?php echo htmlspecialchars($title); ?></title>
        <style>
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1f2937; margin: 40px; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #7c2d12; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: bold; color: #7c2d12; }
            .meta-info { font-size: 13px; color: #4b5563; text-align: right; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background-color: #7c2d12; border-bottom: 2px solid #7c2d12; padding: 12px 10px; text-align: left; font-size: 11px; text-transform: uppercase; color: #ffffff; font-weight: 600; }
            td { border-bottom: 1px solid #e5e7eb; padding: 12px 10px; font-size: 13px; }
            .text-right { text-align: right; }
            .total-row { font-weight: bold; background-color: #f9fafb; border-top: 2px solid #7c2d12; border-bottom: 2px solid #7c2d12; }
            .logo-placeholder { font-size: 20px; font-weight: bold; color: #7c2d12; margin-bottom: 5px; }
            .doc-toolbar { background: #f3f4f6; padding: 15px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 10px; margin: -40px -40px 40px -40px; }
            .btn { background-color: #7c2d12; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 13px; transition: background-color 0.2s; }
            .btn:hover { background-color: #9a3412; }
            @media print {
                body { margin: 10mm; }
                .doc-toolbar { display: none !important; }
            }
        </style>
    </head>
    <body>
        <div class="doc-toolbar">
            <button class="btn" onclick="window.print()">Print / Save as PDF</button>
        </div>
        <div class="header">
            <div>
                <div class="logo-placeholder">★ Ace Ledger</div>
                <div class="title"><?php echo htmlspecialchars($title); ?></div>
            </div>
            <div class="meta-info">
                <div>Statement Date: <?php echo date('Y-m-d'); ?></div>
                <div>Generated: <?php echo date('H:i:s'); ?></div>
            </div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Reference #</th>
                    <th>Description / Party</th>
                    <th class="text-right">Debit (+)</th>
                    <th class="text-right">Credit (-)</th>
                    <th class="text-right">Running Balance</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($entries)): ?>
                    <tr>
                        <td colspan="6" style="text-align: center; color: #9ca3af; padding: 30px;">No transaction records found.</td>
                    </tr>
                <?php else: ?>
                    <?php foreach ($entries as $e): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($e['date']); ?></td>
                            <td><code style="font-family: monospace; font-size: 12px;"><?php echo htmlspecialchars($e['reference']); ?></code></td>
                            <td><?php echo htmlspecialchars($e['description']); ?></td>
                            <td class="text-right"><?php echo $e['debit'] > 0 ? number_format($e['debit'], 2) : '—'; ?></td>
                            <td class="text-right"><?php echo $e['credit'] > 0 ? number_format($e['credit'], 2) : '—'; ?></td>
                            <td class="text-right" style="font-weight: 500;"><?php echo number_format($e['balance'], 2); ?></td>
                        </tr>
                    <?php endforeach; ?>
                    <tr class="total-row">
                        <td colspan="3">Totals</td>
                        <td class="text-right"><?php echo number_format($totalDebit, 2); ?></td>
                        <td class="text-right"><?php echo number_format($totalCredit, 2); ?></td>
                        <td class="text-right"><?php echo number_format($balance, 2); ?></td>
                    </tr>
                <?php endif; ?>
            </tbody>
        </table>
        <script>
            window.onload = function() {
                // Short timeout to allow CSS styles and layouts to settle before print dialog
                setTimeout(function() { window.print(); }, 300);
            };
        </script>
    </body>
    </html>
    <?php
    exit;
}
?>
