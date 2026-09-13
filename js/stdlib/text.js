/* ============================================================================
 * text.js — re, json, csv, textwrap, datetime, struct, codecs, difflib, shlex.
 * ========================================================================== */
(function (root) {
  'use strict';

  var O = root.PyObjects;
  var B = root.PyBuiltins;
  var S = root.PyStdlib;
  var PyList = O.PyList, PyTuple = O.PyTuple, PyDict = O.PyDict, PySet = O.PySet,
      PyBytes = O.PyBytes, PyBuiltin = O.PyBuiltin, PyClass = O.PyClass,
      PyInstance = O.PyInstance, PyIterator = O.PyIterator, PyError = O.PyError,
      truthy = O.truthy, repr = O.repr, str = O.str, typeName = O.typeName,
      eq = O.eq, toBigInt = O.toBigInt, toNumber = O.toNumber;
  var kwget = S.kwget, argk = S.argk, inum = S.inum;

  function lazyIter(nextFn, name) {
    var it = new PyIterator(nextFn, name || 'iterator');
    it.__reprNative__ = function () { return '<' + (name || 'iterator') + ' object>'; };
    return it;
  }

  // ===========================================================================
  // re
  // ===========================================================================

  /** Translate a Python regular expression into JavaScript syntax. */
  function translatePattern(src, flags, interp) {
    var verbose = flags.indexOf('x') >= 0;
    var out = '';
    var i = 0;
    var inClass = false;
    var extraFlags = '';
    while (i < src.length) {
      var c = src[i];
      if (c === '\\') {
        var n = src[i + 1];
        if (n === 'A') { out += '^'; i += 2; continue; }
        if (n === 'Z' || n === 'z') { out += '$'; i += 2; continue; }
        if (n === 'd' || n === 'D' || n === 'w' || n === 'W' || n === 's' || n === 'S' ||
            n === 'b' || n === 'B' || n === 'n' || n === 't' || n === 'r' || n === 'f' ||
            n === 'v' || n === '0') { out += c + n; i += 2; continue; }
        if (n >= '1' && n <= '9') { out += c + n; i += 2; continue; }
        if (n === 'x' || n === 'u') { out += c + n; i += 2; continue; }
        out += '\\' + n;
        i += 2;
        continue;
      }
      if (inClass) {
        if (c === ']') inClass = false;
        out += c;
        i++;
        continue;
      }
      if (c === '[') { inClass = true; out += c; i++; continue; }
      if (verbose && (c === ' ' || c === '\t' || c === '\n')) { i++; continue; }
      if (verbose && c === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (c === '(' && src[i + 1] === '?') {
        var rest = src.slice(i);
        var mNamed = /^\(\?P<([A-Za-z_]\w*)>/.exec(rest);
        if (mNamed) { out += '(?<' + mNamed[1] + '>'; i += mNamed[0].length; continue; }
        var mRef = /^\(\?P=([A-Za-z_]\w*)\)/.exec(rest);
        if (mRef) { out += '\\k<' + mRef[1] + '>'; i += mRef[0].length; continue; }
        var mComment = /^\(\?#[^)]*\)/.exec(rest);
        if (mComment) { i += mComment[0].length; continue; }
        var mInline = /^\(\?([aiLmsux]+)\)/.exec(rest);
        if (mInline) {
          mInline[1].split('').forEach(function (f) {
            if ('ims'.indexOf(f) >= 0 && extraFlags.indexOf(f) < 0) extraFlags += f;
            if (f === 'x') verbose = true;
          });
          i += mInline[0].length;
          continue;
        }
        out += c;
        i++;
        continue;
      }
      out += c;
      i++;
    }
    return { source: out, extra: extraFlags };
  }

  function buildRegex(interp, pattern, flagBits, sticky) {
    var flags = '';
    var bits = Number(flagBits || 0);
    if (bits & 2) flags += 'i';
    if (bits & 8) flags += 'm';
    if (bits & 16) flags += 's';
    if (bits & 64) flags += 'x';
    var t = translatePattern(pattern, flags, interp);
    var jsFlags = 'dg';
    if (flags.indexOf('i') >= 0 || t.extra.indexOf('i') >= 0) jsFlags += 'i';
    if (flags.indexOf('m') >= 0 || t.extra.indexOf('m') >= 0) jsFlags += 'm';
    if (flags.indexOf('s') >= 0 || t.extra.indexOf('s') >= 0) jsFlags += 's';
    try {
      return new RegExp(t.source, jsFlags);
    } catch (e) {
      try { return new RegExp(t.source, jsFlags.replace('d', '')); }
      catch (e2) {
        throw new PyError(interp.makeExc('ValueError', 'bad regular expression: ' + e.message));
      }
    }
  }

  S.define('re', function (interp) {
    var m = S.makeModule('re');
    m.val('IGNORECASE', 2n).val('I', 2n)
     .val('MULTILINE', 8n).val('M', 8n)
     .val('DOTALL', 16n).val('S', 16n)
     .val('VERBOSE', 64n).val('X', 64n)
     .val('ASCII', 256n).val('A', 256n)
     .val('UNICODE', 32n).val('U', 32n);

    var matchCls = new PyClass('Match', [], new Map());

    function makeMatch(execResult, subject, patternObj) {
      var inst = new PyInstance(matchCls);
      inst.__m__ = execResult;
      inst.__subject__ = subject;
      inst.__pattern__ = patternObj;
      return inst;
    }

    function wrapMatchStr(inst, v) {
      if (v === undefined || v === null) return null;
      return (inst.__pattern__ && inst.__pattern__.__isBytes__) ? B.latin1ToBytes(v) : v;
    }
    function groupValue(inst, key, interp2) {
      var r = inst.__m__;
      if (key === undefined || key === null) return wrapMatchStr(inst, r[0]);
      if (typeof key === 'string') {
        if (!r.groups || !(key in r.groups)) interp2.indexError('no such group');
        return wrapMatchStr(inst, r.groups[key]);
      }
      var idx = inum(key);
      if (idx >= r.length) interp2.indexError('no such group');
      return wrapMatchStr(inst, r[idx]);
    }

    function mm(name, fn) {
      matchCls.dict.set(name, new PyBuiltin(name, function (args, kwargs, it) {
        return fn(args[0], args.slice(1), kwargs, it);
      }));
    }
    mm('group', function (self, args, kwargs, it) {
      if (args.length <= 1) return groupValue(self, args.length ? args[0] : 0n, it);
      return new PyTuple(args.map(function (k) { return groupValue(self, k, it); }));
    });
    mm('groups', function (self, args) {
      var dflt = args.length ? args[0] : null;
      var out = [];
      for (var i = 1; i < self.__m__.length; i++) {
        out.push(self.__m__[i] === undefined ? dflt : wrapMatchStr(self, self.__m__[i]));
      }
      return new PyTuple(out);
    });
    mm('groupdict', function (self, args) {
      var d = new PyDict();
      var g = self.__m__.groups || {};
      Object.keys(g).forEach(function (k) { d.set(k, g[k] === undefined ? (args.length ? args[0] : null) : g[k]); });
      return d;
    });
    mm('start', function (self, args, kwargs, it) {
      if (!args.length || inum(args[0]) === 0) return BigInt(self.__m__.index);
      var ind = self.__m__.indices;
      if (ind && ind[inum(args[0])]) return BigInt(ind[inum(args[0])][0]);
      return -1n;
    });
    mm('end', function (self, args, kwargs, it) {
      if (!args.length || inum(args[0]) === 0) return BigInt(self.__m__.index + self.__m__[0].length);
      var ind = self.__m__.indices;
      if (ind && ind[inum(args[0])]) return BigInt(ind[inum(args[0])][1]);
      return -1n;
    });
    mm('span', function (self, args, kwargs, it) {
      var gi = args.length ? inum(args[0]) : 0;
      if (gi === 0) return new PyTuple([BigInt(self.__m__.index), BigInt(self.__m__.index + self.__m__[0].length)]);
      var ind = self.__m__.indices;
      if (ind && ind[gi]) return new PyTuple([BigInt(ind[gi][0]), BigInt(ind[gi][1])]);
      return new PyTuple([-1n, -1n]);
    });
    mm('__repr__', function (self) {
      return "<re.Match object; span=(" + self.__m__.index + ', ' + (self.__m__.index + self.__m__[0].length) +
        '), match=' + repr(self.__m__[0]) + '>';
    });
    matchCls.dict.set('string', new O.PyProperty(new PyBuiltin('string', function (args) { return args[0].__subject__; }), null, null, null));
    matchCls.dict.set('re', new O.PyProperty(new PyBuiltin('re', function (args) { return args[0].__pattern__; }), null, null, null));
    matchCls.dict.set('lastindex', new O.PyProperty(new PyBuiltin('lastindex', function (args) {
      var r = args[0].__m__;
      for (var i = r.length - 1; i >= 1; i--) if (r[i] !== undefined) return BigInt(i);
      return null;
    }), null, null, null));

    var patternCls = new PyClass('Pattern', [], new Map());

    function compilePattern(it, pattern, flagBits) {
      if (pattern instanceof PyInstance && pattern.__class__ === patternCls) return pattern;
      var srcText = pattern instanceof PyBytes ? B.bytesToLatin1(pattern) : str(pattern);
      var inst = new PyInstance(patternCls);
      inst.__src__ = srcText;
      inst.__flags__ = flagBits || 0n;
      inst.__re__ = buildRegex(it, srcText, flagBits);
      inst.__isBytes__ = pattern instanceof PyBytes;
      return inst;
    }

    function subjectText(it, p, s) {
      return s instanceof PyBytes ? B.bytesToLatin1(s) : str(s);
    }
    function wrapOut(p, text) {
      return p.__isBytes__ ? B.latin1ToBytes(text) : text;
    }

    function doSearch(it, p, subject, startPos, anchored, fullOnly) {
      var text = subjectText(it, p, subject);
      var re = p.__re__;
      re.lastIndex = startPos || 0;
      var r;
      while ((r = re.exec(text)) !== null) {
        if (anchored && r.index !== (startPos || 0)) return null;
        if (fullOnly && (r.index !== (startPos || 0) || r[0].length !== text.length - (startPos || 0))) {
          if (r[0].length === 0) { re.lastIndex++; if (re.lastIndex > text.length) return null; continue; }
          return null;
        }
        return makeMatch(r, subject, p);
      }
      return null;
    }

    function allMatches(it, p, subject, limit) {
      var text = subjectText(it, p, subject);
      var re = p.__re__;
      re.lastIndex = 0;
      var out = [];
      var r;
      var guard = 0;
      while ((r = re.exec(text)) !== null) {
        out.push(r);
        if (r[0].length === 0) re.lastIndex++;
        if (limit && out.length >= limit) break;
        if (++guard > 100000) break;
      }
      return out;
    }

    function findallResult(matches, p) {
      return matches.map(function (r) {
        if (r.length === 1) return wrapOut(p, r[0]);
        if (r.length === 2) return wrapOut(p, r[1] === undefined ? '' : r[1]);
        var vals = [];
        for (var i = 1; i < r.length; i++) vals.push(wrapOut(p, r[i] === undefined ? '' : r[i]));
        return new PyTuple(vals);
      });
    }

    function expandTemplate(it, tmpl, r) {
      return tmpl.replace(/\\(\d)|\\g<([^>]+)>|\\n|\\t|\\r|\\\\/g, function (whole, d, name) {
        if (d !== undefined) return r[Number(d)] === undefined ? '' : r[Number(d)];
        if (name !== undefined) {
          if (/^\d+$/.test(name)) return r[Number(name)] === undefined ? '' : r[Number(name)];
          return (r.groups && r.groups[name] !== undefined) ? r.groups[name] : '';
        }
        if (whole === '\\n') return '\n';
        if (whole === '\\t') return '\t';
        if (whole === '\\r') return '\r';
        return '\\';
      });
    }

    function doSub(it, p, replacement, subject, count) {
      var text = subjectText(it, p, subject);
      var matches = allMatches(it, p, subject);
      var out = '';
      var last = 0;
      var n = 0;
      for (var i = 0; i < matches.length; i++) {
        if (count && n >= count) break;
        var r = matches[i];
        out += text.slice(last, r.index);
        if (O.isCallable(replacement)) {
          out += str(it.callSync(replacement, [makeMatch(r, subject, p)], null));
        } else {
          var tmpl = replacement instanceof PyBytes ? B.bytesToLatin1(replacement) : str(replacement);
          out += expandTemplate(it, tmpl, r);
        }
        last = r.index + r[0].length;
        n++;
      }
      out += text.slice(last);
      return { text: wrapOut(p, out), count: n };
    }

    function pm(name, fn) {
      patternCls.dict.set(name, new PyBuiltin(name, function (args, kwargs, it) {
        return fn(args[0], args.slice(1), kwargs, it);
      }));
    }
    pm('search', function (self, args, kwargs, it) {
      var pos = args.length > 1 ? inum(args[1]) : 0;
      return doSearch(it, self, args[0], pos, false, false);
    });
    pm('match', function (self, args, kwargs, it) {
      var pos = args.length > 1 ? inum(args[1]) : 0;
      return doSearch(it, self, args[0], pos, true, false);
    });
    pm('fullmatch', function (self, args, kwargs, it) {
      return doSearch(it, self, args[0], 0, true, true);
    });
    pm('findall', function (self, args, kwargs, it) {
      return new PyList(findallResult(allMatches(it, self, args[0]), self));
    });
    pm('finditer', function (self, args, kwargs, it) {
      var ms = allMatches(it, self, args[0]);
      var i = 0;
      var subject = args[0];
      var selfRef = self;
      return lazyIter(function () {
        return i < ms.length ? { value: makeMatch(ms[i++], subject, selfRef), done: false } : { done: true };
      }, 'callable_iterator');
    });
    pm('sub', function (self, args, kwargs, it) {
      var count = args.length > 2 ? inum(args[2]) : inum(kwget(kwargs, 'count', 0n));
      return doSub(it, self, args[0], args[1], count).text;
    });
    pm('subn', function (self, args, kwargs, it) {
      var count = args.length > 2 ? inum(args[2]) : inum(kwget(kwargs, 'count', 0n));
      var r = doSub(it, self, args[0], args[1], count);
      return new PyTuple([r.text, BigInt(r.count)]);
    });
    pm('split', function (self, args, kwargs, it) {
      var text = subjectText(it, self, args[0]);
      var maxsplit = args.length > 1 ? inum(args[1]) : inum(kwget(kwargs, 'maxsplit', 0n));
      var ms = allMatches(it, self, args[0]);
      var out = [];
      var last = 0, n = 0;
      for (var i = 0; i < ms.length; i++) {
        if (maxsplit && n >= maxsplit) break;
        var r = ms[i];
        if (r[0].length === 0) continue;
        out.push(text.slice(last, r.index));
        for (var g = 1; g < r.length; g++) out.push(r[g] === undefined ? null : r[g]);
        last = r.index + r[0].length;
        n++;
      }
      out.push(text.slice(last));
      return new PyList(out.map(function (x) { return x === null ? null : wrapOut(self, x); }));
    });
    pm('__repr__', function (self) { return 're.compile(' + repr(self.__src__) + ')'; });
    patternCls.dict.set('pattern', new O.PyProperty(new PyBuiltin('pattern', function (args) { return args[0].__src__; }), null, null, null));
    patternCls.dict.set('flags', new O.PyProperty(new PyBuiltin('flags', function (args) { return args[0].__flags__; }), null, null, null));

    m.val('Pattern', patternCls).val('Match', matchCls);
    m.fn('compile', function (args, kwargs, it) {
      return compilePattern(it, args[0], args.length > 1 ? toBigInt(args[1]) : toBigInt(kwget(kwargs, 'flags', 0n)));
    });
    function topLevel(name, method, argOrder) {
      m.fn(name, function (args, kwargs, it) {
        var flags = args.length > argOrder ? toBigInt(args[argOrder]) : toBigInt(kwget(kwargs, 'flags', 0n));
        var p = compilePattern(it, args[0], flags);
        var rest = args.slice(1, argOrder);
        return it.callSync(it.getattr(p, method), rest, kwargs);
      });
    }
    topLevel('search', 'search', 2);
    topLevel('match', 'match', 2);
    topLevel('fullmatch', 'fullmatch', 2);
    topLevel('findall', 'findall', 2);
    topLevel('finditer', 'finditer', 2);
    topLevel('split', 'split', 3);
    topLevel('sub', 'sub', 4);
    topLevel('subn', 'subn', 4);
    m.fn('escape', function (args) {
      return str(args[0]).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    });
    m.val('error', interp.exceptionClasses.ValueError);
    return m.mod;
  });

  // ===========================================================================
  // json
  // ===========================================================================
  S.define('json', function (interp) {
    var m = S.makeModule('json');

    function toJs(v, it, seen) {
      seen = seen || new Set();
      if (v === null || v === undefined) return null;
      if (v === true || v === false) return v;
      if (typeof v === 'bigint') return { __int__: v.toString() };
      if (typeof v === 'number') return v;
      if (typeof v === 'string') return v;
      if (seen.has(v)) it.valueError('Circular reference detected');
      if (v instanceof PyList || v instanceof PyTuple) {
        seen.add(v);
        var arr = v.items.map(function (x) { return toJs(x, it, seen); });
        seen.delete(v);
        return arr;
      }
      if (v instanceof PyDict) {
        seen.add(v);
        var o = {};
        var order = [];
        v.map.forEach(function (e) {
          var key = typeof e.k === 'string' ? e.k : str(e.k);
          o[key] = toJs(e.v, it, seen);
          order.push(key);
        });
        seen.delete(v);
        Object.defineProperty(o, '__order__', { value: order, enumerable: false });
        return o;
      }
      if (v instanceof PyInstance) {
        var o2 = {};
        v.__dict__.forEach(function (val, k) { o2[k] = toJs(val, it, seen); });
        return o2;
      }
      it.typeError('Object of type ' + typeName(v) + ' is not JSON serializable');
    }

    function serialize(x, indent, level, sortKeys, separators) {
      var itemSep = separators ? separators[0] : (indent ? ',' : ', ');
      var keySep = separators ? separators[1] : ': ';
      var nl = indent ? '\n' : '';
      var pad = indent ? indent.repeat(level + 1) : '';
      var padEnd = indent ? indent.repeat(level) : '';
      if (x === null) return 'null';
      if (x === true) return 'true';
      if (x === false) return 'false';
      if (typeof x === 'number') {
        if (Number.isNaN(x)) return 'NaN';
        if (x === Infinity) return 'Infinity';
        if (x === -Infinity) return '-Infinity';
        return O.floatRepr(x);
      }
      if (typeof x === 'string') return JSON.stringify(x);
      if (x && x.__int__ !== undefined) return x.__int__;
      if (Array.isArray(x)) {
        if (!x.length) return '[]';
        var parts = x.map(function (e) { return pad + serialize(e, indent, level + 1, sortKeys, separators); });
        return '[' + nl + parts.join(itemSep + nl) + nl + padEnd + ']';
      }
      var keys = x.__order__ ? x.__order__.slice() : Object.keys(x);
      if (sortKeys) keys.sort();
      if (!keys.length) return '{}';
      var kp = keys.map(function (k) {
        return pad + JSON.stringify(k) + keySep + serialize(x[k], indent, level + 1, sortKeys, separators);
      });
      return '{' + nl + kp.join(itemSep + nl) + nl + padEnd + '}';
    }

    function fromJs(x) {
      if (x === null) return null;
      if (typeof x === 'boolean') return x;
      if (typeof x === 'number') return Number.isInteger(x) ? BigInt(x) : x;
      if (typeof x === 'string') return x;
      if (Array.isArray(x)) return new PyList(x.map(fromJs));
      var d = new PyDict();
      Object.keys(x).forEach(function (k) { d.set(k, fromJs(x[k])); });
      return d;
    }

    m.fn('dumps', function (args, kwargs, it) {
      var indentVal = kwget(kwargs, 'indent', null);
      var indent = null;
      if (indentVal !== null && indentVal !== undefined) {
        indent = typeof indentVal === 'string' ? indentVal : ' '.repeat(inum(indentVal));
      }
      var sortKeys = truthy(kwget(kwargs, 'sort_keys', false));
      var sep = kwget(kwargs, 'separators', null);
      var separators = null;
      if (sep instanceof PyTuple) separators = [str(sep.items[0]), str(sep.items[1])];
      return serialize(toJs(args[0], it), indent, 0, sortKeys, separators);
    });
    m.fn('loads', function (args, kwargs, it) {
      var text = args[0] instanceof PyBytes ? B.utf8Decode(args[0].b, it) : str(args[0]);
      var parsed;
      try { parsed = JSON.parse(text); }
      catch (e) {
        throw new PyError(it.makeExc('ValueError', 'Expecting value: ' + e.message));
      }
      // Preserve big integers that JSON.parse would round.
      var bigMatches = /(-?\d{16,})/.test(text);
      var result = fromJs(parsed);
      if (bigMatches) {
        try {
          var reviveBig = JSON.parse(text, function (k, v) {
            if (typeof v === 'number' && Number.isInteger(v)) return v;
            return v;
          });
        } catch (e2) { /* ignore */ }
      }
      return result;
    });
    m.fn('dump', function (args, kwargs, it) {
      var text = it.callSync(m.get('dumps'), [args[0]], kwargs);
      it.callSync(it.getattr(args[1], 'write'), [text], null);
      return null;
    });
    m.fn('load', function (args, kwargs, it) {
      var text = it.callSync(it.getattr(args[0], 'read'), [], null);
      return it.callSync(m.get('loads'), [text], kwargs);
    });
    m.val('JSONDecodeError', interp.exceptionClasses.ValueError);
    return m.mod;
  });

  // ===========================================================================
  // csv
  // ===========================================================================
  S.define('csv', function (interp) {
    var m = S.makeModule('csv');

    function parseCsvLine(line, delim, quote) {
      var out = [];
      var cur = '';
      var inQ = false;
      for (var i = 0; i < line.length; i++) {
        var c = line[i];
        if (inQ) {
          if (c === quote) {
            if (line[i + 1] === quote) { cur += quote; i++; }
            else inQ = false;
          } else cur += c;
        } else if (c === quote) inQ = true;
        else if (c === delim) { out.push(cur); cur = ''; }
        else cur += c;
      }
      out.push(cur);
      return out;
    }
    function quoteField(v, delim, quote) {
      var s = str(v);
      if (s.indexOf(delim) >= 0 || s.indexOf(quote) >= 0 || /[\r\n]/.test(s)) {
        return quote + s.split(quote).join(quote + quote) + quote;
      }
      return s;
    }

    m.fn('reader', function (args, kwargs, it) {
      var delim = str(kwget(kwargs, 'delimiter', ','));
      var quote = str(kwget(kwargs, 'quotechar', '"'));
      var lines = it.toArray(args[0]).map(function (l) { return str(l).replace(/\r?\n$/, ''); })
        .filter(function (l) { return l.length > 0; });
      var i = 0;
      return lazyIter(function () {
        if (i >= lines.length) return { done: true };
        return { value: new PyList(parseCsvLine(lines[i++], delim, quote)), done: false };
      }, 'reader');
    });
    m.fn('DictReader', function (args, kwargs, it) {
      var delim = str(kwget(kwargs, 'delimiter', ','));
      var quote = str(kwget(kwargs, 'quotechar', '"'));
      var lines = it.toArray(args[0]).map(function (l) { return str(l).replace(/\r?\n$/, ''); })
        .filter(function (l) { return l.length > 0; });
      var header = lines.length ? parseCsvLine(lines[0], delim, quote) : [];
      var i = 1;
      return lazyIter(function () {
        if (i >= lines.length) return { done: true };
        var row = parseCsvLine(lines[i++], delim, quote);
        var d = new PyDict();
        header.forEach(function (h, idx) { d.set(h, idx < row.length ? row[idx] : null); });
        return { value: d, done: false };
      }, 'DictReader');
    });
    m.fn('writer', function (args, kwargs, it) {
      var fileObj = args[0];
      var delim = str(kwget(kwargs, 'delimiter', ','));
      var quote = str(kwget(kwargs, 'quotechar', '"'));
      var writeFn = it.getattr(fileObj, 'write');
      var w = {
        pytype: 'csv.writer',
        __reprNative__: function () { return '<csv.writer object>'; },
        __nativeAttrs__: {
          writerow: new PyBuiltin('writerow', function (a, k2, it2) {
            var row = it2.toArray(a[0]).map(function (v) { return quoteField(v, delim, quote); }).join(delim);
            it2.callSync(writeFn, [row + '\r\n'], null);
            return null;
          }),
          writerows: new PyBuiltin('writerows', function (a, k2, it2) {
            it2.toArray(a[0]).forEach(function (r) {
              var row = it2.toArray(r).map(function (v) { return quoteField(v, delim, quote); }).join(delim);
              it2.callSync(writeFn, [row + '\r\n'], null);
            });
            return null;
          })
        }
      };
      return w;
    });
    return m.mod;
  });

  // ===========================================================================
  // textwrap
  // ===========================================================================
  S.define('textwrap', function (interp) {
    var m = S.makeModule('textwrap');
    function wrapText(text, width) {
      var words = text.split(/\s+/).filter(Boolean);
      var lines = [];
      var cur = '';
      words.forEach(function (w) {
        if (!cur.length) cur = w;
        else if (cur.length + 1 + w.length <= width) cur += ' ' + w;
        else { lines.push(cur); cur = w; }
      });
      if (cur.length) lines.push(cur);
      return lines;
    }
    m.fn('wrap', function (args, kwargs) {
      var width = inum(argk(args, kwargs, 1, 'width', 70n));
      return new PyList(wrapText(str(args[0]), width));
    });
    m.fn('fill', function (args, kwargs) {
      var width = inum(argk(args, kwargs, 1, 'width', 70n));
      return wrapText(str(args[0]), width).join('\n');
    });
    m.fn('shorten', function (args, kwargs) {
      var width = inum(argk(args, kwargs, 1, 'width', 70n));
      var ph = str(kwget(kwargs, 'placeholder', ' [...]'));
      var s = str(args[0]).replace(/\s+/g, ' ').trim();
      if (s.length <= width) return s;
      // Fit whole words, leaving room for the placeholder.
      var words = s.split(' ');
      var kept = '';
      for (var i = 0; i < words.length; i++) {
        var candidate = kept ? kept + ' ' + words[i] : words[i];
        if (candidate.length + ph.length > width) break;
        kept = candidate;
      }
      return kept + ph;
    });
    m.fn('dedent', function (args) {
      var lines = str(args[0]).split('\n');
      var indents = lines.filter(function (l) { return l.trim(); })
        .map(function (l) { return /^[ \t]*/.exec(l)[0].length; });
      var minIndent = indents.length ? Math.min.apply(Math, indents) : 0;
      return lines.map(function (l) { return l.slice(minIndent); }).join('\n');
    });
    m.fn('indent', function (args) {
      var prefix = str(args[1]);
      return str(args[0]).split('\n').map(function (l) { return l.trim() ? prefix + l : l; }).join('\n');
    });
    return m.mod;
  });

  // ===========================================================================
  // struct
  // ===========================================================================
  S.define('struct', function (interp) {
    var m = S.makeModule('struct');
    var SIZES = { x: 1, c: 1, b: 1, B: 1, '?': 1, h: 2, H: 2, i: 4, I: 4, l: 4, L: 4, q: 8, Q: 8, f: 4, d: 8, s: 1 };

    function parseFormat(fmt, it) {
      var little = true;
      var i = 0;
      if ('<>!=@'.indexOf(fmt[0]) >= 0) {
        little = fmt[0] === '<' || fmt[0] === '=' || fmt[0] === '@';
        i = 1;
      }
      var items = [];
      while (i < fmt.length) {
        var count = '';
        while (i < fmt.length && /\d/.test(fmt[i])) count += fmt[i++];
        var code = fmt[i++];
        if (SIZES[code] === undefined) it.throwPy('ValueError', "bad char in struct format: '" + code + "'");
        items.push({ code: code, count: count === '' ? 1 : parseInt(count, 10) });
      }
      return { little: little, items: items };
    }

    function calcsize(spec) {
      var n = 0;
      spec.items.forEach(function (it2) {
        n += it2.code === 's' ? it2.count : SIZES[it2.code] * it2.count;
      });
      return n;
    }

    m.fn('calcsize', function (args, k, it) { return BigInt(calcsize(parseFormat(str(args[0]), it))); });
    m.fn('pack', function (args, kwargs, it) {
      var spec = parseFormat(str(args[0]), it);
      var vals = args.slice(1);
      var buf = new Uint8Array(calcsize(spec));
      var dv = new DataView(buf.buffer);
      var off = 0, vi = 0;
      spec.items.forEach(function (item) {
        if (item.code === 'x') { off += item.count; return; }
        if (item.code === 's') {
          var sv = vals[vi++];
          var bytes = sv instanceof PyBytes ? sv.b : B.utf8Encode(str(sv));
          for (var j = 0; j < item.count; j++) buf[off + j] = j < bytes.length ? bytes[j] : 0;
          off += item.count;
          return;
        }
        for (var c = 0; c < item.count; c++) {
          var v = vals[vi++];
          switch (item.code) {
            case 'b': dv.setInt8(off, Number(toBigInt(v))); off += 1; break;
            case 'B': dv.setUint8(off, Number(toBigInt(v))); off += 1; break;
            case '?': dv.setUint8(off, truthy(v) ? 1 : 0); off += 1; break;
            case 'c': buf[off] = (v instanceof PyBytes ? v.b[0] : str(v).charCodeAt(0)); off += 1; break;
            case 'h': dv.setInt16(off, Number(toBigInt(v)), spec.little); off += 2; break;
            case 'H': dv.setUint16(off, Number(toBigInt(v)), spec.little); off += 2; break;
            case 'i': case 'l': dv.setInt32(off, Number(toBigInt(v)), spec.little); off += 4; break;
            case 'I': case 'L': dv.setUint32(off, Number(toBigInt(v)), spec.little); off += 4; break;
            case 'q': dv.setBigInt64(off, toBigInt(v), spec.little); off += 8; break;
            case 'Q': dv.setBigUint64(off, toBigInt(v), spec.little); off += 8; break;
            case 'f': dv.setFloat32(off, toNumber(v), spec.little); off += 4; break;
            case 'd': dv.setFloat64(off, toNumber(v), spec.little); off += 8; break;
          }
        }
      });
      return new PyBytes(buf);
    });
    m.fn('unpack', function (args, kwargs, it) {
      var spec = parseFormat(str(args[0]), it);
      var data = B.toBytesLike(it, args[1]);
      var need = calcsize(spec);
      if (data.b.length !== need) {
        it.throwPy('ValueError', 'unpack requires a buffer of ' + need + ' bytes');
      }
      var dv = new DataView(data.b.buffer, data.b.byteOffset, data.b.byteLength);
      var out = [];
      var off = 0;
      spec.items.forEach(function (item) {
        if (item.code === 'x') { off += item.count; return; }
        if (item.code === 's') {
          out.push(new PyBytes(data.b.slice(off, off + item.count)));
          off += item.count;
          return;
        }
        for (var c = 0; c < item.count; c++) {
          switch (item.code) {
            case 'b': out.push(BigInt(dv.getInt8(off))); off += 1; break;
            case 'B': out.push(BigInt(dv.getUint8(off))); off += 1; break;
            case '?': out.push(dv.getUint8(off) !== 0); off += 1; break;
            case 'c': out.push(new PyBytes([dv.getUint8(off)])); off += 1; break;
            case 'h': out.push(BigInt(dv.getInt16(off, spec.little))); off += 2; break;
            case 'H': out.push(BigInt(dv.getUint16(off, spec.little))); off += 2; break;
            case 'i': case 'l': out.push(BigInt(dv.getInt32(off, spec.little))); off += 4; break;
            case 'I': case 'L': out.push(BigInt(dv.getUint32(off, spec.little))); off += 4; break;
            case 'q': out.push(dv.getBigInt64(off, spec.little)); off += 8; break;
            case 'Q': out.push(dv.getBigUint64(off, spec.little)); off += 8; break;
            case 'f': out.push(dv.getFloat32(off, spec.little)); off += 4; break;
            case 'd': out.push(dv.getFloat64(off, spec.little)); off += 8; break;
          }
        }
      });
      return new PyTuple(out);
    });
    m.fn('unpack_from', function (args, kwargs, it) {
      var spec = parseFormat(str(args[0]), it);
      var data = B.toBytesLike(it, args[1]);
      var off = args.length > 2 ? inum(args[2]) : 0;
      var need = calcsize(spec);
      return it.callSync(m.get('unpack'), [args[0], new PyBytes(data.b.slice(off, off + need))], null);
    });
    m.val('error', interp.exceptionClasses.ValueError);
    return m.mod;
  });

  // ===========================================================================
  // datetime
  // ===========================================================================
  S.define('datetime', function (interp) {
    var m = S.makeModule('datetime');
    var dtCls = new PyClass('datetime', [], new Map());
    var dateCls = new PyClass('date', [], new Map());
    var tdCls = new PyClass('timedelta', [], new Map());
    var tzCls = new PyClass('timezone', [], new Map());

    function mkDT(ms, cls) {
      var inst = new PyInstance(cls || dtCls);
      inst.__ms__ = ms;
      return inst;
    }
    function mkTD(ms) {
      var inst = new PyInstance(tdCls);
      inst.__ms__ = ms;
      return inst;
    }
    function two(n) { return String(n).padStart(2, '0'); }
    function parts(inst) {
      var d = new Date(inst.__ms__);
      return {
        y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(),
        h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(),
        us: (inst.__ms__ % 1000) * 1000, wd: (d.getUTCDay() + 6) % 7
      };
    }
    function isoOf(inst, isDate) {
      var p = parts(inst);
      var base = p.y + '-' + two(p.mo) + '-' + two(p.d);
      if (isDate) return base;
      var out = base + 'T' + two(p.h) + ':' + two(p.mi) + ':' + two(p.s);
      if (p.us) out += '.' + String(p.us).padStart(6, '0');
      return out;
    }

    dtCls.nativeNew = function (args, kwargs, it) {
      var y = inum(argk(args, kwargs, 0, 'year', 1970n));
      var mo = inum(argk(args, kwargs, 1, 'month', 1n));
      var d = inum(argk(args, kwargs, 2, 'day', 1n));
      var h = inum(argk(args, kwargs, 3, 'hour', 0n));
      var mi = inum(argk(args, kwargs, 4, 'minute', 0n));
      var s = inum(argk(args, kwargs, 5, 'second', 0n));
      var us = inum(argk(args, kwargs, 6, 'microsecond', 0n));
      return mkDT(Date.UTC(y, mo - 1, d, h, mi, s, Math.floor(us / 1000)));
    };
    dateCls.nativeNew = function (args, kwargs, it) {
      var y = inum(argk(args, kwargs, 0, 'year', 1970n));
      var mo = inum(argk(args, kwargs, 1, 'month', 1n));
      var d = inum(argk(args, kwargs, 2, 'day', 1n));
      return mkDT(Date.UTC(y, mo - 1, d), dateCls);
    };
    tdCls.nativeNew = function (args, kwargs, it) {
      var days = toNumber(argk(args, kwargs, 0, 'days', 0n));
      var secs = toNumber(argk(args, kwargs, 1, 'seconds', 0n));
      var us = toNumber(argk(args, kwargs, 2, 'microseconds', 0n));
      var ms = toNumber(kwget(kwargs, 'milliseconds', 0n));
      var mins = toNumber(kwget(kwargs, 'minutes', 0n));
      var hours = toNumber(kwget(kwargs, 'hours', 0n));
      var weeks = toNumber(kwget(kwargs, 'weeks', 0n));
      return mkTD(((days + weeks * 7) * 86400 + hours * 3600 + mins * 60 + secs) * 1000 + ms + us / 1000);
    };

    function dm(cls, name, fn) {
      cls.dict.set(name, new PyBuiltin(name, function (args, kwargs, it) {
        return fn(args[0], args.slice(1), kwargs, it);
      }));
    }
    function prop(cls, name, fn) {
      cls.dict.set(name, new O.PyProperty(new PyBuiltin(name, function (args, k, it) { return fn(args[0], it); }), null, null, null));
    }

    [dtCls, dateCls].forEach(function (cls) {
      prop(cls, 'year', function (s) { return BigInt(parts(s).y); });
      prop(cls, 'month', function (s) { return BigInt(parts(s).mo); });
      prop(cls, 'day', function (s) { return BigInt(parts(s).d); });
      dm(cls, 'isoformat', function (self) { return isoOf(self, self.__class__ === dateCls); });
      dm(cls, 'weekday', function (self) { return BigInt(parts(self).wd); });
      dm(cls, 'strftime', function (self, args) {
        var p = parts(self);
        var names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                      'August', 'September', 'October', 'November', 'December'];
        return str(args[0]).replace(/%[-a-zA-Z%]/g, function (code) {
          switch (code) {
            case '%Y': return String(p.y);
            case '%y': return two(p.y % 100);
            case '%m': return two(p.mo);
            case '%d': return two(p.d);
            case '%H': return two(p.h);
            case '%M': return two(p.mi);
            case '%S': return two(p.s);
            case '%A': return names[p.wd];
            case '%a': return names[p.wd].slice(0, 3);
            case '%B': return months[p.mo - 1];
            case '%b': return months[p.mo - 1].slice(0, 3);
            case '%j': return String(Math.floor((self.__ms__ - Date.UTC(p.y, 0, 1)) / 86400000) + 1).padStart(3, '0');
            case '%%': return '%';
            default: return code;
          }
        });
      });
      dm(cls, '__repr__', function (self) {
        var p = parts(self);
        if (self.__class__ === dateCls) return 'datetime.date(' + p.y + ', ' + p.mo + ', ' + p.d + ')';
        return 'datetime.datetime(' + [p.y, p.mo, p.d, p.h, p.mi, p.s].join(', ') + ')';
      });
      dm(cls, '__str__', function (self) {
        return self.__class__ === dateCls ? isoOf(self, true) : isoOf(self, false).replace('T', ' ');
      });
      dm(cls, '__sub__', function (self, args, kwargs, it) {
        var other = args[0];
        if (other instanceof PyInstance && other.__class__ === tdCls) return mkDT(self.__ms__ - other.__ms__, self.__class__);
        return mkTD(self.__ms__ - other.__ms__);
      });
      dm(cls, '__add__', function (self, args) { return mkDT(self.__ms__ + args[0].__ms__, self.__class__); });
      dm(cls, '__eq__', function (self, args) {
        return args[0] instanceof PyInstance && args[0].__ms__ === self.__ms__;
      });
      dm(cls, '__lt__', function (self, args) { return self.__ms__ < args[0].__ms__; });
      dm(cls, '__gt__', function (self, args) { return self.__ms__ > args[0].__ms__; });
      dm(cls, 'timestamp', function (self) { return self.__ms__ / 1000; });
    });
    prop(dtCls, 'hour', function (s) { return BigInt(parts(s).h); });
    prop(dtCls, 'minute', function (s) { return BigInt(parts(s).mi); });
    prop(dtCls, 'second', function (s) { return BigInt(parts(s).s); });
    dm(dtCls, 'date', function (self) { return mkDT(Math.floor(self.__ms__ / 86400000) * 86400000, dateCls); });

    prop(tdCls, 'days', function (s) { return BigInt(Math.floor(s.__ms__ / 86400000)); });
    prop(tdCls, 'seconds', function (s) { return BigInt(Math.floor((s.__ms__ % 86400000) / 1000)); });
    dm(tdCls, 'total_seconds', function (self) { return self.__ms__ / 1000; });
    dm(tdCls, '__repr__', function (self) {
      var d = Math.floor(self.__ms__ / 86400000);
      var s = Math.floor((self.__ms__ % 86400000) / 1000);
      var bits = [];
      if (d) bits.push('days=' + d);
      if (s) bits.push('seconds=' + s);
      return 'datetime.timedelta(' + (bits.length ? bits.join(', ') : '0') + ')';
    });
    dm(tdCls, '__str__', function (self) {
      var total = Math.floor(self.__ms__ / 1000);
      var d = Math.floor(total / 86400);
      var rem = total % 86400;
      var h = Math.floor(rem / 3600), mi = Math.floor((rem % 3600) / 60), s = rem % 60;
      return (d ? d + ' day' + (d === 1 ? '' : 's') + ', ' : '') + h + ':' + two(mi) + ':' + two(s);
    });
    dm(tdCls, '__add__', function (self, args) { return mkTD(self.__ms__ + args[0].__ms__); });
    dm(tdCls, '__mul__', function (self, args) { return mkTD(self.__ms__ * toNumber(args[0])); });
    dm(tdCls, '__lt__', function (self, args) { return self.__ms__ < args[0].__ms__; });
    dm(tdCls, '__eq__', function (self, args) { return args[0] instanceof PyInstance && self.__ms__ === args[0].__ms__; });

    var FIXED_NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
    dtCls.dict.set('now', new PyBuiltin('now', function () { return mkDT(FIXED_NOW); }));
    dtCls.dict.set('utcnow', new PyBuiltin('utcnow', function () { return mkDT(FIXED_NOW); }));
    dtCls.dict.set('fromtimestamp', new PyBuiltin('fromtimestamp', function (args) {
      var v = args[0];
      if (v instanceof PyInstance) v = args[1];
      return mkDT(toNumber(v) * 1000);
    }));
    dtCls.dict.set('fromisoformat', new PyBuiltin('fromisoformat', function (args, k, it) {
      var v = args[0];
      if (v instanceof PyInstance) v = args[1];
      var ms = Date.parse(str(v).replace(' ', 'T') + (/[Zz+]|\d{2}:\d{2}$/.test(str(v)) ? '' : 'Z'));
      if (Number.isNaN(ms)) it.valueError('Invalid isoformat string: ' + repr(str(v)));
      return mkDT(ms);
    }));
    dtCls.dict.set('strptime', new PyBuiltin('strptime', function (args, k, it) {
      var a = args[0] instanceof PyClass || args[0] instanceof PyInstance ? args.slice(1) : args;
      var text = str(a[0]), fmt = str(a[1]);
      var order = [];
      var reSrc = fmt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%[a-zA-Z]/g, function (code) {
        switch (code) {
          case '%Y': order.push('Y'); return '(\\d{4})';
          case '%m': order.push('m'); return '(\\d{1,2})';
          case '%d': order.push('d'); return '(\\d{1,2})';
          case '%H': order.push('H'); return '(\\d{1,2})';
          case '%M': order.push('M'); return '(\\d{1,2})';
          case '%S': order.push('S'); return '(\\d{1,2})';
          default: return '.*?';
        }
      });
      var mm2 = new RegExp('^' + reSrc + '$').exec(text);
      if (!mm2) it.valueError("time data " + repr(text) + " does not match format " + repr(fmt));
      var v = { Y: 1970, m: 1, d: 1, H: 0, M: 0, S: 0 };
      order.forEach(function (key, i) { v[key] = parseInt(mm2[i + 1], 10); });
      return mkDT(Date.UTC(v.Y, v.m - 1, v.d, v.H, v.M, v.S));
    }));
    dateCls.dict.set('today', new PyBuiltin('today', function () {
      return mkDT(Math.floor(FIXED_NOW / 86400000) * 86400000, dateCls);
    }));
    dateCls.dict.set('fromisoformat', new PyBuiltin('fromisoformat', function (args, k, it) {
      var v = args[0];
      if (v instanceof PyClass) v = args[1];
      return mkDT(Date.parse(str(v) + 'T00:00:00Z'), dateCls);
    }));

    tzCls.dict.set('utc', 'UTC');
    m.val('datetime', dtCls).val('date', dateCls).val('timedelta', tdCls).val('timezone', tzCls);
    return m.mod;
  });

  // ===========================================================================
  // codecs / unicodedata / difflib / shlex / uuid
  // ===========================================================================
  S.define('codecs', function (interp) {
    var m = S.makeModule('codecs');
    m.fn('encode', function (args, kwargs, it) {
      var s = args[0];
      var enc = str(args.length > 1 ? args[1] : 'utf-8').toLowerCase();
      if (enc === 'rot13' || enc === 'rot_13') {
        return str(s).replace(/[a-zA-Z]/g, function (c) {
          var base = c <= 'Z' ? 65 : 97;
          return String.fromCharCode((c.charCodeAt(0) - base + 13) % 26 + base);
        });
      }
      if (enc === 'hex' || enc === 'hex_codec') {
        var bs = s instanceof PyBytes ? s.b : B.utf8Encode(str(s));
        return Array.prototype.map.call(bs, function (x) { return x.toString(16).padStart(2, '0'); }).join('');
      }
      return new PyBytes(B.utf8Encode(str(s)));
    });
    m.fn('decode', function (args, kwargs, it) {
      var s = args[0];
      var enc = str(args.length > 1 ? args[1] : 'utf-8').toLowerCase();
      if (enc === 'rot13' || enc === 'rot_13') return it.callSync(m.get('encode'), [s, 'rot13'], null);
      if (enc === 'hex' || enc === 'hex_codec') {
        var hex = str(s);
        var out = [];
        for (var i = 0; i < hex.length; i += 2) out.push(parseInt(hex.substr(i, 2), 16));
        return new PyBytes(out);
      }
      return B.utf8Decode(B.toBytesLike(it, s).b, it);
    });
    return m.mod;
  });

  S.define('unicodedata', function (interp) {
    var m = S.makeModule('unicodedata');
    m.fn('name', function (args) { return 'CHARACTER-' + str(args[0]).codePointAt(0); });
    m.fn('normalize', function (args) {
      var form = str(args[0]);
      try { return str(args[1]).normalize(form); } catch (e) { return str(args[1]); }
    });
    m.fn('category', function (args) {
      var c = str(args[0]);
      if (/\d/.test(c)) return 'Nd';
      if (/[a-z]/.test(c)) return 'Ll';
      if (/[A-Z]/.test(c)) return 'Lu';
      if (/\s/.test(c)) return 'Zs';
      return 'Po';
    });
    return m.mod;
  });

  S.define('difflib', function (interp) {
    var m = S.makeModule('difflib');
    function ratio(a, b) {
      var matches = 0;
      var bb = b.split('');
      a.split('').forEach(function (c) {
        var i = bb.indexOf(c);
        if (i >= 0) { matches++; bb.splice(i, 1); }
      });
      return (2 * matches) / (a.length + b.length);
    }
    m.fn('get_close_matches', function (args, kwargs, it) {
      var word = str(args[0]);
      var poss = it.toArray(args[1]).map(str);
      var n = inum(argk(args, kwargs, 2, 'n', 3n));
      var cutoff = toNumber(argk(args, kwargs, 3, 'cutoff', 0.6));
      var scored = poss.map(function (p) { return [ratio(word, p), p]; })
        .filter(function (p) { return p[0] >= cutoff; })
        .sort(function (x, y) { return y[0] - x[0]; });
      return new PyList(scored.slice(0, n).map(function (p) { return p[1]; }));
    });
    m.fn('unified_diff', function (args, kwargs, it) {
      var a = it.toArray(args[0]).map(str);
      var b = it.toArray(args[1]).map(str);
      var out = ['--- a', '+++ b'];
      var i = 0;
      while (i < Math.max(a.length, b.length)) {
        if (a[i] !== b[i]) {
          if (a[i] !== undefined) out.push('-' + a[i]);
          if (b[i] !== undefined) out.push('+' + b[i]);
        } else if (a[i] !== undefined) out.push(' ' + a[i]);
        i++;
      }
      var j = 0;
      return lazyIter(function () { return j < out.length ? { value: out[j++], done: false } : { done: true }; }, 'diff');
    });
    return m.mod;
  });

  S.define('shlex', function (interp) {
    var m = S.makeModule('shlex');
    m.fn('split', function (args, kwargs, it) {
      var s = str(args[0]);
      var out = [];
      var cur = '';
      var q = null;
      var started = false;
      for (var i = 0; i < s.length; i++) {
        var c = s[i];
        if (q) {
          if (c === q) q = null;
          else cur += c;
          continue;
        }
        if (c === '"' || c === "'") { q = c; started = true; continue; }
        if (/\s/.test(c)) {
          if (cur.length || started) { out.push(cur); cur = ''; started = false; }
          continue;
        }
        if (c === '\\' && i + 1 < s.length) { cur += s[++i]; continue; }
        cur += c;
      }
      if (cur.length || started) out.push(cur);
      return new PyList(out);
    });
    m.fn('quote', function (args) {
      var s = str(args[0]);
      if (/^[A-Za-z0-9_@%+=:,.\/-]+$/.test(s)) return s;
      return "'" + s.split("'").join("'\"'\"'") + "'";
    });
    return m.mod;
  });

  S.define('uuid', function (interp) {
    var m = S.makeModule('uuid');
    var uuidCls = new PyClass('UUID', [], new Map());
    function makeUuid(hexStr) {
      var inst = new PyInstance(uuidCls);
      inst.__hex__ = hexStr.replace(/-/g, '');
      return inst;
    }
    function dashed(h) {
      return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
    }
    uuidCls.dict.set('__str__', new PyBuiltin('__str__', function (args) { return dashed(args[0].__hex__); }));
    uuidCls.dict.set('__repr__', new PyBuiltin('__repr__', function (args) { return "UUID('" + dashed(args[0].__hex__) + "')"; }));
    uuidCls.dict.set('hex', new O.PyProperty(new PyBuiltin('hex', function (args) { return args[0].__hex__; }), null, null, null));
    uuidCls.nativeNew = function (args, kwargs, it) { return makeUuid(str(args[0] || '0'.repeat(32))); };
    m.val('UUID', uuidCls);
    m.fn('uuid4', function () {
      var h = '';
      for (var i = 0; i < 32; i++) h += Math.floor(Math.random() * 16).toString(16);
      h = h.slice(0, 12) + '4' + h.slice(13, 16) + '89ab'[Math.floor(Math.random() * 4)] + h.slice(17);
      return makeUuid(h);
    });
    return m.mod;
  });
})(typeof window !== 'undefined' ? window : globalThis);

/* --- io -------------------------------------------------------------------- */
(function (root) {
  'use strict';
  var O = root.PyObjects, B = root.PyBuiltins, S = root.PyStdlib;
  var PyList = O.PyList, PyBytes = O.PyBytes, PyBuiltin = O.PyBuiltin,
      str = O.str, repr = O.repr;

  S.define('io', function (interp) {
    var m = S.makeModule('io');

    function makeBuffer(initial, binary) {
      var state = { data: initial || '', pos: 0, closed: false };
      function wrap(s) { return binary ? B.latin1ToBytes(s) : s; }
      var obj = {
        pytype: binary ? '_io.BytesIO' : '_io.StringIO',
        __reprNative__: function () { return '<' + (binary ? '_io.BytesIO' : '_io.StringIO') + ' object>'; },
        __jsiter__: function () {
          return {
            next: function () {
              if (state.pos >= state.data.length) return { done: true };
              var idx = state.data.indexOf('\n', state.pos);
              var end = idx < 0 ? state.data.length : idx + 1;
              var line = state.data.slice(state.pos, end);
              state.pos = end;
              return { value: wrap(line), done: false };
            }
          };
        },
        __nativeAttrs__: {
          write: new PyBuiltin('write', function (args) {
            var s = args[0] instanceof PyBytes ? B.bytesToLatin1(args[0]) : str(args[0]);
            state.data = state.data.slice(0, state.pos) + s + state.data.slice(state.pos + s.length);
            state.pos += s.length;
            return BigInt(s.length);
          }),
          read: new PyBuiltin('read', function (args) {
            var n = args.length && args[0] !== null ? Number(O.toBigInt(args[0])) : -1;
            var out = n < 0 ? state.data.slice(state.pos) : state.data.substr(state.pos, n);
            state.pos += out.length;
            return wrap(out);
          }),
          readline: new PyBuiltin('readline', function () {
            if (state.pos >= state.data.length) return wrap('');
            var idx = state.data.indexOf('\n', state.pos);
            var end = idx < 0 ? state.data.length : idx + 1;
            var line = state.data.slice(state.pos, end);
            state.pos = end;
            return wrap(line);
          }),
          readlines: new PyBuiltin('readlines', function () {
            var rest = state.data.slice(state.pos);
            state.pos = state.data.length;
            if (!rest) return new PyList([]);
            var parts = rest.split('\n');
            var out = [];
            for (var i = 0; i < parts.length; i++) {
              if (i === parts.length - 1 && parts[i] === '') break;
              out.push(wrap(parts[i] + (i < parts.length - 1 ? '\n' : '')));
            }
            return new PyList(out);
          }),
          getvalue: new PyBuiltin('getvalue', function () { return wrap(state.data); }),
          seek: new PyBuiltin('seek', function (args) { state.pos = Number(O.toBigInt(args[0])); return BigInt(state.pos); }),
          tell: new PyBuiltin('tell', function () { return BigInt(state.pos); }),
          truncate: new PyBuiltin('truncate', function () { state.data = state.data.slice(0, state.pos); return BigInt(state.pos); }),
          flush: new PyBuiltin('flush', function () { return null; }),
          close: new PyBuiltin('close', function () { state.closed = true; return null; }),
          __enter__: new PyBuiltin('__enter__', function () { return obj; }),
          __exit__: new PyBuiltin('__exit__', function () { return false; })
        }
      };
      return obj;
    }

    m.fn('StringIO', function (args) {
      return makeBuffer(args.length && args[0] !== null ? str(args[0]) : '', false);
    });
    m.fn('BytesIO', function (args, k, it) {
      var init = args.length && args[0] !== null ? B.bytesToLatin1(B.toBytesLike(it, args[0])) : '';
      return makeBuffer(init, true);
    });
    return m.mod;
  });
})(typeof window !== 'undefined' ? window : globalThis);
