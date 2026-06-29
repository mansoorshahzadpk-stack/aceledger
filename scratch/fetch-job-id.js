async function run() {
  const resRuns = await fetch('https://api.github.com/repos/mansoorshahzadpk-stack/aceledger/actions/runs?per_page=5');
  const jsonRuns = await resRuns.json();
  const latestRun = jsonRuns.workflow_runs[0];
  if (!latestRun) {
    console.log("No workflow runs found.");
    return;
  }
  const res = await fetch(`https://api.github.com/repos/mansoorshahzadpk-stack/aceledger/actions/runs/${latestRun.id}/jobs`);
  const json = await res.json();
  const job = json.jobs[0];
  console.log(`Job: ${job.name}, Status: ${job.status}, Conclusion: ${job.conclusion}`);
  console.log(`Steps details:`);
  for (const step of job.steps) {
    console.log(`- [${step.conclusion || 'PENDING'}] ${step.name}`);
  }
}
run();
