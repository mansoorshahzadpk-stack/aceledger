const supabaseUrl = "https://hpnknjoxwzocenxuziwu.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhwbmtuam94d3pvY2VueHV6aXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDkxOTMsImV4cCI6MjA5NTM4NTE5M30.PGao9Ta7s2_emo8NIXVnXLx_jkXtfxms4DiH886MPf8";

async function check() {
  const payloads = {
    invoice_items: {
      invoice_id: "00000000-0000-0000-0000-000000000000",
      description: "Test description",
      quantity: 1,
      unit_price: 10,
      line_total: 10,
      sort_order: 0,
      shipping: 5,
      shipping_formula: "5"
    },
    vendor_grn_items: {
      grn_id: "00000000-0000-0000-0000-000000000000",
      material: "Test",
      quantity: 1,
      unit_price: 10,
      shipping: 5,
      shipping_formula: "5"
    }
  };

  for (const [table, payload] of Object.entries(payloads)) {
    console.log(`Checking ${table} columns...`);
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        "apikey": anonKey,
        "Authorization": `Bearer ${anonKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify([payload])
    });
    
    const json = await res.json();
    console.log(`Status: ${res.status}`);
    console.log(`Response:`, JSON.stringify(json, null, 2));
    console.log("---");
  }
}

check();
