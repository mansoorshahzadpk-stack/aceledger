async function run() {
  const resRuns = await fetch('https://api.github.com/repos/mansoorshahzadpk-stack/aceledger/actions/runs?per_page=5');
  const jsonRuns = await resRuns.json();
  const latestRun = jsonRuns.workflow_runs.find(r => r.name === "Auto Deploy to Hostinger");
  if (!latestRun) return;

  const resJobs = await fetch(`https://api.github.com/repos/mansoorshahzadpk-stack/aceledger/actions/runs/${latestRun.id}/jobs`);
  const jsonJobs = await resJobs.json();
  if (jsonJobs.jobs && jsonJobs.jobs.length > 0) {
    const job = jsonJobs.jobs[0];
    console.log(JSON.stringify(job.steps, null, 2));
  }
}
run();
