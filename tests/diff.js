/* Runs each tests/cases/*.py through the engine and diffs against CPython's
   recorded output in tests/expected/<name>.txt */
const fs = require('fs');
const path = require('path');
const { runPy } = require('./harness');

const caseDir = path.join(__dirname, 'cases');
const expDir = path.join(__dirname, 'expected');
const only = process.argv[2];
let total = 0, ok = 0;
for (const f of fs.readdirSync(caseDir).sort()) {
  if (!f.endsWith('.py')) continue;
  if (only && !f.includes(only)) continue;
  const src = fs.readFileSync(path.join(caseDir, f), 'utf8');
  const expPath = path.join(expDir, f.replace(/\.py$/, '.txt'));
  const expected = fs.existsSync(expPath) ? fs.readFileSync(expPath, 'utf8') : null;
  const res = runPy(src);
  const got = res.output + (res.ok ? '' : '\n!!! ' + res.traceback);
  total++;
  if (expected === null) { console.log('NO EXPECTED for ' + f); continue; }
  if (got.trimEnd() === expected.trimEnd()) { ok++; console.log('PASS ' + f); continue; }
  console.log('FAIL ' + f);
  const gl = got.split('\n'), el = expected.split('\n');
  let shown = 0;
  for (let i = 0; i < Math.max(gl.length, el.length) && shown < 25; i++) {
    if (gl[i] !== el[i]) {
      console.log('  line ' + (i + 1));
      console.log('    py : ' + JSON.stringify(el[i]));
      console.log('    js : ' + JSON.stringify(gl[i]));
      shown++;
    }
  }
}
console.log(`\n${ok}/${total} case files match CPython`);
process.exitCode = ok === total ? 0 : 1;
