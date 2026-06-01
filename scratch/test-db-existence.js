import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hpnknjoxwzocenxuziwu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhwbmtuam94d3pvY2VueHV6aXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDkxOTMsImV4cCI6MjA5NTM4NTE5M30.PGao9Ta7s2_emo8NIXVnXLx_jkXtfxms4DiH886MPf8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('Testing connection to Supabase...');
  
  // 1. Check if 'assets' table exists
  const { data: assets, error: assetsErr } = await supabase
    .from('assets')
    .select('id')
    .limit(1);
    
  if (assetsErr) {
    console.log('❌ Assets table error:', assetsErr.code, '-', assetsErr.message);
  } else {
    console.log('✅ Assets table exists.');
  }

  // 2. Check if 'ledger_transactions' table exists
  const { data: ledger, error: ledgerErr } = await supabase
    .from('ledger_transactions')
    .select('id')
    .limit(1);
    
  if (ledgerErr) {
    console.log('❌ Ledger Transactions table error:', ledgerErr.code, '-', ledgerErr.message);
  } else {
    console.log('✅ Ledger Transactions table exists.');
  }

  // 3. Check if 'client_payments' contains 'asset_id'
  const { data: clientPays, error: clientPaysErr } = await supabase
    .from('client_payments')
    .select('asset_id')
    .limit(1);
    
  if (clientPaysErr) {
    console.log('❌ client_payments.asset_id column error:', clientPaysErr.code, '-', clientPaysErr.message);
  } else {
    console.log('✅ client_payments.asset_id column exists.');
  }
}

diagnose();
