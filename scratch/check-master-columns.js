const supabaseUrl = "https://hpnknjoxwzocenxuziwu.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhwbmtuam94d3pvY2VueHV6aXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDkxOTMsImV4cCI6MjA5NTM4NTE5M30.PGao9Ta7s2_emo8NIXVnXLx_jkXtfxms4DiH886MPf8";

async function check() {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/app_settings?select=*&limit=1`, {
      headers: {
        "apikey": anonKey,
        "Authorization": `Bearer ${anonKey}`
      }
    });
    console.log("app_settings check status:", res.status);
    const data = await res.json();
    console.log("app_settings check response:", data);
  } catch (err) {
    console.error("Error querying app_settings table columns:", err);
  }
}

check();
