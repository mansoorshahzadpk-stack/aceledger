const supabaseUrl = "https://hpnknjoxwzocenxuziwu.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhwbmtuam94d3pvY2VueHV6aXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDkxOTMsImV4cCI6MjA5NTM4NTE5M30.PGao9Ta7s2_emo8NIXVnXLx_jkXtfxms4DiH886MPf8";

async function check() {
  // 1. Check if column exists
  try {
    const resCol = await fetch(`${supabaseUrl}/rest/v1/app_settings?select=master_password_hash&limit=1`, {
      headers: {
        "apikey": anonKey,
        "Authorization": `Bearer ${anonKey}`
      }
    });
    console.log("Column check status:", resCol.status);
    console.log("Column check response:", await resCol.json());
  } catch (err) {
    console.error("Error checking column:", err);
  }

  // 2. Try calling RPC set_master_password
  try {
    const resRpc = await fetch(`${supabaseUrl}/rest/v1/rpc/set_master_password`, {
      method: "POST",
      headers: {
        "apikey": anonKey,
        "Authorization": `Bearer ${anonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        p_user_id: "00000000-0000-0000-0000-000000000000",
        p_password: "password123"
      })
    });
    console.log("RPC check status:", resRpc.status);
    console.log("RPC check response:", await resRpc.json());
  } catch (err) {
    console.error("Error calling RPC:", err);
  }
}

check();
