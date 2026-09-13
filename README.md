# PyForge

A complete, playable course that teaches **Python** and **cybersecurity with Python**,
running entirely in the browser — works on a laptop and on an iPhone, no install, no server.

## What it is

- A from-scratch **Python interpreter written in JavaScript** (lexer, parser, object
  model, full builtins, 45+ standard-library modules) — every code box runs real Python,
  verified line-for-line against CPython.
- **66 chapters, 339 graded challenges** across two tracks:
  - **Python** (34 chapters): every core subject from `print()` through the object model,
    generators, decorators, async, and packaging.
  - **Cybersecurity** (32 chapters): encoding, hashing, HMAC, symmetric/asymmetric crypto,
    RSA by hand, classical ciphers, networking, port scanning, web recon, and hands-on
    exploitation — SQL injection, XSS, command & path injection, SSRF, IDOR, JWT attacks —
    plus password cracking, log/packet analysis, forensics, malware triage, OSINT,
    defensive automation, cloud/API and supply-chain security, secure code review, and a
    full capstone engagement.
- A built-in **simulated network** (a vulnerable shop, an intranet, a cloud metadata
  service) with a genuinely injectable mini-SQL engine, so the security lessons are
  exploited for real — safely, with nothing touching the outside world.
- Game layer: XP, 14 ranks, levels, day streaks, per-device saved progress, light/dark.

## Structure

```
index.html            the app shell + design system
js/engine/            the Python interpreter
js/stdlib/            the simulated standard library + network
js/content/           the 66 chapters of curriculum
js/app/app.js         the game controller
tests/                CPython-diff harness + content validator
```

## Running the tests

```
node tests/diff.js              # diff engine output against recorded CPython
node tests/validate_content.js  # run all 339 challenge solutions through the engine
```

## Ethics

Every technique here targets the private, simulated lab. The same skills are for
authorised testing and defence only.
