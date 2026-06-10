import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const envPath = path.resolve(__dirname, '../.env');
const configDir = path.resolve(__dirname, '../public/api/settings');
const configPath = path.resolve(configDir, 'config.json');

let supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
let supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

// Fallback to reading .env file directly if not set in process.env
if ((!supabaseUrl || !supabaseAnonKey) && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const urlMatch = envContent.match(/VITE_SUPABASE_URL=["\']?([^"\']+)["\']?/);
  const keyMatch = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=["\']?([^"\']+)["\']?/);
  
  if (urlMatch) supabaseUrl = urlMatch[1];
  if (keyMatch) supabaseAnonKey = keyMatch[1];
}

// Fallback values if completely missing
supabaseUrl = supabaseUrl || 'https://hpnknjoxwzocenxuziwu.supabase.co';
supabaseAnonKey = supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhwbmtuam94d3pvY2VueHV6aXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDkxOTMsImV4cCI6MjA5NTM4NTE5M30.PGao9Ta7s2_emo8NIXVnXLx_jkXtfxms4DiH886MPf8';

// Ensure target directory exists
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// Write config.json
const configData = {
  SUPABASE_URL: supabaseUrl,
  SUPABASE_ANON_KEY: supabaseAnonKey
};

fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
console.log(`[Config Generator] Successfully wrote config.json to ${configPath}`);
console.log(`[Config Generator] URL: ${supabaseUrl}`);
console.log(`[Config Generator] Anon Key: ${supabaseAnonKey.substring(0, 15)}...`);
