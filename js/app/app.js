/* ============================================================================
 * app.js — PyForge game controller.
 * Depends on: PyInterpreter, PyStdlib, PyForgeContent (loaded before this).
 * ========================================================================== */
(function () {
  'use strict';

  var CONTENT = window.PyForgeContent || { python: [], cyber: [] };
  var TRACKS = {
    python: { name: 'Python', tagline: 'The language, subject by subject', lessons: CONTENT.python, icon: 'py' },
    cyber: { name: 'Cybersecurity', tagline: 'Offense, defense and everything with Python', lessons: CONTENT.cyber, icon: 'cy' }
  };

  var RANKS = [
    'Script Kiddie', 'Curious Cat', 'Shell Novice', 'Packet Whisperer', 'Byte Ranger',
    'Loop Master', 'Regex Wrangler', 'Crypto Apprentice', 'Exploit Engineer',
    'Threat Hunter', 'Red Teamer', 'Blue Guardian', 'Kernel Sage', 'Zero Cool'
  ];

  // XP thresholds grow gently so every session moves the bar.
  function levelFor(xp) {
    var lvl = 1, need = 100, total = 0;
    while (xp >= total + need) { total += need; lvl++; need = Math.round(need * 1.18); }
    return { level: lvl, into: xp - total, need: need, floor: total };
  }
  function rankFor(level) { return RANKS[Math.min(level - 1, RANKS.length - 1)]; }

  // --- persistence ----------------------------------------------------------
  var STORE_KEY = 'pyforge.progress.v1';
  var progress = loadProgress();

  function loadProgress() {
    var base = { xp: 0, done: {}, lessonDone: {}, badges: {}, streak: 0, lastDay: null,
                 solved: 0, attempts: 0, theme: null, lastLesson: {} };
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) return Object.assign(base, JSON.parse(raw));
    } catch (e) { /* private mode etc. */ }
    return base;
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) { /* ignore */ }
  }
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function bumpStreak() {
    var t = todayStr();
    if (progress.lastDay === t) return;
    var y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    progress.streak = (progress.lastDay === y) ? progress.streak + 1 : 1;
    progress.lastDay = t;
  }

  // --- tiny DOM helpers -----------------------------------------------------
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    }
    if (kids) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
      if (c === null || c === undefined) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[c];
    });
  }

  // --- lightweight Python syntax highlighter --------------------------------
  var PY_KW = /\b(False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|match|case)\b/;
  var PY_BUILTIN = /\b(print|len|range|int|str|float|bool|list|tuple|dict|set|frozenset|bytes|bytearray|input|open|enumerate|zip|map|filter|sorted|reversed|sum|min|max|abs|round|any|all|type|isinstance|issubclass|super|hasattr|getattr|setattr|repr|hex|oct|bin|chr|ord|hash|id|iter|next|format|pow|divmod)\b/;
  function highlight(code) {
    var out = '';
    var i = 0, n = code.length;
    while (i < n) {
      var c = code[i];
      // comment
      if (c === '#') {
        var j = code.indexOf('\n', i); if (j < 0) j = n;
        out += '<span class="t-com">' + esc(code.slice(i, j)) + '</span>'; i = j; continue;
      }
      // string (single/double, triple)
      if (c === '"' || c === "'") {
        var triple = code.substr(i, 3) === c + c + c;
        var q = triple ? c + c + c : c;
        var k = i + q.length;
        while (k < n) {
          if (code[k] === '\\') { k += 2; continue; }
          if (code.substr(k, q.length) === q) { k += q.length; break; }
          k++;
        }
        out += '<span class="t-str">' + esc(code.slice(i, k)) + '</span>'; i = k; continue;
      }
      // number
      if (/[0-9]/.test(c) && !/[A-Za-z_]/.test(code[i - 1] || ' ')) {
        var m = /^[0-9][0-9_.eExXbBoOa-fA-F]*/.exec(code.slice(i));
        out += '<span class="t-num">' + esc(m[0]) + '</span>'; i += m[0].length; continue;
      }
      // identifier / keyword
      if (/[A-Za-z_]/.test(c)) {
        var w = /^[A-Za-z_]\w*/.exec(code.slice(i))[0];
        var after = code.slice(i + w.length).match(/^\s*\(/);
        if (PY_KW.test(w)) out += '<span class="t-kw">' + w + '</span>';
        else if (PY_BUILTIN.test(w)) out += '<span class="t-bi">' + w + '</span>';
        else if (after) out += '<span class="t-fn">' + w + '</span>';
        else out += esc(w);
        i += w.length; continue;
      }
      out += esc(c); i++;
    }
    return out;
  }

  // --- the interpreter runner ----------------------------------------------
  function runCode(source, opts) {
    opts = opts || {};
    var interp = new window.PyInterpreter.Interpreter({
      timeLimitMs: 5000, maxSteps: 5000000,
      input: opts.input || [], files: opts.files || Object.create(null)
    });
    if (window.PyStdlib) window.PyStdlib.installAll(interp);
    return interp.run((opts.setup || '') + source);
  }

  // Derive the reference output for a challenge (cached).
  var expectCache = {};
  function expectedOutput(lesson, idx, ch) {
    if (ch.expect !== undefined) return String(ch.expect).replace(/\s+$/, '');
    var key = lesson.id + ':' + idx;
    if (expectCache[key] !== undefined) return expectCache[key];
    var res = runCode(ch.solution || '', { setup: ch.setup, input: ch.input });
    var out = res.ok ? res.output.replace(/\s+$/, '') : '';
    expectCache[key] = out;
    return out;
  }

  // ==========================================================================
  // Rendering
  // ==========================================================================
  var state = { track: 'python', lessonId: null, mobileNav: false };

  var root = document.getElementById('app');

  function totalChallenges(lesson) { return (lesson.challenges || []).length; }
  function doneCount(lesson) {
    var arr = progress.done[lesson.id] || [];
    return arr.filter(Boolean).length;
  }
  function isLessonComplete(lesson) {
    return totalChallenges(lesson) > 0 && doneCount(lesson) >= totalChallenges(lesson);
  }
  function trackProgress(track) {
    var ls = TRACKS[track].lessons;
    var done = ls.filter(isLessonComplete).length;
    return { done: done, total: ls.length };
  }

  function render() {
    clear(root);
    root.appendChild(renderHeader());
    var body = el('div', { class: 'body' });
    body.appendChild(renderSidebar());
    body.appendChild(renderMain());
    root.appendChild(body);
    if (state.mobileNav) root.classList.add('nav-open'); else root.classList.remove('nav-open');
  }

  function renderHeader() {
    var lv = levelFor(progress.xp);
    var pct = Math.round(lv.into / lv.need * 100);
    var head = el('header', { class: 'app-head' }, [
      el('button', { class: 'nav-toggle', 'aria-label': 'Menu', onclick: function () { state.mobileNav = !state.mobileNav; render(); } },
        el('span', { html: '&#9776;' })),
      el('div', { class: 'brand', onclick: goHome }, [
        el('span', { class: 'brand-mark', text: '⚒' }),
        el('div', { class: 'brand-name' }, [
          el('strong', { text: 'PyForge' }),
          el('span', { class: 'brand-sub', text: 'learn python by breaking things' })
        ])
      ]),
      el('div', { class: 'hud' }, [
        el('div', { class: 'hud-streak', title: 'Day streak' }, [
          el('span', { class: 'flame', text: '🔥' }),
          el('span', { text: String(progress.streak || 0) })
        ]),
        el('div', { class: 'hud-level' }, [
          el('div', { class: 'hud-rank' }, [
            el('span', { class: 'lvl-badge', text: 'LV ' + lv.level }),
            el('span', { class: 'rank-name', text: rankFor(lv.level) })
          ]),
          el('div', { class: 'xp-bar', title: progress.xp + ' XP' }, [
            el('div', { class: 'xp-fill', style: 'width:' + pct + '%' }),
            el('span', { class: 'xp-text', text: lv.into + ' / ' + lv.need + ' XP' })
          ])
        ]),
        el('button', { class: 'theme-btn', 'aria-label': 'Toggle theme', onclick: toggleTheme },
          el('span', { text: currentTheme() === 'dark' ? '☀' : '☾' }))
      ])
    ]);
    return head;
  }

  function renderSidebar() {
    var side = el('aside', { class: 'sidebar' });
    var switcher = el('div', { class: 'track-switch' });
    Object.keys(TRACKS).forEach(function (key) {
      var tp = trackProgress(key);
      switcher.appendChild(el('button', {
        class: 'track-tab' + (state.track === key ? ' active' : ''),
        onclick: function () { state.track = key; state.lessonId = progress.lastLesson[key] || null; state.mobileNav = false; render(); }
      }, [
        el('span', { class: 'track-tab-name', text: TRACKS[key].name }),
        el('span', { class: 'track-tab-prog', text: tp.done + '/' + tp.total })
      ]));
    });
    side.appendChild(switcher);

    var list = el('nav', { class: 'lesson-list' });
    TRACKS[state.track].lessons.forEach(function (lesson, i) {
      var done = doneCount(lesson), total = totalChallenges(lesson);
      var complete = isLessonComplete(lesson);
      var active = state.lessonId === lesson.id;
      var item = el('button', {
        class: 'lesson-item' + (active ? ' active' : '') + (complete ? ' complete' : ''),
        onclick: function () { openLesson(lesson.id); }
      }, [
        el('span', { class: 'li-num', text: complete ? '✓' : String(i + 1) }),
        el('span', { class: 'li-body' }, [
          el('span', { class: 'li-title', text: lesson.title }),
          el('span', { class: 'li-sub', text: lesson.sub })
        ]),
        el('span', { class: 'li-prog', text: total ? done + '/' + total : '' })
      ]);
      list.appendChild(item);
    });
    side.appendChild(list);
    side.appendChild(el('div', { class: 'sidebar-foot', html:
      'Progress is saved on this device.<br>Runs a real Python interpreter — no server.' }));
    return side;
  }

  function renderMain() {
    var main = el('main', { class: 'main' });
    if (state.mobileNav) main.appendChild(el('div', { class: 'scrim', onclick: function () { state.mobileNav = false; render(); } }));
    var lesson = currentLesson();
    if (!lesson) { main.appendChild(renderDashboard()); return main; }
    main.appendChild(renderLesson(lesson));
    return main;
  }

  function renderDashboard() {
    var wrap = el('div', { class: 'dash' });
    var lv = levelFor(progress.xp);
    wrap.appendChild(el('div', { class: 'dash-hero' }, [
      el('h1', { class: 'dash-title', html: 'Forge your skills in<br><span class="hl">Python</span> &amp; <span class="hl2">Cybersecurity</span>' }),
      el('p', { class: 'dash-lead', text:
        'A complete, hands-on course you play. Every code box runs a real Python interpreter, right here in the page. ' +
        'The security track exploits a built-in vulnerable network — safely, for real.' }),
      el('div', { class: 'dash-stats' }, [
        stat(rankFor(lv.level), 'rank'),
        stat('LV ' + lv.level, 'level'),
        stat(progress.xp + '', 'total XP'),
        stat((progress.solved || 0) + '', 'challenges solved'),
        stat((progress.streak || 0) + '🔥', 'day streak')
      ])
    ]));

    Object.keys(TRACKS).forEach(function (key) {
      var t = TRACKS[key];
      var tp = trackProgress(key);
      var pct = tp.total ? Math.round(tp.done / tp.total * 100) : 0;
      var next = t.lessons.find(function (l) { return !isLessonComplete(l); }) || t.lessons[0];
      wrap.appendChild(el('div', { class: 'track-card' }, [
        el('div', { class: 'track-card-head' }, [
          el('h2', { text: t.name }),
          el('span', { class: 'track-card-tag', text: t.tagline })
        ]),
        el('div', { class: 'track-card-bar' }, el('div', { class: 'track-card-fill', style: 'width:' + pct + '%' })),
        el('div', { class: 'track-card-meta', text: tp.done + ' of ' + tp.total + ' chapters complete' }),
        el('button', { class: 'btn primary', onclick: function () { state.track = key; openLesson(next.id); } },
          tp.done ? 'Continue: ' + next.title : 'Start the ' + t.name + ' track')
      ]));
    });

    wrap.appendChild(el('div', { class: 'dash-note', html:
      '<strong>Ethics first.</strong> Everything here targets a private, simulated lab that never touches the real internet. ' +
      'The same skills are for authorised testing and defence only — the line is written permission.' }));
    return wrap;
  }
  function stat(value, label) {
    return el('div', { class: 'stat' }, [
      el('span', { class: 'stat-val', text: value }),
      el('span', { class: 'stat-lbl', text: label })
    ]);
  }

  function renderLesson(lesson) {
    var wrap = el('article', { class: 'lesson' });
    var idx = TRACKS[state.track].lessons.indexOf(lesson);
    wrap.appendChild(el('div', { class: 'lesson-head' }, [
      el('div', { class: 'lesson-eyebrow', text: TRACKS[state.track].name + ' · Chapter ' + (idx + 1) }),
      el('h1', { class: 'lesson-title', text: lesson.title }),
      el('p', { class: 'lesson-sub', text: lesson.sub })
    ]));

    // teaching
    var teach = el('div', { class: 'teach' });
    (lesson.teach || []).forEach(function (block) { teach.appendChild(renderBlock(block)); });
    wrap.appendChild(teach);

    // challenges
    if ((lesson.challenges || []).length) {
      wrap.appendChild(el('div', { class: 'chal-head' }, [
        el('h2', { text: 'Challenges' }),
        el('span', { class: 'chal-count', text: doneCount(lesson) + ' / ' + totalChallenges(lesson) + ' cleared' })
      ]));
      var cwrap = el('div', { class: 'chal-wrap' });
      lesson.challenges.forEach(function (ch, i) { cwrap.appendChild(renderChallenge(lesson, ch, i)); });
      wrap.appendChild(cwrap);
    }

    // footer nav
    var lessons = TRACKS[state.track].lessons;
    var nav = el('div', { class: 'lesson-nav' });
    if (idx > 0) nav.appendChild(el('button', { class: 'btn ghost', onclick: function () { openLesson(lessons[idx - 1].id); } },
      '← ' + lessons[idx - 1].title));
    else nav.appendChild(el('span'));
    if (idx < lessons.length - 1) nav.appendChild(el('button', { class: 'btn primary', onclick: function () { openLesson(lessons[idx + 1].id); } },
      lessons[idx + 1].title + ' →'));
    wrap.appendChild(nav);
    return wrap;
  }

  function renderBlock(block) {
    if (block.p) return el('p', { class: 'tb-p', html: inlineMd(block.p) });
    if (block.h) return el('h3', { class: 'tb-h', text: block.h });
    if (block.list) {
      var ul = el('ul', { class: 'tb-list' });
      block.list.forEach(function (li) { ul.appendChild(el('li', { html: inlineMd(li) })); });
      return ul;
    }
    if (block.warn) return el('div', { class: 'callout warn', html: '<strong>Watch out.</strong> ' + inlineMd(block.warn) });
    if (block.tip) return el('div', { class: 'callout tip', html: '<strong>Tip.</strong> ' + inlineMd(block.tip) });
    if (block.code) return renderRunnable(block.code);
    return el('div');
  }
  function inlineMd(s) {
    // `code` and **bold** only, everything else escaped.
    var parts = String(s).split('`');
    var out = '';
    for (var i = 0; i < parts.length; i++) {
      if (i % 2) { out += '<code>' + esc(parts[i]) + '</code>'; continue; }
      out += esc(parts[i])
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*\s][^*]*?)\*/g, '<em>$1</em>');
    }
    return out;
  }

  // a runnable teaching example (editable, with Run)
  function renderRunnable(code) {
    var box = el('div', { class: 'runbox' });
    var ed = makeEditor(code);
    box.appendChild(ed.wrap);
    var out = el('pre', { class: 'run-out', hidden: true });
    var bar = el('div', { class: 'run-bar' }, [
      el('button', { class: 'btn run', onclick: function () {
        var res = runCode(ed.get());
        out.hidden = false;
        out.className = 'run-out' + (res.ok ? '' : ' err');
        out.textContent = res.ok ? (res.output || '(no output)') : (res.output + res.traceback);
      } }, [el('span', { class: 'run-ic', text: '▶' }), 'Run']),
      el('button', { class: 'btn ghost sm', onclick: function () { ed.set(code); out.hidden = true; } }, 'Reset')
    ]);
    box.appendChild(bar);
    box.appendChild(out);
    return box;
  }

  // editor: transparent textarea over a highlighted <pre>
  function makeEditor(initial) {
    var wrap = el('div', { class: 'editor' });
    var pre = el('pre', { class: 'ed-hl', 'aria-hidden': 'true' });
    var ta = el('textarea', { class: 'ed-input', spellcheck: 'false', autocapitalize: 'off',
      autocomplete: 'off', autocorrect: 'off', wrap: 'off' });
    ta.value = initial;
    function sync() {
      pre.innerHTML = highlight(ta.value) + '\n';
      pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft;
      var lines = ta.value.split('\n').length;
      ta.style.height = Math.max(lines * 1.55 + 1.2, 3) + 'em';
    }
    ta.addEventListener('input', sync);
    ta.addEventListener('scroll', function () { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        var s = ta.selectionStart, en = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + '    ' + ta.value.slice(en);
        ta.selectionStart = ta.selectionEnd = s + 4;
        sync();
      }
    });
    wrap.appendChild(pre);
    wrap.appendChild(ta);
    setTimeout(sync, 0);
    return { wrap: wrap, get: function () { return ta.value; }, set: function (v) { ta.value = v; sync(); }, ta: ta, sync: sync };
  }

  function renderChallenge(lesson, ch, i) {
    var solved = (progress.done[lesson.id] || [])[i];
    var card = el('div', { class: 'chal' + (solved ? ' solved' : '') });
    card.appendChild(el('div', { class: 'chal-top' }, [
      el('span', { class: 'chal-kind ' + ch.kind, text: kindLabel(ch.kind) }),
      el('span', { class: 'chal-n', text: 'Challenge ' + (i + 1) }),
      solved ? el('span', { class: 'chal-badge', text: '✓ cleared' }) : null
    ]));
    card.appendChild(el('p', { class: 'chal-prompt', html: inlineMd(ch.prompt) }));

    if (ch.kind === 'code') card.appendChild(renderCodeChallenge(lesson, ch, i));
    else if (ch.kind === 'mc') card.appendChild(renderMC(lesson, ch, i));
    else card.appendChild(renderText(lesson, ch, i));  // predict / fill
    return card;
  }
  function kindLabel(k) {
    return { code: 'WRITE CODE', mc: 'MULTIPLE CHOICE', predict: 'PREDICT OUTPUT', fill: 'FILL THE BLANK' }[k] || k;
  }

  function markSolved(lesson, i, xp) {
    if (!progress.done[lesson.id]) progress.done[lesson.id] = [];
    if (progress.done[lesson.id][i]) return false;   // already solved, no double XP
    progress.done[lesson.id][i] = true;
    progress.solved = (progress.solved || 0) + 1;
    bumpStreak();
    var before = levelFor(progress.xp).level;
    progress.xp += xp;
    var after = levelFor(progress.xp).level;
    var lessonNowDone = isLessonComplete(lesson);
    if (lessonNowDone && !progress.lessonDone[lesson.id]) {
      progress.lessonDone[lesson.id] = true;
      progress.xp += 25;   // completion bonus
      after = levelFor(progress.xp).level;
    }
    save();
    if (after > before) celebrate(after);
    return true;
  }

  function renderCodeChallenge(lesson, ch, i) {
    var wrap = el('div');
    var ed = makeEditor(ch.starter !== undefined ? ch.starter : '');
    wrap.appendChild(ed.wrap);
    var needInput = ch.input && ch.input.length;
    var stdin = null;
    if (needInput) {
      stdin = el('textarea', { class: 'stdin', placeholder: 'stdin (one value per line)' });
      stdin.value = (ch.input || []).join('\n');
      wrap.appendChild(el('label', { class: 'stdin-lbl' }, ['Program input', stdin]));
    }
    var feedback = el('div', { class: 'feedback', hidden: true });
    var out = el('pre', { class: 'run-out', hidden: true });
    var solvedFlag = (progress.done[lesson.id] || [])[i];

    var hintBtn = ch.hint ? el('button', { class: 'btn ghost sm', onclick: function () {
      feedback.hidden = false; feedback.className = 'feedback hint'; feedback.textContent = '💡 ' + ch.hint;
    } }, 'Hint') : null;
    var solBtn = ch.solution ? el('button', { class: 'btn ghost sm', onclick: function () {
      ed.set(ch.solution);
      feedback.hidden = false; feedback.className = 'feedback hint'; feedback.textContent = 'Solution loaded — run it, then make it your own.';
    } }, 'Show solution') : null;

    var bar = el('div', { class: 'run-bar' }, [
      el('button', { class: 'btn run', onclick: grade }, [el('span', { class: 'run-ic', text: '▶' }), 'Run & check']),
      el('button', { class: 'btn ghost sm', onclick: function () { ed.set(ch.starter || ''); out.hidden = true; feedback.hidden = true; } }, 'Reset'),
      hintBtn, solBtn
    ]);
    wrap.appendChild(bar);
    wrap.appendChild(out);
    wrap.appendChild(feedback);

    function grade() {
      progress.attempts = (progress.attempts || 0) + 1;
      var input = stdin ? stdin.value.split('\n').filter(function (x, idx, a) { return !(idx === a.length - 1 && x === ''); }) : (ch.input || []);
      var res = runCode(ed.get(), { setup: ch.setup, input: input });
      out.hidden = false;
      out.className = 'run-out' + (res.ok ? '' : ' err');
      out.textContent = res.ok ? (res.output || '(no output)') : (res.output + res.traceback);
      var expected = expectedOutput(lesson, i, ch);
      var got = (res.output || '').replace(/\s+$/, '');
      feedback.hidden = false;
      if (res.ok && got === expected) {
        var awarded = markSolved(lesson, i, 10);
        feedback.className = 'feedback pass';
        feedback.textContent = awarded ? '✓ Correct! +10 XP' : '✓ Correct.';
        refreshChrome();
      } else if (res.ok) {
        feedback.className = 'feedback fail';
        feedback.innerHTML = 'Not quite. Expected output:<br><code>' + esc(expected || '(nothing)') + '</code>';
      } else {
        feedback.className = 'feedback fail';
        feedback.textContent = 'Your code raised an error — read the traceback above (bottom line first).';
      }
    }
    return wrap;
  }

  function renderMC(lesson, ch, i) {
    var wrap = el('div', { class: 'mc' });
    var answered = (progress.done[lesson.id] || [])[i];
    var feedback = el('div', { class: 'feedback', hidden: true });
    ch.options.forEach(function (opt, oi) {
      var b = el('button', { class: 'mc-opt', onclick: function () {
        if (b.classList.contains('locked')) return;
        var correct = oi === ch.answer;
        Array.prototype.forEach.call(wrap.querySelectorAll('.mc-opt'), function (x) { x.classList.add('locked'); });
        b.classList.add(correct ? 'right' : 'wrong');
        if (!correct) wrap.querySelectorAll('.mc-opt')[ch.answer].classList.add('right');
        feedback.hidden = false;
        feedback.className = 'feedback ' + (correct ? 'pass' : 'fail');
        var awarded = correct ? markSolved(lesson, i, 10) : false;
        feedback.textContent = (correct ? (awarded ? '✓ +10 XP. ' : '✓ ') : '✗ ') + (ch.explain || '');
        if (correct) refreshChrome();
        progress.attempts = (progress.attempts || 0) + 1;
      } }, [el('span', { class: 'mc-key', text: 'ABCD'[oi] }), el('span', { text: opt })]);
      wrap.appendChild(b);
    });
    wrap.appendChild(feedback);
    return wrap;
  }

  function renderText(lesson, ch, i) {
    var wrap = el('div', { class: 'textq' });
    if (ch.code) wrap.appendChild(el('pre', { class: 'q-code', html: highlight(ch.code) }));
    if (ch.template) wrap.appendChild(el('pre', { class: 'q-code', html: highlight(ch.template) }));
    var input = el('input', { class: 'answer-in', type: 'text', placeholder: 'your answer', spellcheck: 'false', autocapitalize: 'off' });
    var feedback = el('div', { class: 'feedback', hidden: true });
    function check() {
      var want = String(ch.answer).trim();
      var got = input.value.trim();
      var ok = got === want || got.replace(/\s+/g, ' ') === want.replace(/\s+/g, ' ');
      feedback.hidden = false;
      feedback.className = 'feedback ' + (ok ? 'pass' : 'fail');
      if (ok) {
        var awarded = markSolved(lesson, i, 10);
        feedback.textContent = (awarded ? '✓ +10 XP. ' : '✓ ') + (ch.explain || '');
        refreshChrome();
      } else {
        feedback.innerHTML = 'Not yet. ' + (ch.explain ? '' : '') + 'Expected: <code>' + esc(want) + '</code>';
      }
      progress.attempts = (progress.attempts || 0) + 1;
    }
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); });
    wrap.appendChild(el('div', { class: 'answer-row' }, [
      input, el('button', { class: 'btn run', onclick: check }, 'Check')
    ]));
    wrap.appendChild(feedback);
    return wrap;
  }

  // ==========================================================================
  // navigation, chrome refresh, theme, celebrate
  // ==========================================================================
  function currentLesson() {
    if (!state.lessonId) return null;
    return TRACKS[state.track].lessons.find(function (l) { return l.id === state.lessonId; }) || null;
  }
  function openLesson(id) {
    state.lessonId = id;
    progress.lastLesson[state.track] = id;
    state.mobileNav = false;
    save();
    render();
    window.scrollTo(0, 0);
    var m = document.querySelector('.main'); if (m) m.scrollTop = 0;
  }
  function goHome() { state.lessonId = null; state.mobileNav = false; render(); window.scrollTo(0, 0); }

  // Update just the header + sidebar counts without rebuilding the whole lesson
  // (so editors keep their content after grading).
  function refreshChrome() {
    var head = root.querySelector('.app-head');
    if (head) root.replaceChild(renderHeader(), head);
    var side = root.querySelector('.sidebar');
    if (side) side.parentNode.replaceChild(renderSidebar(), side);
    var cc = document.querySelector('.chal-count');
    var lesson = currentLesson();
    if (cc && lesson) cc.textContent = doneCount(lesson) + ' / ' + totalChallenges(lesson) + ' cleared';
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  function toggleTheme() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    progress.theme = next; save();
    refreshChrome();
  }

  function celebrate(level) {
    toast('⚡ Level up! You are now ' + rankFor(level) + ' (LV ' + level + ')');
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    confetti();
  }
  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) { t = el('div', { id: 'toast' }); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }
  function confetti() {
    var c = el('canvas', { class: 'confetti' });
    document.body.appendChild(c);
    var ctx = c.getContext('2d');
    c.width = window.innerWidth; c.height = window.innerHeight;
    var colors = ['#ff7a3c', '#38d0d8', '#ffb454', '#4ec9a3', '#ff5d6c'];
    var parts = [];
    for (var i = 0; i < 90; i++) parts.push({
      x: c.width / 2, y: c.height / 3, vx: (Math.random() - 0.5) * 14, vy: Math.random() * -12 - 4,
      s: Math.random() * 6 + 3, col: colors[i % colors.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4
    });
    var frames = 0;
    (function tick() {
      ctx.clearRect(0, 0, c.width, c.height);
      frames++;
      parts.forEach(function (p) {
        p.vy += 0.4; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.col; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); ctx.restore();
      });
      if (frames < 120) requestAnimationFrame(tick); else c.remove();
    })();
  }

  // ==========================================================================
  // boot
  // ==========================================================================
  if (progress.theme) document.documentElement.setAttribute('data-theme', progress.theme);
  if (!CONTENT.python.length && !CONTENT.cyber.length) {
    root.appendChild(el('div', { class: 'boot-err', text: 'Content failed to load.' }));
  } else {
    render();
  }
})();
