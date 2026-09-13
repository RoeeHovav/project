/* ============================================================================
 * parser.js — Recursive-descent parser producing a Python AST.
 *
 * Covers the whole surface the curriculum teaches: decorators, default and
 * keyword-only parameters, *args/**kwargs, chained comparisons, comprehensions
 * of every flavour, slices, lambdas, walrus, yield / yield from, async def and
 * await, with-statements, try/except/else/finally, and f-strings (whose bodies
 * are re-parsed here as full expressions).
 * ========================================================================== */
(function (root) {
  'use strict';

  var Lexer = root.PyLexer;

  function ParseError(msg, line, col) {
    this.name = 'SyntaxError';
    this.message = msg;
    this.line = line;
    this.col = col;
    this.pyType = 'SyntaxError';
  }
  ParseError.prototype = Object.create(Error.prototype);

  function Parser(tokens, src) {
    this.toks = tokens;
    this.i = 0;
    this.src = src || '';
  }

  var P = Parser.prototype;

  P.peek = function (k) { return this.toks[this.i + (k || 0)]; };
  P.next = function () { return this.toks[this.i++]; };
  P.at = function (type, value) {
    var t = this.toks[this.i];
    if (!t || t.type !== type) return false;
    return value === undefined || t.value === value;
  };
  P.atOp = function (v) { return this.at('OP', v); };
  P.atKw = function (v) { return this.at('KEYWORD', v); };
  P.accept = function (type, value) {
    if (this.at(type, value)) return this.next();
    return null;
  };
  P.acceptOp = function (v) { return this.accept('OP', v); };
  P.acceptKw = function (v) { return this.accept('KEYWORD', v); };
  P.expect = function (type, value) {
    if (this.at(type, value)) return this.next();
    var t = this.peek();
    throw new ParseError(
      'invalid syntax: expected ' + (value !== undefined ? "'" + value + "'" : type) +
      " but found '" + (t && t.value !== null ? t.value : 'end of input') + "'",
      t ? t.line : 0, t ? t.col : 0);
  };
  P.expectOp = function (v) { return this.expect('OP', v); };
  P.err = function (msg, tok) {
    var t = tok || this.peek();
    throw new ParseError(msg, t ? t.line : 0, t ? t.col : 0);
  };
  P.loc = function (tok) { return { line: tok ? tok.line : 0, col: tok ? tok.col : 0 }; };

  // -------------------------------------------------------------------------
  // Module / statement level
  // -------------------------------------------------------------------------

  P.parseModule = function () {
    var body = [];
    while (!this.at('EOF')) {
      if (this.accept('NEWLINE')) continue;
      if (this.at('INDENT')) this.err('unexpected indent');
      body.push.apply(body, this.parseStatement());
    }
    return { type: 'Module', body: body };
  };

  P.parseBlock = function () {
    // Either an indented suite or a single inline simple-statement line.
    if (this.accept('NEWLINE')) {
      this.expect('INDENT');
      var body = [];
      while (!this.at('DEDENT') && !this.at('EOF')) {
        if (this.accept('NEWLINE')) continue;
        body.push.apply(body, this.parseStatement());
      }
      this.accept('DEDENT');
      if (!body.length) this.err('expected an indented block');
      return body;
    }
    return this.parseSimpleLine();
  };

  P.parseStatement = function () {
    var t = this.peek();
    if (t.type === 'OP' && t.value === '@') return [this.parseDecorated()];
    if (t.type === 'KEYWORD') {
      switch (t.value) {
        case 'if': return [this.parseIf()];
        case 'while': return [this.parseWhile()];
        case 'for': return [this.parseFor(false)];
        case 'try': return [this.parseTry()];
        case 'with': return [this.parseWith(false)];
        case 'def': return [this.parseFunctionDef([], false)];
        case 'class': return [this.parseClassDef([])];
        case 'async': {
          var nxt = this.peek(1);
          if (nxt && nxt.type === 'KEYWORD') {
            if (nxt.value === 'def') { this.next(); return [this.parseFunctionDef([], true)]; }
            if (nxt.value === 'for') { this.next(); return [this.parseFor(true)]; }
            if (nxt.value === 'with') { this.next(); return [this.parseWith(true)]; }
          }
          break;
        }
      }
    }
    return this.parseSimpleLine();
  };

  P.parseSimpleLine = function () {
    var stmts = [this.parseSimpleStatement()];
    while (this.acceptOp(';')) {
      if (this.at('NEWLINE') || this.at('EOF')) break;
      stmts.push(this.parseSimpleStatement());
    }
    if (!this.at('EOF') && !this.at('DEDENT')) this.expect('NEWLINE');
    return stmts;
  };

  P.parseSimpleStatement = function () {
    var t = this.peek();
    var loc = this.loc(t);
    if (t.type === 'KEYWORD') {
      switch (t.value) {
        case 'pass': this.next(); return { type: 'Pass', loc: loc };
        case 'break': this.next(); return { type: 'Break', loc: loc };
        case 'continue': this.next(); return { type: 'Continue', loc: loc };
        case 'return': {
          this.next();
          var val = null;
          if (!this.at('NEWLINE') && !this.atOp(';') && !this.at('EOF') && !this.at('DEDENT')) {
            val = this.parseExprListAsTuple();
          }
          return { type: 'Return', value: val, loc: loc };
        }
        case 'raise': {
          this.next();
          var exc = null, cause = null;
          if (!this.at('NEWLINE') && !this.atOp(';') && !this.at('EOF') && !this.at('DEDENT')) {
            exc = this.parseExpr();
            if (this.acceptKw('from')) cause = this.parseExpr();
          }
          return { type: 'Raise', exc: exc, cause: cause, loc: loc };
        }
        case 'global': case 'nonlocal': {
          this.next();
          var names = [this.expect('NAME').value];
          while (this.acceptOp(',')) names.push(this.expect('NAME').value);
          return { type: t.value === 'global' ? 'Global' : 'Nonlocal', names: names, loc: loc };
        }
        case 'del': {
          this.next();
          var targets = [this.parseExpr()];
          while (this.acceptOp(',')) {
            if (this.at('NEWLINE')) break;
            targets.push(this.parseExpr());
          }
          return { type: 'Delete', targets: targets, loc: loc };
        }
        case 'assert': {
          this.next();
          var test = this.parseExpr();
          var msg = this.acceptOp(',') ? this.parseExpr() : null;
          return { type: 'Assert', test: test, msg: msg, loc: loc };
        }
        case 'import': return this.parseImport();
        case 'from': return this.parseImportFrom();
      }
    }
    return this.parseExprStatement();
  };

  P.parseImport = function () {
    var loc = this.loc(this.peek());
    this.expect('KEYWORD', 'import');
    var names = [];
    do {
      var parts = [this.expect('NAME').value];
      while (this.atOp('.')) { this.next(); parts.push(this.expect('NAME').value); }
      var alias = this.acceptKw('as') ? this.expect('NAME').value : null;
      names.push({ name: parts.join('.'), asname: alias });
    } while (this.acceptOp(','));
    return { type: 'Import', names: names, loc: loc };
  };

  P.parseImportFrom = function () {
    var loc = this.loc(this.peek());
    this.expect('KEYWORD', 'from');
    var level = 0;
    while (this.atOp('.') || this.atOp('...')) {
      level += this.next().value.length;
    }
    var mod = null;
    if (!this.atKw('import')) {
      var mp = [this.expect('NAME').value];
      while (this.atOp('.')) { this.next(); mp.push(this.expect('NAME').value); }
      mod = mp.join('.');
    }
    this.expect('KEYWORD', 'import');
    var names = [];
    if (this.atOp('*')) { this.next(); names.push({ name: '*', asname: null }); }
    else {
      var paren = !!this.acceptOp('(');
      do {
        if (paren && this.atOp(')')) break;
        var nm = this.expect('NAME').value;
        var al = this.acceptKw('as') ? this.expect('NAME').value : null;
        names.push({ name: nm, asname: al });
      } while (this.acceptOp(','));
      if (paren) this.expectOp(')');
    }
    return { type: 'ImportFrom', module: mod, names: names, level: level, loc: loc };
  };

  var AUG_OPS = {
    '+=': '+', '-=': '-', '*=': '*', '/=': '/', '//=': '//', '%=': '%',
    '**=': '**', '&=': '&', '|=': '|', '^=': '^', '<<=': '<<', '>>=': '>>', '@=': '@'
  };

  P.parseExprStatement = function () {
    var startTok = this.peek();
    var loc = this.loc(startTok);
    var first = this.parseExprListAsTuple(true);

    if (this.atOp(':') && (first.type === 'Name' || first.type === 'Attribute' || first.type === 'Subscript')) {
      this.next();
      var ann = this.parseExpr();
      var aval = this.acceptOp('=') ? this.parseExprListAsTuple() : null;
      return { type: 'AnnAssign', target: first, annotation: ann, value: aval, loc: loc };
    }

    var t = this.peek();
    if (t.type === 'OP' && AUG_OPS[t.value]) {
      this.next();
      var rhs = this.parseExprListAsTuple();
      return { type: 'AugAssign', target: first, op: AUG_OPS[t.value], value: rhs, loc: loc };
    }

    if (this.atOp('=')) {
      var targets = [first];
      var value = null;
      while (this.acceptOp('=')) {
        var e = this.parseExprListAsTuple(true);
        targets.push(e);
      }
      value = targets.pop();
      targets.forEach(function (tg) { validateTarget(tg, this); }, this);
      return { type: 'Assign', targets: targets, value: value, loc: loc };
    }

    return { type: 'Expr', value: first, loc: loc };
  };

  function validateTarget(node, parser) {
    switch (node.type) {
      case 'Name': case 'Attribute': case 'Subscript': case 'Starred':
        return;
      case 'Tuple': case 'List':
        node.elts.forEach(function (e) { validateTarget(e, parser); });
        return;
      default:
        parser.err("cannot assign to " + node.type.toLowerCase() + " (invalid assignment target)");
    }
  }

  // -------------------------------------------------------------------------
  // Compound statements
  // -------------------------------------------------------------------------

  P.parseIf = function () {
    var loc = this.loc(this.peek());
    this.expect('KEYWORD', 'if');
    var test = this.parseNamedExpr();
    this.expectOp(':');
    var body = this.parseBlock();
    var orelse = [];
    if (this.atKw('elif')) {
      var sub = this.peek();
      this.next();
      // Re-enter as a nested if by rewinding the keyword into an if-shape.
      var t2 = this.parseNamedExpr();
      this.expectOp(':');
      var b2 = this.parseBlock();
      var inner = { type: 'If', test: t2, body: b2, orelse: [], loc: this.loc(sub) };
      orelse = [inner];
      var cursor = inner;
      while (this.atKw('elif')) {
        var st = this.peek(); this.next();
        var t3 = this.parseNamedExpr();
        this.expectOp(':');
        var b3 = this.parseBlock();
        var nxt = { type: 'If', test: t3, body: b3, orelse: [], loc: this.loc(st) };
        cursor.orelse = [nxt];
        cursor = nxt;
      }
      if (this.acceptKw('else')) { this.expectOp(':'); cursor.orelse = this.parseBlock(); }
    } else if (this.acceptKw('else')) {
      this.expectOp(':');
      orelse = this.parseBlock();
    }
    return { type: 'If', test: test, body: body, orelse: orelse, loc: loc };
  };

  P.parseWhile = function () {
    var loc = this.loc(this.peek());
    this.expect('KEYWORD', 'while');
    var test = this.parseNamedExpr();
    this.expectOp(':');
    var body = this.parseBlock();
    var orelse = [];
    if (this.acceptKw('else')) { this.expectOp(':'); orelse = this.parseBlock(); }
    return { type: 'While', test: test, body: body, orelse: orelse, loc: loc };
  };

  P.parseFor = function (isAsync) {
    var loc = this.loc(this.peek());
    this.expect('KEYWORD', 'for');
    var target = this.parseTargetList();
    this.expect('KEYWORD', 'in');
    var iter = this.parseExprListAsTuple();
    this.expectOp(':');
    var body = this.parseBlock();
    var orelse = [];
    if (this.acceptKw('else')) { this.expectOp(':'); orelse = this.parseBlock(); }
    return { type: 'For', target: target, iter: iter, body: body, orelse: orelse, isAsync: !!isAsync, loc: loc };
  };

  P.parseTargetList = function () {
    var first = this.parseTargetAtom();
    if (!this.atOp(',')) return first;
    var elts = [first];
    while (this.acceptOp(',')) {
      if (this.atKw('in') || this.atOp('=') || this.at('NEWLINE') || this.atOp(')') || this.atOp(']')) break;
      elts.push(this.parseTargetAtom());
    }
    return { type: 'Tuple', elts: elts, loc: first.loc };
  };

  P.parseTargetAtom = function () {
    if (this.atOp('*')) {
      var st = this.next();
      return { type: 'Starred', value: this.parseTargetAtom(), loc: this.loc(st) };
    }
    var e = this.parseUnary();
    return e;
  };

  P.parseTry = function () {
    var loc = this.loc(this.peek());
    this.expect('KEYWORD', 'try');
    this.expectOp(':');
    var body = this.parseBlock();
    var handlers = [];
    while (this.atKw('except')) {
      var ht = this.next();
      var star = !!this.acceptOp('*');
      var etype = null, ename = null;
      if (!this.atOp(':')) {
        etype = this.parseExpr();
        if (this.acceptKw('as')) ename = this.expect('NAME').value;
        else if (this.acceptOp(',')) ename = this.expect('NAME').value;
      }
      this.expectOp(':');
      var hbody = this.parseBlock();
      handlers.push({ type: 'ExceptHandler', etype: etype, name: ename, body: hbody, star: star, loc: this.loc(ht) });
    }
    var orelse = [], finalbody = [];
    if (this.acceptKw('else')) { this.expectOp(':'); orelse = this.parseBlock(); }
    if (this.acceptKw('finally')) { this.expectOp(':'); finalbody = this.parseBlock(); }
    if (!handlers.length && !finalbody.length) this.err("try statement must have except or finally clause");
    return { type: 'Try', body: body, handlers: handlers, orelse: orelse, finalbody: finalbody, loc: loc };
  };

  P.parseWith = function (isAsync) {
    var loc = this.loc(this.peek());
    this.expect('KEYWORD', 'with');
    var items = [];
    var paren = false;
    if (this.atOp('(')) {
      // Ambiguous: could be a parenthesised with-items list or an expression.
      var save = this.i;
      this.next();
      try {
        var probe = [];
        do {
          if (this.atOp(')')) break;
          var ce = this.parseExpr();
          var ov = this.acceptKw('as') ? this.parseTargetAtom() : null;
          probe.push({ context: ce, optional: ov });
        } while (this.acceptOp(','));
        if (this.atOp(')') && (this.peek(1) && this.peek(1).type === 'OP' && this.peek(1).value === ':')) {
          this.next();
          items = probe;
          paren = true;
        } else { this.i = save; }
      } catch (e) { this.i = save; }
    }
    if (!paren) {
      do {
        var c = this.parseExpr();
        var v = this.acceptKw('as') ? this.parseTargetAtom() : null;
        items.push({ context: c, optional: v });
      } while (this.acceptOp(','));
    }
    this.expectOp(':');
    var body = this.parseBlock();
    return { type: 'With', items: items, body: body, isAsync: !!isAsync, loc: loc };
  };

  P.parseDecorated = function () {
    var decorators = [];
    while (this.atOp('@')) {
      this.next();
      decorators.push(this.parseExpr());
      this.expect('NEWLINE');
    }
    if (this.atKw('def')) return this.parseFunctionDef(decorators, false);
    if (this.atKw('class')) return this.parseClassDef(decorators);
    if (this.atKw('async')) { this.next(); return this.parseFunctionDef(decorators, true); }
    this.err('expected function or class definition after decorator');
  };

  P.parseFunctionDef = function (decorators, isAsync) {
    var loc = this.loc(this.peek());
    this.expect('KEYWORD', 'def');
    var name = this.expect('NAME').value;
    this.expectOp('(');
    var params = this.parseParams(')');
    this.expectOp(')');
    var returns = null;
    if (this.acceptOp('->')) returns = this.parseExpr();
    this.expectOp(':');
    var body = this.parseBlock();
    return {
      type: 'FunctionDef', name: name, params: params, body: body,
      decorators: decorators || [], isAsync: !!isAsync, returns: returns, loc: loc
    };
  };

  P.parseParams = function (closer) {
    var params = { args: [], vararg: null, kwonly: [], kwarg: null, posonlyCount: 0 };
    var seenStar = false;
    while (!(closer === ')' ? this.atOp(')') : (this.atOp(':') || this.at('NEWLINE')))) {
      if (this.atOp('/')) { this.next(); params.posonlyCount = params.args.length; if (!this.acceptOp(',')) break; continue; }
      if (this.atOp('*')) {
        this.next();
        if (this.atOp(',') || this.atOp(')') || this.atOp(':')) { seenStar = true; }
        else {
          var vn = this.expect('NAME').value;
          var vann = this.acceptOp(':') ? this.parseExpr() : null;
          params.vararg = { name: vn, annotation: vann };
          seenStar = true;
        }
        if (!this.acceptOp(',')) break;
        continue;
      }
      if (this.atOp('**')) {
        this.next();
        var kn = this.expect('NAME').value;
        var kann = this.acceptOp(':') ? this.parseExpr() : null;
        params.kwarg = { name: kn, annotation: kann };
        if (!this.acceptOp(',')) break;
        continue;
      }
      var pn = this.expect('NAME').value;
      var pann = (closer === ')' && this.atOp(':')) ? (this.next(), this.parseExpr()) : null;
      var pdef = this.acceptOp('=') ? this.parseExpr() : null;
      var entry = { name: pn, annotation: pann, def: pdef };
      if (seenStar) params.kwonly.push(entry); else params.args.push(entry);
      if (!this.acceptOp(',')) break;
    }
    return params;
  };

  P.parseClassDef = function (decorators) {
    var loc = this.loc(this.peek());
    this.expect('KEYWORD', 'class');
    var name = this.expect('NAME').value;
    var bases = [], keywords = [];
    if (this.acceptOp('(')) {
      while (!this.atOp(')')) {
        if (this.at('NAME') && this.peek(1) && this.peek(1).type === 'OP' && this.peek(1).value === '=') {
          var kw = this.next().value; this.next();
          keywords.push({ arg: kw, value: this.parseExpr() });
        } else if (this.atOp('**')) {
          this.next();
          keywords.push({ arg: null, value: this.parseExpr() });
        } else {
          bases.push(this.parseExpr());
        }
        if (!this.acceptOp(',')) break;
      }
      this.expectOp(')');
    }
    this.expectOp(':');
    var body = this.parseBlock();
    return { type: 'ClassDef', name: name, bases: bases, keywords: keywords, body: body, decorators: decorators || [], loc: loc };
  };

  // -------------------------------------------------------------------------
  // Expressions
  // -------------------------------------------------------------------------

  // Comma-separated expression list that becomes a tuple when there is a comma.
  P.parseExprListAsTuple = function (allowStar) {
    var startTok = this.peek();
    var first = allowStar && this.atOp('*')
      ? (function (p) { var s = p.next(); return { type: 'Starred', value: p.parseExpr(), loc: p.loc(s) }; })(this)
      : this.parseNamedExpr();
    if (!this.atOp(',')) return first;
    var elts = [first];
    while (this.acceptOp(',')) {
      if (this.at('NEWLINE') || this.at('EOF') || this.atOp('=') || this.atOp(')') ||
          this.atOp(']') || this.atOp('}') || this.atOp(':') || this.atOp(';')) break;
      if (this.atOp('*')) { var s2 = this.next(); elts.push({ type: 'Starred', value: this.parseExpr(), loc: this.loc(s2) }); }
      else elts.push(this.parseNamedExpr());
    }
    return { type: 'Tuple', elts: elts, loc: this.loc(startTok) };
  };

  P.parseNamedExpr = function () {
    if (this.at('NAME') && this.peek(1) && this.peek(1).type === 'OP' && this.peek(1).value === ':=') {
      var nt = this.next();
      this.next();
      var v = this.parseExpr();
      return { type: 'NamedExpr', target: { type: 'Name', id: nt.value, loc: this.loc(nt) }, value: v, loc: this.loc(nt) };
    }
    return this.parseExpr();
  };

  P.parseExpr = function () {
    if (this.atKw('lambda')) return this.parseLambda();
    if (this.atKw('yield')) return this.parseYield();
    var e = this.parseTernary();
    return e;
  };

  P.parseYield = function () {
    var loc = this.loc(this.peek());
    this.expect('KEYWORD', 'yield');
    if (this.acceptKw('from')) {
      return { type: 'YieldFrom', value: this.parseExpr(), loc: loc };
    }
    if (this.at('NEWLINE') || this.atOp(')') || this.atOp(']') || this.atOp('}') ||
        this.atOp(',') || this.atOp(';') || this.at('EOF') || this.at('DEDENT')) {
      return { type: 'Yield', value: null, loc: loc };
    }
    return { type: 'Yield', value: this.parseExprListAsTuple(), loc: loc };
  };

  P.parseLambda = function () {
    var loc = this.loc(this.peek());
    this.expect('KEYWORD', 'lambda');
    var params = this.parseParams(':');
    this.expectOp(':');
    var body = this.parseExpr();
    return { type: 'Lambda', params: params, body: body, loc: loc };
  };

  P.parseTernary = function () {
    var body = this.parseOr();
    if (this.atKw('if')) {
      var loc = body.loc;
      this.next();
      var test = this.parseOr();
      this.expect('KEYWORD', 'else');
      var orelse = this.parseExpr();
      return { type: 'IfExp', test: test, body: body, orelse: orelse, loc: loc };
    }
    return body;
  };

  P.parseOr = function () {
    var left = this.parseAnd();
    if (!this.atKw('or')) return left;
    var values = [left];
    while (this.acceptKw('or')) values.push(this.parseAnd());
    return { type: 'BoolOp', op: 'or', values: values, loc: left.loc };
  };

  P.parseAnd = function () {
    var left = this.parseNot();
    if (!this.atKw('and')) return left;
    var values = [left];
    while (this.acceptKw('and')) values.push(this.parseNot());
    return { type: 'BoolOp', op: 'and', values: values, loc: left.loc };
  };

  P.parseNot = function () {
    if (this.atKw('not')) {
      var t = this.next();
      return { type: 'UnaryOp', op: 'not', operand: this.parseNot(), loc: this.loc(t) };
    }
    return this.parseComparison();
  };

  P.parseComparison = function () {
    var left = this.parseBitOr();
    var ops = [], comparators = [];
    for (;;) {
      var op = null;
      if (this.atOp('<')) op = '<';
      else if (this.atOp('>')) op = '>';
      else if (this.atOp('==')) op = '==';
      else if (this.atOp('!=')) op = '!=';
      else if (this.atOp('<=')) op = '<=';
      else if (this.atOp('>=')) op = '>=';
      else if (this.atKw('in')) op = 'in';
      else if (this.atKw('is')) op = 'is';
      else if (this.atKw('not') && this.peek(1) && this.peek(1).type === 'KEYWORD' && this.peek(1).value === 'in') op = 'not in';
      if (!op) break;
      if (op === 'not in') { this.next(); this.next(); }
      else {
        this.next();
        if (op === 'is' && this.atKw('not')) { this.next(); op = 'is not'; }
      }
      ops.push(op);
      comparators.push(this.parseBitOr());
    }
    if (!ops.length) return left;
    return { type: 'Compare', left: left, ops: ops, comparators: comparators, loc: left.loc };
  };

  function binaryLevel(name, nextName, opList) {
    P[name] = function () {
      var left = this[nextName]();
      for (;;) {
        var found = null;
        for (var i = 0; i < opList.length; i++) {
          if (this.atOp(opList[i])) { found = opList[i]; break; }
        }
        if (!found) break;
        this.next();
        var right = this[nextName]();
        left = { type: 'BinOp', op: found, left: left, right: right, loc: left.loc };
      }
      return left;
    };
  }

  binaryLevel('parseBitOr', 'parseBitXor', ['|']);
  binaryLevel('parseBitXor', 'parseBitAnd', ['^']);
  binaryLevel('parseBitAnd', 'parseShift', ['&']);
  binaryLevel('parseShift', 'parseArith', ['<<', '>>']);
  binaryLevel('parseArith', 'parseTerm', ['+', '-']);
  binaryLevel('parseTerm', 'parseFactor', ['*', '/', '//', '%', '@']);

  P.parseFactor = function () {
    if (this.atOp('-') || this.atOp('+') || this.atOp('~')) {
      var t = this.next();
      return { type: 'UnaryOp', op: t.value, operand: this.parseFactor(), loc: this.loc(t) };
    }
    return this.parsePower();
  };

  P.parsePower = function () {
    var base = this.parseAwait();
    if (this.atOp('**')) {
      this.next();
      var exp = this.parseFactor();
      return { type: 'BinOp', op: '**', left: base, right: exp, loc: base.loc };
    }
    return base;
  };

  P.parseAwait = function () {
    if (this.atKw('await')) {
      var t = this.next();
      return { type: 'Await', value: this.parseAwait(), loc: this.loc(t) };
    }
    return this.parseUnary();
  };

  P.parseUnary = function () {
    var node = this.parseAtom();
    return this.parseTrailers(node);
  };

  P.parseTrailers = function (node) {
    for (;;) {
      if (this.atOp('(')) {
        this.next();
        var call = this.parseCallArgs(node);
        this.expectOp(')');
        node = call;
      } else if (this.atOp('[')) {
        this.next();
        var sl = this.parseSubscript();
        this.expectOp(']');
        node = { type: 'Subscript', value: node, slice: sl, loc: node.loc };
      } else if (this.atOp('.')) {
        this.next();
        var attr = this.expect('NAME').value;
        node = { type: 'Attribute', value: node, attr: attr, loc: node.loc };
      } else break;
    }
    return node;
  };

  P.parseCallArgs = function (func) {
    var args = [], keywords = [];
    while (!this.atOp(')')) {
      if (this.atOp('*')) {
        var s = this.next();
        args.push({ type: 'Starred', value: this.parseExpr(), loc: this.loc(s) });
      } else if (this.atOp('**')) {
        this.next();
        keywords.push({ arg: null, value: this.parseExpr() });
      } else if (this.at('NAME') && this.peek(1) && this.peek(1).type === 'OP' && this.peek(1).value === '=') {
        var kwName = this.next().value;
        this.next();
        keywords.push({ arg: kwName, value: this.parseExpr() });
      } else {
        var e = this.parseNamedExpr();
        if (this.atKw('for') || (this.atKw('async') && this.peek(1) && this.peek(1).value === 'for')) {
          var gens = this.parseComprehensionClauses();
          e = { type: 'GeneratorExp', elt: e, generators: gens, loc: e.loc };
        }
        args.push(e);
      }
      if (!this.acceptOp(',')) break;
    }
    return { type: 'Call', func: func, args: args, keywords: keywords, loc: func.loc };
  };

  P.parseSubscript = function () {
    var items = [];
    var sawComma = false;
    do {
      if (this.atOp(']')) break;
      items.push(this.parseSliceItem());
      if (this.atOp(',')) { sawComma = true; }
    } while (this.acceptOp(','));
    if (items.length === 1 && !sawComma) return items[0];
    return { type: 'Tuple', elts: items, loc: items.length ? items[0].loc : null };
  };

  P.parseSliceItem = function () {
    var lower = null, upper = null, step = null;
    var loc = this.loc(this.peek());
    if (!this.atOp(':')) {
      lower = this.parseNamedExpr();
      if (!this.atOp(':')) return lower;
    }
    this.expectOp(':');
    if (!this.atOp(':') && !this.atOp(']') && !this.atOp(',')) upper = this.parseExpr();
    if (this.acceptOp(':')) {
      if (!this.atOp(']') && !this.atOp(',')) step = this.parseExpr();
    }
    return { type: 'Slice', lower: lower, upper: upper, step: step, loc: loc };
  };

  P.parseComprehensionClauses = function () {
    var gens = [];
    while (this.atKw('for') || (this.atKw('async') && this.peek(1) && this.peek(1).value === 'for')) {
      var isAsync = false;
      if (this.atKw('async')) { this.next(); isAsync = true; }
      this.expect('KEYWORD', 'for');
      var target = this.parseTargetList();
      this.expect('KEYWORD', 'in');
      var iter = this.parseOr();
      var ifs = [];
      while (this.atKw('if')) { this.next(); ifs.push(this.parseOrNoCond()); }
      gens.push({ target: target, iter: iter, ifs: ifs, isAsync: isAsync });
    }
    return gens;
  };

  // Conditions inside comprehensions cannot contain a bare ternary at top level.
  P.parseOrNoCond = function () { return this.parseOr(); };

  P.parseAtom = function () {
    var t = this.peek();
    var loc = this.loc(t);

    if (t.type === 'NUMBER') {
      this.next();
      return { type: 'Num', v: t.value, isInt: !!t.int, isFloat: !!t.float, isImag: !!t.imag, loc: loc };
    }

    if (t.type === 'STRING' || t.type === 'FSTRING') {
      // Adjacent literals concatenate.
      var pieces = [];
      var anyF = false, anyBytes = false;
      while (this.at('STRING') || this.at('FSTRING')) {
        var st = this.next();
        if (st.type === 'FSTRING') { anyF = true; pieces.push({ f: true, raw: st.value, isRaw: st.raw }); }
        else { if (st.bytes) anyBytes = true; pieces.push({ f: false, v: st.value, bytes: !!st.bytes }); }
      }
      if (anyBytes && !anyF) {
        var allBytes = [];
        pieces.forEach(function (p) {
          if (p.bytes) allBytes = allBytes.concat(p.v);
          else for (var i = 0; i < p.v.length; i++) allBytes.push(p.v.charCodeAt(i) & 0xff);
        });
        return { type: 'Bytes', v: allBytes, loc: loc };
      }
      if (!anyF) {
        var s = pieces.map(function (p) { return p.v; }).join('');
        return { type: 'Str', v: s, loc: loc };
      }
      var parts = [];
      for (var pi = 0; pi < pieces.length; pi++) {
        var p = pieces[pi];
        if (!p.f) { parts.push({ kind: 'lit', text: p.v }); continue; }
        parts.push.apply(parts, this.parseFStringBody(p.raw, p.isRaw, t.line));
      }
      return { type: 'FString', parts: parts, loc: loc };
    }

    if (t.type === 'KEYWORD') {
      if (t.value === 'True') { this.next(); return { type: 'Const', v: true, loc: loc }; }
      if (t.value === 'False') { this.next(); return { type: 'Const', v: false, loc: loc }; }
      if (t.value === 'None') { this.next(); return { type: 'Const', v: null, loc: loc }; }
      if (t.value === 'lambda') return this.parseLambda();
      if (t.value === 'not') return this.parseNot();
      if (t.value === 'yield') return this.parseYield();
      if (t.value === 'await') return this.parseAwait();
    }

    if (t.type === 'NAME') {
      this.next();
      return { type: 'Name', id: t.value, loc: loc };
    }

    if (t.type === 'OP') {
      if (t.value === '...') { this.next(); return { type: 'Const', v: 'Ellipsis', ellipsis: true, loc: loc }; }
      if (t.value === '(') {
        this.next();
        if (this.atOp(')')) { this.next(); return { type: 'Tuple', elts: [], loc: loc }; }
        if (this.atKw('yield')) {
          var y = this.parseYield();
          this.expectOp(')');
          return y;
        }
        var firstEl = this.atOp('*')
          ? (function (p) { var s = p.next(); return { type: 'Starred', value: p.parseExpr(), loc: p.loc(s) }; })(this)
          : this.parseNamedExpr();
        if (this.atKw('for') || (this.atKw('async') && this.peek(1) && this.peek(1).value === 'for')) {
          var gens = this.parseComprehensionClauses();
          this.expectOp(')');
          return { type: 'GeneratorExp', elt: firstEl, generators: gens, loc: loc };
        }
        if (this.atOp(',')) {
          var elts = [firstEl];
          while (this.acceptOp(',')) {
            if (this.atOp(')')) break;
            if (this.atOp('*')) { var s3 = this.next(); elts.push({ type: 'Starred', value: this.parseExpr(), loc: this.loc(s3) }); }
            else elts.push(this.parseNamedExpr());
          }
          this.expectOp(')');
          return { type: 'Tuple', elts: elts, loc: loc };
        }
        this.expectOp(')');
        if (firstEl.type === 'Tuple' || firstEl.type === 'Starred') return firstEl;
        return firstEl;
      }
      if (t.value === '[') {
        this.next();
        if (this.atOp(']')) { this.next(); return { type: 'List', elts: [], loc: loc }; }
        var fe = this.atOp('*')
          ? (function (p) { var s = p.next(); return { type: 'Starred', value: p.parseExpr(), loc: p.loc(s) }; })(this)
          : this.parseNamedExpr();
        if (this.atKw('for') || (this.atKw('async') && this.peek(1) && this.peek(1).value === 'for')) {
          var lgens = this.parseComprehensionClauses();
          this.expectOp(']');
          return { type: 'ListComp', elt: fe, generators: lgens, loc: loc };
        }
        var lelts = [fe];
        while (this.acceptOp(',')) {
          if (this.atOp(']')) break;
          if (this.atOp('*')) { var s4 = this.next(); lelts.push({ type: 'Starred', value: this.parseExpr(), loc: this.loc(s4) }); }
          else lelts.push(this.parseNamedExpr());
        }
        this.expectOp(']');
        return { type: 'List', elts: lelts, loc: loc };
      }
      if (t.value === '{') {
        this.next();
        if (this.atOp('}')) { this.next(); return { type: 'Dict', keys: [], values: [], loc: loc }; }
        if (this.atOp('**')) {
          var keys = [], values = [];
          do {
            if (this.atOp('}')) break;
            if (this.acceptOp('**')) { keys.push(null); values.push(this.parseOr()); }
            else {
              var k0 = this.parseNamedExpr();
              this.expectOp(':');
              keys.push(k0); values.push(this.parseExpr());
            }
          } while (this.acceptOp(','));
          this.expectOp('}');
          return { type: 'Dict', keys: keys, values: values, loc: loc };
        }
        var firstKey = this.atOp('*')
          ? (function (p) { var s = p.next(); return { type: 'Starred', value: p.parseExpr(), loc: p.loc(s) }; })(this)
          : this.parseNamedExpr();
        if (this.atOp(':')) {
          this.next();
          var firstVal = this.parseExpr();
          if (this.atKw('for') || (this.atKw('async') && this.peek(1) && this.peek(1).value === 'for')) {
            var dgens = this.parseComprehensionClauses();
            this.expectOp('}');
            return { type: 'DictComp', key: firstKey, value: firstVal, generators: dgens, loc: loc };
          }
          var dkeys = [firstKey], dvals = [firstVal];
          while (this.acceptOp(',')) {
            if (this.atOp('}')) break;
            if (this.acceptOp('**')) { dkeys.push(null); dvals.push(this.parseOr()); continue; }
            var kk = this.parseNamedExpr();
            this.expectOp(':');
            dkeys.push(kk); dvals.push(this.parseExpr());
          }
          this.expectOp('}');
          return { type: 'Dict', keys: dkeys, values: dvals, loc: loc };
        }
        if (this.atKw('for') || (this.atKw('async') && this.peek(1) && this.peek(1).value === 'for')) {
          var sgens = this.parseComprehensionClauses();
          this.expectOp('}');
          return { type: 'SetComp', elt: firstKey, generators: sgens, loc: loc };
        }
        var selts = [firstKey];
        while (this.acceptOp(',')) {
          if (this.atOp('}')) break;
          if (this.atOp('*')) { var s5 = this.next(); selts.push({ type: 'Starred', value: this.parseExpr(), loc: this.loc(s5) }); }
          else selts.push(this.parseNamedExpr());
        }
        this.expectOp('}');
        return { type: 'Set', elts: selts, loc: loc };
      }
    }

    this.err("invalid syntax near '" + (t.value === null ? 'end of input' : t.value) + "'");
  };

  /**
   * Parse the interior of an f-string into literal and expression parts.
   * Supports nesting, `=` debug specifiers, conversions (!r/!s/!a) and
   * format specs (including nested replacement fields).
   */
  P.parseFStringBody = function (raw, isRaw, line) {
    var parts = [];
    var buf = '';
    var i = 0;
    var n = raw.length;
    while (i < n) {
      var c = raw[i];
      if (c === '{') {
        if (raw[i + 1] === '{') { buf += '{'; i += 2; continue; }
        if (buf) { parts.push({ kind: 'lit', text: isRaw ? buf : Lexer.unescape(buf, false, false, line) }); buf = ''; }
        i++;
        var depth = 1;
        var exprStart = i;
        var inStr = null;
        while (i < n && depth > 0) {
          var ch = raw[i];
          if (inStr) {
            if (ch === '\\') { i += 2; continue; }
            if (ch === inStr) inStr = null;
            i++;
            continue;
          }
          if (ch === "'" || ch === '"') { inStr = ch; i++; continue; }
          if (ch === '{' || ch === '[' || ch === '(') depth++;
          else if (ch === '}' || ch === ']' || ch === ')') depth--;
          if (depth === 0) break;
          i++;
        }
        if (depth !== 0) throw new ParseError("f-string: expecting '}'", line, 0);
        var inner = raw.slice(exprStart, i);
        i++; // consume '}'

        // Split off the format spec / conversion at bracket depth zero.
        var spec = null, conv = null, showExpr = false;
        var d = 0, q = null, cut = -1, convAt = -1;
        for (var j = 0; j < inner.length; j++) {
          var cc = inner[j];
          if (q) { if (cc === '\\') { j++; continue; } if (cc === q) q = null; continue; }
          if (cc === "'" || cc === '"') { q = cc; continue; }
          if (cc === '(' || cc === '[' || cc === '{') d++;
          else if (cc === ')' || cc === ']' || cc === '}') d--;
          else if (d === 0 && cc === ':') { cut = j; break; }
          else if (d === 0 && cc === '!' && inner[j + 1] !== '=' && j + 1 < inner.length) { convAt = j; }
        }
        var exprSrc = inner;
        if (cut >= 0) { spec = inner.slice(cut + 1); exprSrc = inner.slice(0, cut); }
        var cm = /!([rsa])\s*$/.exec(exprSrc);
        if (cm) { conv = cm[1]; exprSrc = exprSrc.slice(0, cm.index); }
        if (/=\s*$/.test(exprSrc) && !/[=!<>]=\s*$/.test(exprSrc)) {
          showExpr = true;
          exprSrc = exprSrc.replace(/=\s*$/, '');
        }
        exprSrc = exprSrc.trim();
        if (!exprSrc) throw new ParseError('f-string: empty expression not allowed', line, 0);
        var subToks = Lexer.tokenize(exprSrc);
        var subParser = new Parser(subToks, exprSrc);
        var expr = subParser.parseExprListAsTuple();
        var specParts = null;
        if (spec !== null && spec.indexOf('{') >= 0) {
          specParts = this.parseFStringBody(spec, true, line);
        }
        parts.push({
          kind: 'expr', expr: expr, spec: spec, specParts: specParts,
          conv: conv, showExpr: showExpr, src: exprSrc
        });
        continue;
      }
      if (c === '}') {
        if (raw[i + 1] === '}') { buf += '}'; i += 2; continue; }
        throw new ParseError("f-string: single '}' is not allowed", line, 0);
      }
      buf += c;
      i++;
    }
    if (buf) parts.push({ kind: 'lit', text: isRaw ? buf : Lexer.unescape(buf, false, false, line) });
    return parts;
  };

  function parse(src) {
    var toks = Lexer.tokenize(src);
    var p = new Parser(toks, src);
    return p.parseModule();
  }

  function parseExpression(src) {
    var toks = Lexer.tokenize(src);
    var p = new Parser(toks, src);
    var e = p.parseExprListAsTuple();
    return e;
  }

  root.PyParser = { parse: parse, parseExpression: parseExpression, ParseError: ParseError, Parser: Parser };
})(typeof window !== 'undefined' ? window : globalThis);
