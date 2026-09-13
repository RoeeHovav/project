/* ============================================================================
 * methods.js — Methods for the built-in types (str, list, dict, set, bytes...).
 * ========================================================================== */
(function (root) {
  'use strict';

  var O = root.PyObjects;
  var B = root.PyBuiltins;
  var PyList = O.PyList, PyTuple = O.PyTuple, PyDict = O.PyDict, PySet = O.PySet,
      PyBytes = O.PyBytes, PyBuiltin = O.PyBuiltin, PyClass = O.PyClass,
      PyGenerator = O.PyGenerator, PyIterator = O.PyIterator, PyError = O.PyError,
      PyComplex = O.PyComplex,
      truthy = O.truthy, repr = O.repr, str = O.str, typeName = O.typeName,
      eq = O.eq, toBigInt = O.toBigInt, toNumber = O.toNumber;

  function kw(kwargs, name, dflt) {
    if (!kwargs) return dflt;
    return kwargs.has(name) ? kwargs.get(name) : dflt;
  }
  function argOr(args, i, dflt) { return args.length > i && args[i] !== null ? args[i] : dflt; }
  function num(v) { return Number(toBigInt(v)); }

  // ---------------------------------------------------------------------------
  // str
  // ---------------------------------------------------------------------------

  var WS = ' \t\n\r\v\f';
  var WS_RE = /[ \t\n\r\v\f]+/;
  var WS_RE_G = /[ \t\n\r\v\f]+/g;
  var WS_LEAD = /^[ \t\n\r\v\f]+/;
  var WS_TRAIL = /[ \t\n\r\v\f]+$/;

  function stripChars(s, chars, left, right) {
    var set = (chars === null || chars === undefined) ? WS : chars;
    var start = 0, end = s.length;
    if (left) while (start < end && set.indexOf(s[start]) >= 0) start++;
    if (right) while (end > start && set.indexOf(s[end - 1]) >= 0) end--;
    return s.slice(start, end);
  }

  function pySplit(interp, s, sep, maxsplit) {
    if (sep === null || sep === undefined) {
      var trimmed = s.replace(WS_LEAD, '').replace(WS_TRAIL, '');
      if (trimmed === '') return [];
      if (maxsplit === undefined || maxsplit < 0) return trimmed.split(WS_RE_G);
      var out = [];
      var rest = trimmed;
      var count = 0;
      while (count < maxsplit) {
        var m = WS_RE.exec(rest);
        if (!m) break;
        out.push(rest.slice(0, m.index));
        rest = rest.slice(m.index + m[0].length);
        count++;
      }
      out.push(rest);
      return out;
    }
    if (sep === '') interp.valueError('empty separator');
    if (maxsplit === undefined || maxsplit < 0) return s.split(sep);
    var res = [];
    var idx = 0;
    for (var i = 0; i < maxsplit; i++) {
      var j = s.indexOf(sep, idx);
      if (j < 0) break;
      res.push(s.slice(idx, j));
      idx = j + sep.length;
    }
    res.push(s.slice(idx));
    return res;
  }

  function sliceBounds(s, args, from) {
    var len = s.length;
    var start = args.length > from && args[from] !== null && args[from] !== undefined ? num(args[from]) : 0;
    var end = args.length > from + 1 && args[from + 1] !== null && args[from + 1] !== undefined ? num(args[from + 1]) : len;
    if (start < 0) start = Math.max(0, start + len);
    if (end < 0) end = Math.max(0, end + len);
    return { start: Math.min(start, len), end: Math.min(end, len) };
  }

  var STR = {
    upper: function (s) { return s.toUpperCase(); },
    lower: function (s) { return s.toLowerCase(); },
    casefold: function (s) { return s.toLowerCase(); },
    swapcase: function (s) {
      return s.replace(/[a-zA-Z\u00C0-\u024F]/g, function (c) {
        return c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase();
      });
    },
    capitalize: function (s) { return s.length ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s; },
    title: function (s) {
      return s.replace(/[A-Za-z]+('[A-Za-z]*)?/g, function (w) {
        return w[0].toUpperCase() + w.slice(1).toLowerCase();
      });
    },
    strip: function (s, args) { return stripChars(s, argOr(args, 0, null), true, true); },
    lstrip: function (s, args) { return stripChars(s, argOr(args, 0, null), true, false); },
    rstrip: function (s, args) { return stripChars(s, argOr(args, 0, null), false, true); },
    removeprefix: function (s, args) { var p = str(args[0]); return p && s.startsWith(p) ? s.slice(p.length) : s; },
    removesuffix: function (s, args) { var p = str(args[0]); return p && s.endsWith(p) ? s.slice(0, s.length - p.length) : s; },
    split: function (s, args, kwargs, it) {
      var sep = args.length ? args[0] : kw(kwargs, 'sep', null);
      var ms = args.length > 1 ? num(args[1]) : num(kw(kwargs, 'maxsplit', -1n));
      return new PyList(pySplit(it, s, (sep === null || sep === undefined) ? null : str(sep), ms));
    },
    rsplit: function (s, args, kwargs, it) {
      var sep = args.length ? args[0] : kw(kwargs, 'sep', null);
      var ms = args.length > 1 ? num(args[1]) : num(kw(kwargs, 'maxsplit', -1n));
      if (sep === null || sep === undefined) {
        var all = pySplit(it, s, null, -1);
        if (ms < 0 || all.length <= ms) return new PyList(all);
        var head = all.slice(0, all.length - ms);
        return new PyList([head.join(' ')].concat(all.slice(all.length - ms)));
      }
      var sp = str(sep);
      var parts = s.split(sp);
      if (ms < 0 || parts.length <= ms) return new PyList(parts);
      var keep = parts.slice(parts.length - ms);
      var joined = parts.slice(0, parts.length - ms).join(sp);
      return new PyList([joined].concat(keep));
    },
    splitlines: function (s, args, kwargs) {
      var keepends = truthy(args.length ? args[0] : kw(kwargs, 'keepends', false));
      if (s === '') return new PyList([]);
      var out = [];
      var re = /\r\n|[\n\r\x0b\x0c\x1c\x1d\x1e\x85\u2028\u2029]/g;
      var last = 0, m;
      while ((m = re.exec(s))) {
        out.push(keepends ? s.slice(last, m.index + m[0].length) : s.slice(last, m.index));
        last = m.index + m[0].length;
      }
      if (last < s.length) out.push(s.slice(last));
      return new PyList(out);
    },
    join: function (s, args, kwargs, it) {
      var items = it.toArray(args[0]);
      var parts = items.map(function (x) {
        if (typeof x !== 'string') it.typeError('sequence item: expected str instance, ' + typeName(x) + ' found');
        return x;
      });
      return parts.join(s);
    },
    replace: function (s, args) {
      var a = str(args[0]), b = str(args[1]);
      var count = args.length > 2 && args[2] !== null ? num(args[2]) : -1;
      if (count < 0) return s.split(a).join(b);
      var res = '';
      var idx = 0;
      for (var i = 0; i < count; i++) {
        var j = s.indexOf(a, idx);
        if (j < 0) break;
        res += s.slice(idx, j) + b;
        idx = j + a.length;
      }
      return res + s.slice(idx);
    },
    find: function (s, args) {
      var b = sliceBounds(s, args, 1);
      var i = s.slice(b.start, b.end).indexOf(str(args[0]));
      return BigInt(i < 0 ? -1 : i + b.start);
    },
    rfind: function (s, args) {
      var b = sliceBounds(s, args, 1);
      var i = s.slice(b.start, b.end).lastIndexOf(str(args[0]));
      return BigInt(i < 0 ? -1 : i + b.start);
    },
    index: function (s, args, kwargs, it) {
      var r = STR.find(s, args);
      if (r < 0n) it.valueError('substring not found');
      return r;
    },
    rindex: function (s, args, kwargs, it) {
      var r = STR.rfind(s, args);
      if (r < 0n) it.valueError('substring not found');
      return r;
    },
    count: function (s, args) {
      var sub = str(args[0]);
      var b = sliceBounds(s, args, 1);
      var hay = s.slice(b.start, b.end);
      if (sub === '') return BigInt(hay.length + 1);
      var c = 0, i = 0;
      for (;;) { var j = hay.indexOf(sub, i); if (j < 0) break; c++; i = j + sub.length; }
      return BigInt(c);
    },
    startswith: function (s, args) {
      var b = sliceBounds(s, args, 1);
      var hay = s.slice(b.start, b.end);
      var p = args[0];
      if (p instanceof PyTuple) return p.items.some(function (x) { return hay.startsWith(str(x)); });
      return hay.startsWith(str(p));
    },
    endswith: function (s, args) {
      var b = sliceBounds(s, args, 1);
      var hay = s.slice(b.start, b.end);
      var p = args[0];
      if (p instanceof PyTuple) return p.items.some(function (x) { return hay.endsWith(str(x)); });
      return hay.endsWith(str(p));
    },
    format: function (s, args, kwargs, it) { return B.strFormat(it, s, args, kwargs); },
    format_map: function (s, args, kwargs, it) { return B.strFormat(it, s, [], args[0]); },
    encode: function (s, args, kwargs, it) {
      var enc = str(args.length ? args[0] : kw(kwargs, 'encoding', 'utf-8')).toLowerCase();
      if (/latin|8859|cp1252/.test(enc)) return B.latin1ToBytes(s);
      if (/ascii/.test(enc)) {
        for (var i = 0; i < s.length; i++) {
          if (s.charCodeAt(i) > 127) {
            it.throwPy('UnicodeEncodeError', "'ascii' codec can't encode character " + repr(s[i]) + ' in position ' + i);
          }
        }
        return B.latin1ToBytes(s);
      }
      return new PyBytes(B.utf8Encode(s));
    },
    isdigit: function (s) { return s.length > 0 && /^[0-9]+$/.test(s); },
    isdecimal: function (s) { return s.length > 0 && /^[0-9]+$/.test(s); },
    isnumeric: function (s) { return s.length > 0 && /^[0-9]+$/.test(s); },
    isalpha: function (s) { return s.length > 0 && /^[A-Za-z\u00C0-\u024F]+$/.test(s); },
    isalnum: function (s) { return s.length > 0 && /^[A-Za-z0-9\u00C0-\u024F]+$/.test(s); },
    isspace: function (s) { return s.length > 0 && /^[ \t\n\r\v\f]+$/.test(s); },
    isupper: function (s) { return /[A-Za-z]/.test(s) && s === s.toUpperCase(); },
    islower: function (s) { return /[A-Za-z]/.test(s) && s === s.toLowerCase(); },
    istitle: function (s) { return s.length > 0 && s === STR.title(s) && /[A-Za-z]/.test(s); },
    isascii: function (s) { return /^[\x00-\x7f]*$/.test(s); },
    isprintable: function (s) { return !/[\x00-\x1f\x7f]/.test(s); },
    isidentifier: function (s) { return /^[A-Za-z_]\w*$/.test(s); },
    ljust: function (s, args) {
      var w = num(args[0]); var f = args.length > 1 ? str(args[1]) : ' ';
      return s.length >= w ? s : s + f.repeat(w - s.length);
    },
    rjust: function (s, args) {
      var w = num(args[0]); var f = args.length > 1 ? str(args[1]) : ' ';
      return s.length >= w ? s : f.repeat(w - s.length) + s;
    },
    center: function (s, args) {
      var w = num(args[0]); var f = args.length > 1 ? str(args[1]) : ' ';
      if (s.length >= w) return s;
      var total = w - s.length;
      var left = Math.floor(total / 2);
      return f.repeat(left) + s + f.repeat(total - left);
    },
    zfill: function (s, args) {
      var w = num(args[0]);
      if (s.length >= w) return s;
      var signChar = (s[0] === '+' || s[0] === '-') ? s[0] : '';
      var rest = signChar ? s.slice(1) : s;
      return signChar + '0'.repeat(w - s.length) + rest;
    },
    partition: function (s, args) {
      var sep = str(args[0]);
      var i = s.indexOf(sep);
      if (i < 0) return new PyTuple([s, '', '']);
      return new PyTuple([s.slice(0, i), sep, s.slice(i + sep.length)]);
    },
    rpartition: function (s, args) {
      var sep = str(args[0]);
      var i = s.lastIndexOf(sep);
      if (i < 0) return new PyTuple(['', '', s]);
      return new PyTuple([s.slice(0, i), sep, s.slice(i + sep.length)]);
    },
    expandtabs: function (s, args) {
      var w = args.length ? num(args[0]) : 8;
      var out = '', col = 0;
      for (var i = 0; i < s.length; i++) {
        if (s[i] === '\t') { var add = w - (col % w); out += ' '.repeat(add); col += add; }
        else { out += s[i]; col = s[i] === '\n' ? 0 : col + 1; }
      }
      return out;
    },
    maketrans: function (s, args, kwargs, it) {
      var d = new PyDict();
      if (args.length === 1 && args[0] instanceof PyDict) {
        args[0].map.forEach(function (e) {
          var k2 = typeof e.k === 'string' ? BigInt(e.k.codePointAt(0)) : toBigInt(e.k);
          d.set(k2, e.v);
        });
        return d;
      }
      var from = str(args[0]), to = str(args[1]);
      for (var i = 0; i < from.length; i++) d.set(BigInt(from.codePointAt(i)), to[i]);
      if (args.length > 2) {
        var del = str(args[2]);
        for (var j = 0; j < del.length; j++) d.set(BigInt(del.codePointAt(j)), null);
      }
      return d;
    },
    translate: function (s, args) {
      var table = args[0];
      var out = '';
      for (var i = 0; i < s.length; i++) {
        var code = BigInt(s.codePointAt(i));
        var v = table instanceof PyDict ? (table.has(code) ? table.get(code) : s[i]) : s[i];
        if (v === null) continue;
        out += typeof v === 'string' ? v : String.fromCodePoint(num(v));
      }
      return out;
    },
    __len__: function (s) { return BigInt(s.length); },
    __contains__: function (s, args) { return s.indexOf(str(args[0])) >= 0; }
  };
  STR.maketrans.isStatic = true;

  // ---------------------------------------------------------------------------
  // list / tuple
  // ---------------------------------------------------------------------------

  var LIST = {
    append: function (self, args, kwargs, it) {
      if (args.length !== 1) it.typeError('append() takes exactly one argument (' + args.length + ' given)');
      self.items.push(args[0]); return null;
    },
    extend: function (self, args, kwargs, it) {
      it.toArray(args[0]).forEach(function (x) { self.items.push(x); }); return null;
    },
    insert: function (self, args) {
      var i = num(args[0]);
      if (i < 0) i = Math.max(0, i + self.items.length);
      self.items.splice(Math.min(i, self.items.length), 0, args[1]);
      return null;
    },
    remove: function (self, args, kwargs, it) {
      for (var i = 0; i < self.items.length; i++) {
        if (eq(self.items[i], args[0])) { self.items.splice(i, 1); return null; }
      }
      it.valueError('list.remove(x): x not in list');
    },
    pop: function (self, args, kwargs, it) {
      if (!self.items.length) it.indexError('pop from empty list');
      var i = args.length ? num(args[0]) : self.items.length - 1;
      if (i < 0) i += self.items.length;
      if (i < 0 || i >= self.items.length) it.indexError('pop index out of range');
      return self.items.splice(i, 1)[0];
    },
    clear: function (self) { self.items.length = 0; return null; },
    index: function (self, args, kwargs, it) {
      var start = args.length > 1 ? num(args[1]) : 0;
      var end = args.length > 2 ? num(args[2]) : self.items.length;
      if (start < 0) start += self.items.length;
      if (end < 0) end += self.items.length;
      for (var i = Math.max(0, start); i < Math.min(end, self.items.length); i++) {
        if (eq(self.items[i], args[0])) return BigInt(i);
      }
      it.valueError(repr(args[0]) + ' is not in list');
    },
    count: function (self, args) {
      var c = 0;
      self.items.forEach(function (x) { if (eq(x, args[0])) c++; });
      return BigInt(c);
    },
    sort: function (self, args, kwargs, it) {
      var keyFn = kw(kwargs, 'key', null);
      var rev = truthy(kw(kwargs, 'reverse', false));
      var sorted = B.sortKeyed(it, self.items, keyFn, rev);
      self.items.length = 0;
      sorted.forEach(function (x) { self.items.push(x); });
      return null;
    },
    reverse: function (self) { self.items.reverse(); return null; },
    copy: function (self) { return new PyList(self.items.slice()); },
    __len__: function (self) { return BigInt(self.items.length); }
  };

  var TUPLE = {
    count: LIST.count,
    index: function (self, args, kwargs, it) {
      for (var i = 0; i < self.items.length; i++) if (eq(self.items[i], args[0])) return BigInt(i);
      it.valueError('tuple.index(x): x not in tuple');
    },
    __len__: LIST.__len__
  };

  // ---------------------------------------------------------------------------
  // dict + views
  // ---------------------------------------------------------------------------

  function makeView(kind, produce) {
    return {
      pytype: kind,
      __reprNative__: function () {
        return kind + '([' + produce().map(function (x) { return repr(x); }).join(', ') + '])';
      },
      __jsiter__: function () {
        var arr = produce(), i = 0;
        return { next: function () { return i < arr.length ? { value: arr[i++], done: false } : { done: true }; } };
      },
      __nativeAttrs__: {},
      __viewLen__: function () { return produce().length; },
      __viewContains__: function (item) {
        var arr = produce();
        for (var i = 0; i < arr.length; i++) if (eq(arr[i], item)) return true;
        return false;
      }
    };
  }

  var DICT = {
    keys: function (self) { return makeView('dict_keys', function () { return self.keys(); }); },
    values: function (self) { return makeView('dict_values', function () { return self.values(); }); },
    items: function (self) {
      return makeView('dict_items', function () {
        return self.entries().map(function (e) { return new PyTuple([e[0], e[1]]); });
      });
    },
    get: function (self, args) { return self.has(args[0]) ? self.get(args[0]) : (args.length > 1 ? args[1] : null); },
    setdefault: function (self, args) {
      if (self.has(args[0])) return self.get(args[0]);
      var v = args.length > 1 ? args[1] : null;
      self.set(args[0], v);
      return v;
    },
    pop: function (self, args, kwargs, it) {
      if (self.has(args[0])) { var v = self.get(args[0]); self.del(args[0]); return v; }
      if (args.length > 1) return args[1];
      it.keyError(args[0]);
    },
    popitem: function (self, args, kwargs, it) {
      var ks = self.keys();
      if (!ks.length) it.keyError('popitem(): dictionary is empty');
      var k2 = ks[ks.length - 1];
      var v = self.get(k2);
      self.del(k2);
      return new PyTuple([k2, v]);
    },
    update: function (self, args, kwargs, it) {
      if (args.length && args[0] !== null) {
        var src = args[0];
        if (src instanceof PyDict) src.map.forEach(function (e) { self.set(e.k, e.v); });
        else it.toArray(src).forEach(function (p) { var pr = it.toArray(p); self.set(pr[0], pr[1]); });
      }
      if (kwargs) kwargs.map.forEach(function (e) { self.set(e.k, e.v); });
      return null;
    },
    clear: function (self) { self.map.clear(); return null; },
    copy: function (self) {
      var d = new PyDict();
      self.map.forEach(function (e) { d.set(e.k, e.v); });
      if (self.__default_factory__) d.__default_factory__ = self.__default_factory__;
      return d;
    },
    fromkeys: function (self, args, kwargs, it) {
      var d = new PyDict();
      it.toArray(args[0]).forEach(function (k2) { d.set(k2, args.length > 1 ? args[1] : null); });
      return d;
    },
    __len__: function (self) { return BigInt(self.size); }
  };
  DICT.fromkeys.isStatic = true;

  // ---------------------------------------------------------------------------
  // set
  // ---------------------------------------------------------------------------

  function asSet(it, v) {
    if (v instanceof PySet) return v;
    return new PySet(it.toArray(v));
  }

  var SET = {
    add: function (self, args, kwargs, it) {
      if (self.frozen) it.attrError("'frozenset' object has no attribute 'add'");
      it.checkHashable(args[0]);
      self.add(args[0]); return null;
    },
    remove: function (self, args, kwargs, it) {
      if (!self.has(args[0])) it.keyError(args[0]);
      self.del(args[0]); return null;
    },
    discard: function (self, args) { self.del(args[0]); return null; },
    pop: function (self, args, kwargs, it) {
      var vs = self.values();
      if (!vs.length) it.keyError('pop from an empty set');
      self.del(vs[0]);
      return vs[0];
    },
    clear: function (self) { self.map.clear(); return null; },
    copy: function (self) { return new PySet(self.values(), self.frozen); },
    union: function (self, args, kwargs, it) {
      var out = new PySet(self.values(), self.frozen);
      args.forEach(function (a) { it.toArray(a).forEach(function (x) { out.add(x); }); });
      return out;
    },
    intersection: function (self, args, kwargs, it) {
      var out = new PySet(self.values(), self.frozen);
      args.forEach(function (a) {
        var s = asSet(it, a);
        out.values().forEach(function (x) { if (!s.has(x)) out.del(x); });
      });
      return out;
    },
    difference: function (self, args, kwargs, it) {
      var out = new PySet(self.values(), self.frozen);
      args.forEach(function (a) { it.toArray(a).forEach(function (x) { out.del(x); }); });
      return out;
    },
    symmetric_difference: function (self, args, kwargs, it) {
      var other = asSet(it, args[0]);
      var out = new PySet([], self.frozen);
      self.values().forEach(function (x) { if (!other.has(x)) out.add(x); });
      other.values().forEach(function (x) { if (!self.has(x)) out.add(x); });
      return out;
    },
    update: function (self, args, kwargs, it) {
      args.forEach(function (a) { it.toArray(a).forEach(function (x) { self.add(x); }); });
      return null;
    },
    intersection_update: function (self, args, kwargs, it) {
      args.forEach(function (a) {
        var s = asSet(it, a);
        self.values().forEach(function (x) { if (!s.has(x)) self.del(x); });
      });
      return null;
    },
    difference_update: function (self, args, kwargs, it) {
      args.forEach(function (a) { it.toArray(a).forEach(function (x) { self.del(x); }); });
      return null;
    },
    symmetric_difference_update: function (self, args, kwargs, it) {
      var other = asSet(it, args[0]);
      other.values().forEach(function (x) { if (self.has(x)) self.del(x); else self.add(x); });
      return null;
    },
    issubset: function (self, args, kwargs, it) {
      var other = asSet(it, args[0]);
      return self.values().every(function (x) { return other.has(x); });
    },
    issuperset: function (self, args, kwargs, it) {
      var other = asSet(it, args[0]);
      return other.values().every(function (x) { return self.has(x); });
    },
    isdisjoint: function (self, args, kwargs, it) {
      var other = asSet(it, args[0]);
      return self.values().every(function (x) { return !other.has(x); });
    },
    __len__: function (self) { return BigInt(self.size); }
  };

  // ---------------------------------------------------------------------------
  // bytes / bytearray
  // ---------------------------------------------------------------------------

  function bstr(v) { return B.bytesToLatin1(v); }

  var BYTES = {
    decode: function (self, args, kwargs, it) {
      var enc = str(args.length ? args[0] : kw(kwargs, 'encoding', 'utf-8')).toLowerCase();
      var errors = str(args.length > 1 ? args[1] : kw(kwargs, 'errors', 'strict'));
      if (/latin|8859|cp1252/.test(enc)) return bstr(self);
      if (/ascii/.test(enc)) {
        for (var i = 0; i < self.b.length; i++) {
          if (self.b[i] > 127) {
            if (errors === 'replace') return bstr(self).replace(/[\x80-\xff]/g, '\ufffd');
            if (errors === 'ignore') return bstr(self).replace(/[\x80-\xff]/g, '');
            it.throwPy('UnicodeDecodeError', "'ascii' codec can't decode byte 0x" + self.b[i].toString(16) +
              ' in position ' + i + ': ordinal not in range(128)');
          }
        }
        return bstr(self);
      }
      return B.utf8Decode(self.b, it, errors);
    },
    hex: function (self, args) {
      var sep = args.length ? str(args[0]) : '';
      var parts = [];
      for (var i = 0; i < self.b.length; i++) parts.push(self.b[i].toString(16).padStart(2, '0'));
      return parts.join(sep);
    },
    fromhex: function (self, args, kwargs, it) {
      var s = str(args[0]).replace(/[\s_]/g, '');
      if (s.length % 2) it.valueError('non-hexadecimal number found in fromhex() arg');
      var out = [];
      for (var i = 0; i < s.length; i += 2) {
        var byteVal = parseInt(s.substr(i, 2), 16);
        if (Number.isNaN(byteVal)) it.valueError('non-hexadecimal number found in fromhex() arg');
        out.push(byteVal);
      }
      return new PyBytes(out);
    },
    split: function (self, args, kwargs, it) {
      var sep = args.length && args[0] !== null ? bstr(B.toBytesLike(it, args[0])) : null;
      var ms = args.length > 1 ? num(args[1]) : -1;
      return new PyList(pySplit(it, bstr(self), sep, ms).map(function (x) { return B.latin1ToBytes(x); }));
    },
    rsplit: function (self, args, kwargs, it) {
      var conv = args.map(function (a) { return a instanceof PyBytes ? bstr(a) : a; });
      var r = STR.rsplit(bstr(self), conv, kwargs, it);
      return new PyList(r.items.map(function (x) { return B.latin1ToBytes(x); }));
    },
    splitlines: function (self, args, kwargs) {
      var r = STR.splitlines(bstr(self), args, kwargs);
      return new PyList(r.items.map(function (x) { return B.latin1ToBytes(x); }));
    },
    strip: function (self, args, kwargs, it) {
      var c = args.length && args[0] !== null ? bstr(B.toBytesLike(it, args[0])) : null;
      return B.latin1ToBytes(stripChars(bstr(self), c, true, true));
    },
    lstrip: function (self, args, kwargs, it) {
      var c = args.length && args[0] !== null ? bstr(B.toBytesLike(it, args[0])) : null;
      return B.latin1ToBytes(stripChars(bstr(self), c, true, false));
    },
    rstrip: function (self, args, kwargs, it) {
      var c = args.length && args[0] !== null ? bstr(B.toBytesLike(it, args[0])) : null;
      return B.latin1ToBytes(stripChars(bstr(self), c, false, true));
    },
    startswith: function (self, args, kwargs, it) {
      var p = args[0];
      if (p instanceof PyTuple) return p.items.some(function (x) { return bstr(self).startsWith(bstr(B.toBytesLike(it, x))); });
      return bstr(self).startsWith(bstr(B.toBytesLike(it, p)));
    },
    endswith: function (self, args, kwargs, it) {
      var p = args[0];
      if (p instanceof PyTuple) return p.items.some(function (x) { return bstr(self).endsWith(bstr(B.toBytesLike(it, x))); });
      return bstr(self).endsWith(bstr(B.toBytesLike(it, p)));
    },
    find: function (self, args, kwargs, it) { return BigInt(bstr(self).indexOf(bstr(B.toBytesLike(it, args[0])))); },
    rfind: function (self, args, kwargs, it) { return BigInt(bstr(self).lastIndexOf(bstr(B.toBytesLike(it, args[0])))); },
    index: function (self, args, kwargs, it) {
      var i = bstr(self).indexOf(bstr(B.toBytesLike(it, args[0])));
      if (i < 0) it.valueError('subsection not found');
      return BigInt(i);
    },
    count: function (self, args, kwargs, it) { return STR.count(bstr(self), [bstr(B.toBytesLike(it, args[0]))]); },
    replace: function (self, args, kwargs, it) {
      var rest = args.slice(2);
      return B.latin1ToBytes(STR.replace(bstr(self),
        [bstr(B.toBytesLike(it, args[0])), bstr(B.toBytesLike(it, args[1]))].concat(rest)));
    },
    join: function (self, args, kwargs, it) {
      var parts = it.toArray(args[0]).map(function (x) { return bstr(B.toBytesLike(it, x)); });
      return B.latin1ToBytes(parts.join(bstr(self)));
    },
    upper: function (self) { return B.latin1ToBytes(bstr(self).toUpperCase()); },
    lower: function (self) { return B.latin1ToBytes(bstr(self).toLowerCase()); },
    isdigit: function (self) { return STR.isdigit(bstr(self)); },
    isalpha: function (self) { return STR.isalpha(bstr(self)); },
    isalnum: function (self) { return STR.isalnum(bstr(self)); },
    isspace: function (self) { return STR.isspace(bstr(self)); },
    ljust: function (self, args) {
      var conv = args.map(function (a) { return a instanceof PyBytes ? bstr(a) : a; });
      return B.latin1ToBytes(STR.ljust(bstr(self), conv));
    },
    rjust: function (self, args) {
      var conv = args.map(function (a) { return a instanceof PyBytes ? bstr(a) : a; });
      return B.latin1ToBytes(STR.rjust(bstr(self), conv));
    },
    translate: function (self, args, kwargs, it) {
      var table = args[0];
      if (table === null) return new PyBytes(self.b.slice(), self.mutable);
      var t = B.toBytesLike(it, table);
      var out = new Uint8Array(self.b.length);
      for (var i = 0; i < self.b.length; i++) out[i] = t.b[self.b[i]];
      return new PyBytes(out, self.mutable);
    },
    append: function (self, args, kwargs, it) {
      if (!self.mutable) it.attrError("'bytes' object has no attribute 'append'");
      var nb = new Uint8Array(self.b.length + 1);
      nb.set(self.b, 0);
      nb[self.b.length] = num(args[0]) & 0xff;
      self.b = nb;
      return null;
    },
    extend: function (self, args, kwargs, it) {
      if (!self.mutable) it.attrError("'bytes' object has no attribute 'extend'");
      var add = B.toBytesLike(it, args[0]);
      var nb = new Uint8Array(self.b.length + add.b.length);
      nb.set(self.b, 0); nb.set(add.b, self.b.length);
      self.b = nb;
      return null;
    },
    __len__: function (self) { return BigInt(self.b.length); }
  };
  BYTES.fromhex.isStatic = true;

  // ---------------------------------------------------------------------------
  // int / float / complex
  // ---------------------------------------------------------------------------

  var INT = {
    bit_length: function (self) {
      var n = toBigInt(self);
      if (n < 0n) n = -n;
      return BigInt(n === 0n ? 0 : n.toString(2).length);
    },
    bit_count: function (self) {
      var n = toBigInt(self); if (n < 0n) n = -n;
      return BigInt((n.toString(2).match(/1/g) || []).length);
    },
    to_bytes: function (self, args, kwargs, it) {
      var n = toBigInt(self);
      var length = args.length ? num(args[0]) : num(kw(kwargs, 'length', 1n));
      var order = str(args.length > 1 ? args[1] : kw(kwargs, 'byteorder', 'big'));
      var signed = truthy(kw(kwargs, 'signed', false));
      if (n < 0n) {
        if (!signed) it.throwPy('OverflowError', "can't convert negative int to unsigned");
        n = (1n << BigInt(length * 8)) + n;
      }
      var out = new Uint8Array(length);
      for (var i = length - 1; i >= 0; i--) { out[i] = Number(n & 0xffn); n >>= 8n; }
      if (n !== 0n) it.throwPy('OverflowError', 'int too big to convert');
      if (order === 'little') out.reverse();
      return new PyBytes(out);
    },
    from_bytes: function (self, args, kwargs, it) {
      var bv = B.toBytesLike(it, args[0]);
      var order = str(args.length > 1 ? args[1] : kw(kwargs, 'byteorder', 'big'));
      var signed = truthy(kw(kwargs, 'signed', false));
      var arr = Array.from(bv.b);
      if (order === 'little') arr.reverse();
      var n = 0n;
      arr.forEach(function (b2) { n = (n << 8n) | BigInt(b2); });
      if (signed && arr.length && (arr[0] & 0x80)) n -= (1n << BigInt(arr.length * 8));
      return n;
    },
    as_integer_ratio: function (self) { return new PyTuple([toBigInt(self), 1n]); },
    conjugate: function (self) { return self; }
  };
  INT.from_bytes.isStatic = true;

  var FLOAT = {
    is_integer: function (self) { return Number.isInteger(toNumber(self)); },
    hex: function (self) { return toNumber(self).toString(16); },
    as_integer_ratio: function (self, args, kwargs, it) {
      var x = toNumber(self);
      if (!isFinite(x)) it.throwPy('OverflowError', 'cannot convert Infinity to integer ratio');
      var denom = 1n, nn = x;
      while (!Number.isInteger(nn) && denom < (1n << 60n)) { nn *= 2; denom *= 2n; }
      return new PyTuple([BigInt(Math.round(nn)), denom]);
    },
    conjugate: function (self) { return self; }
  };

  var COMPLEX = {
    conjugate: function (self) { return new PyComplex(self.re, -self.im); }
  };

  // ---------------------------------------------------------------------------
  // generators / iterators / range
  // ---------------------------------------------------------------------------

  var GEN = {
    __next__: function (self, args, kwargs, it) {
      var r = it.genResume(self, null, null);
      if (r.done) throw new PyError(it.makeExc('StopIteration'));
      return r.value;
    },
    __iter__: function (self) { return self; },
    send: function (self, args, kwargs, it) {
      if (!self.started && args[0] !== null) it.typeError("can't send non-None value to a just-started generator");
      var r = it.genResume(self, args[0], null);
      if (r.done) throw new PyError(it.makeExc('StopIteration'));
      return r.value;
    },
    close: function (self) { self.done = true; return null; },
    throw: function (self, args, kwargs, it) {
      var exc = args[0];
      if (exc instanceof PyClass) exc = it.callSync(exc, args.slice(1), null);
      var r = it.genResume(self, null, new PyError(exc));
      if (r.done) throw new PyError(it.makeExc('StopIteration'));
      return r.value;
    }
  };

  var ITER = {
    __next__: function (self, args, kwargs, it) {
      var r = self.nextFn();
      if (r.done) throw new PyError(it.makeExc('StopIteration'));
      return r.value;
    },
    __iter__: function (self) { return self; }
  };

  var RANGE = {
    count: function (self, args, kwargs, it) { return it.contains(self, args[0]) ? 1n : 0n; },
    index: function (self, args, kwargs, it) {
      if (!it.contains(self, args[0])) it.valueError(repr(args[0]) + ' is not in range');
      return (toBigInt(args[0]) - self.start) / self.step;
    },
    __len__: function (self) { return self.length(); }
  };


  // ---------------------------------------------------------------------------
  // property (so @x.setter works)
  // ---------------------------------------------------------------------------

  var PROPERTY = {
    setter: function (self, args) {
      return new O.PyProperty(self.fget, args[0], self.fdel, self.doc);
    },
    getter: function (self, args) {
      return new O.PyProperty(args[0], self.fset, self.fdel, self.doc);
    },
    deleter: function (self, args) {
      return new O.PyProperty(self.fget, self.fset, args[0], self.doc);
    }
  };

  // ---------------------------------------------------------------------------
  // Dispatch
  // ---------------------------------------------------------------------------

  B.METHODS = {
    str: STR, list: LIST, tuple: TUPLE, dict: DICT, set: SET, frozenset: SET,
    bytes: BYTES, bytearray: BYTES, int: INT, bool: INT, float: FLOAT,
    complex: COMPLEX, generator: GEN, iterator: ITER, range: RANGE,
    property: PROPERTY
  };

  var NATIVE_PROPS = {
    range: { start: function (v) { return v.start; }, stop: function (v) { return v.stop; }, step: function (v) { return v.step; } },
    slice: { start: function (v) { return v.start; }, stop: function (v) { return v.stop; }, step: function (v) { return v.step; } },
    complex: { real: function (v) { return v.re; }, imag: function (v) { return v.im; } },
    int: { real: function (v) { return v; }, imag: function () { return 0n; }, numerator: function (v) { return v; }, denominator: function () { return 1n; } },
    float: { real: function (v) { return v; }, imag: function () { return 0.0; } }
  };

  B.getMethod = function (interp, obj, name) {
    var tn = typeName(obj);
    if (obj && obj.__nativeAttrs__ && (name in obj.__nativeAttrs__)) {
      var na = obj.__nativeAttrs__[name];
      return (typeof na === 'function' && !(na instanceof PyBuiltin)) ? na(obj, interp) : na;
    }
    var props = NATIVE_PROPS[tn];
    if (props && props[name]) return props[name](obj);

    var table = B.METHODS[tn];
    if (obj instanceof PyIterator) table = ITER;
    if (obj instanceof PyGenerator) table = GEN;
    if (!table) return undefined;
    var fn = table[name];
    if (typeof fn !== 'function') return undefined;
    return new PyBuiltin(name, function (args, kwargs, it) {
      return fn(obj, args, kwargs || null, it);
    });
  };

  // Type-level access such as str.upper('x') and bytes.fromhex('4142').
  B.installTypeMethods = function (interp) {
    ['str', 'list', 'tuple', 'dict', 'set', 'frozenset', 'bytes', 'bytearray', 'int', 'float'].forEach(function (tn) {
      var cls = interp.builtinsMap.get(tn);
      if (!cls) return;
      var table = B.METHODS[tn];
      Object.keys(table).forEach(function (mName) {
        var fn = table[mName];
        if (typeof fn !== 'function') return;
        if (fn.isStatic) {
          cls.dict.set(mName, new PyBuiltin(mName, function (args, kwargs, it) {
            return fn(null, args, kwargs || null, it);
          }));
        } else {
          cls.dict.set(mName, new PyBuiltin(mName, function (args, kwargs, it) {
            return fn(args[0], args.slice(1), kwargs || null, it);
          }));
        }
      });
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
