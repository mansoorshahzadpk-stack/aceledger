async function run() {
  const resRuns = await fetch('https://api.github.com/repos/mansoorshahzadpk-stack/aceledger/actions/runs?per_page=5');
  const jsonRuns = await resRuns.json();
  const latestRun = jsonRuns.workflow_runs.find(r => r.name === "Auto Deploy to Hostinger");
  if (!latestRun) {
    console.log("No Auto Deploy to Hostinger runs found.");
    return;
  }
  
  console.log(`Run ID: ${latestRun.id}`);
  console.log(`Commit Message: ${latestRun.display_title}`);
  console.log(`Status: ${latestRun.status}`);
  console.log(`Conclusion: ${latestRun.conclusion}`);
  console.log('---');

  const resJobs = await fetch(`https://api.github.com/repos/mansoorshahzadpk-stack/aceledger/actions/runs/${latestRun.id}/jobs`);
  const jsonJobs = await resJobs.json();
  if (jsonJobs.jobs && jsonJobs.jobs.length > 0) {
    const job = jsonJobs.jobs[0];
    console.log(`Job Name: ${job.name}`);
    console.log(`Job Status: ${job.status}`);
    console.log(`Job Conclusion: ${job.conclusion}`);
    console.log('\nSteps:');
    for (const step of job.steps) {
      console.log(`- ${step.name}: ${step.status} - ${step.conclusion}`);
    }
  } else {
    console.log("No jobs found yet.");
  }
}
run();
