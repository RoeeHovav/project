/* Node test harness: loads the engine and runs Python snippets. */
const path = require('path');
const files = [
  'objects.js', 'lexer.js', 'parser.js', 'builtins.js', 'methods.js', 'interpreter.js'
];
const root = path.join(__dirname, '..', 'js', 'engine');
for (const f of files) require(path.join(root, f));
const stdlibDir = path.join(__dirname, '..', 'js', 'stdlib');
const fs = require('fs');
if (fs.existsSync(stdlibDir)) {
  for (const f of fs.readdirSync(stdlibDir).sort()) {
    if (f.endsWith('.js')) require(path.join(stdlibDir, f));
  }
}

function runPy(src, opts) {
  const interp = new globalThis.PyInterpreter.Interpreter(Object.assign({ timeLimitMs: 8000 }, opts || {}));
  if (globalThis.PyStdlib) globalThis.PyStdlib.installAll(interp);
  const res = interp.run(src);
  return res;
}
module.exports = { runPy };
