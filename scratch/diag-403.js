async function diag() {
  const urls = [
    "https://aceledger.top/",
    "https://aceledger.top/index.html",
    "https://aceledger.top/assets/index-SZquFWZP.js",
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      console.log(`URL: ${url}`);
      console.log(`  Status: ${res.status} ${res.statusText}`);
      if (res.status === 200 && url.endsWith(".html")) {
        const text = await res.text();
        console.log(`  HTML starts with: ${text.slice(0, 100)}`);
      }
    } catch (e) {
      console.error(`Failed fetching ${url}:`, e);
    }
  }
}

diag();
