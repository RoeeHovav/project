const { runPy } = require('./harness');

let pass = 0, fail = 0;
const failures = [];

function t(name, src, expected, opts) {
  const res = runPy(src, opts);
  const got = res.ok ? res.output : (res.output + res.traceback);
  if (got.trimEnd() === String(expected).trimEnd()) { pass++; }
  else {
    fail++;
    failures.push({ name, expected: String(expected), got, err: res.ok ? null : res.error });
  }
}
function terr(name, src, errType) {
  const res = runPy(src);
  if (!res.ok && res.error.type === errType) pass++;
  else { fail++; failures.push({ name, expected: 'error ' + errType, got: res.ok ? 'no error, out=' + res.output : res.error.type + ': ' + res.error.message }); }
}

module.exports = { t, terr, report: () => {
  console.log(`\n${pass} passed, ${fail} failed`);
  for (const f of failures.slice(0, 40)) {
    console.log('\n--- FAIL: ' + f.name);
    console.log('  expected: ' + JSON.stringify(f.expected));
    console.log('  got     : ' + JSON.stringify(f.got));
  }
  process.exitCode = fail ? 1 : 0;
}, stats: () => ({pass, fail}) };
