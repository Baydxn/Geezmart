import { runSmokeTest } from '../dist-ssm/ssr-smoke.js';

const results = runSmokeTest();
let failed = 0;
for (const result of results) {
  if (result.ok) {
    console.log(`PASS  ${result.route}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${result.route} -> ${result.error}`);
  }
}
console.log(`\n${results.length - failed}/${results.length} routes rendered successfully.`);
process.exit(failed ? 1 : 0);
