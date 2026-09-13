/* ============================================================================
 * _util.js — Module-building helpers shared by every stdlib shim.
 * ========================================================================== */
(function (root) {
  'use strict';

  var O = root.PyObjects;

  var registry = [];

  function define(name, factory) { registry.push([name, factory]); }

  function installAll(interp) {
    registry.forEach(function (pair) {
      interp.registerModule(pair[0], pair[1]);
    });
  }

  /** Build a module object with a small fluent helper API. */
  function makeModule(name) {
    var mod = new O.PyModule(name, new Map());
    var api = {
      mod: mod,
      fn: function (fname, f, opts) {
        mod.dict.set(fname, new O.PyBuiltin(fname, f, opts));
        return api;
      },
      val: function (k, v) { mod.dict.set(k, v); return api; },
      alias: function (k, existing) { mod.dict.set(k, mod.dict.get(existing)); return api; },
      get: function (k) { return mod.dict.get(k); }
    };
    return api;
  }

  /**
   * Create a Python-visible class implemented in JS.
   * `spec.init(self, args, kwargs, interp)` initialises the instance dict;
   * `spec.methods` maps names to (self, args, kwargs, interp).
   */
  function makeClass(name, spec, interp) {
    spec = spec || {};
    var dict = new Map();
    var cls = new O.PyClass(name, [], dict, {});
    if (spec.methods) {
      Object.keys(spec.methods).forEach(function (m) {
        var f = spec.methods[m];
        var bi = new O.PyBuiltin(m, function (args, kwargs, it) {
          return f(args[0], args.slice(1), kwargs || null, it);
        });
        dict.set(m, bi);
      });
    }
    if (spec.props) {
      Object.keys(spec.props).forEach(function (pname) {
        var getter = spec.props[pname];
        dict.set(pname, new O.PyProperty(new O.PyBuiltin(pname, function (args, kwargs, it) {
          return getter(args[0], it);
        }), null, null, null));
      });
    }
    cls.nativeNew = function (args, kwargs, it) {
      var inst = new O.PyInstance(cls);
      if (spec.init) spec.init(inst, args, kwargs || null, it);
      return inst;
    };
    return cls;
  }

  function kwget(kwargs, name, dflt) {
    if (!kwargs) return dflt;
    return kwargs.has(name) ? kwargs.get(name) : dflt;
  }
  function arg(args, i, dflt) { return args.length > i && args[i] !== undefined ? args[i] : dflt; }
  function argk(args, kwargs, i, name, dflt) {
    if (args.length > i && args[i] !== undefined) return args[i];
    return kwget(kwargs, name, dflt);
  }
  function inum(v) { return Number(O.toBigInt(v)); }

  root.PyStdlib = {
    define: define,
    installAll: installAll,
    makeModule: makeModule,
    makeClass: makeClass,
    kwget: kwget,
    arg: arg,
    argk: argk,
    inum: inum
  };
})(typeof window !== 'undefined' ? window : globalThis);
