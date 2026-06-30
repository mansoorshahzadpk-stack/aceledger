import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://hpnknjoxwzocenxuziwu.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhwbmtuam94d3pvY2VueHV6aXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDkxOTMsImV4cCI6MjA5NTM4NTE5M30.PGao9Ta7s2_emo8NIXVnXLx_jkXtfxms4DiH886MPf8";

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  console.log("=== Inspecting vendor_grn_items ===");
  const { data: items, error: iErr } = await supabase
    .from('vendor_grn_items')
    .select('id, grn_id, material, quantity, unit_price, quantity_formula, unit_price_formula, shipping');

  if (iErr) {
    console.error('Error:', iErr);
    return;
  }

  const maizeItems = items.filter(it => (it.material || '').toLowerCase().includes('maize'));
  console.log(`Found ${maizeItems.length} Maize items in vendor_grn_items:`);
  maizeItems.forEach(it => {
    console.log(it);
  });

  console.log("\n=== Inspecting parent vendor_grns ===");
  const { data: grns, error: gErr } = await supabase
    .from('vendor_grns')
    .select('id, grn_number, material, quantity, unit_price, quantity_formula, unit_price_formula, shipping, total_amount, status');

  if (gErr) {
    console.error('Error:', gErr);
    return;
  }

  const maizeGrns = grns.filter(g => (g.material || '').toLowerCase().includes('maize'));
  console.log(`Found ${maizeGrns.length} Maize items in vendor_grns:`);
  maizeGrns.forEach(g => {
    console.log(g);
  });
}

inspect();
