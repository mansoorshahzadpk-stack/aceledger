async function run() {
  const res = await fetch('https://api.github.com/repos/mansoorshahzadpk-stack/aceledger/actions/runs/26736132357/jobs');
  const json = await res.json();
  const job = json.jobs[0];
  console.log(`Job ID: ${job.id}`);
  console.log(`Job URL: ${job.url}`);
  console.log(`HTML URL: ${job.html_url}`);
  console.log(`Steps error details:`);
  for (const step of job.steps) {
    if (step.conclusion === 'failure') {
      console.log(JSON.stringify(step, null, 2));
    }
  }
}
run();
