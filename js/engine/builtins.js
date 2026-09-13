/* ============================================================================
 * builtins.js — Built-in functions plus the format mini-language.
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
      PyIterator = O.PyIterator, PyComplex = O.PyComplex,
      PyError = O.PyError,
      truthy = O.truthy, repr = O.repr, str = O.str, typeName = O.typeName,
      eq = O.eq, compare = O.compare, toBigInt = O.toBigInt, toNumber = O.toNumber,
      isNum = O.isNum;

  var B = {};
  root.PyBuiltins = B;

  // --- small helpers ---------------------------------------------------------

  function kwGet(kwargs, name, dflt) {
    if (!kwargs) return dflt;
    return kwargs.has(name) ? kwargs.get(name) : dflt;
  }
  function argErr(interp, msg) { interp.typeError(msg); }

  B.bytesToLatin1 = function (bv) {
    var s = '';
    for (var i = 0; i < bv.b.length; i++) s += String.fromCharCode(bv.b[i]);
    return s;
  };
  B.latin1ToBytes = function (s) {
    var a = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 0xff;
    return new PyBytes(a);
  };
  B.utf8Encode = function (s) {
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.codePointAt(i);
      if (c > 0xffff) i++;
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 63)); }
      else if (c < 0x10000) { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
      else { out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
    }
    return new Uint8Array(out);
  };
  B.utf8Decode = function (bytes, interp, errors) {
    var out = '';
    var i = 0;
    while (i < bytes.length) {
      var b0 = bytes[i];
      if (b0 < 0x80) { out += String.fromCharCode(b0); i++; continue; }
      var n, cp;
      if ((b0 & 0xe0) === 0xc0) { n = 1; cp = b0 & 31; }
      else if ((b0 & 0xf0) === 0xe0) { n = 2; cp = b0 & 15; }
      else if ((b0 & 0xf8) === 0xf0) { n = 3; cp = b0 & 7; }
      else {
        if (errors === 'replace') { out += '\ufffd'; i++; continue; }
        if (errors === 'ignore') { i++; continue; }
        if (interp) interp.throwPy('UnicodeDecodeError',
          "'utf-8' codec can't decode byte 0x" + b0.toString(16) + ' in position ' + i + ': invalid start byte');
        out += '\ufffd'; i++; continue;
      }
      if (i + n >= bytes.length + 0 && i + n > bytes.length - 1) {
        if (errors === 'replace') { out += '\ufffd'; i++; continue; }
        if (errors === 'ignore') { i++; continue; }
        if (interp) interp.throwPy('UnicodeDecodeError', "'utf-8' codec can't decode bytes: unexpected end of data");
        out += '\ufffd'; break;
      }
      var ok = true;
      for (var k = 1; k <= n; k++) {
        var bx = bytes[i + k];
        if (bx === undefined || (bx & 0xc0) !== 0x80) { ok = false; break; }
        cp = (cp << 6) | (bx & 63);
      }
      if (!ok) {
        if (errors === 'replace') { out += '\ufffd'; i++; continue; }
        if (errors === 'ignore') { i++; continue; }
        if (interp) interp.throwPy('UnicodeDecodeError', "'utf-8' codec can't decode byte 0x" + b0.toString(16) + ' in position ' + i + ': invalid continuation byte');
        out += '\ufffd'; i++; continue;
      }
      out += String.fromCodePoint(cp);
      i += n + 1;
    }
    return out;
  };

  B.toBytesLike = function (interp, v) {
    if (v instanceof PyBytes) return v;
    if (typeof v === 'string') return new PyBytes(B.utf8Encode(v));
    if (v instanceof PyList || v instanceof PyTuple) {
      return new PyBytes(v.items.map(function (x) { return Number(toBigInt(x)) & 0xff; }));
    }
    interp.typeError('expected bytes-like object, not ' + typeName(v));
  };

  // ---------------------------------------------------------------------------
  // Format mini-language
  // ---------------------------------------------------------------------------

  var SPEC_RE = /^(?:(.)?([<>=^]))?([-+ ])?(z)?(#)?(0)?(\d+)?([,_])?(?:\.(\d+))?([bcdeEfFgGnosxX%])?$/;

  function groupDigits(digits, sep, interval) {
    interval = interval || 3;
    var out = '';
    var count = 0;
    for (var i = digits.length - 1; i >= 0; i--) {
      out = digits[i] + out;
      count++;
      if (count % interval === 0 && i > 0) out = sep + out;
    }
    return out;
  }

  function expFormat(x, precision, upper) {
    var s = x.toExponential(precision);
    var m = /^(-?[\d.]+)e([+-])(\d+)$/.exec(s);
    if (m) s = m[1] + 'e' + m[2] + (m[3].length < 2 ? '0' + m[3] : m[3]);
    return upper ? s.toUpperCase() : s;
  }

  function gFormat(x, precision, upper, alt) {
    if (precision === 0) precision = 1;
    var exp = x === 0 ? 0 : Math.floor(Math.log10(Math.abs(x)));
    var s;
    if (exp < -4 || exp >= precision) {
      s = expFormat(x, precision - 1, false);
      if (!alt) s = s.replace(/\.?0+e/, 'e');
    } else {
      s = x.toFixed(Math.max(0, precision - 1 - exp));
      if (!alt && s.indexOf('.') >= 0) s = s.replace(/\.?0+$/, '');
    }
    return upper ? s.toUpperCase() : s;
  }

  B.formatValue = function (interp, value, spec) {
    if (!spec) {
      if (value instanceof PyInstance) {
        var fm0 = value.__class__.lookup('__format__');
        if (fm0) return str(interp.callSync(interp.bindDescriptor(fm0, value, value.__class__), [''], null));
      }
      return str(value);
    }
    if (value instanceof PyInstance) {
      var fm = value.__class__.lookup('__format__');
      if (fm) return str(interp.callSync(interp.bindDescriptor(fm, value, value.__class__), [spec], null));
    }
    var m = SPEC_RE.exec(spec);
    if (!m) interp.valueError("Invalid format specifier '" + spec + "'");
    var fill = m[1], align = m[2], sign = m[3] || '-', alt = !!m[5],
        zero = !!m[6], width = m[7] ? parseInt(m[7], 10) : 0,
        group = m[8], precision = m[9] !== undefined ? parseInt(m[9], 10) : null,
        type = m[10] || null;

    if (zero && !align) { align = '='; if (!fill) fill = '0'; }
    if (!fill) fill = ' ';

    var body, negative = false, prefix = '';

    var isIntVal = typeof value === 'bigint' || typeof value === 'boolean';
    var isFloatVal = typeof value === 'number';

    if (type === null && (isIntVal || isFloatVal)) type = isIntVal ? 'd' : null;

    if (type === 's' || (type === null && typeof value === 'string')) {
      body = str(value);
      if (precision !== null) body = body.slice(0, precision);
      if (!align) align = '<';
    } else if (type === 'c') {
      body = String.fromCodePoint(Number(toBigInt(value)));
      if (!align) align = '<';
    } else if (isIntVal || (isFloatVal && 'bodxXn'.indexOf(type) >= 0)) {
      var n = toBigInt(value);
      negative = n < 0n;
      var abs = negative ? -n : n;
      switch (type) {
        case 'b': body = abs.toString(2); if (alt) prefix = '0b'; break;
        case 'o': body = abs.toString(8); if (alt) prefix = '0o'; break;
        case 'x': body = abs.toString(16); if (alt) prefix = '0x'; break;
        case 'X': body = abs.toString(16).toUpperCase(); if (alt) prefix = '0X'; break;
        case 'n': case 'd': case null: default: body = abs.toString(10); break;
      }
      if (group) body = groupDigits(body, group === ',' ? ',' : '_', type === 'x' || type === 'X' || type === 'b' || type === 'o' ? 4 : 3);
      if (!align) align = '>';
    } else if (isFloatVal || isIntVal) {
      var x = toNumber(value);
      negative = x < 0 || Object.is(x, -0);
      var ax = Math.abs(x);
      if (!isFinite(ax)) {
        body = Number.isNaN(ax) ? 'nan' : 'inf';
        if (type === 'E' || type === 'G' || type === 'F') body = body.toUpperCase();
        zero = false;
      } else {
        switch (type) {
          case 'e': body = expFormat(ax, precision === null ? 6 : precision, false); break;
          case 'E': body = expFormat(ax, precision === null ? 6 : precision, true); break;
          case 'f': case 'F': body = ax.toFixed(precision === null ? 6 : precision); break;
          case '%': body = (ax * 100).toFixed(precision === null ? 6 : precision) + '%'; break;
          case 'g': body = gFormat(ax, precision === null ? 6 : precision, false, alt); break;
          case 'G': body = gFormat(ax, precision === null ? 6 : precision, true, alt); break;
          case 'n': body = precision === null ? String(ax) : gFormat(ax, precision, false, alt); break;
          default:
            if (precision !== null) body = gFormat(ax, precision, false, alt);
            else {
              body = O.floatRepr(ax);
            }
        }
        if (group) {
          var dot = body.indexOf('.');
          var ip = dot < 0 ? body : body.slice(0, dot);
          var fp = dot < 0 ? '' : body.slice(dot);
          var epos = ip.indexOf('e');
          if (epos < 0) body = groupDigits(ip, group === ',' ? ',' : '_') + fp;
        }
      }
      if (!align) align = '>';
    } else {
      body = str(value);
      if (precision !== null) body = body.slice(0, precision);
      if (!align) align = '<';
    }

    var signStr = negative ? '-' : (sign === '+' ? '+' : (sign === ' ' ? ' ' : ''));
    var head = signStr + prefix;
    var total = head.length + body.length;
    if (width > total) {
      var pad = width - total;
      if (align === '<') return head + body + fill.repeat(pad);
      if (align === '>') return fill.repeat(pad) + head + body;
      if (align === '=') return head + fill.repeat(pad) + body;
      var left = Math.floor(pad / 2);
      return fill.repeat(left) + head + body + fill.repeat(pad - left);
    }
    return head + body;
  };

  // --- str.format / % formatting --------------------------------------------

  B.strFormat = function (interp, template, args, kwargs) {
    var out = '';
    var i = 0;
    var autoIndex = 0;
    while (i < template.length) {
      var c = template[i];
      if (c === '{') {
        if (template[i + 1] === '{') { out += '{'; i += 2; continue; }
        var depth = 1, j = i + 1;
        while (j < template.length && depth > 0) {
          if (template[j] === '{') depth++;
          else if (template[j] === '}') { depth--; if (depth === 0) break; }
          j++;
        }
        if (depth !== 0) interp.valueError("Single '{' encountered in format string");
        var field = template.slice(i + 1, j);
        i = j + 1;
        var spec = '', conv = null;
        var d2 = 0, cut = -1;
        for (var k = 0; k < field.length; k++) {
          if (field[k] === '[') d2++;
          else if (field[k] === ']') d2--;
          else if (field[k] === ':' && d2 === 0) { cut = k; break; }
        }
        var namePart = field;
        if (cut >= 0) { namePart = field.slice(0, cut); spec = field.slice(cut + 1); }
        var cm = /!([rsa])$/.exec(namePart);
        if (cm) { conv = cm[1]; namePart = namePart.slice(0, cm.index); }
        if (spec.indexOf('{') >= 0) {
          spec = B.strFormat(interp, spec, args, kwargs);
        }
        var value;
        var mainName = namePart, accessors = [];
        var am = /^([^.[]*)/.exec(namePart);
        mainName = am[1];
        var rest = namePart.slice(mainName.length);
        var accRe = /\.([A-Za-z_]\w*)|\[([^\]]*)\]/g, mm;
        while ((mm = accRe.exec(rest))) {
          if (mm[1] !== undefined) accessors.push({ attr: mm[1] });
          else accessors.push({ item: mm[2] });
        }
        if (mainName === '') {
          if (autoIndex >= args.length) interp.indexError('Replacement index ' + autoIndex + ' out of range');
          value = args[autoIndex++];
        } else if (/^\d+$/.test(mainName)) {
          var idx = parseInt(mainName, 10);
          if (idx >= args.length) interp.indexError('Replacement index ' + idx + ' out of range');
          value = args[idx];
        } else {
          if (!kwargs || !kwargs.has(mainName)) interp.keyError(mainName);
          value = kwargs.get(mainName);
        }
        for (var a = 0; a < accessors.length; a++) {
          if (accessors[a].attr !== undefined) value = interp.getattr(value, accessors[a].attr);
          else {
            var key = accessors[a].item;
            value = interp.getitem(value, /^-?\d+$/.test(key) ? BigInt(key) : key);
          }
        }
        var text;
        if (conv === 'r' || conv === 'a') text = repr(value);
        else if (conv === 's') text = str(value);
        else text = null;
        out += text === null ? B.formatValue(interp, value, spec) : (spec ? B.formatValue(interp, text, spec) : text);
        continue;
      }
      if (c === '}') {
        if (template[i + 1] === '}') { out += '}'; i += 2; continue; }
        interp.valueError("Single '}' encountered in format string");
      }
      out += c;
      i++;
    }
    return out;
  };

  B.percentFormat = function (interp, fmt, argv) {
    var args;
    var mapping = null;
    if (argv instanceof PyTuple) args = argv.items.slice();
    else if (argv instanceof PyDict) { mapping = argv; args = [argv]; }
    else args = [argv];
    var ai = 0;
    var out = '';
    var i = 0;
    var re = /^%(\([^)]*\))?([-+ #0]*)(\*|\d+)?(?:\.(\*|\d+))?[hlL]?([diouxXeEfFgGcrsab%])/;
    while (i < fmt.length) {
      if (fmt[i] !== '%') { out += fmt[i++]; continue; }
      var m = re.exec(fmt.slice(i));
      if (!m) interp.valueError('incomplete format');
      i += m[0].length;
      var key = m[1], flags = m[2] || '', widthS = m[3], precS = m[4], conv = m[5];
      if (conv === '%') { out += '%'; continue; }
      var width = widthS === '*' ? Number(toBigInt(args[ai++])) : (widthS ? parseInt(widthS, 10) : 0);
      var prec = precS === '*' ? Number(toBigInt(args[ai++])) : (precS !== undefined ? parseInt(precS, 10) : null);
      var value;
      if (key) {
        if (!mapping) interp.typeError('format requires a mapping');
        var kk = key.slice(1, -1);
        if (!mapping.has(kk)) interp.keyError(kk);
        value = mapping.get(kk);
      } else {
        if (ai >= args.length) interp.typeError('not enough arguments for format string');
        value = args[ai++];
      }
      var spec = '';
      if (flags.indexOf('-') >= 0) spec += '<';
      if (flags.indexOf('+') >= 0) spec += '+';
      else if (flags.indexOf(' ') >= 0) spec += ' ';
      if (flags.indexOf('#') >= 0) spec += '#';
      if (flags.indexOf('0') >= 0 && flags.indexOf('-') < 0) spec += '0';
      if (width) spec += width;
      if (prec !== null && 'eEfFgG'.indexOf(conv) >= 0) spec += '.' + prec;
      var piece;
      switch (conv) {
        case 'd': case 'i': case 'u':
          piece = B.formatValue(interp, isNum(value) ? toBigInt(value) : toBigInt(value), spec + 'd'); break;
        case 'o': piece = B.formatValue(interp, toBigInt(value), spec + 'o'); break;
        case 'x': piece = B.formatValue(interp, toBigInt(value), spec + 'x'); break;
        case 'X': piece = B.formatValue(interp, toBigInt(value), spec + 'X'); break;
        case 'e': case 'E': case 'f': case 'F': case 'g': case 'G':
          piece = B.formatValue(interp, toNumber(value), spec + conv); break;
        case 'c': piece = typeof value === 'string' ? value : String.fromCodePoint(Number(toBigInt(value))); break;
        case 'r': piece = repr(value); if (prec !== null) piece = piece.slice(0, prec); piece = B.formatValue(interp, piece, spec + 's'); break;
        case 'a': piece = repr(value); break;
        case 'b': piece = B.formatValue(interp, toBigInt(value), spec + 'b'); break;
        case 's': default: {
          var s0 = str(value);
          if (prec !== null) s0 = s0.slice(0, prec);
          piece = B.formatValue(interp, s0, spec ? spec + 's' : '');
          break;
        }
      }
      out += piece;
    }
    if (!mapping && ai < args.length && !(argv instanceof PyDict)) {
      interp.typeError('not all arguments converted during string formatting');
    }
    return out;
  };

  // ---------------------------------------------------------------------------
  // Conversions used by several builtins
  // ---------------------------------------------------------------------------

  B.pyInt = function (interp, v, base) {
    if (v === undefined) return 0n;
    if (typeof v === 'bigint') return v;
    if (typeof v === 'boolean') return v ? 1n : 0n;
    if (typeof v === 'number') {
      if (!isFinite(v)) interp.throwPy(Number.isNaN(v) ? 'ValueError' : 'OverflowError', 'cannot convert float infinity/NaN to integer');
      return BigInt(Math.trunc(v));
    }
    if (typeof v === 'string' || v instanceof PyBytes) {
      var s = (typeof v === 'string' ? v : B.utf8Decode(v.b)).trim();
      var b = base === undefined || base === null ? 10 : Number(toBigInt(base));
      var neg = false;
      if (s[0] === '+' || s[0] === '-') { neg = s[0] === '-'; s = s.slice(1); }
      s = s.replace(/_/g, '');
      if (b === 0) {
        if (/^0[xX]/.test(s)) { b = 16; s = s.slice(2); }
        else if (/^0[bB]/.test(s)) { b = 2; s = s.slice(2); }
        else if (/^0[oO]/.test(s)) { b = 8; s = s.slice(2); }
        else b = 10;
      } else if (b === 16 && /^0[xX]/.test(s)) s = s.slice(2);
      else if (b === 2 && /^0[bB]/.test(s)) s = s.slice(2);
      else if (b === 8 && /^0[oO]/.test(s)) s = s.slice(2);
      if (!s.length) interp.valueError("invalid literal for int() with base " + b + ": " + repr(typeof v === 'string' ? v : str(v)));
      var digits = '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, b);
      var acc = 0n, big = BigInt(b);
      for (var i = 0; i < s.length; i++) {
        var d = digits.indexOf(s[i].toLowerCase());
        if (d < 0) interp.valueError("invalid literal for int() with base " + b + ": " + repr(typeof v === 'string' ? v : str(v)));
        acc = acc * big + BigInt(d);
      }
      return neg ? -acc : acc;
    }
    if (v instanceof PyInstance) {
      var m = v.__class__.lookup('__int__') || v.__class__.lookup('__index__');
      if (m) return toBigInt(interp.callSync(interp.bindDescriptor(m, v, v.__class__), [], null));
    }
    interp.typeError("int() argument must be a string or a number, not '" + typeName(v) + "'");
  };

  B.pyFloat = function (interp, v) {
    if (v === undefined) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'bigint') return Number(v);
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'string') {
      var s = v.trim().replace(/_/g, '');
      if (/^[+-]?(inf|infinity)$/i.test(s)) return s[0] === '-' ? -Infinity : Infinity;
      if (/^[+-]?nan$/i.test(s)) return NaN;
      if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) {
        interp.valueError('could not convert string to float: ' + repr(v));
      }
      return parseFloat(s);
    }
    if (v instanceof PyInstance) {
      var m = v.__class__.lookup('__float__');
      if (m) return toNumber(interp.callSync(interp.bindDescriptor(m, v, v.__class__), [], null));
    }
    interp.typeError("float() argument must be a string or a number, not '" + typeName(v) + "'");
  };

  B.sortKeyed = function (interp, arr, keyFn, reverse) {
    var decorated = arr.map(function (v, i) {
      return { k: keyFn ? interp.callSync(keyFn, [v], null) : v, i: i, v: v };
    });
    decorated.sort(function (a, b) {
      var c;
      try { c = compare(a.k, b.k); }
      catch (e) { throw interp.wrapJsError(e); }
      if (c !== 0) return c;
      return a.i - b.i;
    });
    if (reverse) decorated.reverse();
    return decorated.map(function (d) { return d.v; });
  };

  // ---------------------------------------------------------------------------
  // install()
  // ---------------------------------------------------------------------------

  B.install = function (interp) {
    var map = new Map();
    interp.builtinsMap = map;

    function def(name, fn, opts) { map.set(name, new PyBuiltin(name, fn, opts)); }

    // Wire the object-model hooks so repr()/hash()/bool() can call dunders.
    O.hooks.callSync = function (fn, args, kwargs) { return interp.callSync(fn, args, kwargs); };
    O.hooks.lookupSpecial = function (obj, name) {
      if (!(obj instanceof PyInstance)) return undefined;
      var m = obj.__class__.lookup(name);
      if (!m) return undefined;
      return interp.bindDescriptor(m, obj, obj.__class__);
    };

    // --- object / type ------------------------------------------------------
    var objectClass = new PyClass('object', [], new Map());
    interp.objectClass = objectClass;
    map.set('object', objectClass);

    Object.keys(interp.exceptionClasses).forEach(function (k) {
      map.set(k, interp.exceptionClasses[k]);
    });

    map.set('__name__', '__main__');
    map.set('NotImplemented', O.NOT_IMPLEMENTED);
    map.set('Ellipsis', { __ellipsis__: true, pytype: 'ellipsis' });

    // --- output / input ------------------------------------------------------
    def('print', function (args, kwargs, it) {
      var sep = kwGet(kwargs, 'sep', ' ');
      var end = kwGet(kwargs, 'end', '\n');
      if (sep === null) sep = ' ';
      if (end === null) end = '\n';
      var parts = args.map(function (a) { return str(a); });
      it.write(parts.join(sep) + end);
      return null;
    });

    def('input', function (args, kwargs, it) {
      var prompt = args.length ? str(args[0]) : '';
      if (prompt) it.write(prompt);
      if (!it.inputQueue.length) {
        it.throwPy('EOFError', 'EOF when reading a line (no more input was provided to this program)');
      }
      var line = it.inputQueue.shift();
      if (it.inputEcho) it.write(line + '\n');
      return line;
    });

    // --- type constructors ----------------------------------------------------
    def('len', function (args, k, it) { return it.len(args[0]); });
    function makeTypeClass(name, ctor) {
      var cls = new PyClass(name, [objectClass], new Map(), { nativeNew: ctor });
      map.set(name, cls);
      return cls;
    }

    makeTypeClass('int', function (args, kwargs, it) {
      return B.pyInt(it, args[0], args.length > 1 ? args[1] : kwGet(kwargs, 'base', undefined));
    });
    makeTypeClass('float', function (args, k, it) { return B.pyFloat(it, args[0]); });
    makeTypeClass('str', function (args, kwargs, it) {
      if (!args.length) return '';
      if (args[0] instanceof PyBytes && (args.length > 1 || (kwargs && kwargs.has('encoding')))) {
        return B.utf8Decode(args[0].b, it, 'strict');
      }
      return str(args[0]);
    });
    makeTypeClass('bool', function (args, k, it) { return args.length ? truthy(args[0]) : false; });
    makeTypeClass('list', function (args, k, it) { return new PyList(args.length ? it.toArray(args[0]) : []); });
    makeTypeClass('tuple', function (args, k, it) { return new PyTuple(args.length ? it.toArray(args[0]) : []); });
    makeTypeClass('set', function (args, k, it) { return new PySet(args.length ? it.toArray(args[0]) : []); });
    makeTypeClass('frozenset', function (args, k, it) { return new PySet(args.length ? it.toArray(args[0]) : [], true); });
    makeTypeClass('dict', function (args, kwargs, it) {
      var d = new PyDict();
      if (args.length) {
        var src = args[0];
        if (src instanceof PyDict) src.map.forEach(function (e) { d.set(e.k, e.v); });
        else {
          it.toArray(src).forEach(function (pair) {
            var p = it.toArray(pair);
            if (p.length !== 2) it.valueError('dictionary update sequence element has length ' + p.length + '; 2 is required');
            d.set(p[0], p[1]);
          });
        }
      }
      if (kwargs) kwargs.map.forEach(function (e) { d.set(e.k, e.v); });
      return d;
    });
    makeTypeClass('bytes', function (args, kwargs, it) {
      if (!args.length) return new PyBytes([]);
      var v = args[0];
      if (typeof v === 'string') {
        var enc = args.length > 1 ? str(args[1]) : str(kwGet(kwargs, 'encoding', 'utf-8'));
        if (/latin|8859/i.test(enc)) return B.latin1ToBytes(v);
        return new PyBytes(B.utf8Encode(v));
      }
      if (isNum(v)) return new PyBytes(new Uint8Array(Number(toBigInt(v))));
      if (v instanceof PyBytes) return new PyBytes(v.b.slice());
      return new PyBytes(it.toArray(v).map(function (x) {
        var n = Number(toBigInt(x));
        if (n < 0 || n > 255) it.valueError('bytes must be in range(0, 256)');
        return n;
      }));
    });
    makeTypeClass('bytearray', function (args, kwargs, it) {
      var b = map.get('bytes').nativeNew(args, kwargs, it);
      return new PyBytes(b.b.slice(), true);
    });
    makeTypeClass('complex', function (args, k, it) {
      var re = args.length ? toNumber(B.pyFloat(it, args[0])) : 0;
      var im = args.length > 1 ? toNumber(B.pyFloat(it, args[1])) : 0;
      return new PyComplex(re, im);
    });
    makeTypeClass('type', function (args, kwargs, it) {
      if (args.length === 3) {
        var nm = str(args[0]);
        var bs = args[1] instanceof PyTuple ? args[1].items : [];
        var d = new Map();
        if (args[2] instanceof PyDict) args[2].map.forEach(function (e) { d.set(str(e.k), e.v); });
        return new PyClass(nm, bs.length ? bs : [objectClass], d);
      }
      var v = args[0];
      if (v instanceof PyInstance) return v.__class__;
      if (v instanceof PyClass) return map.get('type');
      var tn = typeName(v);
      var known = map.get(tn);
      if (known instanceof PyClass) return known;
      var made = new PyClass(tn, [objectClass], new Map());
      map.set(tn, made);
      return made;
    });
    makeTypeClass('range', function (args, k, it) {
      var a = args.map(function (x) { return toBigInt(x); });
      if (a.length === 1) return new PyRange(0n, a[0], 1n);
      if (a.length === 2) return new PyRange(a[0], a[1], 1n);
      if (a.length >= 3) {
        if (a[2] === 0n) it.valueError('range() arg 3 must not be zero');
        return new PyRange(a[0], a[1], a[2]);
      }
      it.typeError('range expected at least 1 argument, got 0');
    });
    makeTypeClass('slice', function (args, k, it) {
      if (args.length === 1) return new PySlice(null, args[0], null);
      return new PySlice(args[0], args[1], args.length > 2 ? args[2] : null);
    });

    // --- numeric ---------------------------------------------------------------
    def('abs', function (args, k, it) {
      var v = args[0];
      if (typeof v === 'bigint') return v < 0n ? -v : v;
      if (typeof v === 'boolean') return v ? 1n : 0n;
      if (typeof v === 'number') return Math.abs(v);
      if (v instanceof PyComplex) return Math.sqrt(v.re * v.re + v.im * v.im);
      if (v instanceof PyInstance) {
        var m = v.__class__.lookup('__abs__');
        if (m) return it.callSync(it.bindDescriptor(m, v, v.__class__), [], null);
      }
      it.typeError("bad operand type for abs(): '" + typeName(v) + "'");
    });
    def('round', function (args, kwargs, it) {
      var v = args[0];
      var nd = args.length > 1 ? args[1] : kwGet(kwargs, 'ndigits', null);
      var noDigits = (nd === null || nd === undefined);
      if (typeof v === 'bigint' || typeof v === 'boolean') {
        var iv = toBigInt(v);
        if (noDigits) return iv;
        var d0 = Number(toBigInt(nd));
        if (d0 >= 0) return iv;
        return roundBigToPlaces(iv, d0);
      }
      if (v instanceof PyInstance) {
        var rm = v.__class__.lookup('__round__');
        if (rm) return it.callSync(it.bindDescriptor(rm, v, v.__class__), noDigits ? [] : [nd], null);
      }
      var x = toNumber(v);
      if (!isFinite(x)) {
        if (noDigits) it.throwPy(Number.isNaN(x) ? 'ValueError' : 'OverflowError', 'cannot convert float to integer');
        return x;
      }
      var digits = noDigits ? 0 : Number(toBigInt(nd));
      var q = roundExact(x, digits);
      if (noDigits) return q;
      var scaled = digits >= 0 ? Number(q) / Math.pow(10, digits) : Number(q) * Math.pow(10, -digits);
      return scaled === 0 ? 0 * Math.sign(x || 1) : scaled;
    });
    def('divmod', function (args, k, it) {
      var q = it.numericOp('//', args[0], args[1]);
      var r = it.numericOp('%', args[0], args[1]);
      return new PyTuple([q, r]);
    });
    def('pow', function (args, k, it) {
      if (args.length >= 3 && args[2] !== null) {
        var b = toBigInt(args[0]), e = toBigInt(args[1]), m = toBigInt(args[2]);
        if (m === 0n) it.valueError('pow() 3rd argument cannot be 0');
        if (e < 0n) {
          var inv = modInverse(b, m, it);
          b = inv; e = -e;
        }
        return modPow(b, e, m);
      }
      return it.numericOp('**', args[0], args[1]);
    });
    def('sum', function (args, k, it) {
      var items = it.toArray(args[0]);
      var acc = args.length > 1 ? args[1] : 0n;
      for (var i = 0; i < items.length; i++) acc = it.runSync(it.binop('+', acc, items[i]));
      return acc;
    });
    def('min', function (args, kwargs, it) { return minmax(it, args, kwargs, -1); });
    def('max', function (args, kwargs, it) { return minmax(it, args, kwargs, 1); });

    function minmax(it, args, kwargs, dir) {
      var keyFn = kwGet(kwargs, 'key', null);
      var dflt = kwargs && kwargs.has('default') ? kwargs.get('default') : undefined;
      var items = args.length === 1 ? it.toArray(args[0]) : args.slice();
      if (!items.length) {
        if (dflt !== undefined) return dflt;
        it.valueError((dir > 0 ? 'max' : 'min') + '() arg is an empty sequence');
      }
      var best = items[0];
      var bestKey = keyFn ? it.callSync(keyFn, [best], null) : best;
      for (var i = 1; i < items.length; i++) {
        var k = keyFn ? it.callSync(keyFn, [items[i]], null) : items[i];
        var c;
        try { c = compare(k, bestKey); } catch (e) { throw it.wrapJsError(e); }
        if (dir > 0 ? c > 0 : c < 0) { best = items[i]; bestKey = k; }
      }
      return best;
    }

    // --- iterables ---------------------------------------------------------------
    def('sorted', function (args, kwargs, it) {
      var arr = it.toArray(args[0]);
      var keyFn = kwGet(kwargs, 'key', null);
      var rev = truthy(kwGet(kwargs, 'reverse', false));
      return new PyList(B.sortKeyed(it, arr, keyFn, rev));
    });
    def('reversed', function (args, k, it) {
      var v = args[0];
      if (v instanceof PyInstance) {
        var m = v.__class__.lookup('__reversed__');
        if (m) return it.callSync(it.bindDescriptor(m, v, v.__class__), [], null);
      }
      var arr = it.toArray(v).slice().reverse();
      var i = 0;
      var iter = new PyIterator(function () { return i < arr.length ? { value: arr[i++], done: false } : { done: true }; }, 'reversed');
      iter.__reprNative__ = function () { return '<reversed object>'; };
      return iter;
    });
    def('enumerate', function (args, kwargs, it) {
      var arr = it.iter(args[0]);
      var start = args.length > 1 ? toBigInt(args[1]) : toBigInt(kwGet(kwargs, 'start', 0n));
      var i = start;
      var iter = new PyIterator(function () {
        var r = arr.next();
        if (r.done) return { done: true };
        return { value: new PyTuple([i++, r.value]), done: false };
      }, 'enumerate');
      iter.__reprNative__ = function () { return '<enumerate object>'; };
      return iter;
    });
    def('zip', function (args, kwargs, it) {
      var strict = truthy(kwGet(kwargs, 'strict', false));
      var iters = args.map(function (a) { return it.iter(a); });
      var iter = new PyIterator(function () {
        if (!iters.length) return { done: true };
        var vals = [];
        var anyDone = false, allDone = true;
        for (var i = 0; i < iters.length; i++) {
          var r = iters[i].next();
          if (r.done) { anyDone = true; }
          else { allDone = false; vals.push(r.value); }
        }
        if (anyDone) {
          if (strict && !allDone) it.valueError('zip() argument ' + (vals.length + 1) + ' is shorter than argument 1');
          return { done: true };
        }
        return { value: new PyTuple(vals), done: false };
      }, 'zip');
      iter.__reprNative__ = function () { return '<zip object>'; };
      return iter;
    });
    def('map', function (args, k, it) {
      var fn = args[0];
      var iters = args.slice(1).map(function (a) { return it.iter(a); });
      var iter = new PyIterator(function () {
        var vals = [];
        for (var i = 0; i < iters.length; i++) {
          var r = iters[i].next();
          if (r.done) return { done: true };
          vals.push(r.value);
        }
        return { value: it.callSync(fn, vals, null), done: false };
      }, 'map');
      iter.__reprNative__ = function () { return '<map object>'; };
      return iter;
    });
    def('filter', function (args, k, it) {
      var fn = args[0];
      var src = it.iter(args[1]);
      var iter = new PyIterator(function () {
        for (;;) {
          it.tick();
          var r = src.next();
          if (r.done) return { done: true };
          var keep = fn === null ? truthy(r.value) : truthy(it.callSync(fn, [r.value], null));
          if (keep) return { value: r.value, done: false };
        }
      }, 'filter');
      iter.__reprNative__ = function () { return '<filter object>'; };
      return iter;
    });
    def('any', function (args, k, it) {
      var i = it.iter(args[0]);
      for (;;) { it.tick(); var r = i.next(); if (r.done) return false; if (truthy(r.value)) return true; }
    });
    def('all', function (args, k, it) {
      var i = it.iter(args[0]);
      for (;;) { it.tick(); var r = i.next(); if (r.done) return true; if (!truthy(r.value)) return false; }
    });
    def('iter', function (args, k, it) {
      if (args.length === 2) {
        var callable = args[0], sentinel = args[1];
        var done = false;
        return new PyIterator(function () {
          if (done) return { done: true };
          var v = it.callSync(callable, [], null);
          if (eq(v, sentinel)) { done = true; return { done: true }; }
          return { value: v, done: false };
        }, 'callable_iterator');
      }
      var v0 = args[0];
      if (v0 instanceof PyGenerator || v0 instanceof PyIterator) return v0;
      var jsIt = it.iter(v0);
      return new PyIterator(function () { return jsIt.next(); }, 'iterator');
    });
    def('next', function (args, k, it) {
      var g = args[0];
      if (g instanceof PyGenerator) {
        var r = it.genResume(g, null, null);
        if (r.done) {
          if (args.length > 1) return args[1];
          throw new PyError(it.makeExc('StopIteration'));
        }
        return r.value;
      }
      if (g instanceof PyIterator) {
        var r2 = g.nextFn();
        if (r2.done) {
          if (args.length > 1) return args[1];
          throw new PyError(it.makeExc('StopIteration'));
        }
        return r2.value;
      }
      if (g instanceof PyInstance) {
        var m = g.__class__.lookup('__next__');
        if (m) {
          try { return it.callSync(it.bindDescriptor(m, g, g.__class__), [], null); }
          catch (e) {
            if (args.length > 1 && e instanceof PyError && e.exc.__class__.isSubclassOf(it.exceptionClasses.StopIteration)) return args[1];
            throw e;
          }
        }
      }
      it.typeError("'" + typeName(g) + "' object is not an iterator");
    });

    // --- reflection ---------------------------------------------------------------
    def('isinstance', function (args, k, it) {
      var v = args[0], cls = args[1];
      return isInstanceOf(it, v, cls);
    });
    function isInstanceOf(it, v, cls) {
      if (cls instanceof PyTuple) {
        return cls.items.some(function (c) { return isInstanceOf(it, v, c); });
      }
      if (!(cls instanceof PyClass)) it.typeError('isinstance() arg 2 must be a type or tuple of types');
      if (v instanceof PyInstance) return v.__class__.isSubclassOf(cls);
      if (cls === objectClass) return true;
      var tn = typeName(v);
      if (cls.name === tn) return true;
      if (cls.name === 'int' && typeof v === 'boolean') return true;
      if (cls.name === 'float' && typeof v === 'number') return true;
      if (cls.name === 'object') return true;
      return false;
    }
    def('issubclass', function (args, k, it) {
      var c = args[0], p = args[1];
      if (!(c instanceof PyClass)) it.typeError('issubclass() arg 1 must be a class');
      if (p instanceof PyTuple) return p.items.some(function (x) { return c.isSubclassOf(x); });
      return c.isSubclassOf(p) || p === objectClass;
    });
    def('getattr', function (args, k, it) {
      return it.getattr(args[0], str(args[1]), args.length > 2 ? args[2] : undefined);
    });
    def('setattr', function (args, k, it) { it.setattr(args[0], str(args[1]), args[2]); return null; });
    def('delattr', function (args, k, it) { it.delattr(args[0], str(args[1])); return null; });
    def('hasattr', function (args, k, it) {
      try { it.getattr(args[0], str(args[1])); return true; }
      catch (e) { if (e instanceof PyError) return false; throw e; }
    });
    def('callable', function (args) { return O.isCallable(args[0]); });
    def('id', function (args) { return BigInt(parseInt(O.hashKey(args[0]).replace(/\D/g, '').slice(0, 12) || '1', 10) + 140000000); });
    def('hash', function (args, k, it) {
      it.checkHashable(args[0]);
      var s = O.hashKey(args[0]);
      var h = 0n;
      for (var i = 0; i < s.length; i++) h = (h * 31n + BigInt(s.charCodeAt(i))) % (2n ** 61n - 1n);
      return h;
    });
    def('repr', function (args) { return repr(args[0]); });
    def('ascii', function (args) { return repr(args[0]); });
    def('format', function (args, k, it) { return B.formatValue(it, args[0], args.length > 1 ? str(args[1]) : ''); });
    def('dir', function (args, k, it) {
      var out = [];
      var v = args[0];
      if (v === undefined) {
        it.globals.vars.forEach(function (_, key) { out.push(key); });
      } else if (v instanceof PyInstance) {
        v.__dict__.forEach(function (_, key) { out.push(key); });
        v.__class__.mro.forEach(function (c) { c.dict.forEach(function (_, key) { if (out.indexOf(key) < 0) out.push(key); }); });
      } else if (v instanceof PyClass) {
        v.mro.forEach(function (c) { c.dict.forEach(function (_, key) { if (out.indexOf(key) < 0) out.push(key); }); });
      } else if (v instanceof PyModule) {
        v.dict.forEach(function (_, key) { out.push(key); });
      } else {
        var tbl = B.METHODS[typeName(v)] || {};
        out = Object.keys(tbl);
      }
      out.sort();
      return new PyList(out);
    });
    def('vars', function (args, k, it) {
      var d = new PyDict();
      if (!args.length) { it.globals.vars.forEach(function (v, key) { d.set(key, v); }); return d; }
      var v = args[0];
      if (v instanceof PyInstance) v.__dict__.forEach(function (val, key) { d.set(key, val); });
      else if (v instanceof PyClass) v.dict.forEach(function (val, key) { d.set(key, val); });
      else if (v instanceof PyModule) v.dict.forEach(function (val, key) { d.set(key, val); });
      return d;
    });
    def('globals', function (args, k, it) {
      var d = new PyDict();
      it.globals.vars.forEach(function (v, key) { d.set(key, v); });
      return d;
    });
    def('locals', function (args, k, it) {
      var d = new PyDict();
      it.globals.vars.forEach(function (v, key) { d.set(key, v); });
      return d;
    });

    // --- character / number conversions --------------------------------------
    def('chr', function (args, k, it) {
      var n = Number(toBigInt(args[0]));
      if (n < 0 || n > 0x10ffff) it.valueError('chr() arg not in range(0x110000)');
      return String.fromCodePoint(n);
    });
    def('ord', function (args, k, it) {
      var v = args[0];
      if (v instanceof PyBytes) {
        if (v.b.length !== 1) it.typeError('ord() expected a character, but string of length ' + v.b.length + ' found');
        return BigInt(v.b[0]);
      }
      var s = str(v);
      var arr = Array.from(s);
      if (arr.length !== 1) it.typeError('ord() expected a character, but string of length ' + arr.length + ' found');
      return BigInt(s.codePointAt(0));
    });
    def('hex', function (args, k, it) {
      var n = toBigInt(args[0]);
      return (n < 0n ? '-0x' + (-n).toString(16) : '0x' + n.toString(16));
    });
    def('oct', function (args, k, it) {
      var n = toBigInt(args[0]);
      return (n < 0n ? '-0o' + (-n).toString(8) : '0o' + n.toString(8));
    });
    def('bin', function (args, k, it) {
      var n = toBigInt(args[0]);
      return (n < 0n ? '-0b' + (-n).toString(2) : '0b' + n.toString(2));
    });

    // --- misc ---------------------------------------------------------------------
    def('staticmethod', function (args) { return new PyStaticMethod(args[0]); });
    def('classmethod', function (args) { return new PyClassMethod(args[0]); });
    def('property', function (args, kwargs) {
      return new PyProperty(args[0] || kwGet(kwargs, 'fget', null),
        args[1] || kwGet(kwargs, 'fset', null),
        args[2] || kwGet(kwargs, 'fdel', null),
        args[3] || kwGet(kwargs, 'doc', null));
    });
    def('super', function (args, k, it) {
      if (args.length >= 2) return it.makeSuper(args[0], args[1]);
      it.typeError('super(): no arguments — use super() inside a method body');
    });
    def('exit', function (args, k, it) { it.throwPy('SystemExit', args.length ? str(args[0]) : ''); });
    def('quit', function (args, k, it) { it.throwPy('SystemExit', args.length ? str(args[0]) : ''); });
    def('help', function (args, k, it) {
      var v = args[0];
      if (v === undefined) { it.write('Type help(object) for help about an object.\n'); return null; }
      var doc = null;
      if (v instanceof PyFunction) doc = v.doc;
      else if (v instanceof PyClass) doc = v.lookup('__doc__');
      else if (v instanceof PyBuiltin) doc = v.doc;
      it.write((doc ? str(doc) : 'No documentation found for ' + repr(v)) + '\n');
      return null;
    });

    def('open', function (args, kwargs, it) {
      var path = str(args[0]);
      var mode = args.length > 1 ? str(args[1]) : str(kwGet(kwargs, 'mode', 'r'));
      return B.makeFile(it, path, mode);
    });

    def('eval', function (args, k, it) {
      var src = str(args[0]);
      try {
        var ast = root.PyParser.parseExpression(src);
        return it.runSync(it.evalExpr(ast, it.globals));
      } catch (e) {
        if (e instanceof PyError) throw e;
        if (e && e.pyType) it.throwPy(e.pyType, e.message);
        throw e;
      }
    });
    def('exec', function (args, k, it) {
      var src = str(args[0]);
      try {
        var ast = root.PyParser.parse(src);
        it.runSync(it.execBlock(ast.body, it.globals));
        return null;
      } catch (e) {
        if (e instanceof PyError) throw e;
        if (e && e.pyType) it.throwPy(e.pyType, e.message);
        throw e;
      }
    });
    def('compile', function (args, k, it) {
      it.throwPy('NotImplementedError', 'compile() is not available in this sandbox');
    });
    def('breakpoint', function () { return null; });
    def('memoryview', function (args, k, it) { return args[0]; });

    interp.builtinsMap = map;
  };


  // --- exact decimal rounding (matches CPython's round-half-to-even) ----------
  var _f64buf = new DataView(new ArrayBuffer(8));
  function exactRational(x) {
    _f64buf.setFloat64(0, x);
    var hi = _f64buf.getUint32(0), lo = _f64buf.getUint32(4);
    var neg = (hi >>> 31) === 1;
    var exp = (hi >>> 20) & 0x7ff;
    var mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo >>> 0);
    if (exp === 0) exp = 1; else mant |= (1n << 52n);
    var e = BigInt(exp - 1075);
    var num, den;
    if (e >= 0n) { num = mant << e; den = 1n; }
    else { num = mant; den = 1n << (-e); }
    if (neg) num = -num;
    return { num: num, den: den };
  }
  function floorDivMod(a, b) {
    var q = a / b;
    var r = a - q * b;
    if (r !== 0n && ((r < 0n) !== (b < 0n))) { q -= 1n; r += b; }
    return [q, r];
  }
  /** Round the double x to `digits` decimal places, returning a BigInt of the
   *  scaled value (x * 10**digits), using banker's rounding on the exact value. */
  function roundExact(x, digits) {
    var r = exactRational(x);
    var num = r.num, den = r.den;
    if (digits >= 0) num *= 10n ** BigInt(digits);
    else den *= 10n ** BigInt(-digits);
    var qr = floorDivMod(num, den);
    var q = qr[0], rem = qr[1];
    var twice = rem * 2n;
    if (twice > den) q += 1n;
    else if (twice === den) { if (q % 2n !== 0n) q += 1n; }
    return q;
  }
  function roundBigToPlaces(iv, digits) {
    var p = 10n ** BigInt(-digits);
    var qr = floorDivMod(iv, p);
    var q = qr[0], rem = qr[1];
    var twice = rem * 2n;
    if (twice > p) q += 1n;
    else if (twice === p) { if (q % 2n !== 0n) q += 1n; }
    return q * p;
  }
  B.roundExact = roundExact;

  // --- modular arithmetic used by pow() ---------------------------------------
  function modPow(base, exp, mod) {
    if (mod === 1n) return 0n;
    var result = 1n;
    base = ((base % mod) + mod) % mod;
    while (exp > 0n) {
      if (exp & 1n) result = (result * base) % mod;
      exp >>= 1n;
      base = (base * base) % mod;
    }
    return result;
  }
  function modInverse(a, m, interp) {
    var g = m, x = 0n, x1 = 1n, aa = ((a % m) + m) % m;
    var old_r = aa, r = m, old_s = 1n, s = 0n;
    while (r !== 0n) {
      var q = old_r / r;
      var tmp = old_r - q * r; old_r = r; r = tmp;
      var tmp2 = old_s - q * s; old_s = s; s = tmp2;
    }
    if (old_r !== 1n) {
      if (interp) interp.valueError('base is not invertible for the given modulus');
      throw new Error('not invertible');
    }
    return ((old_s % m) + m) % m;
  }
  B.modPow = modPow;
  B.modInverse = modInverse;

  // ---------------------------------------------------------------------------
  // Virtual file objects
  // ---------------------------------------------------------------------------

  B.makeFile = function (interp, path, mode) {
    var binary = mode.indexOf('b') >= 0;
    var reading = mode.indexOf('r') >= 0;
    var writing = mode.indexOf('w') >= 0;
    var appending = mode.indexOf('a') >= 0;
    var plus = mode.indexOf('+') >= 0;
    var fs = interp.files;
    if (reading && !plus && fs[path] === undefined) {
      throw new PyError(interp.makeExc('FileNotFoundError',
        "[Errno 2] No such file or directory: " + repr(path)));
    }
    if (writing) fs[path] = '';
    if (fs[path] === undefined) fs[path] = '';
    var pos = appending ? fs[path].length : 0;
    var closed = false;

    function checkOpen() { if (closed) interp.valueError('I/O operation on closed file'); }
    function wrap(s) { return binary ? B.latin1ToBytes(s) : s; }

    var file = {
      pytype: '_io.TextIOWrapper',
      __reprNative__: function () { return "<_io." + (binary ? 'BufferedRandom' : 'TextIOWrapper') + " name=" + repr(path) + " mode=" + repr(mode) + ">"; },
      __nativeAttrs__: {
        name: path,
        mode: mode,
        closed: function () { return closed; },
        read: new PyBuiltin('read', function (args) {
          checkOpen();
          var n = args.length && args[0] !== null ? Number(toBigInt(args[0])) : -1;
          var data = n < 0 ? fs[path].slice(pos) : fs[path].substr(pos, n);
          pos += data.length;
          return wrap(data);
        }),
        readline: new PyBuiltin('readline', function () {
          checkOpen();
          if (pos >= fs[path].length) return wrap('');
          var idx = fs[path].indexOf('\n', pos);
          var end = idx < 0 ? fs[path].length : idx + 1;
          var line = fs[path].slice(pos, end);
          pos = end;
          return wrap(line);
        }),
        readlines: new PyBuiltin('readlines', function () {
          checkOpen();
          var rest = fs[path].slice(pos);
          pos = fs[path].length;
          if (!rest) return new PyList([]);
          var parts = rest.split('\n');
          var out = [];
          for (var i = 0; i < parts.length; i++) {
            if (i === parts.length - 1 && parts[i] === '') break;
            out.push(wrap(parts[i] + (i < parts.length - 1 ? '\n' : '')));
          }
          return new PyList(out);
        }),
        write: new PyBuiltin('write', function (args, k, it) {
          checkOpen();
          var data = args[0];
          var s = data instanceof PyBytes ? B.bytesToLatin1(data) : str(data);
          fs[path] = fs[path].slice(0, pos) + s + fs[path].slice(pos + s.length);
          pos += s.length;
          return BigInt(s.length);
        }),
        writelines: new PyBuiltin('writelines', function (args, k, it) {
          checkOpen();
          it.toArray(args[0]).forEach(function (line) {
            var s = line instanceof PyBytes ? B.bytesToLatin1(line) : str(line);
            fs[path] = fs[path].slice(0, pos) + s + fs[path].slice(pos + s.length);
            pos += s.length;
          });
          return null;
        }),
        seek: new PyBuiltin('seek', function (args) {
          var off = Number(toBigInt(args[0]));
          var whence = args.length > 1 ? Number(toBigInt(args[1])) : 0;
          pos = whence === 0 ? off : (whence === 1 ? pos + off : fs[path].length + off);
          return BigInt(pos);
        }),
        tell: new PyBuiltin('tell', function () { return BigInt(pos); }),
        flush: new PyBuiltin('flush', function () { return null; }),
        close: new PyBuiltin('close', function () { closed = true; return null; }),
        __enter__: new PyBuiltin('__enter__', function () { return file; }),
        __exit__: new PyBuiltin('__exit__', function () { closed = true; return false; })
      },
      __jsiter__: function () {
        return {
          next: function () {
            if (closed || pos >= fs[path].length) return { done: true };
            var idx = fs[path].indexOf('\n', pos);
            var end = idx < 0 ? fs[path].length : idx + 1;
            var line = fs[path].slice(pos, end);
            pos = end;
            return { value: wrap(line), done: false };
          }
        };
      }
    };
    return file;
  };
})(typeof window !== 'undefined' ? window : globalThis);
