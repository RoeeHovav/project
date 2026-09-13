/* ============================================================================
 * lexer.js — Tokenizer for the PyForge Python subset.
 *
 * Produces a flat token stream with INDENT / DEDENT tokens synthesised from
 * leading whitespace, the way CPython's tokenizer does. Handles implicit line
 * joining inside brackets, explicit joining with a trailing backslash, all the
 * numeric literal forms, and every string prefix combination the game needs
 * (r, b, f, u and their pairings, single and triple quoted).
 * ========================================================================== */
(function (root) {
  'use strict';

  var KEYWORDS = {
    False: 1, None: 1, True: 1, and: 1, as: 1, assert: 1, async: 1, await: 1,
    break: 1, class: 1, continue: 1, def: 1, del: 1, elif: 1, else: 1,
    except: 1, finally: 1, for: 1, from: 1, global: 1, if: 1, import: 1,
    in: 1, is: 1, lambda: 1, nonlocal: 1, not: 1, or: 1, pass: 1, raise: 1,
    return: 1, try: 1, while: 1, with: 1, yield: 1
  };

  // Longest first so that maximal munch works with a simple prefix scan.
  var OPERATORS = [
    '**=', '//=', '>>=', '<<=', '...', '!==',
    '->', ':=', '==', '!=', '<=', '>=', '<<', '>>', '**', '//',
    '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '@=',
    '+', '-', '*', '/', '%', '@', '&', '|', '^', '~', '<', '>',
    '(', ')', '[', ']', '{', '}', ',', ':', '.', ';', '='
  ];

  function PyLexError(msg, line, col) {
    this.name = 'SyntaxError';
    this.message = msg;
    this.line = line;
    this.col = col;
    this.pyType = 'SyntaxError';
  }
  PyLexError.prototype = Object.create(Error.prototype);

  function isDigit(c) { return c >= '0' && c <= '9'; }
  function isHex(c) { return isDigit(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'); }
  function isIdStart(c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c.charCodeAt(0) > 127;
  }
  function isIdChar(c) { return isIdStart(c) || isDigit(c); }

  /**
   * Decode the escape sequences inside a string body.
   * `bytesMode` keeps the result as an array of byte values instead of a JS
   * string so that b'' literals round-trip non-UTF8 data correctly.
   */
  function unescape(body, raw, bytesMode, line) {
    if (raw) {
      if (!bytesMode) return body;
      var rb = [];
      for (var ri = 0; ri < body.length; ri++) {
        var rc = body.charCodeAt(ri);
        if (rc > 255) throw new PyLexError('bytes can only contain ASCII literal characters', line, 0);
        rb.push(rc);
      }
      return rb;
    }
    var out = bytesMode ? [] : '';
    function push(ch) {
      if (bytesMode) {
        var code = typeof ch === 'number' ? ch : ch.charCodeAt(0);
        out.push(code & 0xff);
      } else {
        out += typeof ch === 'number' ? String.fromCodePoint(ch) : ch;
      }
    }
    var i = 0;
    while (i < body.length) {
      var c = body[i];
      if (c !== '\\') { push(c); i++; continue; }
      i++;
      if (i >= body.length) { push('\\'); break; }
      var e = body[i++];
      switch (e) {
        case 'n': push('\n'); break;
        case 't': push('\t'); break;
        case 'r': push('\r'); break;
        case '0': push(0); break;
        case 'a': push(7); break;
        case 'b': push(8); break;
        case 'f': push(12); break;
        case 'v': push(11); break;
        case '\\': push('\\'); break;
        case "'": push("'"); break;
        case '"': push('"'); break;
        case '\n': break; // line continuation inside a string
        case 'x': {
          var hx = body.substr(i, 2);
          if (hx.length < 2 || !isHex(hx[0]) || !isHex(hx[1])) {
            throw new PyLexError('truncated \\xXX escape', line, 0);
          }
          i += 2;
          push(parseInt(hx, 16));
          break;
        }
        case 'u': {
          var u4 = body.substr(i, 4);
          if (u4.length < 4) throw new PyLexError('truncated \\uXXXX escape', line, 0);
          i += 4;
          push(parseInt(u4, 16));
          break;
        }
        case 'U': {
          var u8 = body.substr(i, 8);
          if (u8.length < 8) throw new PyLexError('truncated \\UXXXXXXXX escape', line, 0);
          i += 8;
          push(parseInt(u8, 16));
          break;
        }
        default:
          // Unknown escapes are kept verbatim, matching CPython's behaviour.
          push('\\'); push(e);
      }
    }
    return out;
  }

  function tokenize(src) {
    if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);
    src = src.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    var tokens = [];
    var indents = [0];
    var pos = 0;
    var line = 1;
    var lineStart = 0;
    var parenDepth = 0;
    var atLineStart = true;
    var n = src.length;

    function col() { return pos - lineStart + 1; }
    function push(type, value, startCol, extra) {
      var t = { type: type, value: value, line: line, col: startCol };
      if (extra) for (var k in extra) t[k] = extra[k];
      tokens.push(t);
      return t;
    }
    function lastMeaningful() {
      for (var i = tokens.length - 1; i >= 0; i--) {
        var t = tokens[i];
        if (t.type !== 'COMMENT') return t;
      }
      return null;
    }

    while (pos < n) {
      if (atLineStart && parenDepth === 0) {
        // Measure indentation; blank and comment-only lines carry none.
        var ws = 0;
        var scan = pos;
        while (scan < n) {
          var wc = src[scan];
          if (wc === ' ') { ws += 1; scan++; }
          else if (wc === '\t') { ws += 8 - (ws % 8); scan++; }
          else if (wc === '\f') { ws = 0; scan++; }
          else break;
        }
        if (scan >= n) { pos = scan; break; }
        if (src[scan] === '\n') { pos = scan + 1; line++; lineStart = pos; continue; }
        if (src[scan] === '#') {
          while (scan < n && src[scan] !== '\n') scan++;
          pos = scan;
          continue;
        }
        pos = scan;
        atLineStart = false;
        var top = indents[indents.length - 1];
        if (ws > top) {
          indents.push(ws);
          push('INDENT', ws, col());
        } else if (ws < top) {
          while (indents.length && indents[indents.length - 1] > ws) {
            indents.pop();
            push('DEDENT', ws, col());
          }
          if (indents[indents.length - 1] !== ws) {
            throw new PyLexError('unindent does not match any outer indentation level', line, col());
          }
        }
        continue;
      }

      var c = src[pos];

      if (c === ' ' || c === '\t' || c === '\f') { pos++; continue; }

      if (c === '#') {
        while (pos < n && src[pos] !== '\n') pos++;
        continue;
      }

      if (c === '\\' && src[pos + 1] === '\n') {
        pos += 2; line++; lineStart = pos;
        continue;
      }

      if (c === '\n') {
        pos++;
        if (parenDepth === 0) {
          var lm = lastMeaningful();
          if (lm && lm.type !== 'NEWLINE' && lm.type !== 'INDENT' && lm.type !== 'DEDENT') {
            push('NEWLINE', '\n', col());
          }
          atLineStart = true;
        }
        line++; lineStart = pos;
        continue;
      }

      var startCol = col();

      // --- strings (with optional prefixes) -------------------------------
      var prefixMatch = /^([rRbBuUfF]{0,3})('''|"""|'|")/.exec(src.slice(pos, pos + 6));
      if (prefixMatch && (prefixMatch[1].length === 0 ? (c === "'" || c === '"') : true)) {
        var prefix = prefixMatch[1].toLowerCase();
        var quote = prefixMatch[2];
        var validPrefix = prefix === '' || /^(r|b|u|f|rb|br|fr|rf)$/.test(prefix);
        if (validPrefix) {
          var bodyStart = pos + prefix.length + quote.length;
          var i = bodyStart;
          var isRaw = prefix.indexOf('r') >= 0;
          var isBytes = prefix.indexOf('b') >= 0;
          var isF = prefix.indexOf('f') >= 0;
          var triple = quote.length === 3;
          var found = -1;
          while (i < n) {
            if (src[i] === '\\' && !triple) { i += 2; continue; }
            if (src[i] === '\\' && triple) { i += 2; continue; }
            if (src[i] === '\n') {
              if (!triple) throw new PyLexError('EOL while scanning string literal', line, startCol);
              line++;
              i++;
              continue;
            }
            if (src.startsWith(quote, i)) { found = i; break; }
            i++;
          }
          if (found < 0) throw new PyLexError('EOF while scanning string literal', line, startCol);
          var body = src.slice(bodyStart, found);
          pos = found + quote.length;
          if (isF) {
            push('FSTRING', body, startCol, { raw: isRaw });
          } else {
            push('STRING', unescape(body, isRaw, isBytes, line), startCol, { bytes: isBytes });
          }
          continue;
        }
      }

      // --- numbers ---------------------------------------------------------
      if (isDigit(c) || (c === '.' && isDigit(src[pos + 1]))) {
        var numStart = pos;
        var isFloat = false;
        if (c === '0' && (src[pos + 1] === 'x' || src[pos + 1] === 'X')) {
          pos += 2;
          while (pos < n && (isHex(src[pos]) || src[pos] === '_')) pos++;
          push('NUMBER', BigInt(src.slice(numStart, pos).replace(/_/g, '')), startCol, { int: true });
          continue;
        }
        if (c === '0' && (src[pos + 1] === 'b' || src[pos + 1] === 'B')) {
          pos += 2;
          while (pos < n && (src[pos] === '0' || src[pos] === '1' || src[pos] === '_')) pos++;
          push('NUMBER', BigInt(src.slice(numStart, pos).replace(/_/g, '')), startCol, { int: true });
          continue;
        }
        if (c === '0' && (src[pos + 1] === 'o' || src[pos + 1] === 'O')) {
          pos += 2;
          while (pos < n && src[pos] >= '0' && src[pos] <= '7') pos++;
          push('NUMBER', BigInt(src.slice(numStart, pos).replace(/_/g, '')), startCol, { int: true });
          continue;
        }
        while (pos < n && (isDigit(src[pos]) || src[pos] === '_')) pos++;
        if (src[pos] === '.' && isDigit(src[pos + 1])) {
          isFloat = true; pos++;
          while (pos < n && (isDigit(src[pos]) || src[pos] === '_')) pos++;
        } else if (src[pos] === '.' && !isIdStart(src[pos + 1] || ' ')) {
          isFloat = true; pos++;
        }
        if (src[pos] === 'e' || src[pos] === 'E') {
          var save = pos;
          pos++;
          if (src[pos] === '+' || src[pos] === '-') pos++;
          if (isDigit(src[pos])) {
            isFloat = true;
            while (pos < n && isDigit(src[pos])) pos++;
          } else { pos = save; }
        }
        if (src[pos] === 'j' || src[pos] === 'J') {
          pos++;
          push('NUMBER', parseFloat(src.slice(numStart, pos - 1).replace(/_/g, '')), startCol, { imag: true });
          continue;
        }
        var text = src.slice(numStart, pos).replace(/_/g, '');
        if (isFloat) push('NUMBER', parseFloat(text), startCol, { float: true });
        else push('NUMBER', BigInt(text), startCol, { int: true });
        continue;
      }

      // --- names / keywords -------------------------------------------------
      if (isIdStart(c)) {
        var idStart = pos;
        while (pos < n && isIdChar(src[pos])) pos++;
        var word = src.slice(idStart, pos);
        push(KEYWORDS[word] ? 'KEYWORD' : 'NAME', word, startCol);
        continue;
      }

      // --- operators ---------------------------------------------------------
      var matched = null;
      for (var oi = 0; oi < OPERATORS.length; oi++) {
        if (src.startsWith(OPERATORS[oi], pos)) { matched = OPERATORS[oi]; break; }
      }
      if (matched) {
        if (matched === '(' || matched === '[' || matched === '{') parenDepth++;
        else if (matched === ')' || matched === ']' || matched === '}') parenDepth = Math.max(0, parenDepth - 1);
        pos += matched.length;
        push('OP', matched, startCol);
        continue;
      }

      throw new PyLexError("invalid character '" + c + "' in source", line, startCol);
    }

    var lastTok = lastMeaningful();
    if (lastTok && lastTok.type !== 'NEWLINE' && lastTok.type !== 'DEDENT') {
      push('NEWLINE', '\n', col());
    }
    while (indents.length > 1) { indents.pop(); push('DEDENT', 0, 1); }
    push('EOF', null, 1);
    return tokens;
  }

  root.PyLexer = { tokenize: tokenize, PyLexError: PyLexError, KEYWORDS: KEYWORDS, unescape: unescape };
})(typeof window !== 'undefined' ? window : globalThis);
