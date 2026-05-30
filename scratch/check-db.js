async function check() {
  const pageRes = await fetch('https://aceledger.top/');
  const html = await pageRes.text();
  
  // Find all js files preload or scripts
  const jsFiles = [];
  const regex = /\/assets\/[a-zA-Z0-9_\-]+\.js/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    jsFiles.push(match[0]);
  }
  
  console.log('JS files found on live site:', jsFiles);
  
  for (const jsFile of jsFiles) {
    const fileRes = await fetch(`https://aceledger.top${jsFile}`);
    const code = await fileRes.text();
    const supabaseMatch = code.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
    if (supabaseMatch) {
      console.log(`Found Supabase URL in ${jsFile}:`, supabaseMatch[0]);
    }
    const refMatch = code.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_\-]+/);
    if (refMatch) {
      console.log(`Found JWT-like key prefix in ${jsFile}:`, refMatch[0].slice(0, 50));
    }
  }
}

check();
