const { execSync } = require('child_process');
const required = process.argv[2];
const current = execSync('git branch --show-current').toString().trim();
if (current !== required) {
  console.error(`ERROR: switch to '${required}' branch first (current: '${current}')`);
  process.exit(1);
}
