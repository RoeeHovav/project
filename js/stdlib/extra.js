/* ============================================================================
 * extra.js — html, contextlib, threading, asyncio, base helpers.
 *
 * threading and asyncio are cooperative shims: there is one JS thread, so
 * "concurrency" here runs each unit to completion in turn. That is enough to
 * teach the APIs and the concepts (locks, gather, coroutines) faithfully.
 * ========================================================================== */
(function (root) {
  'use strict';

  var O = root.PyObjects;
  var B = root.PyBuiltins;
  var S = root.PyStdlib;
  var PyList = O.PyList, PyTuple = O.PyTuple, PyDict = O.PyDict,
      PyBuiltin = O.PyBuiltin, PyClass = O.PyClass, PyInstance = O.PyInstance,
      PyCoroutine = O.PyCoroutine, PyError = O.PyError, AwaitMarker = O.AwaitMarker,
      truthy = O.truthy, str = O.str, repr = O.repr;
  var kwget = S.kwget, inum = S.inum;

  // ===========================================================================
  // html
  // ===========================================================================
  S.define('html', function (interp) {
    var m = S.makeModule('html');
    m.fn('escape', function (args, kwargs) {
      var quote = args.length > 1 ? truthy(args[1]) : truthy(kwget(kwargs, 'quote', true));
      var s = str(args[0]).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (quote) s = s.replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
      return s;
    });
    m.fn('unescape', function (args) {
      return str(args[0])
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
    });
    return m.mod;
  });

  // ===========================================================================
  // contextlib
  // ===========================================================================
  S.define('contextlib', function (interp) {
    var m = S.makeModule('contextlib');

    m.fn('contextmanager', function (args, kwargs, it) {
      var genFunc = args[0];
      // Returns a factory; calling it produces a context-manager object.
      var factory = new PyBuiltin('cm_factory', function (fargs, fkwargs, it2) {
        var gen = it2.callSync(genFunc, fargs, fkwargs);   // a PyGenerator
        var cmCls = new PyClass('_GeneratorCM', [], new Map());
        var inst = new PyInstance(cmCls);
        cmCls.dict.set('__enter__', new PyBuiltin('__enter__', function () {
          var r = it2.genResume(gen, null, null);
          if (r.done) it2.throwPy('RuntimeError', 'generator did not yield');
          return r.value;
        }));
        cmCls.dict.set('__exit__', new PyBuiltin('__exit__', function (ea) {
          var excType = ea[1], excVal = ea[2];
          try {
            if (excType && excType !== null) {
              var exc = excVal instanceof PyInstance ? excVal : it2.makeExc('Exception', excVal);
              it2.genResume(gen, null, new PyError(exc));
            } else {
              it2.genResume(gen, null, null);
            }
          } catch (e) {
            if (e instanceof PyError && excType &&
                e.exc.__class__ === (excVal && excVal.__class__)) return false;
            if (e instanceof PyError && !excType) throw e;
          }
          return false;
        }));
        return inst;
      });
      return factory;
    });

    m.fn('suppress', function (args, kwargs, it) {
      var types = args.slice();
      var cmCls = new PyClass('_Suppress', [], new Map());
      var inst = new PyInstance(cmCls);
      cmCls.dict.set('__enter__', new PyBuiltin('__enter__', function () { return inst; }));
      cmCls.dict.set('__exit__', new PyBuiltin('__exit__', function (ea) {
        var excType = ea[0];
        if (!excType) return false;
        return types.some(function (t) { return excType instanceof PyClass && excType.isSubclassOf(t); });
      }));
      return inst;
    });

    var nullCls = new PyClass('nullcontext', [], new Map());
    nullCls.nativeNew = function (args) {
      var inst = new PyInstance(nullCls);
      inst.__dict__.set('__enterval__', args.length ? args[0] : null);
      return inst;
    };
    nullCls.dict.set('__enter__', new PyBuiltin('__enter__', function (a) { return a[0].__dict__.get('__enterval__'); }));
    nullCls.dict.set('__exit__', new PyBuiltin('__exit__', function () { return false; }));
    m.val('nullcontext', nullCls);
    return m.mod;
  });

  // ===========================================================================
  // threading (cooperative — one JS thread)
  // ===========================================================================
  S.define('threading', function (interp) {
    var m = S.makeModule('threading');

    var lockCls = new PyClass('Lock', [], new Map());
    lockCls.nativeNew = function () {
      var inst = new PyInstance(lockCls);
      inst.__locked__ = false;
      return inst;
    };
    lockCls.dict.set('acquire', new PyBuiltin('acquire', function (a) { a[0].__locked__ = true; return true; }));
    lockCls.dict.set('release', new PyBuiltin('release', function (a) { a[0].__locked__ = false; return null; }));
    lockCls.dict.set('locked', new PyBuiltin('locked', function (a) { return a[0].__locked__; }));
    lockCls.dict.set('__enter__', new PyBuiltin('__enter__', function (a) { a[0].__locked__ = true; return a[0]; }));
    lockCls.dict.set('__exit__', new PyBuiltin('__exit__', function (a) { a[0].__locked__ = false; return false; }));
    m.val('Lock', lockCls);
    m.val('RLock', lockCls);

    var threadCls = new PyClass('Thread', [], new Map());
    threadCls.nativeNew = function (args, kwargs, it) {
      var inst = new PyInstance(threadCls);
      inst.__target__ = kwget(kwargs, 'target', null);
      inst.__args__ = kwget(kwargs, 'args', new PyTuple([]));
      inst.__kwargs__ = kwget(kwargs, 'kwargs', null);
      inst.__started__ = false;
      return inst;
    };
    threadCls.dict.set('start', new PyBuiltin('start', function (a, k, it) {
      var self = a[0];
      self.__started__ = true;
      // Run synchronously to completion — cooperative model.
      if (self.__target__) {
        it.callSync(self.__target__, it.toArray(self.__args__),
          self.__kwargs__ instanceof PyDict ? self.__kwargs__ : null);
      }
      return null;
    }));
    threadCls.dict.set('join', new PyBuiltin('join', function () { return null; }));
    threadCls.dict.set('is_alive', new PyBuiltin('is_alive', function () { return false; }));
    m.val('Thread', threadCls);

    m.fn('current_thread', function (it) {
      var inst = new PyInstance(threadCls);
      inst.__dict__.set('name', 'MainThread');
      return inst;
    });
    m.fn('active_count', function () { return 1n; });

    var eventCls = new PyClass('Event', [], new Map());
    eventCls.nativeNew = function () { var i = new PyInstance(eventCls); i.__set__ = false; return i; };
    eventCls.dict.set('set', new PyBuiltin('set', function (a) { a[0].__set__ = true; return null; }));
    eventCls.dict.set('clear', new PyBuiltin('clear', function (a) { a[0].__set__ = false; return null; }));
    eventCls.dict.set('is_set', new PyBuiltin('is_set', function (a) { return a[0].__set__; }));
    eventCls.dict.set('wait', new PyBuiltin('wait', function (a) { return a[0].__set__; }));
    m.val('Event', eventCls);
    return m.mod;
  });

  // ===========================================================================
  // asyncio (cooperative event loop)
  // ===========================================================================
  S.define('asyncio', function (interp) {
    var m = S.makeModule('asyncio');

    // Drive a coroutine to completion. await X where X is a coroutine runs it;
    // await sleep() is a no-op advance. Everything is synchronous underneath.
    function drive(it, coro) {
      if (!(coro instanceof PyCoroutine)) return coro;
      var sendValue = null;
      for (;;) {
        it.tick();
        var r;
        try {
          r = coro.iter.next(sendValue);
        } catch (e) {
          if (e && e.__signal__ === 'return') return e.value;
          throw e;
        }
        if (r.done) { coro.done = true; return r.value === undefined ? null : r.value; }
        var awaited = r.value;
        if (awaited instanceof AwaitMarker) {
          var target = awaited.__await__;
          if (target instanceof PyCoroutine) sendValue = drive(it, target);
          else if (target && target.__sleep__) sendValue = null;
          else if (target && target.__gather__) {
            sendValue = new PyList(target.coros.map(function (c) { return drive(it, c); }));
          } else sendValue = target;
        } else {
          sendValue = null;
        }
      }
    }

    m.fn('run', function (args, kwargs, it) { return drive(it, args[0]); });
    m.fn('sleep', function (args, kwargs, it) {
      // Returns an awaitable sentinel; the driver treats it as an instant yield.
      var result = args.length > 1 ? args[1] : null;
      var coroCls = { __sleep__: true, pytype: 'coroutine', __reprNative__: function () { return '<coroutine sleep>'; } };
      return coroCls;
    });
    m.fn('gather', function (args, kwargs, it) {
      return { __gather__: true, coros: args.slice(), pytype: 'coroutine',
               __reprNative__: function () { return '<_GatheringFuture>'; } };
    });
    m.fn('create_task', function (args) { return args[0]; });
    m.fn('get_event_loop', function (it) {
      var loop = { pytype: 'EventLoop', __reprNative__: function () { return '<EventLoop>'; },
        __nativeAttrs__: {
          run_until_complete: new PyBuiltin('run_until_complete', function (a, k, it2) { return drive(it2, a[0]); }),
          close: new PyBuiltin('close', function () { return null; })
        } };
      return loop;
    });
    m.__drive__ = drive;
    return m.mod;
  });
})(typeof window !== 'undefined' ? window : globalThis);
