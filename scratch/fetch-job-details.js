async function run() {
  const jobId = '78791054364';
  const url = `https://api.github.com/repos/mansoorshahzadpk-stack/aceledger/actions/jobs/${jobId}`;
  
  const res = await fetch(url);
  const job = await res.json();
  console.log(`Job info:`, JSON.stringify(job, null, 2));
}
run();
