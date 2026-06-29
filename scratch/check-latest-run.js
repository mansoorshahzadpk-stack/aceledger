async function check() {
  try {
    const res = await fetch('https://api.github.com/repos/mansoorshahzadpk-stack/aceledger/actions/runs?per_page=5', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Node-Fetch'
      }
    });
    const data = await res.json();
    if (data.workflow_runs) {
      for (const run of data.workflow_runs) {
        console.log(`Run #${run.run_number} (${run.name}): Commit: "${run.head_commit.message.split('\n')[0]}", Status: ${run.status}, Conclusion: ${run.conclusion}`);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

check();
