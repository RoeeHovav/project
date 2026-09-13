/* ============================================================================
 * interpreter.js — Tree-walking evaluator.
 *
 * Every eval/exec routine is a JavaScript generator function. Python's `yield`
 * simply yields a marker up the JS generator chain, which gives real Python
 * generators for free, and lets the driver interrupt runaway programs between
 * steps.
 * ========================================================================== */
(function (root) {
  'use strict';

  var O = root.PyObjects;
  var PyList = O.PyList, PyTuple = O.PyTuple, PyDict = O.PyDict, PySet = O.PySet,
      PyBytes = O.PyBytes, PyRange = O.PyRange, PySlice = O.PySlice,
      PyFunction = O.PyFunction, PyBuiltin = O.PyBuiltin, PyMethod = O.PyMethod,
      PyClass = O.PyClass, PyInstance = O.PyInstance, PyModule = O.PyModule,
      PyProperty = O.PyProperty, PyStaticMethod = O.PyStaticMethod,
      PyClassMethod = O.PyClassMethod, PyGenerator = O.PyGenerator,
      PyIterator = O.PyIterator, PyCoroutine = O.PyCoroutine,
      YieldMarker = O.YieldMarker, AwaitMarker = O.AwaitMarker,
      PyError = O.PyError, ReturnSignal = O.ReturnSignal,
      BreakSignal = O.BreakSignal, ContinueSignal = O.ContinueSignal,
      ExecutionLimit = O.ExecutionLimit,
      truthy = O.truthy, eq = O.eq, repr = O.repr, str = O.str,
      typeName = O.typeName, compare = O.compare, hashKey = O.hashKey,
      toBigInt = O.toBigInt, toNumber = O.toNumber, isNum = O.isNum;

  // ---------------------------------------------------------------------------
  // Scopes
  // ---------------------------------------------------------------------------

  function Env(parent, kind, globalsEnv) {
    this.vars = new Map();
    this.parent = parent || null;
    this.kind = kind || 'local';                       // module | local | class
    this.globalsEnv = globalsEnv || (parent ? parent.globalsEnv : this);
    this.globalNames = null;
    this.nonlocalNames = null;
  }
  Env.prototype.get = function (name) {
    var e = this;
    if (this.globalNames && this.globalNames.has(name)) e = this.globalsEnv;
    while (e) {
      if (e.vars.has(name)) return { found: true, value: e.vars.get(name) };
      // Class bodies are not part of the lexical chain for nested functions,
      // but they are while executing the body itself, so we keep walking.
      e = e.parent;
    }
    return { found: false };
  };
  Env.prototype.set = function (name, value) {
    if (this.globalNames && this.globalNames.has(name)) { this.globalsEnv.vars.set(name, value); return; }
    if (this.nonlocalNames && this.nonlocalNames.has(name)) {
      var e = this.parent;
      while (e) {
        if (e.vars.has(name)) { e.vars.set(name, value); return; }
        e = e.parent;
      }
    }
    this.vars.set(name, value);
  };
  Env.prototype.del = function (name) {
    if (this.globalNames && this.globalNames.has(name)) return this.globalsEnv.vars.delete(name);
    return this.vars.delete(name);
  };

  // ---------------------------------------------------------------------------
  // Interpreter
  // ---------------------------------------------------------------------------

  function Interpreter(opts) {
    opts = opts || {};
    this.out = [];
    this.maxSteps = opts.maxSteps || 4000000;
    this.maxOutput = opts.maxOutput || 200000;
    this.timeLimitMs = opts.timeLimitMs || 6000;
    this.steps = 0;
    this.startTime = 0;
    this.inputQueue = (opts.input || []).slice();
    this.inputEcho = opts.inputEcho !== false;
    this.moduleFactories = Object.create(null);
    this.modules = Object.create(null);
    this.files = opts.files || Object.create(null);   // virtual filesystem
    this.globals = new Env(null, 'module');
    this.globals.globalsEnv = this.globals;
    this.callDepth = 0;
    this.maxCallDepth = opts.maxCallDepth || 220;
    this.exceptionClasses = Object.create(null);
    this.world = opts.world || null;                   // simulated network, set by the game
    this.trace = null;
    this.onPrint = opts.onPrint || null;
    this.setupBuiltins();
  }

  var I = Interpreter.prototype;

  // --- output ---------------------------------------------------------------

  I.write = function (text) {
    this.out.push(text);
    if (this.onPrint) this.onPrint(text);
    var total = 0;
    for (var i = this.out.length - 1, c = 0; i >= 0 && c < 50; i--, c++) total += this.out[i].length;
    if (this.outLen === undefined) this.outLen = 0;
    this.outLen += text.length;
    if (this.outLen > this.maxOutput) {
      throw new ExecutionLimit('Output limit exceeded (' + this.maxOutput + ' characters). Is something printing in an endless loop?');
    }
  };
  I.getOutput = function () { return this.out.join(''); };

  // --- limits ----------------------------------------------------------------

  I.tick = function (n) {
    this.steps += (n || 1);
    if (this.steps > this.maxSteps) {
      throw new ExecutionLimit('Execution limit reached (' + this.maxSteps + ' steps). Check for an infinite loop.');
    }
    if ((this.steps & 8191) === 0 && this.startTime) {
      if (Date.now() - this.startTime > this.timeLimitMs) {
        throw new ExecutionLimit('Timed out after ' + (this.timeLimitMs / 1000) + 's. Check for an infinite loop.');
      }
    }
  };

  // --- exceptions ------------------------------------------------------------

  I.setupBuiltins = function () {
    var self = this;
    var B = root.PyBuiltins;
    // Exception hierarchy.
    var base = new PyClass('BaseException', [], new Map(), { isException: true });
    this.exceptionClasses.BaseException = base;
    var hierarchy = {
      Exception: 'BaseException',
      SystemExit: 'BaseException',
      KeyboardInterrupt: 'BaseException',
      GeneratorExit: 'BaseException',
      ArithmeticError: 'Exception',
      ZeroDivisionError: 'ArithmeticError',
      OverflowError: 'ArithmeticError',
      FloatingPointError: 'ArithmeticError',
      AssertionError: 'Exception',
      AttributeError: 'Exception',
      BufferError: 'Exception',
      EOFError: 'Exception',
      ImportError: 'Exception',
      ModuleNotFoundError: 'ImportError',
      LookupError: 'Exception',
      IndexError: 'LookupError',
      KeyError: 'LookupError',
      MemoryError: 'Exception',
      NameError: 'Exception',
      UnboundLocalError: 'NameError',
      OSError: 'Exception',
      IOError: 'OSError',
      FileNotFoundError: 'OSError',
      FileExistsError: 'OSError',
      PermissionError: 'OSError',
      TimeoutError: 'OSError',
      ConnectionError: 'OSError',
      ConnectionRefusedError: 'ConnectionError',
      ConnectionResetError: 'ConnectionError',
      IsADirectoryError: 'OSError',
      NotADirectoryError: 'OSError',
      ReferenceError: 'Exception',
      RuntimeError: 'Exception',
      NotImplementedError: 'RuntimeError',
      RecursionError: 'RuntimeError',
      StopIteration: 'Exception',
      StopAsyncIteration: 'Exception',
      SyntaxError: 'Exception',
      IndentationError: 'SyntaxError',
      TabError: 'IndentationError',
      SystemError: 'Exception',
      TypeError: 'Exception',
      ValueError: 'Exception',
      UnicodeError: 'ValueError',
      UnicodeDecodeError: 'UnicodeError',
      UnicodeEncodeError: 'UnicodeError',
      Warning: 'Exception',
      UserWarning: 'Warning',
      DeprecationWarning: 'Warning'
    };
    Object.keys(hierarchy).forEach(function mk(name) {
      if (self.exceptionClasses[name]) return;
      var parentName = hierarchy[name];
      if (!self.exceptionClasses[parentName]) mk(parentName);
      var cls = new PyClass(name, [self.exceptionClasses[parentName]], new Map(), { isException: true });
      self.exceptionClasses[name] = cls;
    });

    if (B && B.install) { B.install(this); if (B.installTypeMethods) B.installTypeMethods(this); }
  };

  I.makeExc = function (typeName_, message, extra) {
    var cls = this.exceptionClasses[typeName_] || this.exceptionClasses.Exception;
    var inst = new PyInstance(cls);
    var args = message === undefined || message === null ? [] : [message];
    inst.__dict__.set('args', new PyTuple(args));
    if (extra) for (var k in extra) inst.__dict__.set(k, extra[k]);
    return inst;
  };
  I.throwPy = function (typeName_, message, extra) {
    throw new PyError(this.makeExc(typeName_, message, extra));
  };
  I.typeError = function (m) { this.throwPy('TypeError', m); };
  I.valueError = function (m) { this.throwPy('ValueError', m); };
  I.nameError = function (m) { this.throwPy('NameError', m); };
  I.indexError = function (m) { this.throwPy('IndexError', m); };
  I.keyError = function (k) { throw new PyError(this.makeExc('KeyError', k)); };
  I.attrError = function (m) { this.throwPy('AttributeError', m); };

  /** Translate a raw JS error into a Python exception where we can. */
  I.wrapJsError = function (e) {
    if (e instanceof PyError) return e;
    if (e && e.__signal__) return e;
    if (e instanceof ExecutionLimit || (e && e.__signal__ === 'limit')) return e;
    if (e instanceof RangeError && /call stack/i.test(e.message || '')) {
      return new PyError(this.makeExc('RecursionError', 'maximum recursion depth exceeded'));
    }
    var t = (e && e.pyType) || 'RuntimeError';
    return new PyError(this.makeExc(t, (e && e.message) || String(e)));
  };

  // ---------------------------------------------------------------------------
  // Driving generators
  // ---------------------------------------------------------------------------

  /** Run an evaluator generator to completion; yields are illegal here. */
  I.runSync = function (gen) {
    var r = gen.next();
    while (!r.done) {
      if (r.value instanceof YieldMarker) {
        this.throwPy('SyntaxError', "'yield' outside function");
      }
      if (r.value instanceof AwaitMarker) {
        this.throwPy('RuntimeError', "'await' used outside of an event loop");
      }
      r = gen.next();
    }
    return r.value;
  };

  // ---------------------------------------------------------------------------
  // Attribute access
  // ---------------------------------------------------------------------------

  I.bindDescriptor = function (raw, obj, owner) {
    if (raw instanceof PyFunction) return new PyMethod(raw, obj);
    if (raw instanceof PyStaticMethod) return raw.func;
    if (raw instanceof PyClassMethod) return new PyMethod(raw.func, owner);
    if (raw instanceof PyProperty) {
      if (!raw.fget) this.attrError('unreadable attribute');
      return this.callSync(raw.fget, [obj], null);
    }
    if (raw instanceof PyBuiltin) {
      // A JS-implemented method living in a class dict: bind the instance so
      // the implementation receives it as its first argument.
      if (raw.boundSelf !== undefined) return raw;
      var bound = new PyBuiltin(raw.name, raw.fn, { gen: raw.isGeneratorImpl });
      bound.boundSelf = obj;
      bound.__nativeAttrs__ = raw.__nativeAttrs__;
      bound.__reprNative__ = raw.__reprNative__;
      return bound;
    }
    return raw;
  };

  I.getattr = function (obj, name, dflt) {
    var B = root.PyBuiltins;
    try {
      if (obj instanceof PyInstance) {
        var cls = obj.__class__;
        var clsAttr = cls.lookup(name);
        if (clsAttr instanceof PyProperty) return this.bindDescriptor(clsAttr, obj, cls);
        if (obj.__dict__.has(name)) return obj.__dict__.get(name);
        if (clsAttr !== undefined) return this.bindDescriptor(clsAttr, obj, cls);
        var ga = cls.lookup('__getattr__');
        if (ga) return this.callSync(this.bindDescriptor(ga, obj, cls), [name], null);
        if (dflt !== undefined) return dflt;
        this.attrError("'" + cls.name + "' object has no attribute '" + name + "'");
      }
      if (obj instanceof PyClass) {
        if (name === '__name__') return obj.name;
        if (name === '__bases__') return new PyTuple(obj.bases);
        if (name === '__mro__') return new PyTuple(obj.mro);
        if (name === '__dict__') {
          var d = new PyDict();
          obj.dict.forEach(function (v, k) { d.set(k, v); });
          return d;
        }
        var v = obj.lookup(name);
        if (v !== undefined) {
          if (v instanceof PyStaticMethod) return v.func;
          if (v instanceof PyClassMethod) return new PyMethod(v.func, obj);
          return v;
        }
        if (dflt !== undefined) return dflt;
        this.attrError("type object '" + obj.name + "' has no attribute '" + name + "'");
      }
      if (obj instanceof PyModule) {
        if (obj.dict.has(name)) return obj.dict.get(name);
        if (name === '__name__') return obj.name;
        if (dflt !== undefined) return dflt;
        this.attrError("module '" + obj.name + "' has no attribute '" + name + "'");
      }
      if (obj instanceof PyFunction) {
        if (name === '__name__') return obj.name;
        if (name === '__doc__') return obj.doc;
        if (name === '__qualname__') return obj.qualname;
        if (name === '__annotations__') {
          var ad = new PyDict();
          if (obj.annotations) obj.annotations.forEach(function (val, k) { ad.set(k, val); });
          return ad;
        }
        if (obj.__dict__.has(name)) return obj.__dict__.get(name);
        if (dflt !== undefined) return dflt;
        this.attrError("'function' object has no attribute '" + name + "'");
      }
      if (obj instanceof PyMethod) {
        if (name === '__name__') return obj.func.name;
        if (name === '__self__') return obj.self;
        if (name === '__func__') return obj.func;
      }
      if (obj && obj.__nativeAttrs__ && (name in obj.__nativeAttrs__)) {
        var na = obj.__nativeAttrs__[name];
        return typeof na === 'function' ? na(obj, this) : na;
      }
      // Built-in types get their methods from the method registry.
      var m = B.getMethod(this, obj, name);
      if (m !== undefined) return m;
      if (dflt !== undefined) return dflt;
      this.attrError("'" + typeName(obj) + "' object has no attribute '" + name + "'");
    } catch (e) {
      if (dflt !== undefined && e instanceof PyError && e.exc.__class__.name === 'AttributeError') return dflt;
      throw e;
    }
  };

  I.setattr = function (obj, name, value) {
    if (obj instanceof PyInstance) {
      var p = obj.__class__.lookup(name);
      if (p instanceof PyProperty) {
        if (!p.fset) this.attrError("can't set attribute '" + name + "'");
        this.callSync(p.fset, [obj, value], null);
        return;
      }
      if (obj.__frozen__) this.throwPy('AttributeError', "cannot assign to field '" + name + "'");
      var slots = obj.__class__.__slotset__;
      if (slots && !slots.has(name) && !obj.__class__.lookup(name)) {
        this.attrError("'" + obj.__class__.name + "' object has no attribute '" + name + "'");
      }
      obj.__dict__.set(name, value);
      return;
    }
    if (obj instanceof PyClass) { obj.dict.set(name, value); obj.mro = O.computeMro(obj); return; }
    if (obj instanceof PyModule) { obj.dict.set(name, value); return; }
    if (obj instanceof PyFunction) { obj.__dict__.set(name, value); return; }
    if (obj && obj.__nativeSet__) { obj.__nativeSet__(name, value, this); return; }
    this.attrError("'" + typeName(obj) + "' object has no attribute '" + name + "'");
  };

  I.delattr = function (obj, name) {
    if (obj instanceof PyInstance) {
      if (obj.__dict__.has(name)) { obj.__dict__.delete(name); return; }
      this.attrError(name);
    }
    if (obj instanceof PyClass) { obj.dict.delete(name); return; }
    if (obj instanceof PyModule) { obj.dict.delete(name); return; }
    this.attrError(name);
  };

  // ---------------------------------------------------------------------------
  // Calling
  // ---------------------------------------------------------------------------

  I.callSync = function (fn, args, kwargs) {
    return this.runSync(this.call(fn, args || [], kwargs || null));
  };

  I.call = function* (fn, args, kwargs) {
    this.tick();
    args = args || [];
    if (fn instanceof PyBuiltin) {
      var a = args;
      if (fn.boundSelf !== undefined) a = [fn.boundSelf].concat(args);
      var res = fn.fn.call(null, a, kwargs, this);
      if (res && typeof res.next === 'function' && typeof res[Symbol.iterator] === 'function' && fn.isGeneratorImpl) {
        return yield* res;
      }
      if (res && res.__isGenObj__) return res.value;
      return res === undefined ? null : res;
    }
    if (fn instanceof PyMethod) {
      return yield* this.call(fn.func, [fn.self].concat(args), kwargs);
    }
    if (fn instanceof PyStaticMethod) return yield* this.call(fn.func, args, kwargs);
    if (fn instanceof PyFunction) return yield* this.callFunction(fn, args, kwargs);
    if (fn instanceof PyClass) return yield* this.instantiate(fn, args, kwargs);
    if (fn instanceof PyInstance) {
      var c = fn.__class__.lookup('__call__');
      if (c) return yield* this.call(this.bindDescriptor(c, fn, fn.__class__), args, kwargs);
    }
    this.typeError("'" + typeName(fn) + "' object is not callable");
  };

  I.instantiate = function* (cls, args, kwargs) {
    if (cls.nativeNew) {
      var nv = cls.nativeNew(args, kwargs, this);
      return nv;
    }
    var inst = new PyInstance(cls);
    if (cls.isException) {
      inst.__dict__.set('args', new PyTuple(args.slice()));
      var initE = cls.lookup('__init__');
      if (initE) yield* this.call(this.bindDescriptor(initE, inst, cls), args, kwargs);
      return inst;
    }
    var newM = cls.lookup('__new__');
    if (newM && !(newM instanceof PyBuiltin)) {
      var created = yield* this.call(newM instanceof PyStaticMethod ? newM.func : newM, [cls].concat(args), kwargs);
      if (created instanceof PyInstance) inst = created;
      else return created;
    }
    var init = cls.lookup('__init__');
    if (init) {
      yield* this.call(this.bindDescriptor(init, inst, cls), args, kwargs);
    } else if (args.length || (kwargs && kwargs.size)) {
      this.typeError(cls.name + '() takes no arguments');
    }
    return inst;
  };

  I.bindParams = function (fn, args, kwargs, env) {
    var p = fn.params;
    var i;
    var named = new Set();
    var supplied = Object.create(null);
    var kwLeft = new PyDict();
    if (kwargs) {
      kwargs.map.forEach(function (e) { kwLeft.set(e.k, e.v); });
    }
    var positional = args.slice();
    var nPos = p.args.length;

    for (i = 0; i < nPos; i++) {
      var nm = p.args[i].name;
      if (i < positional.length) { supplied[nm] = positional[i]; named.add(nm); }
    }
    if (positional.length > nPos && !p.vararg) {
      this.typeError(fn.name + '() takes ' + nPos + ' positional argument' + (nPos === 1 ? '' : 's') +
        ' but ' + positional.length + ' were given');
    }
    if (p.vararg) {
      env.set(p.vararg.name, new PyTuple(positional.slice(nPos)));
    }
    // Keyword arguments.
    var self = this;
    var consumed = [];
    kwLeft.map.forEach(function (e) {
      var key = e.k;
      if (typeof key !== 'string') return;
      var isPos = p.args.some(function (x, idx) { return x.name === key && idx >= (p.posonlyCount || 0); });
      var isKwOnly = p.kwonly.some(function (x) { return x.name === key; });
      if (isPos) {
        if (named.has(key)) self.typeError(fn.name + "() got multiple values for argument '" + key + "'");
        supplied[key] = e.v; named.add(key); consumed.push(key);
      } else if (isKwOnly) {
        supplied[key] = e.v; named.add(key); consumed.push(key);
      }
    });
    consumed.forEach(function (k) { kwLeft.del(k); });
    if (p.kwarg) {
      env.set(p.kwarg.name, kwLeft);
    } else if (kwLeft.size) {
      var bad = kwLeft.keys()[0];
      this.typeError(fn.name + "() got an unexpected keyword argument '" + str(bad) + "'");
    }

    var defaults = fn.defaultsEvaluated || { pos: [], kw: new Map() };
    var missing = [];
    for (i = 0; i < p.args.length; i++) {
      var a = p.args[i];
      if (named.has(a.name)) { env.set(a.name, supplied[a.name]); continue; }
      var defIdx = i - (p.args.length - defaults.pos.length);
      if (a.def && defIdx >= 0 && defIdx < defaults.pos.length) env.set(a.name, defaults.pos[defIdx]);
      else missing.push(a.name);
    }
    for (i = 0; i < p.kwonly.length; i++) {
      var k = p.kwonly[i];
      if (named.has(k.name)) { env.set(k.name, supplied[k.name]); continue; }
      if (defaults.kw.has(k.name)) env.set(k.name, defaults.kw.get(k.name));
      else missing.push(k.name);
    }
    if (missing.length) {
      this.typeError(fn.name + '() missing ' + missing.length + ' required argument' +
        (missing.length === 1 ? '' : 's') + ": " + missing.map(function (m) { return "'" + m + "'"; }).join(', '));
    }
  };

  I.callFunction = function* (fn, args, kwargs) {
    var env = new Env(fn.env, 'local', fn.env.globalsEnv);
    this.bindParams(fn, args, kwargs, env);
    if (fn.boundClass) env.__class__ = fn.boundClass;
    env.__firstarg__ = args.length ? args[0] : null;
    if (fn.isGenerator) {
      var self = this;
      var it = (function* () {
        try {
          yield* self.execBlock(fn.body, env);
        } catch (e) {
          if (e && e.__signal__ === 'return') return e.value;
          throw e;
        }
        return null;
      })();
      if (fn.isAsync) return new PyCoroutine(it, fn.name);
      return new PyGenerator(it, fn.name);
    }
    if (fn.isAsync) {
      var self2 = this;
      var it2 = (function* () {
        try {
          yield* self2.execBlock(fn.body, env);
        } catch (e) {
          if (e && e.__signal__ === 'return') return e.value;
          throw e;
        }
        return null;
      })();
      return new PyCoroutine(it2, fn.name);
    }
    this.callDepth++;
    if (this.callDepth > this.maxCallDepth) {
      this.callDepth--;
      throw new PyError(this.makeExc('RecursionError', 'maximum recursion depth exceeded'));
    }
    try {
      yield* this.execBlock(fn.body, env);
      return null;
    } catch (e) {
      if (e && e.__signal__ === 'return') return e.value;
      throw e;
    } finally {
      this.callDepth--;
    }
  };

  // ---------------------------------------------------------------------------
  // Iteration
  // ---------------------------------------------------------------------------

  /** Returns a JS-style iterator {next() -> {value, done}} over a Python value. */
  I.iter = function (v) {
    var self = this;
    if (typeof v === 'string') {
      var i = 0;
      var chars = Array.from(v);
      return { next: function () { return i < chars.length ? { value: chars[i++], done: false } : { done: true }; } };
    }
    if (v instanceof PyList || v instanceof PyTuple) {
      var arr = v.items, j = 0;
      return { next: function () { return j < arr.length ? { value: arr[j++], done: false } : { done: true }; } };
    }
    if (v instanceof PyBytes) {
      var k = 0;
      return { next: function () { return k < v.b.length ? { value: BigInt(v.b[k++]), done: false } : { done: true }; } };
    }
    if (v instanceof PyDict) {
      var ks = v.keys(), m = 0;
      return { next: function () { return m < ks.length ? { value: ks[m++], done: false } : { done: true }; } };
    }
    if (v instanceof PySet) {
      var vs = v.values(), n = 0;
      return { next: function () { return n < vs.length ? { value: vs[n++], done: false } : { done: true }; } };
    }
    if (v instanceof PyRange) {
      var cur = v.start, stop = v.stop, step = v.step;
      return {
        next: function () {
          if (step > 0n ? cur >= stop : cur <= stop) return { done: true };
          var val = cur; cur += step; return { value: val, done: false };
        }
      };
    }
    if (v instanceof PyGenerator) {
      return {
        next: function () {
          var r = self.genResume(v, null, null);
          return r.done ? { done: true } : { value: r.value, done: false };
        }
      };
    }
    if (v instanceof PyIterator) {
      return {
        next: function () {
          var r = v.nextFn();
          return r && r.done ? { done: true } : { value: r.value, done: false };
        }
      };
    }
    if (v instanceof PyInstance) {
      var itm = v.__class__.lookup('__iter__');
      if (itm) {
        var iterObj = this.callSync(this.bindDescriptor(itm, v, v.__class__), [], null);
        if (iterObj !== v) return this.iter(iterObj);
        var nx = v.__class__.lookup('__next__');
        if (!nx) this.typeError('iterator has no __next__');
        var boundNext = this.bindDescriptor(nx, v, v.__class__);
        return {
          next: function () {
            try { return { value: self.callSync(boundNext, [], null), done: false }; }
            catch (e) {
              if (e instanceof PyError && e.exc.__class__.isSubclassOf(self.exceptionClasses.StopIteration)) return { done: true };
              throw e;
            }
          }
        };
      }
      var nx2 = v.__class__.lookup('__next__');
      if (nx2) {
        var bn = this.bindDescriptor(nx2, v, v.__class__);
        return {
          next: function () {
            try { return { value: self.callSync(bn, [], null), done: false }; }
            catch (e) {
              if (e instanceof PyError && e.exc.__class__.isSubclassOf(self.exceptionClasses.StopIteration)) return { done: true };
              throw e;
            }
          }
        };
      }
      var gi = v.__class__.lookup('__getitem__');
      if (gi) {
        var idx = 0n;
        var bg = this.bindDescriptor(gi, v, v.__class__);
        return {
          next: function () {
            try { return { value: self.callSync(bg, [idx++], null), done: false }; }
            catch (e) {
              if (e instanceof PyError && (e.exc.__class__.isSubclassOf(self.exceptionClasses.IndexError) ||
                  e.exc.__class__.isSubclassOf(self.exceptionClasses.StopIteration))) return { done: true };
              throw e;
            }
          }
        };
      }
    }
    if (v && v.__jsiter__) return v.__jsiter__();
    this.typeError("'" + typeName(v) + "' object is not iterable");
  };

  I.toArray = function (v, limit) {
    var it = this.iter(v);
    var out = [];
    var cap = limit || 2000000;
    for (;;) {
      this.tick();
      var r = it.next();
      if (r.done) break;
      out.push(r.value);
      if (out.length > cap) this.throwPy('MemoryError', 'iterable too large');
    }
    return out;
  };

  /** Resume a generator, returning {value, done}. */
  I.genResume = function (gen, sendValue, throwExc) {
    if (gen.done) {
      if (throwExc) throw throwExc;
      return { done: true };
    }
    var r;
    try {
      if (throwExc) r = gen.iter.throw(throwExc);
      else r = gen.iter.next(sendValue);
    } catch (e) {
      gen.done = true;
      throw e;
    }
    if (r.done) {
      gen.done = true;
      gen.returnValue = r.value === undefined ? null : r.value;
      return { done: true, value: gen.returnValue };
    }
    if (r.value instanceof YieldMarker) {
      gen.started = true;
      return { done: false, value: r.value.__yield__ };
    }
    if (r.value instanceof AwaitMarker) {
      // A bare await inside a sync generator context: not supported.
      gen.done = true;
      this.throwPy('RuntimeError', 'await is only valid inside async functions run by asyncio');
    }
    return { done: false, value: null };
  };

  // ---------------------------------------------------------------------------
  // Statements
  // ---------------------------------------------------------------------------

  I.execBlock = function* (body, env) {
    for (var i = 0; i < body.length; i++) {
      yield* this.execStmt(body[i], env);
    }
  };

  I.execStmt = function* (node, env) {
    this.tick();
    this.currentLoc = node.loc;
    switch (node.type) {
      case 'Expr': {
        var v = yield* this.evalExpr(node.value, env);
        this.lastValue = v;
        return;
      }
      case 'Assign': {
        var val = yield* this.evalExpr(node.value, env);
        for (var i = 0; i < node.targets.length; i++) {
          yield* this.assign(node.targets[i], val, env);
        }
        return;
      }
      case 'AnnAssign': {
        if (node.value !== null) {
          var av = yield* this.evalExpr(node.value, env);
          yield* this.assign(node.target, av, env);
        } else if (node.target.type === 'Name') {
          var anns = env.vars.get('__annotations__');
          if (!anns) { anns = new PyDict(); env.vars.set('__annotations__', anns); }
          var annVal = null;
          try { annVal = yield* this.evalExpr(node.annotation, env); } catch (e) { annVal = null; }
          anns.set(node.target.id, annVal);
        }
        return;
      }
      case 'AugAssign': {
        var cur = yield* this.evalExpr(node.target, env);
        var rhs = yield* this.evalExpr(node.value, env);
        var res = yield* this.binopAug(node.op, cur, rhs);
        yield* this.assign(node.target, res, env);
        return;
      }
      case 'If': {
        if (truthy(yield* this.evalExpr(node.test, env))) yield* this.execBlock(node.body, env);
        else yield* this.execBlock(node.orelse, env);
        return;
      }
      case 'While': {
        var broke = false;
        while (truthy(yield* this.evalExpr(node.test, env))) {
          this.tick();
          try {
            yield* this.execBlock(node.body, env);
          } catch (e) {
            if (e && e.__signal__ === 'break') { broke = true; break; }
            if (e && e.__signal__ === 'continue') continue;
            throw e;
          }
        }
        if (!broke) yield* this.execBlock(node.orelse, env);
        return;
      }
      case 'For': {
        var iterable = yield* this.evalExpr(node.iter, env);
        var it = this.iter(iterable);
        var didBreak = false;
        for (;;) {
          this.tick();
          var r = it.next();
          if (r.done) break;
          yield* this.assign(node.target, r.value, env);
          try {
            yield* this.execBlock(node.body, env);
          } catch (e) {
            if (e && e.__signal__ === 'break') { didBreak = true; break; }
            if (e && e.__signal__ === 'continue') continue;
            throw e;
          }
        }
        if (!didBreak) yield* this.execBlock(node.orelse, env);
        return;
      }
      case 'Break': throw new BreakSignal();
      case 'Continue': throw new ContinueSignal();
      case 'Pass': return;
      case 'Return': {
        var rv = node.value ? yield* this.evalExpr(node.value, env) : null;
        throw new ReturnSignal(rv);
      }
      case 'FunctionDef': {
        var fn = yield* this.makeFunction(node, env);
        var deco = node.decorators;
        for (var d = deco.length - 1; d >= 0; d--) {
          var dv = yield* this.evalExpr(deco[d], env);
          fn = yield* this.call(dv, [fn], null);
        }
        env.set(node.name, fn);
        return;
      }
      case 'ClassDef': {
        var cls = yield* this.makeClass(node, env);
        var cdeco = node.decorators;
        for (var cd = cdeco.length - 1; cd >= 0; cd--) {
          var cdv = yield* this.evalExpr(cdeco[cd], env);
          cls = yield* this.call(cdv, [cls], null);
        }
        env.set(node.name, cls);
        return;
      }
      case 'Delete': {
        for (var di = 0; di < node.targets.length; di++) {
          var t = node.targets[di];
          if (t.type === 'Name') {
            if (!env.del(t.id)) this.nameError("name '" + t.id + "' is not defined");
          } else if (t.type === 'Subscript') {
            var obj = yield* this.evalExpr(t.value, env);
            var key = yield* this.evalSlice(t.slice, env);
            this.delitem(obj, key);
          } else if (t.type === 'Attribute') {
            var ao = yield* this.evalExpr(t.value, env);
            this.delattr(ao, t.attr);
          }
        }
        return;
      }
      case 'Global': {
        if (!env.globalNames) env.globalNames = new Set();
        node.names.forEach(function (n) { env.globalNames.add(n); });
        return;
      }
      case 'Nonlocal': {
        if (!env.nonlocalNames) env.nonlocalNames = new Set();
        node.names.forEach(function (n) { env.nonlocalNames.add(n); });
        return;
      }
      case 'Assert': {
        if (!truthy(yield* this.evalExpr(node.test, env))) {
          var msg = node.msg ? yield* this.evalExpr(node.msg, env) : undefined;
          throw new PyError(this.makeExc('AssertionError', msg));
        }
        return;
      }
      case 'Raise': {
        if (!node.exc) {
          if (this.currentException) throw new PyError(this.currentException);
          this.throwPy('RuntimeError', 'No active exception to re-raise');
        }
        var ev = yield* this.evalExpr(node.exc, env);
        var inst;
        if (ev instanceof PyClass) inst = yield* this.instantiate(ev, [], null);
        else inst = ev;
        if (!(inst instanceof PyInstance) || !inst.__class__.isException) {
          this.typeError('exceptions must derive from BaseException');
        }
        if (node.cause) {
          var cv = yield* this.evalExpr(node.cause, env);
          inst.__dict__.set('__cause__', cv);
        }
        throw new PyError(inst);
      }
      case 'Try': return yield* this.execTry(node, env);
      case 'With': return yield* this.execWith(node, env);
      case 'Import': {
        for (var ii = 0; ii < node.names.length; ii++) {
          var spec = node.names[ii];
          var mod = this.importModule(spec.name);
          if (spec.asname) env.set(spec.asname, mod);
          else {
            var topName = spec.name.split('.')[0];
            env.set(topName, this.importModule(topName));
          }
        }
        return;
      }
      case 'ImportFrom': {
        var src = this.importModule(node.module);
        for (var fi = 0; fi < node.names.length; fi++) {
          var nm = node.names[fi];
          if (nm.name === '*') {
            src.dict.forEach(function (v, k) { if (k[0] !== '_') env.set(k, v); });
            continue;
          }
          var val2;
          if (src.dict.has(nm.name)) val2 = src.dict.get(nm.name);
          else {
            // Maybe it is a submodule.
            try { val2 = this.importModule(node.module + '.' + nm.name); }
            catch (e) {
              this.throwPy('ImportError', "cannot import name '" + nm.name + "' from '" + node.module + "'");
            }
          }
          env.set(nm.asname || nm.name, val2);
        }
        return;
      }
      default:
        this.throwPy('SystemError', 'unsupported statement: ' + node.type);
    }
  };

  I.execTry = function* (node, env) {
    var handled = false;
    try {
      try {
        yield* this.execBlock(node.body, env);
        if (node.orelse.length) yield* this.execBlock(node.orelse, env);
      } catch (e) {
        if (e && e.__signal__) throw e;
        var err = this.wrapJsError(e);
        if (!(err instanceof PyError)) throw err;
        var exc = err.exc;
        for (var i = 0; i < node.handlers.length; i++) {
          var h = node.handlers[i];
          var match = false;
          if (!h.etype) match = true;
          else {
            var et = yield* this.evalExpr(h.etype, env);
            var candidates = et instanceof PyTuple ? et.items : [et];
            for (var c = 0; c < candidates.length; c++) {
              if (candidates[c] instanceof PyClass && exc.__class__.isSubclassOf(candidates[c])) { match = true; break; }
            }
          }
          if (match) {
            handled = true;
            var prev = this.currentException;
            this.currentException = exc;
            if (h.name) env.set(h.name, exc);
            try {
              yield* this.execBlock(h.body, env);
            } finally {
              this.currentException = prev;
              if (h.name) env.del(h.name);
            }
            break;
          }
        }
        if (!handled) throw err;
      }
    } finally {
      if (node.finalbody.length) yield* this.execBlock(node.finalbody, env);
    }
  };

  I.execWith = function* (node, env) {
    var self = this;
    var entered = [];
    function* enterAll(idx) {
      if (idx >= node.items.length) {
        yield* self.execBlock(node.body, env);
        return;
      }
      var item = node.items[idx];
      var ctx = yield* self.evalExpr(item.context, env);
      var enterM = self.getattr(ctx, '__enter__', null);
      if (!enterM) self.typeError("'" + typeName(ctx) + "' object does not support the context manager protocol");
      var val = yield* self.call(enterM, [], null);
      if (item.optional) yield* self.assign(item.optional, val, env);
      entered.push(ctx);
      var exitM = self.getattr(ctx, '__exit__', null);
      try {
        yield* enterAll(idx + 1);
      } catch (e) {
        if (e && e.__signal__) {
          if (exitM) yield* self.call(exitM, [null, null, null], null);
          throw e;
        }
        var err = self.wrapJsError(e);
        if (exitM && err instanceof PyError) {
          var suppress = yield* self.call(exitM, [err.exc.__class__, err.exc, null], null);
          if (truthy(suppress)) return;
        } else if (exitM) {
          yield* self.call(exitM, [null, null, null], null);
        }
        throw err;
      }
      if (exitM) yield* self.call(exitM, [null, null, null], null);
    }
    yield* enterAll(0);
  };

  I.makeFunction = function* (node, env) {
    var isGen = containsYield(node.body);
    var fn = new PyFunction(node.name, node.params, node.body, env, {
      isGenerator: isGen,
      isAsync: node.isAsync,
      doc: docstringOf(node.body),
      qualname: node.name
    });
    var defaults = { pos: [], kw: new Map() };
    for (var i = 0; i < node.params.args.length; i++) {
      var a = node.params.args[i];
      if (a.def) defaults.pos.push(yield* this.evalExpr(a.def, env));
    }
    for (var j = 0; j < node.params.kwonly.length; j++) {
      var k = node.params.kwonly[j];
      if (k.def) defaults.kw.set(k.name, yield* this.evalExpr(k.def, env));
    }
    fn.defaultsEvaluated = defaults;
    var anns = new Map();
    var all = node.params.args.concat(node.params.kwonly);
    for (var m = 0; m < all.length; m++) {
      if (all[m].annotation) {
        try { anns.set(all[m].name, yield* this.evalExpr(all[m].annotation, env)); } catch (e) { /* forward refs */ }
      }
    }
    if (node.returns) {
      try { anns.set('return', yield* this.evalExpr(node.returns, env)); } catch (e) { /* ignore */ }
    }
    fn.annotations = anns;
    return fn;
  };

  I.makeClass = function* (node, env) {
    var bases = [];
    for (var i = 0; i < node.bases.length; i++) {
      var b = yield* this.evalExpr(node.bases[i], env);
      if (b instanceof PyClass) bases.push(b);
    }
    var objectCls = this.objectClass;
    if (!bases.length && objectCls) bases = [objectCls];
    var classEnv = new Env(env, 'class', env.globalsEnv);
    classEnv.vars.set('__name__', node.name);
    classEnv.vars.set('__qualname__', node.name);
    yield* this.execBlock(node.body, classEnv);
    var dict = new Map();
    classEnv.vars.forEach(function (v, k) { dict.set(k, v); });
    var doc = docstringOf(node.body);
    if (doc && !dict.has('__doc__')) dict.set('__doc__', doc);
    var isExc = bases.some(function (b) { return b.isException; });
    var isEnum = bases.some(function (b) { return b.__isEnumBase__; });
    var cls = new PyClass(node.name, bases, dict, { isException: isExc });
    // __slots__ support
    var slotsDef = dict.get('__slots__');
    if (slotsDef && (slotsDef instanceof PyTuple || slotsDef instanceof PyList)) {
      cls.__slotset__ = new Set(slotsDef.items.map(function (x) { return O.str(x); }));
    } else if (typeof slotsDef === 'string') {
      cls.__slotset__ = new Set([slotsDef]);
    }
    if (isEnum) {
      cls.__isEnumBase__ = true;
      this.buildEnum(cls, node, classEnv);
    }
    // Give methods a handle on their defining class so zero-arg super() works.
    dict.forEach(function (v) {
      if (v instanceof PyFunction) { v.boundClass = cls; v.qualname = node.name + '.' + v.name; }
      if ((v instanceof PyStaticMethod || v instanceof PyClassMethod) && v.func instanceof PyFunction) v.func.boundClass = cls;
      if (v instanceof PyProperty) {
        [v.fget, v.fset, v.fdel].forEach(function (f) { if (f instanceof PyFunction) f.boundClass = cls; });
      }
    });
    return cls;
  };

  I.buildEnum = function (cls, node, classEnv) {
    var members = new Map();
    var auto = 0;
    var self = this;
    classEnv.vars.forEach(function (v, k) {
      if (k.indexOf('__') === 0) return;
      if (v instanceof PyFunction || v instanceof PyBuiltin || v instanceof PyProperty ||
          v instanceof PyStaticMethod || v instanceof PyClassMethod) return;
      var value = v;
      if (v && v.__auto__) { auto += 1; value = BigInt(auto); }
      else if (typeof v === 'bigint') auto = Number(v);
      var member = new PyInstance(cls);
      member.__dict__.set('name', k);
      member.__dict__.set('value', value);
      member.__enumMember__ = true;
      members.set(k, member);
      cls.dict.set(k, member);
    });
    cls.__enumMembers__ = members;
    cls.dict.set('__repr__', new PyBuiltin('__repr__', function (a) {
      return '<' + cls.name + '.' + O.str(a[0].__dict__.get('name')) + ': ' + O.repr(a[0].__dict__.get('value')) + '>';
    }));
    cls.dict.set('__str__', new PyBuiltin('__str__', function (a) {
      return cls.name + '.' + O.str(a[0].__dict__.get('name'));
    }));
    // Calling the enum with a value looks up the member: Proto(17)
    cls.nativeNew = function (args, kwargs, it) {
      var target = args[0];
      var found = null;
      members.forEach(function (m) { if (O.eq(m.__dict__.get('value'), target)) found = m; });
      if (!found) it.valueError(O.repr(target) + ' is not a valid ' + cls.name);
      return found;
    };
    // Iterating the class yields members
    cls.__jsiter__ = function () {
      var vals = Array.from(members.values()), i = 0;
      return { next: function () { return i < vals.length ? { value: vals[i++], done: false } : { done: true }; } };
    };
  };

  function docstringOf(body) {
    if (body.length && body[0].type === 'Expr' && body[0].value.type === 'Str') return body[0].value.v;
    return null;
  }

  function containsYield(body) {
    var found = false;
    walk(body, function (n) {
      if (found) return false;
      if (n.type === 'FunctionDef' || n.type === 'Lambda' || n.type === 'ClassDef') return false;
      if (n.type === 'Yield' || n.type === 'YieldFrom') { found = true; return false; }
      return true;
    });
    return found;
  }

  function walk(node, visit) {
    if (Array.isArray(node)) { node.forEach(function (n) { walk(n, visit); }); return; }
    if (!node || typeof node !== 'object' || !node.type) return;
    if (visit(node) === false) return;
    for (var k in node) {
      if (k === 'loc' || k === 'type') continue;
      var v = node[k];
      if (Array.isArray(v) || (v && typeof v === 'object' && v.type)) walk(v, visit);
      else if (v && typeof v === 'object') {
        for (var k2 in v) {
          var v2 = v[k2];
          if (Array.isArray(v2) || (v2 && typeof v2 === 'object' && v2.type)) walk(v2, visit);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Assignment targets
  // ---------------------------------------------------------------------------

  I.assign = function* (target, value, env) {
    switch (target.type) {
      case 'Name': env.set(target.id, value); return;
      case 'Tuple': case 'List': {
        var elts = target.elts;
        var starIdx = -1;
        for (var i = 0; i < elts.length; i++) if (elts[i].type === 'Starred') { starIdx = i; break; }
        var vals = this.toArray(value);
        if (starIdx < 0) {
          if (vals.length !== elts.length) {
            if (vals.length < elts.length) this.valueError('not enough values to unpack (expected ' + elts.length + ', got ' + vals.length + ')');
            this.valueError('too many values to unpack (expected ' + elts.length + ')');
          }
          for (var j = 0; j < elts.length; j++) yield* this.assign(elts[j], vals[j], env);
          return;
        }
        var before = starIdx, after = elts.length - starIdx - 1;
        if (vals.length < before + after) {
          this.valueError('not enough values to unpack (expected at least ' + (before + after) + ', got ' + vals.length + ')');
        }
        for (var b = 0; b < before; b++) yield* this.assign(elts[b], vals[b], env);
        var mid = vals.slice(before, vals.length - after);
        yield* this.assign(elts[starIdx].value, new PyList(mid), env);
        for (var a = 0; a < after; a++) {
          yield* this.assign(elts[starIdx + 1 + a], vals[vals.length - after + a], env);
        }
        return;
      }
      case 'Starred': return yield* this.assign(target.value, value, env);
      case 'Attribute': {
        var obj = yield* this.evalExpr(target.value, env);
        this.setattr(obj, target.attr, value);
        return;
      }
      case 'Subscript': {
        var o = yield* this.evalExpr(target.value, env);
        var key = yield* this.evalSlice(target.slice, env);
        this.setitem(o, key, value);
        return;
      }
      default:
        this.throwPy('SyntaxError', 'cannot assign to ' + target.type);
    }
  };

  // ---------------------------------------------------------------------------
  // Expressions
  // ---------------------------------------------------------------------------

  I.evalExpr = function* (node, env) {
    this.tick();
    switch (node.type) {
      case 'Num': return node.v;
      case 'Str': return node.v;
      case 'Bytes': return new PyBytes(node.v);
      case 'Const':
        if (node.ellipsis) { var e = { __ellipsis__: true, pytype: 'ellipsis' }; return e; }
        return node.v;
      case 'Name': {
        var r = env.get(node.id);
        if (r.found) return r.value;
        if (this.builtinsMap.has(node.id)) return this.builtinsMap.get(node.id);
        this.nameError("name '" + node.id + "' is not defined");
        return;
      }
      case 'Tuple': {
        var titems = [];
        for (var i = 0; i < node.elts.length; i++) {
          var el = node.elts[i];
          if (el.type === 'Starred') {
            var sv = yield* this.evalExpr(el.value, env);
            titems.push.apply(titems, this.toArray(sv));
          } else titems.push(yield* this.evalExpr(el, env));
        }
        return new PyTuple(titems);
      }
      case 'List': {
        var litems = [];
        for (var j = 0; j < node.elts.length; j++) {
          var le = node.elts[j];
          if (le.type === 'Starred') {
            var lv = yield* this.evalExpr(le.value, env);
            litems.push.apply(litems, this.toArray(lv));
          } else litems.push(yield* this.evalExpr(le, env));
        }
        return new PyList(litems);
      }
      case 'Set': {
        var s = new PySet();
        for (var k = 0; k < node.elts.length; k++) {
          var se = node.elts[k];
          if (se.type === 'Starred') {
            var svv = this.toArray(yield* this.evalExpr(se.value, env));
            svv.forEach(function (x) { s.add(x); });
          } else s.add(yield* this.evalExpr(se, env));
        }
        return s;
      }
      case 'Dict': {
        var d = new PyDict();
        for (var m = 0; m < node.keys.length; m++) {
          if (node.keys[m] === null) {
            var other = yield* this.evalExpr(node.values[m], env);
            if (other instanceof PyDict) other.map.forEach(function (en) { d.set(en.k, en.v); });
            else this.typeError('argument after ** must be a mapping');
            continue;
          }
          var kk = yield* this.evalExpr(node.keys[m], env);
          var vv = yield* this.evalExpr(node.values[m], env);
          this.checkHashable(kk);
          d.set(kk, vv);
        }
        return d;
      }
      case 'FString': return yield* this.evalFString(node, env);
      case 'BinOp': {
        var a = yield* this.evalExpr(node.left, env);
        var b = yield* this.evalExpr(node.right, env);
        return yield* this.binop(node.op, a, b);
      }
      case 'UnaryOp': {
        var v = yield* this.evalExpr(node.operand, env);
        return this.unaryop(node.op, v);
      }
      case 'BoolOp': {
        var last = null;
        for (var bi = 0; bi < node.values.length; bi++) {
          last = yield* this.evalExpr(node.values[bi], env);
          if (node.op === 'and' && !truthy(last)) return last;
          if (node.op === 'or' && truthy(last)) return last;
        }
        return last;
      }
      case 'Compare': {
        var left = yield* this.evalExpr(node.left, env);
        for (var ci = 0; ci < node.ops.length; ci++) {
          var right = yield* this.evalExpr(node.comparators[ci], env);
          if (!(yield* this.compareOp(node.ops[ci], left, right))) return false;
          left = right;
        }
        return true;
      }
      case 'IfExp':
        return truthy(yield* this.evalExpr(node.test, env))
          ? yield* this.evalExpr(node.body, env)
          : yield* this.evalExpr(node.orelse, env);
      case 'Call': return yield* this.evalCall(node, env);
      case 'Attribute': {
        var obj = yield* this.evalExpr(node.value, env);
        return this.getattr(obj, node.attr);
      }
      case 'Subscript': {
        var o = yield* this.evalExpr(node.value, env);
        var key = yield* this.evalSlice(node.slice, env);
        return this.getitem(o, key);
      }
      case 'Slice': return yield* this.evalSlice(node, env);
      case 'Lambda': {
        var lf = new PyFunction('<lambda>', node.params, [{ type: 'Return', value: node.body, loc: node.loc }], env, { isLambda: true });
        var defs = { pos: [], kw: new Map() };
        for (var li = 0; li < node.params.args.length; li++) {
          if (node.params.args[li].def) defs.pos.push(yield* this.evalExpr(node.params.args[li].def, env));
        }
        for (var lj = 0; lj < node.params.kwonly.length; lj++) {
          if (node.params.kwonly[lj].def) defs.kw.set(node.params.kwonly[lj].name, yield* this.evalExpr(node.params.kwonly[lj].def, env));
        }
        lf.defaultsEvaluated = defs;
        return lf;
      }
      case 'ListComp': return new PyList(yield* this.comprehend(node, env, 'list'));
      case 'SetComp': {
        var st = new PySet();
        var vals = yield* this.comprehend(node, env, 'set');
        vals.forEach(function (x) { st.add(x); });
        return st;
      }
      case 'DictComp': {
        var dd = new PyDict();
        var pairs = yield* this.comprehend(node, env, 'dict');
        for (var pi = 0; pi < pairs.length; pi++) dd.set(pairs[pi][0], pairs[pi][1]);
        return dd;
      }
      case 'GeneratorExp': {
        var self = this;
        var genEnv = new Env(env, 'local', env.globalsEnv);
        var it = (function* () {
          var vals = yield* self.comprehendLazy(node, genEnv);
          return vals;
        })();
        return new PyGenerator(this.makeCompGenerator(node, genEnv), '<genexpr>');
      }
      case 'Starred': return yield* this.evalExpr(node.value, env);
      case 'NamedExpr': {
        var nv = yield* this.evalExpr(node.value, env);
        env.set(node.target.id, nv);
        return nv;
      }
      case 'Yield': {
        var yv = node.value ? yield* this.evalExpr(node.value, env) : null;
        var sent = yield new YieldMarker(yv);
        return sent === undefined ? null : sent;
      }
      case 'YieldFrom': {
        var src = yield* this.evalExpr(node.value, env);
        var iter = this.iter(src);
        var lastSent = null;
        for (;;) {
          this.tick();
          var rr = iter.next();
          if (rr.done) return rr.value === undefined ? null : rr.value;
          lastSent = yield new YieldMarker(rr.value);
        }
      }
      case 'Await': {
        var aw = yield* this.evalExpr(node.value, env);
        var got = yield new AwaitMarker(aw);
        return got === undefined ? null : got;
      }
      default:
        this.throwPy('SystemError', 'unsupported expression: ' + node.type);
    }
  };

  I.makeCompGenerator = function (node, env) {
    var self = this;
    return (function* () {
      yield* self.compIterate(node, env, 0, function* (val) {
        yield new YieldMarker(val);
      });
      return null;
    })();
  };

  I.compIterate = function* (node, env, gi, emit) {
    var gens = node.generators;
    if (gi >= gens.length) {
      if (node.type === 'DictComp') {
        var k = yield* this.evalExpr(node.key, env);
        var v = yield* this.evalExpr(node.value, env);
        yield* emit([k, v]);
      } else {
        var val = yield* this.evalExpr(node.elt, env);
        yield* emit(val);
      }
      return;
    }
    var g = gens[gi];
    var iterable = yield* this.evalExpr(g.iter, env);
    var it = this.iter(iterable);
    for (;;) {
      this.tick();
      var r = it.next();
      if (r.done) break;
      yield* this.assign(g.target, r.value, env);
      var ok = true;
      for (var i = 0; i < g.ifs.length; i++) {
        if (!truthy(yield* this.evalExpr(g.ifs[i], env))) { ok = false; break; }
      }
      if (!ok) continue;
      yield* this.compIterate(node, env, gi + 1, emit);
    }
  };

  I.comprehend = function* (node, env, kind) {
    var scope = new Env(env, 'local', env.globalsEnv);
    var out = [];
    yield* this.compIterate(node, scope, 0, function* (v) { out.push(v); });
    return out;
  };

  I.evalFString = function* (node, env) {
    var B = root.PyBuiltins;
    var out = '';
    for (var i = 0; i < node.parts.length; i++) {
      var p = node.parts[i];
      if (p.kind === 'lit') { out += p.text; continue; }
      var v = yield* this.evalExpr(p.expr, env);
      if (p.showExpr) out += p.src + '=';
      var spec = p.spec;
      if (p.specParts) {
        spec = '';
        for (var s = 0; s < p.specParts.length; s++) {
          var sp = p.specParts[s];
          if (sp.kind === 'lit') spec += sp.text;
          else spec += str(yield* this.evalExpr(sp.expr, env));
        }
      }
      var text;
      if (p.conv === 'r' || (p.showExpr && !p.conv && !spec)) text = repr(v);
      else if (p.conv === 's') text = str(v);
      else if (p.conv === 'a') text = repr(v);
      else text = null;
      if (text === null) text = B.formatValue(this, v, spec || '');
      else if (spec) text = B.formatValue(this, text, spec);
      out += text;
    }
    return out;
  };

  I.evalCall = function* (node, env) {
    var func = yield* this.evalExpr(node.func, env);
    var args = [];
    for (var i = 0; i < node.args.length; i++) {
      var a = node.args[i];
      if (a.type === 'Starred') {
        var sv = yield* this.evalExpr(a.value, env);
        args.push.apply(args, this.toArray(sv));
      } else {
        args.push(yield* this.evalExpr(a, env));
      }
    }
    var kwargs = null;
    for (var k = 0; k < node.keywords.length; k++) {
      var kw = node.keywords[k];
      if (!kwargs) kwargs = new PyDict();
      if (kw.arg === null) {
        var mapping = yield* this.evalExpr(kw.value, env);
        if (mapping instanceof PyDict) mapping.map.forEach(function (e) { kwargs.set(e.k, e.v); });
        else this.typeError('argument after ** must be a mapping');
      } else {
        kwargs.set(kw.arg, yield* this.evalExpr(kw.value, env));
      }
    }
    // Zero-argument super() needs the enclosing class and instance.
    if (node.func.type === 'Name' && node.func.id === 'super' && args.length === 0) {
      var cls = null, e2 = env;
      while (e2 && !cls) { cls = e2.__class__ || null; e2 = e2.parent; }
      var inst = null; e2 = env;
      while (e2 && inst === null) { if (e2.__firstarg__ !== undefined) inst = e2.__firstarg__; e2 = e2.parent; }
      if (cls) return this.makeSuper(cls, inst);
    }
    try {
      return yield* this.call(func, args, kwargs);
    } catch (e) {
      throw this.wrapJsError(e);
    }
  };

  I.makeSuper = function (cls, inst) {
    var self = this;
    var startIdx = 1;
    var mro = (inst instanceof PyInstance ? inst.__class__.mro : cls.mro);
    var idx = mro.indexOf(cls);
    var searchFrom = idx >= 0 ? idx + 1 : 1;
    var proxy = {
      pytype: 'super',
      __nativeAttrs__: {},
      __superLookup__: function (name) {
        for (var i = searchFrom; i < mro.length; i++) {
          if (mro[i].dict.has(name)) return { cls: mro[i], val: mro[i].dict.get(name) };
        }
        // Exceptions and object provide __init__ implicitly.
        if (name === '__init__' && (cls.isException || mro.some(function (c) { return c.isException; }))) {
          return { cls: mro[mro.length - 1], val: new O.PyBuiltin('__init__', function (a) {
            var selfObj = a[0];
            if (selfObj instanceof O.PyInstance) selfObj.__dict__.set('args', new O.PyTuple(a.slice(1)));
            return null;
          }) };
        }
        if (name === '__init__') {
          return { cls: mro[mro.length - 1], val: new O.PyBuiltin('__init__', function () { return null; }) };
        }
        return null;
      }
    };
    proxy.__nativeAttrs__ = new Proxy({}, {
      has: function (t, name) { return !!proxy.__superLookup__(name); },
      get: function (t, name) {
        var f = proxy.__superLookup__(name);
        if (!f) return undefined;
        return function () { return self.bindDescriptor(f.val, inst, f.cls); };
      }
    });
    return proxy;
  };

  // ---------------------------------------------------------------------------
  // Operators
  // ---------------------------------------------------------------------------

  I.checkHashable = function (v) {
    if (v instanceof PyList) this.typeError("unhashable type: 'list'");
    if (v instanceof PyDict) this.typeError("unhashable type: 'dict'");
    if (v instanceof PySet && !v.frozen) this.typeError("unhashable type: 'set'");
  };

  I.dunderBin = function* (op, a, b) {
    var names = {
      '+': ['__add__', '__radd__'], '-': ['__sub__', '__rsub__'],
      '*': ['__mul__', '__rmul__'], '/': ['__truediv__', '__rtruediv__'],
      '//': ['__floordiv__', '__rfloordiv__'], '%': ['__mod__', '__rmod__'],
      '**': ['__pow__', '__rpow__'], '&': ['__and__', '__rand__'],
      '|': ['__or__', '__ror__'], '^': ['__xor__', '__rxor__'],
      '<<': ['__lshift__', '__rlshift__'], '>>': ['__rshift__', '__rrshift__'],
      '@': ['__matmul__', '__rmatmul__']
    }[op];
    if (!names) return undefined;
    if (a instanceof PyInstance) {
      var m = a.__class__.lookup(names[0]);
      if (m) {
        var r = yield* this.call(this.bindDescriptor(m, a, a.__class__), [b], null);
        if (r !== O.NOT_IMPLEMENTED) return r;
      }
    }
    if (b instanceof PyInstance) {
      var m2 = b.__class__.lookup(names[1]);
      if (m2) {
        var r2 = yield* this.call(this.bindDescriptor(m2, b, b.__class__), [a], null);
        if (r2 !== O.NOT_IMPLEMENTED) return r2;
      }
    }
    return undefined;
  };

  I.binopAug = function* (op, a, b) {
    var iNames = {
      '+': '__iadd__', '-': '__isub__', '*': '__imul__', '/': '__itruediv__',
      '//': '__ifloordiv__', '%': '__imod__', '**': '__ipow__', '&': '__iand__',
      '|': '__ior__', '^': '__ixor__', '<<': '__ilshift__', '>>': '__irshift__'
    };
    if (a instanceof PyInstance && iNames[op]) {
      var m = a.__class__.lookup(iNames[op]);
      if (m) return yield* this.call(this.bindDescriptor(m, a, a.__class__), [b], null);
    }
    // In-place list extension keeps identity, as CPython does.
    if (op === '+' && a instanceof PyList) {
      var extra = this.toArray(b);
      for (var i = 0; i < extra.length; i++) a.items.push(extra[i]);
      return a;
    }
    if (op === '|' && a instanceof PySet && !a.frozen && b instanceof PySet) {
      b.values().forEach(function (x) { a.add(x); });
      return a;
    }
    if (op === '|' && a instanceof PyDict && b instanceof PyDict) {
      b.map.forEach(function (e) { a.set(e.k, e.v); });
      return a;
    }
    return yield* this.binop(op, a, b);
  };

  I.binop = function* (op, a, b) {
    this.tick();
    var custom = yield* this.dunderBin(op, a, b);
    if (custom !== undefined) return custom;

    var aNum = isNum(a) && !(typeof a === 'string');
    var bNum = isNum(b);

    if (aNum && bNum) return this.numericOp(op, a, b);

    switch (op) {
      case '+':
        if (typeof a === 'string' && typeof b === 'string') return a + b;
        if (a instanceof PyList && b instanceof PyList) return new PyList(a.items.concat(b.items));
        if (a instanceof PyTuple && b instanceof PyTuple) return new PyTuple(a.items.concat(b.items));
        if (a instanceof PyBytes && b instanceof PyBytes) {
          var merged = new Uint8Array(a.b.length + b.b.length);
          merged.set(a.b, 0); merged.set(b.b, a.b.length);
          return new PyBytes(merged, a.mutable);
        }
        if (typeof a === 'string' && b !== null && !isNum(b)) {
          this.typeError('can only concatenate str (not "' + typeName(b) + '") to str');
        }
        break;
      case '*': {
        var seq = null, count = null;
        if ((typeof a === 'string' || a instanceof PyList || a instanceof PyTuple || a instanceof PyBytes) && isNum(b)) { seq = a; count = b; }
        else if ((typeof b === 'string' || b instanceof PyList || b instanceof PyTuple || b instanceof PyBytes) && isNum(a)) { seq = b; count = a; }
        if (seq !== null) {
          if (typeof count === 'number') this.typeError("can't multiply sequence by non-int of type 'float'");
          var n = Number(toBigInt(count));
          if (n < 0) n = 0;
          if (typeof seq === 'string') {
            if (seq.length * n > 5000000) this.throwPy('MemoryError', 'string too large');
            return seq.repeat(n);
          }
          if (seq instanceof PyBytes) {
            var out = new Uint8Array(seq.b.length * n);
            for (var r = 0; r < n; r++) out.set(seq.b, r * seq.b.length);
            return new PyBytes(out, seq.mutable);
          }
          if (seq.items.length * n > 2000000) this.throwPy('MemoryError', 'sequence too large');
          var arr = [];
          for (var q = 0; q < n; q++) arr = arr.concat(seq.items);
          return seq instanceof PyList ? new PyList(arr) : new PyTuple(arr);
        }
        break;
      }
      case '%':
        if (typeof a === 'string') return root.PyBuiltins.percentFormat(this, a, b);
        if (a instanceof PyBytes) {
          var s = root.PyBuiltins.percentFormat(this, root.PyBuiltins.bytesToLatin1(a), b);
          return root.PyBuiltins.latin1ToBytes(s);
        }
        break;
      case '|':
        if (a instanceof PySet && b instanceof PySet) {
          var u = new PySet(a.values(), a.frozen && b.frozen);
          b.values().forEach(function (x) { u.add(x); });
          return u;
        }
        if (a instanceof PyDict && b instanceof PyDict) {
          var nd = new PyDict();
          a.map.forEach(function (e) { nd.set(e.k, e.v); });
          b.map.forEach(function (e) { nd.set(e.k, e.v); });
          return nd;
        }
        break;
      case '&':
        if (a instanceof PySet && b instanceof PySet) {
          var inter = new PySet([], a.frozen && b.frozen);
          a.values().forEach(function (x) { if (b.has(x)) inter.add(x); });
          return inter;
        }
        break;
      case '-':
        if (a instanceof PySet && b instanceof PySet) {
          var diff = new PySet([], a.frozen && b.frozen);
          a.values().forEach(function (x) { if (!b.has(x)) diff.add(x); });
          return diff;
        }
        break;
      case '^':
        if (a instanceof PySet && b instanceof PySet) {
          var sym = new PySet([], a.frozen && b.frozen);
          a.values().forEach(function (x) { if (!b.has(x)) sym.add(x); });
          b.values().forEach(function (x) { if (!a.has(x)) sym.add(x); });
          return sym;
        }
        break;
    }
    this.typeError("unsupported operand type(s) for " + op + ": '" + typeName(a) + "' and '" + typeName(b) + "'");
  };

  I.numericOp = function (op, a, b) {
    var bothInt = (typeof a === 'bigint' || typeof a === 'boolean') && (typeof b === 'bigint' || typeof b === 'boolean');
    if (bothInt) {
      var x = toBigInt(a), y = toBigInt(b);
      switch (op) {
        case '+': return x + y;
        case '-': return x - y;
        case '*': return x * y;
        case '/':
          if (y === 0n) this.throwPy('ZeroDivisionError', 'division by zero');
          return Number(x) / Number(y);
        case '//': {
          if (y === 0n) this.throwPy('ZeroDivisionError', 'integer division or modulo by zero');
          var q = x / y;
          if ((x % y !== 0n) && ((x < 0n) !== (y < 0n))) q -= 1n;
          return q;
        }
        case '%': {
          if (y === 0n) this.throwPy('ZeroDivisionError', 'integer division or modulo by zero');
          var m = x % y;
          if (m !== 0n && ((m < 0n) !== (y < 0n))) m += y;
          return m;
        }
        case '**': {
          if (y < 0n) return Math.pow(Number(x), Number(y));
          if (y > 20000n) this.throwPy('OverflowError', 'exponent too large for this sandbox');
          return x ** y;
        }
        case '&': return x & y;
        case '|': return x | y;
        case '^': return x ^ y;
        case '<<':
          if (y > 100000n) this.throwPy('OverflowError', 'shift too large for this sandbox');
          return x << y;
        case '>>': return x >> y;
        case '@': this.typeError("unsupported operand type(s) for @: 'int' and 'int'");
      }
    }
    var fa = toNumber(a), fb = toNumber(b);
    switch (op) {
      case '+': return fa + fb;
      case '-': return fa - fb;
      case '*': return fa * fb;
      case '/':
        if (fb === 0) this.throwPy('ZeroDivisionError', 'float division by zero');
        return fa / fb;
      case '//':
        if (fb === 0) this.throwPy('ZeroDivisionError', 'float floor division by zero');
        return Math.floor(fa / fb);
      case '%': {
        if (fb === 0) this.throwPy('ZeroDivisionError', 'float modulo');
        var r = fa % fb;
        if (r !== 0 && (r < 0) !== (fb < 0)) r += fb;
        return r;
      }
      case '**': return Math.pow(fa, fb);
      case '&': case '|': case '^': case '<<': case '>>':
        this.typeError("unsupported operand type(s) for " + op + ": '" + typeName(a) + "' and '" + typeName(b) + "'");
    }
    this.typeError('unsupported operand ' + op);
  };

  I.unaryop = function (op, v) {
    if (op === 'not') return !truthy(v);
    if (v instanceof PyInstance) {
      var nm = { '-': '__neg__', '+': '__pos__', '~': '__invert__' }[op];
      var m = v.__class__.lookup(nm);
      if (m) return this.callSync(this.bindDescriptor(m, v, v.__class__), [], null);
    }
    if (op === '-') {
      if (typeof v === 'bigint') return -v;
      if (typeof v === 'boolean') return v ? -1n : 0n;
      if (typeof v === 'number') return -v;
    }
    if (op === '+') {
      if (typeof v === 'boolean') return v ? 1n : 0n;
      if (isNum(v)) return v;
    }
    if (op === '~') {
      if (typeof v === 'bigint') return ~v;
      if (typeof v === 'boolean') return v ? -2n : -1n;
    }
    this.typeError("bad operand type for unary " + op + ": '" + typeName(v) + "'");
  };

  I.compareOp = function* (op, a, b) {
    switch (op) {
      case '==': return this.richEq(a, b);
      case '!=': return !this.richEq(a, b);
      case 'is': return this.isIdentical(a, b);
      case 'is not': return !this.isIdentical(a, b);
      case 'in': return this.contains(b, a);
      case 'not in': return !this.contains(b, a);
    }
    if (a instanceof PySet && b instanceof PySet) {
      var av = a.values(), bv = b.values();
      var aSub = av.every(function (x) { return b.has(x); });
      var bSub = bv.every(function (x) { return a.has(x); });
      switch (op) {
        case '<=': return aSub;
        case '>=': return bSub;
        case '<': return aSub && a.size < b.size;
        case '>': return bSub && a.size > b.size;
      }
    }
    if (a instanceof PyInstance || b instanceof PyInstance) {
      var names = { '<': '__lt__', '<=': '__le__', '>': '__gt__', '>=': '__ge__' };
      var rev = { '<': '__gt__', '<=': '__ge__', '>': '__lt__', '>=': '__le__' };
      if (a instanceof PyInstance) {
        var m = a.__class__.lookup(names[op]);
        if (m) {
          var r = yield* this.call(this.bindDescriptor(m, a, a.__class__), [b], null);
          if (r !== O.NOT_IMPLEMENTED) return truthy(r);
        }
      }
      if (b instanceof PyInstance) {
        var m2 = b.__class__.lookup(rev[op]);
        if (m2) {
          var r2 = yield* this.call(this.bindDescriptor(m2, b, b.__class__), [a], null);
          if (r2 !== O.NOT_IMPLEMENTED) return truthy(r2);
        }
      }
    }
    try {
      var c = compare(a, b);
      switch (op) {
        case '<': return c < 0;
        case '<=': return c <= 0;
        case '>': return c > 0;
        case '>=': return c >= 0;
      }
    } catch (e) {
      throw this.wrapJsError(e);
    }
  };

  I.richEq = function (a, b) {
    try { return eq(a, b); } catch (e) { throw this.wrapJsError(e); }
  };

  I.isIdentical = function (a, b) {
    if (a === null && b === null) return true;
    if (typeof a === 'bigint' && typeof b === 'bigint') {
      // Small ints are interned in CPython; mirror that so `x is 5` behaves.
      return a === b && a >= -5n && a <= 256n ? true : a === b;
    }
    if (typeof a === 'boolean' || typeof b === 'boolean') return a === b;
    if (typeof a === 'string' && typeof b === 'string') return a === b;
    return a === b;
  };

  I.contains = function (container, item) {
    if (typeof container === 'string') {
      if (typeof item !== 'string') this.typeError("'in <string>' requires string as left operand, not " + typeName(item));
      return container.indexOf(item) >= 0;
    }
    if (container instanceof PyDict) return container.has(item);
    if (container instanceof PySet) return container.has(item);
    if (container instanceof PyBytes) {
      if (isNum(item)) return Array.prototype.indexOf.call(container.b, Number(toBigInt(item))) >= 0;
      if (item instanceof PyBytes) {
        var hay = Array.prototype.join.call(container.b, ',');
        var nee = Array.prototype.join.call(item.b, ',');
        return nee === '' || (',' + hay + ',').indexOf(',' + nee + ',') >= 0;
      }
    }
    if (container instanceof PyRange) {
      if (!isNum(item)) return false;
      var n = toBigInt(item);
      if (container.step > 0n ? (n < container.start || n >= container.stop) : (n > container.start || n <= container.stop)) return false;
      return (n - container.start) % container.step === 0n;
    }
    if (container instanceof PyInstance) {
      var m = container.__class__.lookup('__contains__');
      if (m) return truthy(this.callSync(this.bindDescriptor(m, container, container.__class__), [item], null));
    }
    var it = this.iter(container);
    for (;;) {
      this.tick();
      var r = it.next();
      if (r.done) return false;
      if (this.richEq(r.value, item)) return true;
    }
  };

  // ---------------------------------------------------------------------------
  // Indexing
  // ---------------------------------------------------------------------------

  I.evalSlice = function* (node, env) {
    if (node.type === 'Slice') {
      var lo = node.lower ? yield* this.evalExpr(node.lower, env) : null;
      var hi = node.upper ? yield* this.evalExpr(node.upper, env) : null;
      var st = node.step ? yield* this.evalExpr(node.step, env) : null;
      return new PySlice(lo, hi, st);
    }
    return yield* this.evalExpr(node, env);
  };

  I.normIndex = function (idx, len, forSlice) {
    var i = Number(toBigInt(idx));
    if (i < 0) i += len;
    if (!forSlice && (i < 0 || i >= len)) return null;
    return i;
  };

  I.sliceIndices = function (sl, len) {
    var step = sl.step === null || sl.step === undefined ? 1 : Number(toBigInt(sl.step));
    if (step === 0) this.valueError('slice step cannot be zero');
    var start, stop;
    if (step > 0) {
      start = sl.start === null || sl.start === undefined ? 0 : Number(toBigInt(sl.start));
      stop = sl.stop === null || sl.stop === undefined ? len : Number(toBigInt(sl.stop));
      if (start < 0) start = Math.max(0, start + len);
      if (stop < 0) stop = Math.max(0, stop + len);
      start = Math.min(start, len); stop = Math.min(stop, len);
    } else {
      start = sl.start === null || sl.start === undefined ? len - 1 : Number(toBigInt(sl.start));
      stop = sl.stop === null || sl.stop === undefined ? -1 : Number(toBigInt(sl.stop));
      if (start < 0) start += len;
      if (sl.stop !== null && sl.stop !== undefined && stop < 0) stop += len;
      start = Math.min(start, len - 1);
      if (sl.stop === null || sl.stop === undefined) stop = -1;
      else stop = Math.max(stop, -1);
    }
    return { start: start, stop: stop, step: step };
  };

  I.sliceArray = function (arr, sl) {
    var ix = this.sliceIndices(sl, arr.length);
    var out = [];
    if (ix.step > 0) { for (var i = ix.start; i < ix.stop; i += ix.step) out.push(arr[i]); }
    else { for (var j = ix.start; j > ix.stop; j += ix.step) out.push(arr[j]); }
    return out;
  };

  I.getitem = function (obj, key) {
    if (obj instanceof PyList || obj instanceof PyTuple) {
      if (key instanceof PySlice) {
        var s = this.sliceArray(obj.items, key);
        return obj instanceof PyList ? new PyList(s) : new PyTuple(s);
      }
      if (!isNum(key)) this.typeError(typeName(obj) + ' indices must be integers or slices, not ' + typeName(key));
      var i = this.normIndex(key, obj.items.length, false);
      if (i === null) this.indexError(typeName(obj) + ' index out of range');
      return obj.items[i];
    }
    if (typeof obj === 'string') {
      var chars = Array.from(obj);
      if (key instanceof PySlice) return this.sliceArray(chars, key).join('');
      var si = this.normIndex(key, chars.length, false);
      if (si === null) this.indexError('string index out of range');
      return chars[si];
    }
    if (obj instanceof PyBytes) {
      if (key instanceof PySlice) return new PyBytes(this.sliceArray(Array.from(obj.b), key), obj.mutable);
      var bi = this.normIndex(key, obj.b.length, false);
      if (bi === null) this.indexError('index out of range');
      return BigInt(obj.b[bi]);
    }
    if (obj instanceof PyDict) {
      if (obj.has(key)) return obj.get(key);
      if (obj.__default_factory__) {
        var dv = this.callSync(obj.__default_factory__, [], null);
        obj.set(key, dv);
        return dv;
      }
      var mi = obj.__missing__;
      if (mi) return this.callSync(mi, [key], null);
      this.keyError(key);
    }
    if (obj instanceof PyRange) {
      if (key instanceof PySlice) {
        var arr = [];
        var cur = obj.start;
        while (obj.step > 0n ? cur < obj.stop : cur > obj.stop) { arr.push(cur); cur += obj.step; }
        return new PyList(this.sliceArray(arr, key));
      }
      var len = Number(obj.length());
      var ri = this.normIndex(key, len, false);
      if (ri === null) this.indexError('range object index out of range');
      return obj.at(BigInt(ri));
    }
    if (obj instanceof PyInstance) {
      var m = obj.__class__.lookup('__getitem__');
      if (m) return this.callSync(this.bindDescriptor(m, obj, obj.__class__), [key], null);
    }
    if (obj instanceof PyClass) return obj;   // typing-style subscription: List[int]
    if (obj && obj.__getitem_native__) return obj.__getitem_native__(key, this);
    this.typeError("'" + typeName(obj) + "' object is not subscriptable");
  };

  I.setitem = function (obj, key, value) {
    if (obj instanceof PyList) {
      if (key instanceof PySlice) {
        var ix = this.sliceIndices(key, obj.items.length);
        var vals = this.toArray(value);
        if (ix.step === 1) {
          obj.items.splice(ix.start, Math.max(0, ix.stop - ix.start), ...vals);
        } else {
          var idxs = [];
          if (ix.step > 0) { for (var i = ix.start; i < ix.stop; i += ix.step) idxs.push(i); }
          else { for (var j = ix.start; j > ix.stop; j += ix.step) idxs.push(j); }
          if (idxs.length !== vals.length) {
            this.valueError('attempt to assign sequence of size ' + vals.length + ' to extended slice of size ' + idxs.length);
          }
          idxs.forEach(function (ii, n) { obj.items[ii] = vals[n]; });
        }
        return;
      }
      var li = this.normIndex(key, obj.items.length, false);
      if (li === null) this.indexError('list assignment index out of range');
      obj.items[li] = value;
      return;
    }
    if (obj instanceof PyDict) { this.checkHashable(key); obj.set(key, value); return; }
    if (obj instanceof PyBytes && obj.mutable) {
      var bi = this.normIndex(key, obj.b.length, false);
      if (bi === null) this.indexError('bytearray index out of range');
      obj.b[bi] = Number(toBigInt(value)) & 0xff;
      return;
    }
    if (obj instanceof PyInstance) {
      var m = obj.__class__.lookup('__setitem__');
      if (m) { this.callSync(this.bindDescriptor(m, obj, obj.__class__), [key, value], null); return; }
    }
    if (obj instanceof PyTuple) this.typeError("'tuple' object does not support item assignment");
    if (typeof obj === 'string') this.typeError("'str' object does not support item assignment");
    this.typeError("'" + typeName(obj) + "' object does not support item assignment");
  };

  I.delitem = function (obj, key) {
    if (obj instanceof PyList) {
      if (key instanceof PySlice) {
        var ix = this.sliceIndices(key, obj.items.length);
        var idxs = [];
        if (ix.step > 0) { for (var i = ix.start; i < ix.stop; i += ix.step) idxs.push(i); }
        else { for (var j = ix.start; j > ix.stop; j += ix.step) idxs.push(j); }
        idxs.sort(function (a, b) { return b - a; }).forEach(function (ii) { obj.items.splice(ii, 1); });
        return;
      }
      var li = this.normIndex(key, obj.items.length, false);
      if (li === null) this.indexError('list assignment index out of range');
      obj.items.splice(li, 1);
      return;
    }
    if (obj instanceof PyDict) {
      if (!obj.del(key)) this.keyError(key);
      return;
    }
    if (obj instanceof PySet) { obj.del(key); return; }
    if (obj instanceof PyInstance) {
      var m = obj.__class__.lookup('__delitem__');
      if (m) { this.callSync(this.bindDescriptor(m, obj, obj.__class__), [key], null); return; }
    }
    this.typeError("'" + typeName(obj) + "' object doesn't support item deletion");
  };

  I.len = function (v) {
    if (typeof v === 'string') return BigInt(Array.from(v).length);
    if (v instanceof PyList || v instanceof PyTuple) return BigInt(v.items.length);
    if (v instanceof PyDict || v instanceof PySet) return BigInt(v.size);
    if (v instanceof PyBytes) return BigInt(v.b.length);
    if (v instanceof PyRange) return v.length();
    if (v instanceof PyInstance) {
      var m = v.__class__.lookup('__len__');
      if (m) return toBigInt(this.callSync(this.bindDescriptor(m, v, v.__class__), [], null));
    }
    this.typeError("object of type '" + typeName(v) + "' has no len()");
  };

  // ---------------------------------------------------------------------------
  // Imports
  // ---------------------------------------------------------------------------

  I.registerModule = function (name, factory) { this.moduleFactories[name] = factory; };

  I.importModule = function (name) {
    if (this.modules[name]) return this.modules[name];
    var factory = this.moduleFactories[name];
    if (!factory) {
      // Support dotted access to registered submodules such as os.path.
      var parts = name.split('.');
      if (parts.length > 1 && this.moduleFactories[parts[0]]) {
        var parent = this.importModule(parts[0]);
        var cur = parent;
        for (var i = 1; i < parts.length; i++) {
          if (cur.dict.has(parts[i])) cur = cur.dict.get(parts[i]);
          else { cur = null; break; }
        }
        if (cur instanceof PyModule) { this.modules[name] = cur; return cur; }
      }
      throw new PyError(this.makeExc('ModuleNotFoundError',
        "No module named '" + name + "'. In this sandbox you can import: " +
        Object.keys(this.moduleFactories).sort().slice(0, 40).join(', ') + ' ...'));
    }
    var mod = factory(this);
    this.modules[name] = mod;
    return mod;
  };

  // ---------------------------------------------------------------------------
  // Public entry points
  // ---------------------------------------------------------------------------

  I.run = function (source, opts) {
    opts = opts || {};
    this.startTime = Date.now();
    this.steps = 0;
    this.outLen = 0;
    var ast;
    try {
      ast = root.PyParser.parse(source);
    } catch (e) {
      return {
        ok: false,
        output: this.getOutput(),
        error: { type: e.pyType || 'SyntaxError', message: e.message, line: e.line, col: e.col },
        traceback: formatSyntaxError(e, source)
      };
    }
    var env = opts.env || this.globals;
    env.vars.set('__name__', opts.moduleName || '__main__');
    try {
      this.runSync(this.execBlock(ast.body, env));
      return { ok: true, output: this.getOutput(), value: this.lastValue };
    } catch (e) {
      return this.buildErrorResult(e, source);
    }
  };

  I.buildErrorResult = function (e, source) {
    if (e && e.__signal__ === 'return') {
      return { ok: true, output: this.getOutput(), value: e.value };
    }
    if (e instanceof ExecutionLimit || (e && e.__signal__ === 'limit')) {
      return {
        ok: false, output: this.getOutput(),
        error: { type: 'ExecutionLimit', message: e.message },
        traceback: 'ExecutionLimit: ' + e.message
      };
    }
    var err = this.wrapJsError(e);
    if (err instanceof PyError) {
      var name = err.exc.__class__.name;
      var msg = str(err.exc);
      return {
        ok: false,
        output: this.getOutput(),
        error: { type: name, message: msg, exc: err.exc, line: this.currentLoc ? this.currentLoc.line : null },
        traceback: formatPyTraceback(name, msg, this.currentLoc, source)
      };
    }
    return {
      ok: false, output: this.getOutput(),
      error: { type: 'InternalError', message: String(e && e.message || e) },
      traceback: 'InternalError: ' + String(e && e.message || e)
    };
  };

  function sourceLine(source, line) {
    if (!source || !line) return null;
    var lines = source.split('\n');
    return lines[line - 1] !== undefined ? lines[line - 1] : null;
  }

  function formatSyntaxError(e, source) {
    var out = '  File "solution.py", line ' + (e.line || '?') + '\n';
    var ln = sourceLine(source, e.line);
    if (ln !== null) {
      out += '    ' + ln.trim() + '\n';
      if (e.col) out += '    ' + ' '.repeat(Math.max(0, e.col - 1 - (ln.length - ln.trimStart().length))) + '^\n';
    }
    return out + (e.pyType || 'SyntaxError') + ': ' + e.message;
  }

  function formatPyTraceback(name, msg, loc, source) {
    var out = 'Traceback (most recent call last):\n';
    if (loc && loc.line) {
      out += '  File "solution.py", line ' + loc.line + '\n';
      var ln = sourceLine(source, loc.line);
      if (ln !== null) out += '    ' + ln.trim() + '\n';
    }
    out += name + (msg ? ': ' + msg : '');
    return out;
  }

  I.evalString = function (source) {
    var ast = root.PyParser.parseExpression(source);
    return this.runSync(this.evalExpr(ast, this.globals));
  };

  root.PyInterpreter = { Interpreter: Interpreter, Env: Env };
})(typeof window !== 'undefined' ? window : globalThis);
