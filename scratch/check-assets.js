const supabaseUrl = "https://hpnknjoxwzocenxuziwu.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhwbmtuam94d3pvY2VueHV6aXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDkxOTMsImV4cCI6MjA5NTM4NTE5M30.PGao9Ta7s2_emo8NIXVnXLx_jkXtfxms4DiH886MPf8";

async function check() {
  try {
    const resAssets = await fetch(`${supabaseUrl}/rest/v1/assets?limit=1`, {
      headers: {
        "apikey": anonKey,
        "Authorization": `Bearer ${anonKey}`
      }
    });
    console.log("assets table check status:", resAssets.status);
    const body = await resAssets.json();
    console.log("assets table check response:", body);

    const resClientPayments = await fetch(`${supabaseUrl}/rest/v1/client_payments?select=asset_id,reconciled&limit=1`, {
      headers: {
        "apikey": anonKey,
        "Authorization": `Bearer ${anonKey}`
      }
    });
    console.log("client_payments columns status:", resClientPayments.status);
    console.log("client_payments columns response:", await resClientPayments.json());
  } catch (err) {
    console.error("Error querying schema:", err);
  }
}

check();
