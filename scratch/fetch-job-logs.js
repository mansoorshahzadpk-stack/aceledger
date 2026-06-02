async function run() {
  const resRuns = await fetch('https://api.github.com/repos/mansoorshahzadpk-stack/aceledger/actions/runs?per_page=5');
  const jsonRuns = await resRuns.json();
  const latestRun = jsonRuns.workflow_runs.find(r => r.name === "Auto Deploy to Hostinger");
  if (!latestRun) {
    console.log("No Auto Deploy to Hostinger runs found.");
    return;
  }
  
  const resJobs = await fetch(`https://api.github.com/repos/mansoorshahzadpk-stack/aceledger/actions/runs/${latestRun.id}/jobs`);
  const jsonJobs = await resJobs.json();
  if (!jsonJobs.jobs || jsonJobs.jobs.length === 0) {
    console.log("No jobs found.");
    return;
  }
  
  const job = jsonJobs.jobs[0];
  console.log(`Fetching logs for job: ${job.name} (ID: ${job.id})`);
  
  const token = process.env.GITHUB_TOKEN; // in case auth is needed, but public logs might not need it or we can try without it.
  const headers = {};
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }
  
  const resLogs = await fetch(`https://api.github.com/repos/mansoorshahzadpk-stack/aceledger/actions/jobs/${job.id}/logs`, { headers });
  if (resLogs.status !== 200) {
    console.log(`Failed to get logs: ${resLogs.status} ${resLogs.statusText}`);
    const text = await resLogs.text();
    console.log(text);
    return;
  }
  
  const logText = await resLogs.text();
  const lines = logText.split('\n');
  console.log(`Total log lines: ${lines.length}`);
  console.log('--- Last 100 lines ---');
  console.log(lines.slice(-100).join('\n'));
}

run();
