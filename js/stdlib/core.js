/* ============================================================================
 * core.js — math, random, string, sys, time, os, itertools, functools,
 *           collections, copy, statistics, heapq, bisect, enum, dataclasses,
 *           typing, abc, operator, pprint, logging, unittest.
 *
 * `random` is a faithful MT19937 so that seeded sequences match CPython — the
 * "predictable PRNG" security lessons depend on that being real.
 * ========================================================================== */
(function (root) {
  'use strict';

  var O = root.PyObjects;
  var B = root.PyBuiltins;
  var S = root.PyStdlib;
  var PyList = O.PyList, PyTuple = O.PyTuple, PyDict = O.PyDict, PySet = O.PySet,
      PyBytes = O.PyBytes, PyRange = O.PyRange, PyBuiltin = O.PyBuiltin,
      PyClass = O.PyClass, PyInstance = O.PyInstance, PyIterator = O.PyIterator,
      PyFunction = O.PyFunction, PyProperty = O.PyProperty, PyError = O.PyError,
      truthy = O.truthy, repr = O.repr, str = O.str, typeName = O.typeName,
      eq = O.eq, compare = O.compare, toBigInt = O.toBigInt, toNumber = O.toNumber;

  var kwget = S.kwget, arg = S.arg, argk = S.argk, inum = S.inum;

  function F(v) { return toNumber(v); }
  function lazyIter(nextFn, name) {
    var it = new PyIterator(nextFn, name || 'iterator');
    it.__reprNative__ = function () { return '<' + (name || 'iterator') + ' object>'; };
    return it;
  }

  // ===========================================================================
  // math
  // ===========================================================================
  S.define('math', function (interp) {
    var m = S.makeModule('math');
    m.val('pi', Math.PI).val('e', Math.E).val('tau', Math.PI * 2)
     .val('inf', Infinity).val('nan', NaN);

    function f1(name, fn) { m.fn(name, function (args) { return fn(F(args[0])); }); }
    f1('sqrt', function (x) { if (x < 0) interp.valueError('math domain error'); return Math.sqrt(x); });
    f1('exp', Math.exp); f1('expm1', Math.expm1);
    f1('sin', Math.sin); f1('cos', Math.cos); f1('tan', Math.tan);
    f1('asin', Math.asin); f1('acos', Math.acos); f1('atan', Math.atan);
    f1('sinh', Math.sinh); f1('cosh', Math.cosh); f1('tanh', Math.tanh);
    f1('asinh', Math.asinh); f1('acosh', Math.acosh); f1('atanh', Math.atanh);
    f1('degrees', function (x) { return x * 180 / Math.PI; });
    f1('radians', function (x) { return x * Math.PI / 180; });
    f1('fabs', Math.abs);
    f1('log1p', Math.log1p);
    f1('cbrt', Math.cbrt);
    m.fn('log', function (args) {
      var x = F(args[0]);
      if (x <= 0) interp.valueError('math domain error');
      return args.length > 1 ? Math.log(x) / Math.log(F(args[1])) : Math.log(x);
    });
    m.fn('log2', function (args) { return Math.log2(F(args[0])); });
    m.fn('log10', function (args) { return Math.log10(F(args[0])); });
    m.fn('pow', function (args) { return Math.pow(F(args[0]), F(args[1])); });
    m.fn('atan2', function (args) { return Math.atan2(F(args[0]), F(args[1])); });
    m.fn('hypot', function (args) { return Math.hypot.apply(Math, args.map(F)); });
    m.fn('floor', function (args) { return BigInt(Math.floor(F(args[0]))); });
    m.fn('ceil', function (args) { return BigInt(Math.ceil(F(args[0]))); });
    m.fn('trunc', function (args) { return BigInt(Math.trunc(F(args[0]))); });
    m.fn('copysign', function (args) { return Math.sign(F(args[1])) * Math.abs(F(args[0])) || (F(args[1]) < 0 ? -0 : 0); });
    m.fn('fmod', function (args) { return F(args[0]) % F(args[1]); });
    m.fn('modf', function (args) {
      var x = F(args[0]);
      var ip = Math.trunc(x);
      return new PyTuple([x - ip, ip * 1.0]);
    });
    m.fn('isnan', function (args) { return Number.isNaN(F(args[0])); });
    m.fn('isinf', function (args) { return !isFinite(F(args[0])) && !Number.isNaN(F(args[0])); });
    m.fn('isfinite', function (args) { return isFinite(F(args[0])); });
    m.fn('isclose', function (args, kwargs) {
      var a = F(args[0]), b = F(args[1]);
      var rel = F(kwget(kwargs, 'rel_tol', 1e-9));
      var abs_ = F(kwget(kwargs, 'abs_tol', 0.0));
      return Math.abs(a - b) <= Math.max(rel * Math.max(Math.abs(a), Math.abs(b)), abs_);
    });
    m.fn('factorial', function (args, k, it) {
      var n = toBigInt(args[0]);
      if (n < 0n) it.valueError('factorial() not defined for negative values');
      if (n > 3000n) it.throwPy('OverflowError', 'factorial argument too large for this sandbox');
      var r = 1n;
      for (var i = 2n; i <= n; i++) r *= i;
      return r;
    });
    m.fn('gcd', function (args) {
      var g = 0n;
      args.forEach(function (a) {
        var x = toBigInt(a); if (x < 0n) x = -x;
        var y = g < 0n ? -g : g;
        while (x) { var t = y % x; y = x; x = t; }
        g = y;
      });
      return g;
    });
    m.fn('lcm', function (args) {
      var l = 1n;
      args.forEach(function (a) {
        var x = toBigInt(a); if (x < 0n) x = -x;
        if (x === 0n) { l = 0n; return; }
        var a1 = l, b1 = x;
        while (b1) { var t = a1 % b1; a1 = b1; b1 = t; }
        l = l / a1 * x;
      });
      return l;
    });
    m.fn('isqrt', function (args, k, it) {
      var n = toBigInt(args[0]);
      if (n < 0n) it.valueError('isqrt() argument must be nonnegative');
      if (n < 2n) return n;
      var x = n, y = (x + 1n) / 2n;
      while (y < x) { x = y; y = (x + n / x) / 2n; }
      return x;
    });
    m.fn('comb', function (args) {
      var n = toBigInt(args[0]), k2 = toBigInt(args[1]);
      if (k2 < 0n || k2 > n) return 0n;
      if (k2 > n - k2) k2 = n - k2;
      var r = 1n;
      for (var i = 0n; i < k2; i++) r = r * (n - i) / (i + 1n);
      return r;
    });
    m.fn('perm', function (args) {
      var n = toBigInt(args[0]);
      var k2 = args.length > 1 ? toBigInt(args[1]) : n;
      var r = 1n;
      for (var i = 0n; i < k2; i++) r *= (n - i);
      return r;
    });
    m.fn('prod', function (args, kwargs, it) {
      var items = it.toArray(args[0]);
      var acc = kwget(kwargs, 'start', 1n);
      items.forEach(function (x) { acc = it.runSync(it.binop('*', acc, x)); });
      return acc;
    });
    m.fn('fsum', function (args, k, it) {
      var s = 0;
      it.toArray(args[0]).forEach(function (x) { s += F(x); });
      return s;
    });
    m.fn('dist', function (args, k, it) {
      var p = it.toArray(args[0]).map(F), q = it.toArray(args[1]).map(F);
      var s = 0;
      for (var i = 0; i < p.length; i++) s += (p[i] - q[i]) * (p[i] - q[i]);
      return Math.sqrt(s);
    });
    return m.mod;
  });

  // ===========================================================================
  // random — MT19937, bit-compatible with CPython
  // ===========================================================================
  function MT19937() {
    this.mt = new Uint32Array(624);
    this.index = 625;
  }
  MT19937.prototype.initGenrand = function (s) {
    this.mt[0] = s >>> 0;
    for (var i = 1; i < 624; i++) {
      var prev = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      // 1812433253 * prev + i, computed in 32-bit pieces
      var lo = (prev & 0xffff) * 1812433253;
      var hi = (((prev >>> 16) * 1812433253) & 0xffff) << 16;
      this.mt[i] = ((lo + hi) + i) >>> 0;
    }
    this.index = 624;
  };
  MT19937.prototype.initByArray = function (key) {
    this.initGenrand(19650218);
    var i = 1, j = 0;
    var k = Math.max(624, key.length);
    for (; k; k--) {
      var prev = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      var lo = (prev & 0xffff) * 1664525;
      var hi = (((prev >>> 16) * 1664525) & 0xffff) << 16;
      this.mt[i] = (((this.mt[i] ^ (lo + hi)) >>> 0) + key[j] + j) >>> 0;
      i++; j++;
      if (i >= 624) { this.mt[0] = this.mt[623]; i = 1; }
      if (j >= key.length) j = 0;
    }
    for (k = 623; k; k--) {
      var prev2 = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      var lo2 = (prev2 & 0xffff) * 1566083941;
      var hi2 = (((prev2 >>> 16) * 1566083941) & 0xffff) << 16;
      this.mt[i] = (((this.mt[i] ^ (lo2 + hi2)) >>> 0) - i) >>> 0;
      i++;
      if (i >= 624) { this.mt[0] = this.mt[623]; i = 1; }
    }
    this.mt[0] = 0x80000000;
    this.index = 624;
  };
  MT19937.prototype.genrand = function () {
    if (this.index >= 624) {
      if (this.index === 625) this.initGenrand(5489);
      var y;
      for (var kk = 0; kk < 624 - 397; kk++) {
        y = ((this.mt[kk] & 0x80000000) | (this.mt[kk + 1] & 0x7fffffff)) >>> 0;
        this.mt[kk] = (this.mt[kk + 397] ^ (y >>> 1) ^ ((y & 1) ? 0x9908b0df : 0)) >>> 0;
      }
      for (; kk < 623; kk++) {
        y = ((this.mt[kk] & 0x80000000) | (this.mt[kk + 1] & 0x7fffffff)) >>> 0;
        this.mt[kk] = (this.mt[kk + (397 - 624)] ^ (y >>> 1) ^ ((y & 1) ? 0x9908b0df : 0)) >>> 0;
      }
      y = ((this.mt[623] & 0x80000000) | (this.mt[0] & 0x7fffffff)) >>> 0;
      this.mt[623] = (this.mt[396] ^ (y >>> 1) ^ ((y & 1) ? 0x9908b0df : 0)) >>> 0;
      this.index = 0;
    }
    var z = this.mt[this.index++];
    z = (z ^ (z >>> 11)) >>> 0;
    z = (z ^ ((z << 7) & 0x9d2c5680)) >>> 0;
    z = (z ^ ((z << 15) & 0xefc60000)) >>> 0;
    z = (z ^ (z >>> 18)) >>> 0;
    return z >>> 0;
  };
  MT19937.prototype.random = function () {
    var a = this.genrand() >>> 5, b = this.genrand() >>> 6;
    return (a * 67108864.0 + b) * (1.0 / 9007199254740992.0);
  };
  MT19937.prototype.getrandbits = function (k) {
    if (k <= 0) return 0n;
    if (k <= 32) return BigInt(this.genrand() >>> (32 - k));
    var words = [];
    var left = k;
    while (left > 0) {
      var take = left < 32 ? left : 32;
      var w = this.genrand() >>> (32 - take);
      words.push(BigInt(w >>> 0));
      left -= take;
    }
    var out = 0n;
    for (var i = words.length - 1; i >= 0; i--) {
      out = (out << (i === words.length - 1 ? BigInt(k - 32 * i) : 32n)) | words[i];
    }
    // Rebuild little-endian exactly as CPython does.
    out = 0n;
    var shift = 0n;
    for (var j = 0; j < words.length; j++) {
      out |= words[j] << shift;
      shift += 32n;
    }
    return out;
  };
  MT19937.prototype.seedInt = function (n) {
    if (n < 0n) n = -n;
    var key = [];
    if (n === 0n) key = [0];
    while (n > 0n) { key.push(Number(n & 0xffffffffn)); n >>= 32n; }
    this.initByArray(key);
  };

  S.define('random', function (interp) {
    var m = S.makeModule('random');
    var gen = new MT19937();
    gen.seedInt(BigInt(Math.floor(Date.now() % 2147483647)));

    function randbelow(n) {
      if (n <= 0n) return 0n;
      var k = n.toString(2).length;
      for (;;) {
        var r = gen.getrandbits(k);
        if (r < n) return r;
      }
    }
    m.__randbelow = randbelow;

    m.fn('seed', function (args) {
      var a = args.length ? args[0] : null;
      if (a === null) gen.seedInt(BigInt(Date.now()));
      else if (typeof a === 'string') {
        var n = 0n;
        var bs = B.utf8Encode(a);
        for (var i = bs.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(bs[i]);
        gen.seedInt(n);
      } else gen.seedInt(toBigInt(a));
      return null;
    });
    m.fn('random', function () { return gen.random(); });
    m.fn('getrandbits', function (args) { return gen.getrandbits(inum(args[0])); });
    m.fn('randrange', function (args, kwargs, it) {
      var start, stop, step = 1n;
      if (args.length === 1) { start = 0n; stop = toBigInt(args[0]); }
      else { start = toBigInt(args[0]); stop = toBigInt(args[1]); if (args.length > 2) step = toBigInt(args[2]); }
      var width = stop - start;
      if (step === 1n) {
        if (width <= 0n) it.valueError('empty range for randrange()');
        return start + randbelow(width);
      }
      var n = step > 0n ? (width + step - 1n) / step : (width + step + 1n) / step;
      if (n <= 0n) it.valueError('empty range for randrange()');
      return start + step * randbelow(n);
    });
    m.fn('randint', function (args, kwargs, it) {
      var a = toBigInt(args[0]), b = toBigInt(args[1]);
      if (b < a) it.valueError('empty range for randint()');
      return a + randbelow(b - a + 1n);
    });
    m.fn('choice', function (args, kwargs, it) {
      var seq = it.toArray(args[0]);
      if (!seq.length) it.indexError('Cannot choose from an empty sequence');
      return seq[Number(randbelow(BigInt(seq.length)))];
    });
    m.fn('choices', function (args, kwargs, it) {
      var pop = it.toArray(args[0]);
      var weights = kwget(kwargs, 'weights', args.length > 1 ? args[1] : null);
      var k = inum(kwget(kwargs, 'k', 1n));
      var out = [];
      if (weights === null || weights === undefined) {
        for (var i = 0; i < k; i++) out.push(pop[Math.floor(gen.random() * pop.length)]);
      } else {
        var w = it.toArray(weights).map(F);
        var total = w.reduce(function (a, b) { return a + b; }, 0);
        for (var j = 0; j < k; j++) {
          var r = gen.random() * total, acc = 0;
          for (var x = 0; x < pop.length; x++) {
            acc += w[x];
            if (r < acc) { out.push(pop[x]); break; }
          }
        }
      }
      return new PyList(out);
    });
    m.fn('shuffle', function (args, kwargs, it) {
      var lst = args[0];
      if (!(lst instanceof PyList)) it.typeError('shuffle() requires a list');
      for (var i = lst.items.length - 1; i > 0; i--) {
        var j = Number(randbelow(BigInt(i + 1)));
        var t = lst.items[i]; lst.items[i] = lst.items[j]; lst.items[j] = t;
      }
      return null;
    });
    m.fn('sample', function (args, kwargs, it) {
      var pop = it.toArray(args[0]);
      var k = inum(argk(args, kwargs, 1, 'k', 1n));
      if (k > pop.length) it.valueError('Sample larger than population or is negative');
      var pool = pop.slice();
      var out = [];
      for (var i = 0; i < k; i++) {
        var j = Number(randbelow(BigInt(pop.length - i)));
        out.push(pool[j]);
        pool[j] = pool[pop.length - i - 1];
      }
      return new PyList(out);
    });
    m.fn('uniform', function (args) {
      var a = F(args[0]), b = F(args[1]);
      return a + (b - a) * gen.random();
    });
    m.fn('gauss', function (args) {
      var mu = args.length ? F(args[0]) : 0, sigma = args.length > 1 ? F(args[1]) : 1;
      var u1 = 1 - gen.random(), u2 = gen.random();
      return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    });
    m.alias('normalvariate', 'gauss');
    m.fn('triangular', function (args) {
      var lo = args.length ? F(args[0]) : 0, hi = args.length > 1 ? F(args[1]) : 1;
      return lo + (hi - lo) * Math.sqrt(gen.random());
    });
    return m.mod;
  });

  // ===========================================================================
  // string
  // ===========================================================================
  S.define('string', function () {
    var m = S.makeModule('string');
    var lower = 'abcdefghijklmnopqrstuvwxyz';
    var upper = lower.toUpperCase();
    m.val('ascii_lowercase', lower)
     .val('ascii_uppercase', upper)
     .val('ascii_letters', lower + upper)
     .val('digits', '0123456789')
     .val('hexdigits', '0123456789abcdefABCDEF')
     .val('octdigits', '01234567')
     .val('punctuation', '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~')
     .val('whitespace', ' \t\n\r\x0b\x0c')
     .val('printable', '0123456789' + lower + upper + '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~' + ' \t\n\r\x0b\x0c');
    m.fn('capwords', function (args, k, it) {
      var s = str(args[0]);
      return s.split(/\s+/).filter(Boolean).map(function (w) {
        return w[0].toUpperCase() + w.slice(1).toLowerCase();
      }).join(' ');
    });
    return m.mod;
  });

  // ===========================================================================
  // sys / platform / getpass
  // ===========================================================================
  S.define('sys', function (interp) {
    var m = S.makeModule('sys');
    m.val('version', '3.12.0 (PyForge sandbox)')
     .val('version_info', new PyTuple([3n, 12n, 0n, 'final', 0n]))
     .val('platform', 'pyforge')
     .val('maxsize', 9223372036854775807n)
     .val('argv', new PyList(['solution.py']))
     .val('path', new PyList(['.', '/lib']))
     .val('byteorder', 'little');
    var stdout = {
      pytype: 'TextIO',
      __reprNative__: function () { return "<_io.TextIOWrapper name='<stdout>'>"; },
      __nativeAttrs__: {
        write: new PyBuiltin('write', function (args, k, it) { it.write(str(args[0])); return BigInt(str(args[0]).length); }),
        flush: new PyBuiltin('flush', function () { return null; })
      }
    };
    m.val('stdout', stdout).val('stderr', stdout);
    m.fn('exit', function (args, k, it) { it.throwPy('SystemExit', args.length ? str(args[0]) : ''); });
    m.fn('getsizeof', function (args, k, it) {
      var v = args[0];
      if (typeof v === 'string') return BigInt(49 + v.length);
      if (typeof v === 'bigint') return BigInt(28 + Math.ceil(v.toString(2).length / 30) * 4);
      if (v instanceof PyList) return BigInt(56 + 8 * v.items.length);
      return 48n;
    });
    m.fn('getrecursionlimit', function (args, k, it) { return BigInt(it.maxCallDepth); });
    m.fn('setrecursionlimit', function (args, k, it) { it.maxCallDepth = Math.min(400, inum(args[0])); return null; });
    return m.mod;
  });

  S.define('platform', function () {
    var m = S.makeModule('platform');
    m.fn('system', function () { return 'PyForge'; });
    m.fn('python_version', function () { return '3.12.0'; });
    m.fn('machine', function () { return 'wasm-ish'; });
    m.fn('node', function () { return 'training-vm'; });
    return m.mod;
  });

  S.define('getpass', function (interp) {
    var m = S.makeModule('getpass');
    m.fn('getpass', function (args, k, it) {
      var prompt = args.length ? str(args[0]) : 'Password: ';
      it.write(prompt);
      if (!it.inputQueue.length) it.throwPy('EOFError', 'no input available');
      var line = it.inputQueue.shift();
      it.write('\n');
      return line;
    });
    m.fn('getuser', function () { return 'analyst'; });
    return m.mod;
  });

  // ===========================================================================
  // time
  // ===========================================================================
  S.define('time', function (interp) {
    var m = S.makeModule('time');
    var base = 1767225600; // 2026-01-01T00:00:00Z, stable for lesson output
    var fake = base;
    m.fn('time', function () { return fake + (Date.now() % 1000) / 1000; });
    m.fn('time_ns', function () { return BigInt(Math.floor(fake * 1e9)); });
    m.fn('sleep', function (args, k, it) {
      // Time is simulated: advance the clock without blocking the browser.
      fake += F(args[0] || 0);
      it.tick(Math.min(50000, Math.floor(F(args[0] || 0) * 1000)));
      return null;
    });
    m.fn('perf_counter', function () { return (Date.now() % 100000) / 1000; });
    m.fn('monotonic', function () { return (Date.now() % 100000) / 1000; });
    m.fn('ctime', function () { return 'Thu Jan  1 00:00:00 2026'; });
    m.fn('strftime', function (args) { return str(args[0]); });
    return m.mod;
  });

  // ===========================================================================
  // os / os.path
  // ===========================================================================
  S.define('os', function (interp) {
    var m = S.makeModule('os');
    var pathMod = S.makeModule('os.path');
    pathMod.fn('join', function (args) {
      var parts = args.map(str).filter(function (p, i) { return p !== '' || i === 0; });
      var out = '';
      parts.forEach(function (p) {
        if (p.startsWith('/')) out = p;
        else if (out === '' || out.endsWith('/')) out += p;
        else out += '/' + p;
      });
      return out;
    });
    pathMod.fn('basename', function (args) { var p = str(args[0]); return p.slice(p.lastIndexOf('/') + 1); });
    pathMod.fn('dirname', function (args) {
      var p = str(args[0]); var i = p.lastIndexOf('/');
      return i < 0 ? '' : (i === 0 ? '/' : p.slice(0, i));
    });
    pathMod.fn('splitext', function (args) {
      var p = str(args[0]);
      var b = p.slice(p.lastIndexOf('/') + 1);
      var i = b.lastIndexOf('.');
      if (i <= 0) return new PyTuple([p, '']);
      return new PyTuple([p.slice(0, p.length - (b.length - i)), b.slice(i)]);
    });
    pathMod.fn('split', function (args) {
      var p = str(args[0]); var i = p.lastIndexOf('/');
      return new PyTuple([i < 0 ? '' : p.slice(0, i), p.slice(i + 1)]);
    });
    pathMod.fn('exists', function (args, k, it) { return Object.prototype.hasOwnProperty.call(it.files, str(args[0])); });
    pathMod.fn('isfile', function (args, k, it) { return Object.prototype.hasOwnProperty.call(it.files, str(args[0])); });
    pathMod.fn('isdir', function (args, k, it) {
      var p = str(args[0]).replace(/\/$/, '') + '/';
      return Object.keys(it.files).some(function (f) { return f.startsWith(p); });
    });
    pathMod.fn('getsize', function (args, k, it) {
      var p = str(args[0]);
      if (it.files[p] === undefined) it.throwPy('FileNotFoundError', p);
      return BigInt(it.files[p].length);
    });
    pathMod.fn('abspath', function (args) { var p = str(args[0]); return p.startsWith('/') ? p : '/home/analyst/' + p; });
    pathMod.fn('normpath', function (args) {
      var raw = str(args[0]);
      var absolute = raw.charAt(0) === '/';
      var parts = raw.split('/');
      var out = [];
      parts.forEach(function (seg) {
        if (seg === '' || seg === '.') return;
        if (seg === '..') {
          if (out.length && out[out.length - 1] !== '..') out.pop();
          else if (!absolute) out.push('..');
        } else out.push(seg);
      });
      var result = (absolute ? '/' : '') + out.join('/');
      return result || (absolute ? '/' : '.');
    });
    pathMod.val('sep', '/');

    m.val('path', pathMod.mod);
    m.val('sep', '/').val('linesep', '\n').val('name', 'posix');
    m.fn('getcwd', function () { return '/home/analyst'; });
    m.fn('listdir', function (args, k, it) {
      var prefix = args.length ? str(args[0]).replace(/\/$/, '') + '/' : '';
      var names = new Set();
      Object.keys(it.files).forEach(function (f) {
        if (prefix && !f.startsWith(prefix)) return;
        var rest = prefix ? f.slice(prefix.length) : f;
        names.add(rest.split('/')[0]);
      });
      return new PyList(Array.from(names).sort());
    });
    m.fn('remove', function (args, k, it) {
      var p = str(args[0]);
      if (it.files[p] === undefined) it.throwPy('FileNotFoundError', p);
      delete it.files[p];
      return null;
    });
    m.alias('unlink', 'remove');
    m.fn('rename', function (args, k, it) {
      var a = str(args[0]), b2 = str(args[1]);
      it.files[b2] = it.files[a];
      delete it.files[a];
      return null;
    });
    m.fn('makedirs', function () { return null; });
    m.fn('mkdir', function () { return null; });
    m.fn('urandom', function (args, k, it) {
      var n = inum(args[0]);
      var out = new Uint8Array(n);
      for (var i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
      return new PyBytes(out);
    });
    var envd = new PyDict();
    envd.set('HOME', '/home/analyst');
    envd.set('USER', 'analyst');
    envd.set('PATH', '/usr/local/bin:/usr/bin:/bin');
    envd.set('LANG', 'en_US.UTF-8');
    m.val('environ', envd);
    m.fn('getenv', function (args) { return envd.has(str(args[0])) ? envd.get(str(args[0])) : (args.length > 1 ? args[1] : null); });
    m.fn('walk', function (args, kwargs, it) {
      var top = str(args[0]).replace(/\/$/, '');
      var files = Object.keys(it.files).filter(function (f) { return f.startsWith(top + '/') || top === '.'; });
      var out = [new PyTuple([top, new PyList([]), new PyList(files.map(function (f) {
        return f.slice(top.length + 1);
      }))])];
      var i = 0;
      return lazyIter(function () { return i < out.length ? { value: out[i++], done: false } : { done: true }; }, 'walk');
    });
    return m.mod;
  });

  // ===========================================================================
  // itertools
  // ===========================================================================
  S.define('itertools', function (interp) {
    var m = S.makeModule('itertools');
    m.fn('count', function (args, kwargs) {
      var cur = argk(args, kwargs, 0, 'start', 0n);
      var step = argk(args, kwargs, 1, 'step', 1n);
      return lazyIter(function () {
        var v = cur;
        cur = (typeof cur === 'bigint' && typeof step === 'bigint') ? cur + step : F(cur) + F(step);
        return { value: v, done: false };
      }, 'count');
    });
    m.fn('cycle', function (args, k, it) {
      var arr = it.toArray(args[0]);
      var i = 0;
      return lazyIter(function () {
        if (!arr.length) return { done: true };
        var v = arr[i % arr.length];
        i++;
        return { value: v, done: false };
      }, 'cycle');
    });
    m.fn('repeat', function (args, kwargs) {
      var v = args[0];
      var times = args.length > 1 ? inum(args[1]) : (kwget(kwargs, 'times', null) !== null ? inum(kwget(kwargs, 'times', 0n)) : -1);
      var i = 0;
      return lazyIter(function () {
        if (times >= 0 && i >= times) return { done: true };
        i++;
        return { value: v, done: false };
      }, 'repeat');
    });
    m.fn('chain', function (args, k, it) {
      var iters = args.map(function (a) { return it.iter(a); });
      var idx = 0;
      return lazyIter(function () {
        while (idx < iters.length) {
          var r = iters[idx].next();
          if (!r.done) return r;
          idx++;
        }
        return { done: true };
      }, 'chain');
    });
    m.get('chain').__nativeAttrs__ = {
      from_iterable: new PyBuiltin('from_iterable', function (args, k, it) {
        var groups = it.toArray(args[0]);
        var flat = [];
        groups.forEach(function (g) { flat = flat.concat(it.toArray(g)); });
        var i = 0;
        return lazyIter(function () { return i < flat.length ? { value: flat[i++], done: false } : { done: true }; }, 'chain');
      })
    };
    m.fn('islice', function (args, k, it) {
      var src = it.iter(args[0]);
      var start = 0, stop = Infinity, step = 1;
      if (args.length === 2) stop = args[1] === null ? Infinity : inum(args[1]);
      else if (args.length >= 3) {
        start = args[1] === null ? 0 : inum(args[1]);
        stop = args[2] === null ? Infinity : inum(args[2]);
        if (args.length > 3) step = inum(args[3]);
      }
      var i = 0, nextWanted = start;
      return lazyIter(function () {
        for (;;) {
          if (i >= stop) return { done: true };
          var r = src.next();
          if (r.done) return { done: true };
          var cur = i++;
          if (cur === nextWanted) { nextWanted += step; return { value: r.value, done: false }; }
        }
      }, 'islice');
    });
    m.fn('product', function (args, kwargs, it) {
      var pools = args.map(function (a) { return it.toArray(a); });
      var rep = inum(kwget(kwargs, 'repeat', 1n));
      var all = [];
      for (var r = 0; r < rep; r++) all = all.concat(pools.map(function (p) { return p.slice(); }));
      var result = [[]];
      all.forEach(function (pool) {
        var next = [];
        result.forEach(function (prefix) {
          pool.forEach(function (x) { next.push(prefix.concat([x])); });
        });
        result = next;
        if (result.length > 500000) it.throwPy('MemoryError', 'product too large');
      });
      var i = 0;
      return lazyIter(function () {
        return i < result.length ? { value: new PyTuple(result[i++]), done: false } : { done: true };
      }, 'product');
    });
    m.fn('permutations', function (args, kwargs, it) {
      var pool = it.toArray(args[0]);
      var r = args.length > 1 && args[1] !== null ? inum(args[1]) : pool.length;
      var out = [];
      function rec(prefix, remaining) {
        if (prefix.length === r) { out.push(prefix.slice()); return; }
        for (var i = 0; i < remaining.length; i++) {
          var rest = remaining.slice(0, i).concat(remaining.slice(i + 1));
          rec(prefix.concat([remaining[i]]), rest);
        }
      }
      if (r <= pool.length) rec([], pool);
      var idx = 0;
      return lazyIter(function () {
        return idx < out.length ? { value: new PyTuple(out[idx++]), done: false } : { done: true };
      }, 'permutations');
    });
    m.fn('combinations', function (args, kwargs, it) {
      var pool = it.toArray(args[0]);
      var r = inum(argk(args, kwargs, 1, 'r', 0n));
      var out = [];
      function rec(start, prefix) {
        if (prefix.length === r) { out.push(prefix.slice()); return; }
        for (var i = start; i < pool.length; i++) rec(i + 1, prefix.concat([pool[i]]));
      }
      rec(0, []);
      var idx = 0;
      return lazyIter(function () {
        return idx < out.length ? { value: new PyTuple(out[idx++]), done: false } : { done: true };
      }, 'combinations');
    });
    m.fn('combinations_with_replacement', function (args, kwargs, it) {
      var pool = it.toArray(args[0]);
      var r = inum(argk(args, kwargs, 1, 'r', 0n));
      var out = [];
      function rec(start, prefix) {
        if (prefix.length === r) { out.push(prefix.slice()); return; }
        for (var i = start; i < pool.length; i++) rec(i, prefix.concat([pool[i]]));
      }
      rec(0, []);
      var idx = 0;
      return lazyIter(function () {
        return idx < out.length ? { value: new PyTuple(out[idx++]), done: false } : { done: true };
      }, 'combinations_with_replacement');
    });
    m.fn('groupby', function (args, kwargs, it) {
      var items = it.toArray(args[0]);
      var keyFn = argk(args, kwargs, 1, 'key', null);
      var groups = [];
      items.forEach(function (x) {
        var k2 = keyFn ? it.callSync(keyFn, [x], null) : x;
        if (groups.length && eq(groups[groups.length - 1][0], k2)) groups[groups.length - 1][1].push(x);
        else groups.push([k2, [x]]);
      });
      var i = 0;
      return lazyIter(function () {
        if (i >= groups.length) return { done: true };
        var g = groups[i++];
        return { value: new PyTuple([g[0], new PyList(g[1])]), done: false };
      }, 'groupby');
    });
    m.fn('accumulate', function (args, kwargs, it) {
      var items = it.toArray(args[0]);
      var fn = argk(args, kwargs, 1, 'func', null);
      var out = [];
      var acc = null;
      items.forEach(function (x, i) {
        if (i === 0) acc = x;
        else acc = fn ? it.callSync(fn, [acc, x], null) : it.runSync(it.binop('+', acc, x));
        out.push(acc);
      });
      var i2 = 0;
      return lazyIter(function () { return i2 < out.length ? { value: out[i2++], done: false } : { done: true }; }, 'accumulate');
    });
    m.fn('starmap', function (args, k, it) {
      var fn = args[0];
      var items = it.toArray(args[1]);
      var i = 0;
      return lazyIter(function () {
        if (i >= items.length) return { done: true };
        return { value: it.callSync(fn, it.toArray(items[i++]), null), done: false };
      }, 'starmap');
    });
    m.fn('zip_longest', function (args, kwargs, it) {
      var fill = kwget(kwargs, 'fillvalue', null);
      var lists = args.map(function (a) { return it.toArray(a); });
      var maxLen = Math.max.apply(Math, lists.map(function (l) { return l.length; }).concat([0]));
      var i = 0;
      return lazyIter(function () {
        if (i >= maxLen) return { done: true };
        var row = lists.map(function (l) { return i < l.length ? l[i] : fill; });
        i++;
        return { value: new PyTuple(row), done: false };
      }, 'zip_longest');
    });
    m.fn('takewhile', function (args, k, it) {
      var fn = args[0], src = it.iter(args[1]), stopped = false;
      return lazyIter(function () {
        if (stopped) return { done: true };
        var r = src.next();
        if (r.done) return { done: true };
        if (!truthy(it.callSync(fn, [r.value], null))) { stopped = true; return { done: true }; }
        return r;
      }, 'takewhile');
    });
    m.fn('dropwhile', function (args, k, it) {
      var fn = args[0], src = it.iter(args[1]), dropping = true;
      return lazyIter(function () {
        for (;;) {
          var r = src.next();
          if (r.done) return { done: true };
          if (dropping && truthy(it.callSync(fn, [r.value], null))) continue;
          dropping = false;
          return r;
        }
      }, 'dropwhile');
    });
    m.fn('filterfalse', function (args, k, it) {
      var fn = args[0], src = it.iter(args[1]);
      return lazyIter(function () {
        for (;;) {
          var r = src.next();
          if (r.done) return { done: true };
          var keep = fn === null ? !truthy(r.value) : !truthy(it.callSync(fn, [r.value], null));
          if (keep) return r;
        }
      }, 'filterfalse');
    });
    m.fn('pairwise', function (args, k, it) {
      var arr = it.toArray(args[0]);
      var i = 0;
      return lazyIter(function () {
        if (i + 1 >= arr.length) return { done: true };
        var v = new PyTuple([arr[i], arr[i + 1]]);
        i++;
        return { value: v, done: false };
      }, 'pairwise');
    });
    return m.mod;
  });

  // ===========================================================================
  // functools
  // ===========================================================================
  S.define('functools', function (interp) {
    var m = S.makeModule('functools');
    m.fn('reduce', function (args, kwargs, it) {
      var fn = args[0];
      var items = it.toArray(args[1]);
      var acc;
      var start = 0;
      if (args.length > 2) acc = args[2];
      else {
        if (!items.length) it.typeError('reduce() of empty iterable with no initial value');
        acc = items[0]; start = 1;
      }
      for (var i = start; i < items.length; i++) acc = it.callSync(fn, [acc, items[i]], null);
      return acc;
    });
    m.fn('partial', function (args, kwargs, it) {
      var fn = args[0];
      var bound = args.slice(1);
      var boundKw = kwargs;
      var p = new PyBuiltin('partial', function (a2, k2, it2) {
        var merged = null;
        if (boundKw || k2) {
          merged = new PyDict();
          if (boundKw) boundKw.map.forEach(function (e) { merged.set(e.k, e.v); });
          if (k2) k2.map.forEach(function (e) { merged.set(e.k, e.v); });
        }
        return it2.callSync(fn, bound.concat(a2), merged);
      });
      p.__reprNative__ = function () { return 'functools.partial(' + repr(fn) + ')'; };
      p.__nativeAttrs__ = { func: fn, args: new PyTuple(bound) };
      return p;
    });
    m.fn('lru_cache', function (args, kwargs, it) {
      // Usable both as @lru_cache and @lru_cache(maxsize=N).
      function wrap(fn) {
        var cache = new Map();
        var hits = 0, misses = 0;
        var wrapper = new PyBuiltin(fn.name || 'cached', function (a2, k2, it2) {
          var key = a2.map(function (x) { return O.hashKey(x); }).join('|');
          if (k2) k2.map.forEach(function (e) { key += '#' + str(e.k) + '=' + O.hashKey(e.v); });
          if (cache.has(key)) { hits++; return cache.get(key); }
          misses++;
          var v = it2.callSync(fn, a2, k2);
          cache.set(key, v);
          return v;
        });
        wrapper.__nativeAttrs__ = {
          cache_clear: new PyBuiltin('cache_clear', function () { cache.clear(); hits = 0; misses = 0; return null; }),
          cache_info: new PyBuiltin('cache_info', function () {
            return new PyTuple([BigInt(hits), BigInt(misses), null, BigInt(cache.size)]);
          }),
          __wrapped__: fn,
          __name__: fn.name || 'cached'
        };
        return wrapper;
      }
      if (args.length === 1 && O.isCallable(args[0])) return wrap(args[0]);
      return new PyBuiltin('lru_cache_decorator', function (a2) { return wrap(a2[0]); });
    });
    m.alias('cache', 'lru_cache');
    m.fn('wraps', function (args, kwargs, it) {
      var original = args[0];
      return new PyBuiltin('wraps_decorator', function (a2) {
        var fn = a2[0];
        if (fn instanceof PyFunction && original instanceof PyFunction) {
          fn.name = original.name;
          fn.qualname = original.qualname;
          fn.doc = original.doc;
        }
        return fn;
      });
    });
    m.fn('cmp_to_key', function (args, kwargs, it) {
      var cmpFn = args[0];
      return new PyBuiltin('key', function (a2, k2, it2) {
        var val = a2[0];
        var wrapperCls = new PyClass('K', [], new Map());
        var inst = new PyInstance(wrapperCls);
        inst.__dict__.set('obj', val);
        inst.__cmpFn__ = cmpFn;
        return inst;
      });
    });
    m.fn('total_ordering', function (args) { return args[0]; });
    return m.mod;
  });

  // ===========================================================================
  // collections
  // ===========================================================================
  S.define('collections', function (interp) {
    var m = S.makeModule('collections');

    // Counter -------------------------------------------------------------
    var counterCls = new PyClass('Counter', [], new Map());
    counterCls.nativeNew = function (args, kwargs, it) {
      var d = new PyDict();
      var inst = new PyInstance(counterCls);
      inst.__counter__ = d;
      if (args.length && args[0] !== null) {
        var src = args[0];
        if (src instanceof PyDict) src.map.forEach(function (e) { d.set(e.k, e.v); });
        else it.toArray(src).forEach(function (x) { d.set(x, (d.has(x) ? toBigInt(d.get(x)) : 0n) + 1n); });
      }
      if (kwargs) kwargs.map.forEach(function (e) { d.set(e.k, e.v); });
      return inst;
    };
    function counterDict(self) { return self.__counter__; }
    function counterSorted(self) {
      return counterDict(self).entries().slice().sort(function (a, b2) {
        return Number(toBigInt(b2[1]) - toBigInt(a[1]));
      });
    }
    counterCls.dict.set('most_common', new PyBuiltin('most_common', function (args, kwargs, it) {
      var self = args[0];
      var n = args.length > 1 ? inum(args[1]) : null;
      var sorted = counterSorted(self);
      var slice = n === null ? sorted : sorted.slice(0, n);
      return new PyList(slice.map(function (e) { return new PyTuple([e[0], e[1]]); }));
    }));
    counterCls.dict.set('elements', new PyBuiltin('elements', function (args, kwargs, it) {
      var self = args[0];
      var out = [];
      counterDict(self).entries().forEach(function (e) {
        var n = Number(toBigInt(e[1]));
        for (var i = 0; i < n; i++) out.push(e[0]);
      });
      var i2 = 0;
      return lazyIter(function () { return i2 < out.length ? { value: out[i2++], done: false } : { done: true }; }, 'elements');
    }));
    counterCls.dict.set('update', new PyBuiltin('update', function (args, kwargs, it) {
      var self = args[0], d = counterDict(self);
      if (args.length > 1) {
        var src = args[1];
        if (src instanceof PyDict) src.map.forEach(function (e) { d.set(e.k, (d.has(e.k) ? toBigInt(d.get(e.k)) : 0n) + toBigInt(e.v)); });
        else it.toArray(src).forEach(function (x) { d.set(x, (d.has(x) ? toBigInt(d.get(x)) : 0n) + 1n); });
      }
      return null;
    }));
    counterCls.dict.set('__getitem__', new PyBuiltin('__getitem__', function (args) {
      var d = counterDict(args[0]);
      return d.has(args[1]) ? d.get(args[1]) : 0n;
    }));
    counterCls.dict.set('__setitem__', new PyBuiltin('__setitem__', function (args) {
      counterDict(args[0]).set(args[1], args[2]); return null;
    }));
    counterCls.dict.set('__len__', new PyBuiltin('__len__', function (args) { return BigInt(counterDict(args[0]).size); }));
    counterCls.dict.set('__contains__', new PyBuiltin('__contains__', function (args) { return counterDict(args[0]).has(args[1]); }));
    counterCls.dict.set('__iter__', new PyBuiltin('__iter__', function (args, k, it) {
      var ks = counterDict(args[0]).keys(), i = 0;
      return lazyIter(function () { return i < ks.length ? { value: ks[i++], done: false } : { done: true }; }, 'counter_iter');
    }));
    counterCls.dict.set('items', new PyBuiltin('items', function (args) {
      return new PyList(counterDict(args[0]).entries().map(function (e) { return new PyTuple([e[0], e[1]]); }));
    }));
    counterCls.dict.set('keys', new PyBuiltin('keys', function (args) { return new PyList(counterDict(args[0]).keys()); }));
    counterCls.dict.set('values', new PyBuiltin('values', function (args) { return new PyList(counterDict(args[0]).values()); }));
    counterCls.dict.set('get', new PyBuiltin('get', function (args) {
      var d = counterDict(args[0]);
      return d.has(args[1]) ? d.get(args[1]) : (args.length > 2 ? args[2] : null);
    }));
    counterCls.dict.set('total', new PyBuiltin('total', function (args) {
      var t = 0n;
      counterDict(args[0]).values().forEach(function (v) { t += toBigInt(v); });
      return t;
    }));
    counterCls.dict.set('__repr__', new PyBuiltin('__repr__', function (args) {
      var sorted = counterSorted(args[0]);
      return 'Counter({' + sorted.map(function (e) { return repr(e[0]) + ': ' + repr(e[1]); }).join(', ') + '})';
    }));
    m.val('Counter', counterCls);

    // defaultdict ----------------------------------------------------------
    var ddCls = new PyClass('defaultdict', [], new Map());
    ddCls.nativeNew = function (args, kwargs, it) {
      var d = new PyDict();
      d.__default_factory__ = args.length ? args[0] : null;
      if (args.length > 1 && args[1] instanceof PyDict) args[1].map.forEach(function (e) { d.set(e.k, e.v); });
      d.__reprNative__ = function () {
        var inner = [];
        d.map.forEach(function (e) { inner.push(repr(e.k) + ': ' + repr(e.v)); });
        return 'defaultdict(' + repr(d.__default_factory__) + ', {' + inner.join(', ') + '})';
      };
      return d;
    };
    m.val('defaultdict', ddCls);

    // OrderedDict ------------------------------------------------------------
    var odCls = new PyClass('OrderedDict', [], new Map());
    odCls.nativeNew = function (args, kwargs, it) {
      var d = new PyDict();
      if (args.length && args[0] instanceof PyDict) args[0].map.forEach(function (e) { d.set(e.k, e.v); });
      else if (args.length) it.toArray(args[0]).forEach(function (p) { var pr = it.toArray(p); d.set(pr[0], pr[1]); });
      if (kwargs) kwargs.map.forEach(function (e) { d.set(e.k, e.v); });
      d.__reprNative__ = function () {
        var inner = [];
        d.map.forEach(function (e) { inner.push('(' + repr(e.k) + ', ' + repr(e.v) + ')'); });
        return 'OrderedDict([' + inner.join(', ') + '])';
      };
      return d;
    };
    m.val('OrderedDict', odCls);

    // deque -------------------------------------------------------------------
    var dequeCls = new PyClass('deque', [], new Map());
    dequeCls.nativeNew = function (args, kwargs, it) {
      var inst = new PyInstance(dequeCls);
      inst.__items__ = args.length && args[0] !== null ? it.toArray(args[0]) : [];
      var maxlen = argk(args, kwargs, 1, 'maxlen', null);
      inst.__maxlen__ = maxlen === null ? null : inum(maxlen);
      trimDeque(inst);
      return inst;
    };
    function trimDeque(self) {
      if (self.__maxlen__ !== null) {
        while (self.__items__.length > self.__maxlen__) self.__items__.shift();
      }
    }
    function dm(name, f) { dequeCls.dict.set(name, new PyBuiltin(name, function (args, kwargs, it) { return f(args[0], args.slice(1), kwargs, it); })); }
    dm('append', function (self, a) { self.__items__.push(a[0]); trimDeque(self); return null; });
    dm('appendleft', function (self, a) {
      self.__items__.unshift(a[0]);
      if (self.__maxlen__ !== null) while (self.__items__.length > self.__maxlen__) self.__items__.pop();
      return null;
    });
    dm('pop', function (self, a, k, it) {
      if (!self.__items__.length) it.indexError('pop from an empty deque');
      return self.__items__.pop();
    });
    dm('popleft', function (self, a, k, it) {
      if (!self.__items__.length) it.indexError('pop from an empty deque');
      return self.__items__.shift();
    });
    dm('extend', function (self, a, k, it) { it.toArray(a[0]).forEach(function (x) { self.__items__.push(x); }); trimDeque(self); return null; });
    dm('extendleft', function (self, a, k, it) { it.toArray(a[0]).forEach(function (x) { self.__items__.unshift(x); }); return null; });
    dm('rotate', function (self, a) {
      var n = a.length ? inum(a[0]) : 1;
      var len = self.__items__.length;
      if (!len) return null;
      n = ((n % len) + len) % len;
      self.__items__ = self.__items__.slice(len - n).concat(self.__items__.slice(0, len - n));
      return null;
    });
    dm('clear', function (self) { self.__items__.length = 0; return null; });
    dm('count', function (self, a) { return BigInt(self.__items__.filter(function (x) { return eq(x, a[0]); }).length); });
    dm('remove', function (self, a, k, it) {
      for (var i = 0; i < self.__items__.length; i++) if (eq(self.__items__[i], a[0])) { self.__items__.splice(i, 1); return null; }
      it.valueError('deque.remove(x): x not in deque');
    });
    dm('__len__', function (self) { return BigInt(self.__items__.length); });
    dm('__getitem__', function (self, a, k, it) {
      var i = inum(a[0]);
      if (i < 0) i += self.__items__.length;
      if (i < 0 || i >= self.__items__.length) it.indexError('deque index out of range');
      return self.__items__[i];
    });
    dm('__iter__', function (self) {
      var i = 0;
      return lazyIter(function () { return i < self.__items__.length ? { value: self.__items__[i++], done: false } : { done: true }; }, 'deque_iter');
    });
    dm('__repr__', function (self) {
      return 'deque([' + self.__items__.map(function (x) { return repr(x); }).join(', ') + '])' ;
    });
    dm('__contains__', function (self, a) { return self.__items__.some(function (x) { return eq(x, a[0]); }); });
    m.val('deque', dequeCls);

    // namedtuple --------------------------------------------------------------
    m.fn('namedtuple', function (args, kwargs, it) {
      var clsName = str(args[0]);
      var fieldSpec = args[1];
      var fields = typeof fieldSpec === 'string'
        ? fieldSpec.split(/[,\s]+/).filter(Boolean)
        : it.toArray(fieldSpec).map(str);
      var cls = new PyClass(clsName, [], new Map());
      cls.nativeNew = function (a2, k2, it2) {
        var inst = new PyInstance(cls);
        var vals = a2.slice();
        fields.forEach(function (f, i) {
          var v = i < vals.length ? vals[i] : (k2 && k2.has(f) ? k2.get(f) : undefined);
          if (v === undefined) it2.typeError('__new__() missing argument: ' + repr(f));
          inst.__dict__.set(f, v);
        });
        inst.__fields__ = fields;
        return inst;
      };
      cls.dict.set('_fields', new PyTuple(fields));
      cls.dict.set('__repr__', new PyBuiltin('__repr__', function (a2) {
        var self = a2[0];
        return clsName + '(' + fields.map(function (f) { return f + '=' + repr(self.__dict__.get(f)); }).join(', ') + ')';
      }));
      cls.dict.set('__len__', new PyBuiltin('__len__', function () { return BigInt(fields.length); }));
      cls.dict.set('__getitem__', new PyBuiltin('__getitem__', function (a2) {
        var self = a2[0];
        return self.__dict__.get(fields[inum(a2[1])]);
      }));
      cls.dict.set('__iter__', new PyBuiltin('__iter__', function (a2) {
        var self = a2[0], i = 0;
        return lazyIter(function () { return i < fields.length ? { value: self.__dict__.get(fields[i++]), done: false } : { done: true }; }, 'nt_iter');
      }));
      cls.dict.set('_asdict', new PyBuiltin('_asdict', function (a2) {
        var self = a2[0];
        var d = new PyDict();
        fields.forEach(function (f) { d.set(f, self.__dict__.get(f)); });
        return d;
      }));
      cls.dict.set('_replace', new PyBuiltin('_replace', function (a2, k2, it2) {
        var self = a2[0];
        var vals = fields.map(function (f) { return (k2 && k2.has(f)) ? k2.get(f) : self.__dict__.get(f); });
        return cls.nativeNew(vals, null, it2);
      }));
      return cls;
    });
    return m.mod;
  });

  // ===========================================================================
  // copy
  // ===========================================================================
  S.define('copy', function (interp) {
    var m = S.makeModule('copy');
    function shallow(v, it) {
      if (v instanceof PyList) return new PyList(v.items.slice());
      if (v instanceof PyTuple) return new PyTuple(v.items.slice());
      if (v instanceof PySet) return new PySet(v.values(), v.frozen);
      if (v instanceof PyDict) {
        var d = new PyDict();
        v.map.forEach(function (e) { d.set(e.k, e.v); });
        return d;
      }
      if (v instanceof PyBytes) return new PyBytes(v.b.slice(), v.mutable);
      if (v instanceof PyInstance) {
        var inst = new PyInstance(v.__class__);
        v.__dict__.forEach(function (val, k) { inst.__dict__.set(k, val); });
        if (v.__items__) inst.__items__ = v.__items__.slice();
        return inst;
      }
      return v;
    }
    function deep(v, it, seen) {
      seen = seen || new Map();
      if (seen.has(v)) return seen.get(v);
      if (v instanceof PyList) {
        var l = new PyList([]);
        seen.set(v, l);
        v.items.forEach(function (x) { l.items.push(deep(x, it, seen)); });
        return l;
      }
      if (v instanceof PyTuple) return new PyTuple(v.items.map(function (x) { return deep(x, it, seen); }));
      if (v instanceof PySet) return new PySet(v.values().map(function (x) { return deep(x, it, seen); }), v.frozen);
      if (v instanceof PyDict) {
        var d = new PyDict();
        seen.set(v, d);
        v.map.forEach(function (e) { d.set(deep(e.k, it, seen), deep(e.v, it, seen)); });
        return d;
      }
      if (v instanceof PyBytes) return new PyBytes(v.b.slice(), v.mutable);
      if (v instanceof PyInstance) {
        var inst = new PyInstance(v.__class__);
        seen.set(v, inst);
        v.__dict__.forEach(function (val, k) { inst.__dict__.set(k, deep(val, it, seen)); });
        if (v.__items__) inst.__items__ = v.__items__.map(function (x) { return deep(x, it, seen); });
        return inst;
      }
      return v;
    }
    m.fn('copy', function (args, k, it) { return shallow(args[0], it); });
    m.fn('deepcopy', function (args, k, it) { return deep(args[0], it); });
    return m.mod;
  });

  // ===========================================================================
  // statistics / heapq / bisect / operator
  // ===========================================================================
  S.define('statistics', function (interp) {
    var m = S.makeModule('statistics');
    function nums(it, v) { return it.toArray(v).map(F); }
    m.fn('mean', function (args, k, it) {
      var a = nums(it, args[0]);
      if (!a.length) it.throwPy('ValueError', 'mean requires at least one data point');
      return a.reduce(function (x, y) { return x + y; }, 0) / a.length;
    });
    m.fn('median', function (args, k, it) {
      var a = it.toArray(args[0]).slice().sort(function (x, y) { return compare(x, y); });
      if (!a.length) it.throwPy('ValueError', 'no median for empty data');
      var mid = Math.floor(a.length / 2);
      if (a.length % 2) return a[mid];
      return (F(a[mid - 1]) + F(a[mid])) / 2;
    });
    m.fn('mode', function (args, k, it) {
      var a = it.toArray(args[0]);
      var counts = new Map(), best = null, bestN = 0;
      a.forEach(function (x) {
        var key = O.hashKey(x);
        var n = (counts.get(key) || 0) + 1;
        counts.set(key, n);
        if (n > bestN) { bestN = n; best = x; }
      });
      if (best === null) it.throwPy('ValueError', 'no mode for empty data');
      return best;
    });
    m.fn('stdev', function (args, k, it) {
      var a = nums(it, args[0]);
      var mu = a.reduce(function (x, y) { return x + y; }, 0) / a.length;
      var v = a.reduce(function (acc, x) { return acc + (x - mu) * (x - mu); }, 0) / (a.length - 1);
      return Math.sqrt(v);
    });
    m.fn('pstdev', function (args, k, it) {
      var a = nums(it, args[0]);
      var mu = a.reduce(function (x, y) { return x + y; }, 0) / a.length;
      var v = a.reduce(function (acc, x) { return acc + (x - mu) * (x - mu); }, 0) / a.length;
      return Math.sqrt(v);
    });
    m.fn('variance', function (args, k, it) {
      var a = nums(it, args[0]);
      var mu = a.reduce(function (x, y) { return x + y; }, 0) / a.length;
      return a.reduce(function (acc, x) { return acc + (x - mu) * (x - mu); }, 0) / (a.length - 1);
    });
    return m.mod;
  });

  S.define('heapq', function (interp) {
    var m = S.makeModule('heapq');
    function up(arr, pos) {
      var item = arr[pos];
      while (pos > 0) {
        var parent = (pos - 1) >> 1;
        if (compare(item, arr[parent]) < 0) { arr[pos] = arr[parent]; pos = parent; }
        else break;
      }
      arr[pos] = item;
    }
    function down(arr, pos) {
      var n = arr.length, item = arr[pos];
      for (;;) {
        var child = 2 * pos + 1;
        if (child >= n) break;
        if (child + 1 < n && compare(arr[child + 1], arr[child]) < 0) child++;
        if (compare(arr[child], item) >= 0) break;
        arr[pos] = arr[child];
        pos = child;
      }
      arr[pos] = item;
    }
    m.fn('heappush', function (args) {
      var h = args[0];
      h.items.push(args[1]);
      up(h.items, h.items.length - 1);
      return null;
    });
    m.fn('heappop', function (args, k, it) {
      var h = args[0];
      if (!h.items.length) it.indexError('index out of range');
      var last = h.items.pop();
      if (!h.items.length) return last;
      var top = h.items[0];
      h.items[0] = last;
      down(h.items, 0);
      return top;
    });
    m.fn('heapify', function (args) {
      var h = args[0];
      for (var i = (h.items.length >> 1) - 1; i >= 0; i--) down(h.items, i);
      return null;
    });
    m.fn('nlargest', function (args, kwargs, it) {
      var n = inum(args[0]);
      var arr = it.toArray(args[1]);
      var keyFn = kwget(kwargs, 'key', null);
      return new PyList(B.sortKeyed(it, arr, keyFn, true).slice(0, n));
    });
    m.fn('nsmallest', function (args, kwargs, it) {
      var n = inum(args[0]);
      var arr = it.toArray(args[1]);
      var keyFn = kwget(kwargs, 'key', null);
      return new PyList(B.sortKeyed(it, arr, keyFn, false).slice(0, n));
    });
    return m.mod;
  });

  S.define('bisect', function (interp) {
    var m = S.makeModule('bisect');
    function bisectRight(arr, x) {
      var lo = 0, hi = arr.length;
      while (lo < hi) {
        var mid = (lo + hi) >> 1;
        if (compare(x, arr[mid]) < 0) hi = mid; else lo = mid + 1;
      }
      return lo;
    }
    function bisectLeft(arr, x) {
      var lo = 0, hi = arr.length;
      while (lo < hi) {
        var mid = (lo + hi) >> 1;
        if (compare(arr[mid], x) < 0) lo = mid + 1; else hi = mid;
      }
      return lo;
    }
    m.fn('bisect_right', function (args) { return BigInt(bisectRight(args[0].items, args[1])); });
    m.fn('bisect_left', function (args) { return BigInt(bisectLeft(args[0].items, args[1])); });
    m.alias('bisect', 'bisect_right');
    m.fn('insort_right', function (args) { args[0].items.splice(bisectRight(args[0].items, args[1]), 0, args[1]); return null; });
    m.fn('insort_left', function (args) { args[0].items.splice(bisectLeft(args[0].items, args[1]), 0, args[1]); return null; });
    m.alias('insort', 'insort_right');
    return m.mod;
  });

  S.define('operator', function (interp) {
    var m = S.makeModule('operator');
    var ops = {
      add: '+', sub: '-', mul: '*', truediv: '/', floordiv: '//', mod: '%',
      pow: '**', and_: '&', or_: '|', xor: '^', lshift: '<<', rshift: '>>'
    };
    Object.keys(ops).forEach(function (name) {
      m.fn(name, function (args, k, it) { return it.runSync(it.binop(ops[name], args[0], args[1])); });
    });
    var cmps = { lt: '<', le: '<=', gt: '>', ge: '>=', eq: '==', ne: '!=' };
    Object.keys(cmps).forEach(function (name) {
      m.fn(name, function (args, k, it) { return it.runSync(it.compareOp(cmps[name], args[0], args[1])); });
    });
    m.fn('neg', function (args, k, it) { return it.unaryop('-', args[0]); });
    m.fn('not_', function (args) { return !truthy(args[0]); });
    m.fn('itemgetter', function (args, k, it) {
      var keys = args.slice();
      return new PyBuiltin('itemgetter', function (a2, k2, it2) {
        if (keys.length === 1) return it2.getitem(a2[0], keys[0]);
        return new PyTuple(keys.map(function (kk) { return it2.getitem(a2[0], kk); }));
      });
    });
    m.fn('attrgetter', function (args) {
      var names = args.map(str);
      return new PyBuiltin('attrgetter', function (a2, k2, it2) {
        function dig(obj, path) {
          return path.split('.').reduce(function (o, p) { return it2.getattr(o, p); }, obj);
        }
        if (names.length === 1) return dig(a2[0], names[0]);
        return new PyTuple(names.map(function (n) { return dig(a2[0], n); }));
      });
    });
    m.fn('methodcaller', function (args, kwargs) {
      var name = str(args[0]);
      var extra = args.slice(1);
      return new PyBuiltin('methodcaller', function (a2, k2, it2) {
        return it2.callSync(it2.getattr(a2[0], name), extra, kwargs);
      });
    });
    return m.mod;
  });

  // ===========================================================================
  // enum / dataclasses / typing / abc
  // ===========================================================================
  S.define('enum', function (interp) {
    var m = S.makeModule('enum');
    var enumBase = new PyClass('Enum', [], new Map());
    enumBase.__isEnumBase__ = true;
    m.val('Enum', enumBase);
    var intEnum = new PyClass('IntEnum', [enumBase], new Map());
    intEnum.__isEnumBase__ = true;
    m.val('IntEnum', intEnum);
    m.fn('auto', function () { return { __auto__: true, pytype: 'auto' }; });
    m.val('unique', new PyBuiltin('unique', function (args) { return args[0]; }));
    return m.mod;
  });

  S.define('dataclasses', function (interp) {
    var m = S.makeModule('dataclasses');
    function buildDataclass(cls, opts, it) {
      var fields = [];
      var anns = cls.dict.get('__annotations__');
      if (anns instanceof PyDict) {
        anns.map.forEach(function (e) {
          var name = str(e.k);
          fields.push({ name: name, def: cls.dict.has(name) ? cls.dict.get(name) : undefined });
        });
      }
      cls.__dcfields__ = fields;
      if (!cls.dict.has('__init__')) {
        cls.dict.set('__init__', new PyBuiltin('__init__', function (a2, k2, it2) {
          var self = a2[0];
          var vals = a2.slice(1);
          fields.forEach(function (f, i) {
            var v;
            if (i < vals.length) v = vals[i];
            else if (k2 && k2.has(f.name)) v = k2.get(f.name);
            else if (f.def !== undefined) v = f.def;
            else it2.typeError(cls.name + '.__init__() missing required argument: ' + repr(f.name));
            if (v && v.__isField__) v = v.defaultValue;
            self.__dict__.set(f.name, v);
          });
          return null;
        }));
      }
      if (!cls.dict.has('__repr__')) {
        cls.dict.set('__repr__', new PyBuiltin('__repr__', function (a2) {
          var self = a2[0];
          return cls.name + '(' + fields.map(function (f) {
            return f.name + '=' + repr(self.__dict__.get(f.name));
          }).join(', ') + ')';
        }));
      }
      if (!cls.dict.has('__eq__')) {
        cls.dict.set('__eq__', new PyBuiltin('__eq__', function (a2) {
          var self = a2[0], other = a2[1];
          if (!(other instanceof PyInstance) || other.__class__ !== cls) return false;
          return fields.every(function (f) { return eq(self.__dict__.get(f.name), other.__dict__.get(f.name)); });
        }));
      }
      if (opts && opts.frozen) {
        cls.__frozenDataclass__ = true;
        var origInit = cls.dict.get('__init__');
        cls.dict.set('__init__', new PyBuiltin('__init__', function (a2, k2, it2) {
          var r = it2.callSync(origInit, a2, k2);
          a2[0].__frozen__ = true;
          return r;
        }));
      }
      if (opts && opts.order) {
        cls.dict.set('__lt__', new PyBuiltin('__lt__', function (a2) {
          var self = a2[0], other = a2[1];
          var av = fields.map(function (f) { return self.__dict__.get(f.name); });
          var bv = fields.map(function (f) { return other.__dict__.get(f.name); });
          return compare(new PyTuple(av), new PyTuple(bv)) < 0;
        }));
      }
      cls.mro = O.computeMro(cls);
      return cls;
    }
    m.fn('dataclass', function (args, kwargs, it) {
      var opts = {
        frozen: truthy(kwget(kwargs, 'frozen', false)),
        order: truthy(kwget(kwargs, 'order', false))
      };
      if (args.length && args[0] instanceof PyClass) return buildDataclass(args[0], opts, it);
      return new PyBuiltin('dataclass_decorator', function (a2, k2, it2) {
        return buildDataclass(a2[0], opts, it2);
      });
    });
    m.fn('field', function (args, kwargs) {
      var dfv = kwget(kwargs, 'default', null);
      var factory = kwget(kwargs, 'default_factory', null);
      return { __isField__: true, defaultValue: dfv, factory: factory, pytype: 'Field' };
    });
    m.fn('asdict', function (args, k, it) {
      var self = args[0];
      var d = new PyDict();
      self.__dict__.forEach(function (v, key) { d.set(key, v); });
      return d;
    });
    m.fn('astuple', function (args, k, it) {
      var self = args[0];
      var out = [];
      self.__dict__.forEach(function (v) { out.push(v); });
      return new PyTuple(out);
    });
    m.fn('fields', function (args, k, it) {
      var cls = args[0] instanceof PyClass ? args[0] : args[0].__class__;
      return new PyTuple((cls.__dcfields__ || []).map(function (f) {
        var inst = new PyInstance(new PyClass('Field', [], new Map()));
        inst.__dict__.set('name', f.name);
        return inst;
      }));
    });
    return m.mod;
  });

  S.define('typing', function (interp) {
    var m = S.makeModule('typing');
    ['List', 'Dict', 'Set', 'Tuple', 'Optional', 'Union', 'Any', 'Callable',
     'Iterable', 'Iterator', 'Sequence', 'Mapping', 'Type', 'TypeVar', 'Generic',
     'NamedTuple', 'TypedDict', 'Literal', 'Final', 'ClassVar', 'Annotated',
     'Protocol', 'NoReturn', 'Self'].forEach(function (name) {
      var holder = {
        pytype: 'typing.' + name,
        __reprNative__: function () { return 'typing.' + name; },
        __getitem_native__: function () { return holder; },
        __nativeAttrs__: {}
      };
      m.val(name, holder);
    });
    m.fn('cast', function (args) { return args[1]; });
    m.fn('get_type_hints', function (args, k, it) { return new PyDict(); });
    return m.mod;
  });

  S.define('abc', function (interp) {
    var m = S.makeModule('abc');
    var abcMeta = new PyClass('ABCMeta', [], new Map());
    m.val('ABCMeta', abcMeta);
    var abcCls = new PyClass('ABC', [], new Map());
    m.val('ABC', abcCls);
    m.fn('abstractmethod', function (args) {
      var f = args[0];
      if (f instanceof PyFunction) f.__abstract__ = true;
      return f;
    });
    return m.mod;
  });

  // ===========================================================================
  // pprint / logging / unittest (light)
  // ===========================================================================
  S.define('pprint', function (interp) {
    var m = S.makeModule('pprint');
    function pretty(v, indent, width) {
      var r = repr(v);
      if (r.length <= width) return r;
      var pad = ' '.repeat(indent + 1);
      if (v instanceof PyList) return '[' + v.items.map(function (x) { return pretty(x, indent + 1, width); }).join(',\n' + pad) + ']';
      if (v instanceof PyDict) {
        var parts = [];
        v.map.forEach(function (e) { parts.push(repr(e.k) + ': ' + pretty(e.v, indent + 1, width)); });
        return '{' + parts.join(',\n' + pad) + '}';
      }
      return r;
    }
    m.fn('pprint', function (args, kwargs, it) {
      it.write(pretty(args[0], 0, inum(kwget(kwargs, 'width', 72n))) + '\n');
      return null;
    });
    m.fn('pformat', function (args, kwargs) { return pretty(args[0], 0, inum(kwget(kwargs, 'width', 72n))); });
    return m.mod;
  });

  S.define('logging', function (interp) {
    var m = S.makeModule('logging');
    var levelNames = { 10: 'DEBUG', 20: 'INFO', 30: 'WARNING', 40: 'ERROR', 50: 'CRITICAL' };
    var current = { level: 20 };
    m.val('DEBUG', 10n).val('INFO', 20n).val('WARNING', 30n).val('ERROR', 40n).val('CRITICAL', 50n);
    function emit(it, level, args, kwargs) {
      if (level < current.level) return null;
      var msg = str(args[0]);
      if (args.length > 1) msg = B.percentFormat(it, msg, new PyTuple(args.slice(1)));
      it.write(levelNames[level] + ':root:' + msg + '\n');
      return null;
    }
    m.fn('debug', function (a, k, it) { return emit(it, 10, a, k); });
    m.fn('info', function (a, k, it) { return emit(it, 20, a, k); });
    m.fn('warning', function (a, k, it) { return emit(it, 30, a, k); });
    m.fn('error', function (a, k, it) { return emit(it, 40, a, k); });
    m.fn('critical', function (a, k, it) { return emit(it, 50, a, k); });
    m.fn('exception', function (a, k, it) { return emit(it, 40, a, k); });
    m.fn('basicConfig', function (a, kwargs) {
      var lvl = kwget(kwargs, 'level', null);
      if (lvl !== null) current.level = inum(lvl);
      return null;
    });
    m.fn('getLogger', function (args, k, it) {
      var name = args.length ? str(args[0]) : 'root';
      var logger = {
        pytype: 'Logger',
        __reprNative__: function () { return '<Logger ' + name + '>'; },
        __nativeAttrs__: {
          name: name,
          debug: new PyBuiltin('debug', function (a, k2, it2) { return emit(it2, 10, a, k2); }),
          info: new PyBuiltin('info', function (a, k2, it2) { return emit(it2, 20, a, k2); }),
          warning: new PyBuiltin('warning', function (a, k2, it2) { return emit(it2, 30, a, k2); }),
          error: new PyBuiltin('error', function (a, k2, it2) { return emit(it2, 40, a, k2); }),
          critical: new PyBuiltin('critical', function (a, k2, it2) { return emit(it2, 50, a, k2); }),
          setLevel: new PyBuiltin('setLevel', function (a) { current.level = inum(a[0]); return null; })
        }
      };
      return logger;
    });
    return m.mod;
  });

  S.define('unittest', function (interp) {
    var m = S.makeModule('unittest');
    var tcCls = new PyClass('TestCase', [], new Map());
    function assertMethod(name, check, msgFn) {
      tcCls.dict.set(name, new PyBuiltin(name, function (args, kwargs, it) {
        var ok = check(args.slice(1), it);
        if (!ok) {
          var custom = args.length > (check.length || 3) ? null : null;
          throw new PyError(it.makeExc('AssertionError', msgFn(args.slice(1))));
        }
        return null;
      }));
    }
    assertMethod('assertEqual', function (a) { return eq(a[0], a[1]); },
      function (a) { return repr(a[0]) + ' != ' + repr(a[1]); });
    assertMethod('assertNotEqual', function (a) { return !eq(a[0], a[1]); },
      function (a) { return repr(a[0]) + ' == ' + repr(a[1]); });
    assertMethod('assertTrue', function (a) { return truthy(a[0]); },
      function (a) { return repr(a[0]) + ' is not true'; });
    assertMethod('assertFalse', function (a) { return !truthy(a[0]); },
      function (a) { return repr(a[0]) + ' is not false'; });
    assertMethod('assertIn', function (a, it) { return it.contains(a[1], a[0]); },
      function (a) { return repr(a[0]) + ' not found in ' + repr(a[1]); });
    assertMethod('assertIsNone', function (a) { return a[0] === null; },
      function (a) { return repr(a[0]) + ' is not None'; });
    assertMethod('assertIsInstance', function (a, it) {
      return a[0] instanceof PyInstance && a[0].__class__.isSubclassOf(a[1]);
    }, function (a) { return repr(a[0]) + ' is not an instance'; });
    m.val('TestCase', tcCls);
    m.fn('main', function (args, kwargs, it) {
      it.write('(unittest.main() is a no-op in this sandbox — call your tests directly)\n');
      return null;
    });
    return m.mod;
  });

  S.define('warnings', function (interp) {
    var m = S.makeModule('warnings');
    m.fn('warn', function (args, k, it) { it.write('Warning: ' + str(args[0]) + '\n'); return null; });
    m.fn('filterwarnings', function () { return null; });
    m.fn('simplefilter', function () { return null; });
    return m.mod;
  });
})(typeof window !== 'undefined' ? window : globalThis);
