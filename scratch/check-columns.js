const supabaseUrl = "https://hpnknjoxwzocenxuziwu.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhwbmtuam94d3pvY2VueHV6aXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDkxOTMsImV4cCI6MjA5NTM4NTE5M30.PGao9Ta7s2_emo8NIXVnXLx_jkXtfxms4DiH886MPf8";

async function check() {
  try {
    const resInv = await fetch(`${supabaseUrl}/rest/v1/invoices?select=discount&limit=1`, {
      headers: {
        "apikey": anonKey,
        "Authorization": `Bearer ${anonKey}`
      }
    });
    console.log("Invoices / discount check status:", resInv.status);
    console.log("Invoices / discount check response:", await resInv.json());

    const resGrn = await fetch(`${supabaseUrl}/rest/v1/vendor_grns?select=discount&limit=1`, {
      headers: {
        "apikey": anonKey,
        "Authorization": `Bearer ${anonKey}`
      }
    });
    console.log("vendor_grns / discount check status:", resGrn.status);
    console.log("vendor_grns / discount check response:", await resGrn.json());
  } catch (err) {
    console.error("Error querying table columns:", err);
  }
}

check();
