const path = require('path');
require('./harness');  // loads engine + stdlib
const { runPy } = require('./harness');
// load content
['python-1','python-2','cyber-1','cyber-2'].forEach(f => {
  try { require(path.join(__dirname,'..','js','content',f+'.js')); } catch(e){ console.log('LOAD FAIL',f,e.message); }
});
const C = globalThis.PyForgeContent;
let lessons = 0, chals = 0, fails = [];
function checkTrack(track, name) {
  track.forEach(lesson => {
    lessons++;
    (lesson.challenges||[]).forEach((ch, ci) => {
      chals++;
      if (ch.kind !== 'code') {
        // sanity for mc/predict/fill
        if (ch.kind === 'mc' && (ch.answer === undefined || !ch.options)) fails.push([lesson.id, ci, 'mc missing answer']);
        return;
      }
      if (!ch.solution) { fails.push([lesson.id, ci, 'no solution']); return; }
      // run setup + solution
      let src = (ch.setup||'') + ch.solution;
      const res = runPy(src, { input: (ch.input||[]) });
      if (!res.ok) { fails.push([lesson.id, ci, 'solution ERROR: ' + (res.error.type+': '+res.error.message).slice(0,80)]); return; }
      const got = res.output.replace(/\n+$/,'');
      if (ch.expect !== undefined) {
        const exp = String(ch.expect).replace(/\n+$/,'');
        if (got !== exp) fails.push([lesson.id, ci, 'MISMATCH exp='+JSON.stringify(exp).slice(0,60)+' got='+JSON.stringify(got).slice(0,60)]);
      }
      // also run the starter (should not crash the engine catastrophically — ok if it errors)
    });
  });
}
checkTrack(C.python,'python');
checkTrack(C.cyber,'cyber');
console.log(`Lessons: ${lessons}  Challenges: ${chals}  Failures: ${fails.length}`);
fails.slice(0,60).forEach(f => console.log('  '+f[0]+' #'+f[1]+': '+f[2]));
process.exitCode = fails.length ? 1 : 0;
