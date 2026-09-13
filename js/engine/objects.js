/* ============================================================================
 * objects.js — The value model.
 *
 * Mapping to JavaScript:
 *   None    -> null                 str   -> JS string
 *   bool    -> JS boolean           float -> JS number
 *   int     -> BigInt (arbitrary precision, so RSA maths actually works)
 *   everything else -> a tagged wrapper class defined below.
 * ========================================================================== */
(function (root) {
  'use strict';

  // Hooks the interpreter fills in so that repr()/str()/comparison can call
  // back into user-defined dunder methods.
  var hooks = {
    callSync: null,        // (callable, args, kwargs) -> value
    lookupSpecial: null    // (obj, name) -> bound callable or undefined
  };

  // --- error plumbing --------------------------------------------------------

  function PyError(exc) {
    this.exc = exc;              // a PyInstance of an exception class
    this.name = 'PyError';
    this.message = excMessage(exc);
    this.pyTraceback = [];
  }
  PyError.prototype = Object.create(Error.prototype);
  PyError.prototype.constructor = PyError;

  function excMessage(exc) {
    try {
      if (exc && exc.__class__) {
        var a = exc.__dict__ && exc.__dict__.get('args');
        if (a && a.items && a.items.length) {
          return exc.__class__.name + ': ' + a.items.map(function (x) { return str(x); }).join(', ');
        }
        return exc.__class__.name;
      }
    } catch (e) { /* fall through */ }
    return String(exc);
  }

  // Control-flow signals. Thrown, never caught by user `except`.
  function BreakSignal() { this.__signal__ = 'break'; }
  function ContinueSignal() { this.__signal__ = 'continue'; }
  function ReturnSignal(value) { this.__signal__ = 'return'; this.value = value; }
  function ExecutionLimit(msg) { this.__signal__ = 'limit'; this.message = msg; this.name = 'ExecutionLimit'; }
  ExecutionLimit.prototype = Object.create(Error.prototype);

  // --- containers ------------------------------------------------------------

  function PyList(items) { this.items = items || []; }
  PyList.prototype.pytype = 'list';

  function PyTuple(items) { this.items = items || []; }
  PyTuple.prototype.pytype = 'tuple';

  function PyBytes(bytes, mutable) {
    this.b = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes || []);
    this.mutable = !!mutable;
  }
  PyBytes.prototype.pytype = 'bytes';

  function PyDict(entries) {
    this.map = new Map();         // hashKey -> {k, v}
    if (entries) {
      for (var i = 0; i < entries.length; i++) this.set(entries[i][0], entries[i][1]);
    }
  }
  PyDict.prototype.pytype = 'dict';
  PyDict.prototype.set = function (k, v) { this.map.set(hashKey(k), { k: k, v: v }); };
  PyDict.prototype.get = function (k, dflt) {
    var e = this.map.get(hashKey(k));
    return e ? e.v : dflt;
  };
  PyDict.prototype.has = function (k) { return this.map.has(hashKey(k)); };
  PyDict.prototype.del = function (k) { return this.map.delete(hashKey(k)); };
  PyDict.prototype.keys = function () {
    var out = [];
    this.map.forEach(function (e) { out.push(e.k); });
    return out;
  };
  PyDict.prototype.values = function () {
    var out = [];
    this.map.forEach(function (e) { out.push(e.v); });
    return out;
  };
  PyDict.prototype.entries = function () {
    var out = [];
    this.map.forEach(function (e) { out.push([e.k, e.v]); });
    return out;
  };
  Object.defineProperty(PyDict.prototype, 'size', { get: function () { return this.map.size; } });

  function PySet(items, frozen) {
    this.map = new Map();
    this.frozen = !!frozen;
    if (items) for (var i = 0; i < items.length; i++) this.add(items[i]);
  }
  PySet.prototype.pytype = 'set';
  PySet.prototype.add = function (v) { this.map.set(hashKey(v), v); };
  PySet.prototype.has = function (v) { return this.map.has(hashKey(v)); };
  PySet.prototype.del = function (v) { return this.map.delete(hashKey(v)); };
  PySet.prototype.values = function () {
    var out = [];
    this.map.forEach(function (v) { out.push(v); });
    return out;
  };
  Object.defineProperty(PySet.prototype, 'size', { get: function () { return this.map.size; } });

  function PyRange(start, stop, step) { this.start = start; this.stop = stop; this.step = step; }
  PyRange.prototype.pytype = 'range';
  PyRange.prototype.length = function () {
    var s = this.start, e = this.stop, st = this.step;
    if (st > 0n) { var d = e - s; return d <= 0n ? 0n : (d + st - 1n) / st; }
    var d2 = s - e; return d2 <= 0n ? 0n : (d2 + (-st) - 1n) / (-st);
  };
  PyRange.prototype.at = function (i) { return this.start + this.step * i; };

  function PySlice(start, stop, step) { this.start = start; this.stop = stop; this.step = step; }
  PySlice.prototype.pytype = 'slice';

  function PyComplex(re, im) { this.re = re; this.im = im; }
  PyComplex.prototype.pytype = 'complex';

  // --- callables & types -----------------------------------------------------

  function PyFunction(name, params, body, env, opts) {
    opts = opts || {};
    this.name = name;
    this.params = params;
    this.body = body;
    this.env = env;
    this.isGenerator = !!opts.isGenerator;
    this.isAsync = !!opts.isAsync;
    this.isLambda = !!opts.isLambda;
    this.doc = opts.doc || null;
    this.qualname = opts.qualname || name;
    this.annotations = opts.annotations || null;
    this.__dict__ = new Map();
    this.defaultsEvaluated = null;
  }
  PyFunction.prototype.pytype = 'function';

  function PyBuiltin(name, fn, opts) {
    this.name = name;
    this.fn = fn;              // (args, kwargs, interp) -> value  (may be a generator fn)
    opts = opts || {};
    this.isGeneratorImpl = !!opts.gen;
    this.doc = opts.doc || null;
    this.self = opts.self !== undefined ? opts.self : undefined;
  }
  PyBuiltin.prototype.pytype = 'builtin_function_or_method';

  function PyMethod(func, self) { this.func = func; this.self = self; }
  PyMethod.prototype.pytype = 'method';

  function PyClass(name, bases, dict, opts) {
    this.name = name;
    this.bases = bases || [];
    this.dict = dict || new Map();
    opts = opts || {};
    this.isException = !!opts.isException;
    this.nativeNew = opts.nativeNew || null;
    this.mro = computeMro(this);
    this.__dict__ = this.dict;
  }
  PyClass.prototype.pytype = 'type';
  PyClass.prototype.lookup = function (name) {
    for (var i = 0; i < this.mro.length; i++) {
      var c = this.mro[i];
      if (c.dict.has(name)) return c.dict.get(name);
    }
    return undefined;
  };
  PyClass.prototype.isSubclassOf = function (other) {
    return this.mro.indexOf(other) >= 0;
  };

  function computeMro(cls) {
    // C3 linearisation, with a forgiving fallback to depth-first order.
    function merge(seqs) {
      var result = [];
      for (;;) {
        seqs = seqs.filter(function (s) { return s.length; });
        if (!seqs.length) return result;
        var cand = null;
        for (var i = 0; i < seqs.length; i++) {
          var head = seqs[i][0];
          var inTail = seqs.some(function (s) { return s.indexOf(head) > 0; });
          if (!inTail) { cand = head; break; }
        }
        if (!cand) {
          // Inconsistent hierarchy: degrade gracefully instead of exploding.
          cand = seqs[0][0];
        }
        result.push(cand);
        seqs = seqs.map(function (s) { return s[0] === cand ? s.slice(1) : s.filter(function (x) { return x !== cand; }); });
      }
    }
    var bases = cls.bases || [];
    var seqs = bases.map(function (b) { return b.mro ? b.mro.slice() : [b]; });
    seqs.push(bases.slice());
    return [cls].concat(merge(seqs));
  }

  function PyInstance(cls) {
    this.__class__ = cls;
    this.__dict__ = new Map();
  }
  PyInstance.prototype.pytype = 'instance';

  function PyModule(name, dict) {
    this.name = name;
    this.dict = dict || new Map();
  }
  PyModule.prototype.pytype = 'module';

  function PyProperty(fget, fset, fdel, doc) {
    this.fget = fget; this.fset = fset; this.fdel = fdel; this.doc = doc || null;
  }
  PyProperty.prototype.pytype = 'property';

  function PyStaticMethod(f) { this.func = f; }
  PyStaticMethod.prototype.pytype = 'staticmethod';
  function PyClassMethod(f) { this.func = f; }
  PyClassMethod.prototype.pytype = 'classmethod';

  function PyGenerator(iter, name) {
    this.iter = iter;
    this.name = name || 'generator';
    this.done = false;
    this.started = false;
  }
  PyGenerator.prototype.pytype = 'generator';

  function PyIterator(nextFn, name) { this.nextFn = nextFn; this.name = name || 'iterator'; }
  PyIterator.prototype.pytype = 'iterator';

  function PyCoroutine(iter, name) { this.iter = iter; this.name = name || 'coroutine'; this.done = false; this.result = null; }
  PyCoroutine.prototype.pytype = 'coroutine';

  // A sentinel produced by `yield` inside the evaluator generators.
  function YieldMarker(value) { this.__yield__ = value; }
  function AwaitMarker(value) { this.__await__ = value; }

  // --- type naming -----------------------------------------------------------

  function typeName(v) {
    if (v === null || v === undefined) return 'NoneType';
    var t = typeof v;
    if (t === 'boolean') return 'bool';
    if (t === 'bigint') return 'int';
    if (t === 'number') return 'float';
    if (t === 'string') return 'str';
    if (v instanceof PyInstance) return v.__class__.name;
    if (v instanceof PyClass) return 'type';
    if (v instanceof PyBytes) return v.mutable ? 'bytearray' : 'bytes';
    if (v instanceof PySet) return v.frozen ? 'frozenset' : 'set';
    if (v instanceof PyFunction) return 'function';
    if (v instanceof PyMethod) return 'method';
    if (v instanceof PyBuiltin) return 'builtin_function_or_method';
    if (v && v.pytype) return v.pytype;
    return 'object';
  }

  function isInt(v) { return typeof v === 'bigint'; }
  function isFloat(v) { return typeof v === 'number'; }
  function isNum(v) { return typeof v === 'bigint' || typeof v === 'number' || typeof v === 'boolean'; }
  function isStr(v) { return typeof v === 'string'; }
  function isCallable(v) {
    return v instanceof PyFunction || v instanceof PyBuiltin || v instanceof PyClass ||
      v instanceof PyMethod || v instanceof PyStaticMethod ||
      (v instanceof PyInstance && !!v.__class__.lookup('__call__'));
  }

  function toNumber(v) {
    if (typeof v === 'bigint') return Number(v);
    if (typeof v === 'boolean') return v ? 1 : 0;
    return v;
  }
  function toBigInt(v) {
    if (typeof v === 'bigint') return v;
    if (typeof v === 'boolean') return v ? 1n : 0n;
    if (typeof v === 'number') {
      if (!isFinite(v)) throw new Error('cannot convert non-finite float to int');
      return BigInt(Math.trunc(v));
    }
    return BigInt(v);
  }

  // --- truthiness ------------------------------------------------------------

  function truthy(v) {
    if (v === null || v === undefined || v === false) return false;
    if (v === true) return true;
    if (typeof v === 'bigint') return v !== 0n;
    if (typeof v === 'number') return v !== 0 && !Number.isNaN(v) === true ? v !== 0 : false;
    if (typeof v === 'string') return v.length > 0;
    if (v instanceof PyList || v instanceof PyTuple) return v.items.length > 0;
    if (v instanceof PyDict || v instanceof PySet) return v.size > 0;
    if (v instanceof PyBytes) return v.b.length > 0;
    if (v instanceof PyRange) return v.length() > 0n;
    if (v instanceof PyInstance) {
      if (hooks.lookupSpecial) {
        var b = hooks.lookupSpecial(v, '__bool__');
        if (b) return truthy(hooks.callSync(b, [], null));
        var l = hooks.lookupSpecial(v, '__len__');
        if (l) return truthy(hooks.callSync(l, [], null));
      }
      return true;
    }
    return true;
  }

  // --- hashing / equality ----------------------------------------------------

  function hashKey(v) {
    if (v === null || v === undefined) return 'N';
    var t = typeof v;
    if (t === 'boolean') return 'i' + (v ? '1' : '0');
    if (t === 'bigint') return 'i' + v.toString();
    if (t === 'number') {
      if (Number.isInteger(v)) return 'i' + BigInt(v).toString();
      return 'f' + v;
    }
    if (t === 'string') return 's' + v;
    if (v instanceof PyBytes) return 'b' + Array.prototype.map.call(v.b, function (x) { return x.toString(16).padStart(2, '0'); }).join('');
    if (v instanceof PyTuple) return 't(' + v.items.map(hashKey).join(',') + ')';
    if (v instanceof PySet && v.frozen) return 'z(' + v.values().map(hashKey).sort().join(',') + ')';
    if (v instanceof PyRange) return 'r' + v.start + ':' + v.stop + ':' + v.step;
    if (v instanceof PyInstance) {
      if (hooks.lookupSpecial) {
        var h = hooks.lookupSpecial(v, '__hash__');
        var eqm = hooks.lookupSpecial(v, '__eq__');
        if (h) return 'h' + String(hooks.callSync(h, [], null));
        if (eqm) {
          // Custom __eq__ without __hash__: fall back to structural fields.
          var parts = [];
          v.__dict__.forEach(function (val, k) { parts.push(k + '=' + hashKey(val)); });
          return 'o<' + v.__class__.name + '>{' + parts.sort().join(',') + '}';
        }
      }
    }
    if (!v.__idhash__) {
      Object.defineProperty(v, '__idhash__', { value: 'x' + (++hashKey._counter), enumerable: false });
    }
    return v.__idhash__;
  }
  hashKey._counter = 0;

  function eq(a, b) {
    if (a === b) return true;
    if (a === null || b === null) return a === b;
    var ta = typeof a, tb = typeof b;
    if (isNum(a) && isNum(b)) {
      if (typeof a === 'number' || typeof b === 'number') return toNumber(a) === toNumber(b);
      return toBigInt(a) === toBigInt(b);
    }
    if (ta === 'string' || tb === 'string') return a === b;
    if (a instanceof PyList && b instanceof PyList) return seqEq(a.items, b.items);
    if (a instanceof PyTuple && b instanceof PyTuple) return seqEq(a.items, b.items);
    if (a instanceof PyBytes && b instanceof PyBytes) {
      if (a.b.length !== b.b.length) return false;
      for (var i = 0; i < a.b.length; i++) if (a.b[i] !== b.b[i]) return false;
      return true;
    }
    if (a instanceof PyDict && b instanceof PyDict) {
      if (a.size !== b.size) return false;
      var ok = true;
      a.map.forEach(function (e, k) {
        if (!ok) return;
        if (!b.map.has(k)) { ok = false; return; }
        if (!eq(e.v, b.map.get(k).v)) ok = false;
      });
      return ok;
    }
    if (a instanceof PySet && b instanceof PySet) {
      if (a.size !== b.size) return false;
      var ok2 = true;
      a.map.forEach(function (v, k) { if (!b.map.has(k)) ok2 = false; });
      return ok2;
    }
    if (a instanceof PyRange && b instanceof PyRange) {
      return a.start === b.start && a.stop === b.stop && a.step === b.step;
    }
    if (a instanceof PyInstance && hooks.lookupSpecial) {
      var m = hooks.lookupSpecial(a, '__eq__');
      if (m) {
        var r = hooks.callSync(m, [b], null);
        if (r !== NOT_IMPLEMENTED) return truthy(r);
      }
    }
    if (b instanceof PyInstance && hooks.lookupSpecial) {
      var m2 = hooks.lookupSpecial(b, '__eq__');
      if (m2) {
        var r2 = hooks.callSync(m2, [a], null);
        if (r2 !== NOT_IMPLEMENTED) return truthy(r2);
      }
    }
    return false;
  }

  function seqEq(x, y) {
    if (x.length !== y.length) return false;
    for (var i = 0; i < x.length; i++) if (!eq(x[i], y[i])) return false;
    return true;
  }

  var NOT_IMPLEMENTED = { pytype: 'NotImplementedType' };

  /** Three-way comparison; throws a JS Error for unorderable pairs. */
  function compare(a, b) {
    if (isNum(a) && isNum(b)) {
      if (typeof a === 'bigint' && typeof b === 'bigint') return a < b ? -1 : (a > b ? 1 : 0);
      var x = toNumber(a), y = toNumber(b);
      return x < y ? -1 : (x > y ? 1 : 0);
    }
    if (typeof a === 'string' && typeof b === 'string') {
      return a < b ? -1 : (a > b ? 1 : 0);
    }
    if (a instanceof PyBytes && b instanceof PyBytes) {
      var n = Math.min(a.b.length, b.b.length);
      for (var i = 0; i < n; i++) {
        if (a.b[i] !== b.b[i]) return a.b[i] < b.b[i] ? -1 : 1;
      }
      return a.b.length === b.b.length ? 0 : (a.b.length < b.b.length ? -1 : 1);
    }
    var aSeq = (a instanceof PyList && b instanceof PyList) || (a instanceof PyTuple && b instanceof PyTuple);
    if (aSeq) {
      var A = a.items, B = b.items, m = Math.min(A.length, B.length);
      for (var j = 0; j < m; j++) {
        if (!eq(A[j], B[j])) return compare(A[j], B[j]);
      }
      return A.length === B.length ? 0 : (A.length < B.length ? -1 : 1);
    }
    if (a instanceof PyInstance && hooks.lookupSpecial) {
      var lt = hooks.lookupSpecial(a, '__lt__');
      if (lt) {
        if (eq(a, b)) return 0;
        return truthy(hooks.callSync(lt, [b], null)) ? -1 : 1;
      }
    }
    var err = new Error("'<' not supported between instances of '" + typeName(a) + "' and '" + typeName(b) + "'");
    err.pyType = 'TypeError';
    throw err;
  }

  // --- repr / str -------------------------------------------------------------

  function reprStr(s) {
    var useDouble = s.indexOf("'") >= 0 && s.indexOf('"') < 0;
    var q = useDouble ? '"' : "'";
    var out = q;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      var code = s.charCodeAt(i);
      if (c === '\\') out += '\\\\';
      else if (c === q) out += '\\' + q;
      else if (c === '\n') out += '\\n';
      else if (c === '\t') out += '\\t';
      else if (c === '\r') out += '\\r';
      else if (code < 32 || code === 127) out += '\\x' + code.toString(16).padStart(2, '0');
      else out += c;
    }
    return out + q;
  }

  function floatRepr(v) {
    if (Number.isNaN(v)) return 'nan';
    if (v === Infinity) return 'inf';
    if (v === -Infinity) return '-inf';
    if (Number.isInteger(v) && Math.abs(v) < 1e16) {
      return (Object.is(v, -0) ? '-0' : String(v)) + '.0';
    }
    var s = String(v);
    if (s.indexOf('e') >= 0) {
      // Python writes exponents with at least two digits and a sign.
      var m = /^(-?)(\d(?:\.\d+)?)e([+-])(\d+)$/.exec(s);
      if (m) {
        var mant = m[2].indexOf('.') < 0 ? m[2] + '.0' : m[2];
        return m[1] + mant + 'e' + m[3] + (m[4].length < 2 ? '0' + m[4] : m[4]);
      }
    }
    return s;
  }

  function bytesRepr(v) {
    var out = v.mutable ? "bytearray(b'" : "b'";
    for (var i = 0; i < v.b.length; i++) {
      var c = v.b[i];
      if (c === 92) out += '\\\\';
      else if (c === 39) out += "\\'";
      else if (c === 10) out += '\\n';
      else if (c === 13) out += '\\r';
      else if (c === 9) out += '\\t';
      else if (c >= 32 && c < 127) out += String.fromCharCode(c);
      else out += '\\x' + c.toString(16).padStart(2, '0');
    }
    return out + (v.mutable ? "')" : "'");
  }

  function repr(v, seen) {
    seen = seen || new Set();
    if (v === null || v === undefined) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (v === NOT_IMPLEMENTED) return 'NotImplemented';
    var t = typeof v;
    if (t === 'bigint') return v.toString();
    if (t === 'number') return floatRepr(v);
    if (t === 'string') return reprStr(v);
    if (v instanceof PyBytes) return bytesRepr(v);
    if (v && v.__ellipsis__) return 'Ellipsis';
    if (v && typeof v.__reprNative__ === 'function') return v.__reprNative__();

    if (seen.has(v)) return v instanceof PyList ? '[...]' : (v instanceof PyDict ? '{...}' : '(...)');
    seen.add(v);
    try {
      if (v instanceof PyList) return '[' + v.items.map(function (x) { return repr(x, seen); }).join(', ') + ']';
      if (v instanceof PyTuple) {
        if (v.items.length === 1) return '(' + repr(v.items[0], seen) + ',)';
        return '(' + v.items.map(function (x) { return repr(x, seen); }).join(', ') + ')';
      }
      if (v instanceof PyDict) {
        var parts = [];
        v.map.forEach(function (e) { parts.push(repr(e.k, seen) + ': ' + repr(e.v, seen)); });
        return '{' + parts.join(', ') + '}';
      }
      if (v instanceof PySet) {
        var vals = v.values().map(function (x) { return repr(x, seen); });
        if (v.frozen) return 'frozenset(' + (vals.length ? '{' + vals.join(', ') + '}' : '') + ')';
        return vals.length ? '{' + vals.join(', ') + '}' : 'set()';
      }
      if (v instanceof PyRange) {
        return 'range(' + v.start + ', ' + v.stop + (v.step !== 1n ? ', ' + v.step : '') + ')';
      }
      if (v instanceof PySlice) {
        return 'slice(' + repr(v.start) + ', ' + repr(v.stop) + ', ' + repr(v.step) + ')';
      }
      if (v instanceof PyComplex) {
        var im = floatRepr(v.im);
        if (v.re === 0) return '(' + (v.im >= 0 ? '' : '') + im + 'j)';
        return '(' + floatRepr(v.re) + (v.im >= 0 ? '+' : '') + im + 'j)';
      }
      if (v instanceof PyClass) return "<class '" + v.name + "'>";
      if (v instanceof PyFunction) return '<function ' + v.qualname + '>';
      if (v instanceof PyBuiltin) return '<built-in function ' + v.name + '>';
      if (v instanceof PyMethod) return '<bound method ' + (v.func.name || '?') + '>';
      if (v instanceof PyModule) return "<module '" + v.name + "'>";
      if (v instanceof PyGenerator) return '<generator object ' + v.name + '>';
      if (v instanceof PyCoroutine) return '<coroutine object ' + v.name + '>';
      if (v instanceof PyProperty) return '<property object>';
      if (v instanceof PyInstance) {
        if (hooks.lookupSpecial) {
          var m = hooks.lookupSpecial(v, '__repr__');
          if (m) return str_(hooks.callSync(m, [], null));
        }
        if (v.__class__.isException) {
          var args = v.__dict__.get('args');
          var inner = args && args.items ? args.items.map(function (x) { return repr(x, seen); }).join(', ') : '';
          return v.__class__.name + '(' + inner + ')';
        }
        return '<' + v.__class__.name + ' object>';
      }
      if (v instanceof PyIterator) return '<' + v.name + ' object>';
      return String(v);
    } finally {
      seen.delete(v);
    }
  }

  function str_(v) {
    if (typeof v === 'string') return v;
    if (v === null || v === undefined) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (typeof v === 'bigint') return v.toString();
    if (typeof v === 'number') return floatRepr(v);
    if (v && typeof v.__strNative__ === 'function') return v.__strNative__();
    if (v instanceof PyInstance) {
      if (hooks.lookupSpecial) {
        var m = hooks.lookupSpecial(v, '__str__');
        if (m) return str_(hooks.callSync(m, [], null));
      }
      if (v.__class__.isException) {
        var args = v.__dict__.get('args');
        var isKeyErr = v.__class__.mro.some(function (c) { return c.name === 'KeyError'; });
        if (args && args.items) {
          if (args.items.length === 0) return '';
          if (args.items.length === 1) return isKeyErr ? repr(args.items[0]) : str_(args.items[0]);
          return '(' + args.items.map(function (x) { return repr(x); }).join(', ') + ')';
        }
      }
      return repr(v);
    }
    return repr(v);
  }

  root.PyObjects = {
    hooks: hooks,
    PyError: PyError, excMessage: excMessage,
    BreakSignal: BreakSignal, ContinueSignal: ContinueSignal, ReturnSignal: ReturnSignal,
    ExecutionLimit: ExecutionLimit,
    PyList: PyList, PyTuple: PyTuple, PyDict: PyDict, PySet: PySet, PyBytes: PyBytes,
    PyRange: PyRange, PySlice: PySlice, PyComplex: PyComplex,
    PyFunction: PyFunction, PyBuiltin: PyBuiltin, PyMethod: PyMethod,
    PyClass: PyClass, PyInstance: PyInstance, PyModule: PyModule,
    PyProperty: PyProperty, PyStaticMethod: PyStaticMethod, PyClassMethod: PyClassMethod,
    PyGenerator: PyGenerator, PyIterator: PyIterator, PyCoroutine: PyCoroutine,
    YieldMarker: YieldMarker, AwaitMarker: AwaitMarker,
    NOT_IMPLEMENTED: NOT_IMPLEMENTED,
    typeName: typeName, truthy: truthy, hashKey: hashKey, eq: eq, compare: compare,
    repr: repr, str: str_, reprStr: reprStr, floatRepr: floatRepr, bytesRepr: bytesRepr,
    isInt: isInt, isFloat: isFloat, isNum: isNum, isStr: isStr, isCallable: isCallable,
    toNumber: toNumber, toBigInt: toBigInt, computeMro: computeMro
  };
  // `str` is a common name; expose it under both spellings for convenience.
  root.PyObjects.str = str_;
})(typeof window !== 'undefined' ? window : globalThis);
