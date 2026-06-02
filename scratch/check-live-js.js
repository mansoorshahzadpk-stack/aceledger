async function check() {
  const pageRes = await fetch('https://aceledger.top/');
  const html = await pageRes.text();
  
  const jsFiles = [];
  const regex = /\/app-assets\/[a-zA-Z0-9_\-]+\.js/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    jsFiles.push(match[0]);
  }
  
  console.log('JS files found on live site:', jsFiles);
  
  let found = false;
  for (const jsFile of jsFiles) {
    const fileRes = await fetch(`https://aceledger.top${jsFile}`);
    const code = await fileRes.text();
    if (code.includes('admin_delete_user')) {
      console.log(`✅ SUCCESS! Found "admin_delete_user" in ${jsFile}`);
      found = true;
    }
  }
  
  if (!found) {
    console.log('❌ NOT FOUND! "admin_delete_user" was not found in any of the live JS files.');
  }
}

check();
