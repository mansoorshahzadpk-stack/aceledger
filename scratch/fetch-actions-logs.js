async function run() {
  const res = await fetch('https://api.github.com/repos/mansoorshahzadpk-stack/aceledger/actions/runs/26736132357/jobs');
  const json = await res.json();
  const job = json.jobs[0];
  console.log(`Job Name: ${job.name}`);
  console.log(`Job Status: ${job.status}`);
  console.log(`Job Conclusion: ${job.conclusion}`);
  console.log('\nSteps:');
  for (const step of job.steps) {
    console.log(`- ${step.name}: ${step.status} - ${step.conclusion}`);
  }
}
run();
