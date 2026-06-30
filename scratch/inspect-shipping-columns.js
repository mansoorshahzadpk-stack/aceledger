const supabaseUrl = "https://hpnknjoxwzocenxuziwu.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhwbmtuam94d3pvY2VueHV6aXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDkxOTMsImV4cCI6MjA5NTM4NTE5M30.PGao9Ta7s2_emo8NIXVnXLx_jkXtfxms4DiH886MPf8";

async function check() {
  const tables = ["invoices", "invoice_items", "vendor_grns", "vendor_grn_items"];
  
  for (const table of tables) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, {
        headers: {
          "apikey": anonKey,
          "Authorization": `Bearer ${anonKey}`
        }
      });
      
      console.log(`Table: ${table}, Status: ${res.status}`);
      if (res.status === 200) {
        const json = await res.json();
        if (json.length > 0) {
          const keys = Object.keys(json[0]);
          console.log(`- Columns: ${keys.join(", ")}`);
          console.log(`- shipping exists: ${keys.includes("shipping")}`);
          console.log(`- shipping_formula exists: ${keys.includes("shipping_formula")}`);
        } else {
          console.log(`- Table is empty, let's fetch headers...`);
          // Try checking by posting an empty array to see schema error or another query
          const resEmpty = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
            method: "POST",
            headers: {
              "apikey": anonKey,
              "Authorization": `Bearer ${anonKey}`,
              "Content-Type": "application/json",
              "Prefer": "return=minimal"
            },
            body: JSON.stringify([{ id: "00000000-0000-0000-0000-000000000000" }])
          });
          const errJson = await resEmpty.json();
          console.log(`- Insert test error:`, errJson.message || errJson);
        }
      } else {
        console.log(`- Error response:`, await res.json());
      }
    } catch (err) {
      console.error(`Error checking ${table}:`, err);
    }
    console.log("---");
  }
}

check();
