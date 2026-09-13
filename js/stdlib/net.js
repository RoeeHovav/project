/* ============================================================================
 * net.js — The simulated internet plus the modules that reach it.
 *
 * ipaddress, urllib.parse, socket, requests, sqlite3 (a genuinely injectable
 * mini-SQL engine), subprocess, scapy-lite, pickle/yaml demos.
 *
 * The target hosts below are deliberately vulnerable so that the security
 * chapters can be practised for real: the SQL engine really does honour
 * `' OR '1'='1' --`, and the HTTP apps really do reflect unescaped input.
 * Nothing here touches the outside world.
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
      toBigInt = O.toBigInt, toNumber = O.toNumber;
  var kwget = S.kwget, argk = S.argk, inum = S.inum;

  function lazyIter(nextFn, name) {
    var it = new PyIterator(nextFn, name || 'iterator');
    it.__reprNative__ = function () { return '<' + (name || 'iterator') + ' object>'; };
    return it;
  }
  function dictOf(obj) {
    var d = new PyDict();
    Object.keys(obj).forEach(function (k) { d.set(k, obj[k]); });
    return d;
  }

  // ===========================================================================
  // A very small SQL engine — injectable on purpose
  // ===========================================================================

  function SqlDb() { this.tables = Object.create(null); }

  function sqlTokenize(sql) {
    var toks = [];
    var i = 0;
    while (i < sql.length) {
      var c = sql[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '-' && sql[i + 1] === '-') { while (i < sql.length && sql[i] !== '\n') i++; continue; }
      if (c === '#') { while (i < sql.length && sql[i] !== '\n') i++; continue; }
      if (c === '/' && sql[i + 1] === '*') { i += 2; while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++; i += 2; continue; }
      if (c === "'" || c === '"') {
        var q = c; i++;
        var s = '';
        while (i < sql.length) {
          if (sql[i] === q) {
            if (sql[i + 1] === q) { s += q; i += 2; continue; }
            i++; break;
          }
          if (sql[i] === '\\' && i + 1 < sql.length) { s += sql[i + 1]; i += 2; continue; }
          s += sql[i++];
        }
        toks.push({ t: 'str', v: s });
        continue;
      }
      if (/[0-9]/.test(c)) {
        var n = '';
        while (i < sql.length && /[0-9.]/.test(sql[i])) n += sql[i++];
        toks.push({ t: 'num', v: parseFloat(n) });
        continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        var w = '';
        while (i < sql.length && /[A-Za-z0-9_.]/.test(sql[i])) w += sql[i++];
        toks.push({ t: 'word', v: w, up: w.toUpperCase() });
        continue;
      }
      var two = sql.substr(i, 2);
      if (two === '<=' || two === '>=' || two === '<>' || two === '!=' || two === '||') {
        toks.push({ t: 'op', v: two }); i += 2; continue;
      }
      toks.push({ t: 'op', v: c });
      i++;
    }
    return toks;
  }

  function SqlParser(toks) { this.toks = toks; this.i = 0; this.paramCount = 0; }
  SqlParser.prototype.peek = function () { return this.toks[this.i]; };
  SqlParser.prototype.next = function () { return this.toks[this.i++]; };
  SqlParser.prototype.atWord = function (w) {
    var t = this.peek();
    return t && t.t === 'word' && t.up === w;
  };
  SqlParser.prototype.acceptWord = function (w) { if (this.atWord(w)) { this.i++; return true; } return false; };
  SqlParser.prototype.atOp = function (v) { var t = this.peek(); return t && t.t === 'op' && t.v === v; };
  SqlParser.prototype.acceptOp = function (v) { if (this.atOp(v)) { this.i++; return true; } return false; };
  SqlParser.prototype.fail = function (msg) { var e = new Error(msg); e.sqlError = true; throw e; };

  // expr := orExpr
  SqlParser.prototype.parseExpr = function () { return this.parseOr(); };
  SqlParser.prototype.parseOr = function () {
    var left = this.parseAnd();
    while (this.acceptWord('OR')) left = { op: 'or', l: left, r: this.parseAnd() };
    return left;
  };
  SqlParser.prototype.parseAnd = function () {
    var left = this.parseNot();
    while (this.acceptWord('AND')) left = { op: 'and', l: left, r: this.parseNot() };
    return left;
  };
  SqlParser.prototype.parseNot = function () {
    if (this.acceptWord('NOT')) return { op: 'not', l: this.parseNot() };
    return this.parseCmp();
  };
  SqlParser.prototype.parseCmp = function () {
    var left = this.parseAtom();
    for (;;) {
      if (this.acceptOp('=') || this.acceptOp('==')) { left = { op: '=', l: left, r: this.parseAtom() }; continue; }
      if (this.acceptOp('<>') || this.acceptOp('!=')) { left = { op: '!=', l: left, r: this.parseAtom() }; continue; }
      if (this.acceptOp('<=')) { left = { op: '<=', l: left, r: this.parseAtom() }; continue; }
      if (this.acceptOp('>=')) { left = { op: '>=', l: left, r: this.parseAtom() }; continue; }
      if (this.acceptOp('<')) { left = { op: '<', l: left, r: this.parseAtom() }; continue; }
      if (this.acceptOp('>')) { left = { op: '>', l: left, r: this.parseAtom() }; continue; }
      if (this.acceptWord('LIKE')) { left = { op: 'like', l: left, r: this.parseAtom() }; continue; }
      if (this.acceptWord('IS')) {
        var neg = this.acceptWord('NOT');
        this.acceptWord('NULL');
        left = { op: neg ? 'isnotnull' : 'isnull', l: left };
        continue;
      }
      break;
    }
    return left;
  };
  SqlParser.prototype.parseAtom = function () {
    if (this.acceptOp('(')) {
      var e = this.parseExpr();
      this.acceptOp(')');
      return e;
    }
    var t = this.next();
    if (!t) this.fail('unexpected end of SQL');
    if (t.t === 'str') return { op: 'lit', v: t.v };
    if (t.t === 'num') return { op: 'lit', v: t.v };
    if (t.t === 'op' && t.v === '?') return { op: 'param', idx: this.paramCount++ };
    if (t.t === 'word') {
      if (t.up === 'NULL') return { op: 'lit', v: null };
      if (t.up === 'TRUE') return { op: 'lit', v: 1 };
      if (t.up === 'FALSE') return { op: 'lit', v: 0 };
      if (this.atOp('(')) {
        // Function call, e.g. COUNT(*) / UPPER(x) / sqlite_version()
        this.next();
        var args = [];
        while (!this.atOp(')') && this.peek()) {
          if (this.acceptOp('*')) { args.push({ op: 'star' }); }
          else args.push(this.parseExpr());
          if (!this.acceptOp(',')) break;
        }
        this.acceptOp(')');
        return { op: 'call', name: t.up, args: args };
      }
      return { op: 'col', name: t.v };
    }
    if (t.t === 'op' && t.v === '*') return { op: 'star' };
    this.fail('unexpected token ' + JSON.stringify(t.v) + ' in SQL');
  };

  function sqlParseSelect(p) {
    var stmt = { kind: 'select', cols: [], from: null, where: null, limit: null, union: null, orderBy: null };
    do {
      if (p.acceptOp('*')) { stmt.cols.push({ expr: { op: 'star' }, alias: '*' }); }
      else {
        var e = p.parseExpr();
        var alias = null;
        if (p.acceptWord('AS')) alias = p.next().v;
        else if (p.peek() && p.peek().t === 'word' &&
                 ['FROM', 'WHERE', 'LIMIT', 'UNION', 'ORDER', 'GROUP'].indexOf(p.peek().up) < 0) {
          alias = p.next().v;
        }
        stmt.cols.push({ expr: e, alias: alias });
      }
    } while (p.acceptOp(','));
    if (p.acceptWord('FROM')) {
      var t = p.next();
      stmt.from = t ? t.v : null;
    }
    if (p.acceptWord('WHERE')) stmt.where = p.parseExpr();
    if (p.acceptWord('ORDER')) {
      p.acceptWord('BY');
      var oc = p.parseExpr();
      var desc = p.acceptWord('DESC');
      p.acceptWord('ASC');
      stmt.orderBy = { expr: oc, desc: desc };
    }
    if (p.acceptWord('LIMIT')) {
      var lt = p.next();
      stmt.limit = lt && lt.t === 'num' ? lt.v : null;
    }
    if (p.acceptWord('UNION')) {
      p.acceptWord('ALL');
      p.acceptWord('SELECT');
      stmt.union = sqlParseSelect(p);
    }
    return stmt;
  }

  function sqlParse(sqlText) {
    var toks = sqlTokenize(sqlText);
    var p = new SqlParser(toks);
    var stmts = [];
    while (p.peek()) {
      if (p.acceptOp(';')) continue;
      if (p.acceptWord('SELECT')) { stmts.push(sqlParseSelect(p)); continue; }
      if (p.acceptWord('INSERT')) {
        p.acceptWord('INTO');
        var tname = p.next().v;
        var cols = null;
        if (p.acceptOp('(')) {
          cols = [];
          do { cols.push(p.next().v); } while (p.acceptOp(','));
          p.acceptOp(')');
        }
        p.acceptWord('VALUES');
        var rows = [];
        do {
          p.acceptOp('(');
          var vals = [];
          do { vals.push(p.parseExpr()); } while (p.acceptOp(','));
          p.acceptOp(')');
          rows.push(vals);
        } while (p.acceptOp(','));
        stmts.push({ kind: 'insert', table: tname, cols: cols, rows: rows });
        continue;
      }
      if (p.acceptWord('CREATE')) {
        p.acceptWord('TABLE');
        if (p.acceptWord('IF')) { p.acceptWord('NOT'); p.acceptWord('EXISTS'); }
        var cname = p.next().v;
        var defs = [];
        if (p.acceptOp('(')) {
          var depth = 1;
          var cur = [];
          while (p.peek() && depth > 0) {
            if (p.atOp('(')) depth++;
            if (p.atOp(')')) { depth--; if (!depth) { p.next(); break; } }
            if (p.atOp(',') && depth === 1) { p.next(); if (cur.length) defs.push(cur[0]); cur = []; continue; }
            var tk = p.next();
            if (!cur.length && tk.t === 'word') cur.push(tk.v);
          }
          if (cur.length) defs.push(cur[0]);
        }
        stmts.push({ kind: 'create', table: cname, cols: defs });
        continue;
      }
      if (p.acceptWord('UPDATE')) {
        var utable = p.next().v;
        p.acceptWord('SET');
        var sets = [];
        do {
          var col = p.next().v;
          p.acceptOp('=');
          sets.push({ col: col, expr: p.parseExpr() });
        } while (p.acceptOp(','));
        var uwhere = p.acceptWord('WHERE') ? p.parseExpr() : null;
        stmts.push({ kind: 'update', table: utable, sets: sets, where: uwhere });
        continue;
      }
      if (p.acceptWord('DELETE')) {
        p.acceptWord('FROM');
        var dtable = p.next().v;
        var dwhere = p.acceptWord('WHERE') ? p.parseExpr() : null;
        stmts.push({ kind: 'delete', table: dtable, where: dwhere });
        continue;
      }
      if (p.acceptWord('DROP')) {
        p.acceptWord('TABLE');
        if (p.acceptWord('IF')) p.acceptWord('EXISTS');
        stmts.push({ kind: 'drop', table: p.next().v });
        continue;
      }
      if (p.acceptWord('PRAGMA') || p.acceptWord('BEGIN') || p.acceptWord('COMMIT')) {
        while (p.peek() && !p.atOp(';')) p.next();
        continue;
      }
      p.fail('unsupported SQL statement near ' + JSON.stringify(p.peek().v));
    }
    return stmts;
  }

  function sqlEval(node, row, ctx) {
    switch (node.op) {
      case 'lit': return node.v;
      case 'param': {
        // Placeholders are numbered at parse time, so re-evaluating the same
        // expression for every row keeps binding the same value.
        if (ctx.params && node.idx < ctx.params.length) return ctx.params[node.idx];
        return null;
      }
      case 'star': return 1;
      case 'col': {
        var name = node.name;
        if (row && Object.prototype.hasOwnProperty.call(row, name)) return row[name];
        var short = name.indexOf('.') >= 0 ? name.split('.').pop() : name;
        if (row && Object.prototype.hasOwnProperty.call(row, short)) return row[short];
        // An unknown bare word behaves like SQLite: it is an error unless the
        // query is being abused, where treating it as a literal keeps the
        // classic injection payloads working.
        return null;
      }
      case 'call': {
        var args = node.args.map(function (a) { return sqlEval(a, row, ctx); });
        switch (node.name) {
          case 'UPPER': return String(args[0]).toUpperCase();
          case 'LOWER': return String(args[0]).toLowerCase();
          case 'LENGTH': return String(args[0]).length;
          case 'COUNT': return ctx.aggCount || 0;
          case 'SQLITE_VERSION': return '3.45.0';
          case 'HEX': return Array.from(String(args[0])).map(function (c) {
            return c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase();
          }).join('');
          case 'SUBSTR': return String(args[0]).substr(args[1] - 1, args[2]);
          default: return null;
        }
      }
      case 'and': return truthySql(sqlEval(node.l, row, ctx)) && truthySql(sqlEval(node.r, row, ctx)) ? 1 : 0;
      case 'or': return truthySql(sqlEval(node.l, row, ctx)) || truthySql(sqlEval(node.r, row, ctx)) ? 1 : 0;
      case 'not': return truthySql(sqlEval(node.l, row, ctx)) ? 0 : 1;
      case 'isnull': return sqlEval(node.l, row, ctx) === null ? 1 : 0;
      case 'isnotnull': return sqlEval(node.l, row, ctx) !== null ? 1 : 0;
      case 'like': {
        var v = String(sqlEval(node.l, row, ctx));
        var pat = String(sqlEval(node.r, row, ctx))
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/%/g, '.*').replace(/_/g, '.');
        return new RegExp('^' + pat + '$', 'i').test(v) ? 1 : 0;
      }
      default: {
        var a = sqlEval(node.l, row, ctx);
        var b = sqlEval(node.r, row, ctx);
        if (typeof a === 'number' && typeof b === 'string' && /^-?\d+(\.\d+)?$/.test(b)) b = parseFloat(b);
        if (typeof b === 'number' && typeof a === 'string' && /^-?\d+(\.\d+)?$/.test(a)) a = parseFloat(a);
        switch (node.op) {
          case '=': return a === b ? 1 : 0;
          case '!=': return a !== b ? 1 : 0;
          case '<': return a < b ? 1 : 0;
          case '>': return a > b ? 1 : 0;
          case '<=': return a <= b ? 1 : 0;
          case '>=': return a >= b ? 1 : 0;
        }
        return 0;
      }
    }
  }
  function truthySql(v) { return !(v === 0 || v === null || v === '' || v === false); }

  SqlDb.prototype.exec = function (sqlText, params) {
    var stmts = sqlParse(sqlText);
    var ctx = { params: params || [], paramIndex: 0 };
    var lastRows = [];
    var lastCols = [];
    var self = this;
    stmts.forEach(function (stmt) {
      switch (stmt.kind) {
        case 'create':
          if (!self.tables[stmt.table]) self.tables[stmt.table] = { cols: stmt.cols, rows: [] };
          break;
        case 'insert': {
          var tbl = self.tables[stmt.table];
          if (!tbl) { var e = new Error('no such table: ' + stmt.table); e.sqlError = true; throw e; }
          stmt.rows.forEach(function (vals) {
            var row = {};
            var cols = stmt.cols || tbl.cols;
            cols.forEach(function (c, i) {
              row[c] = i < vals.length ? sqlEval(vals[i], null, ctx) : null;
            });
            tbl.rows.push(row);
          });
          break;
        }
        case 'update': {
          var ut = self.tables[stmt.table];
          if (!ut) break;
          ut.rows.forEach(function (row) {
            if (!stmt.where || truthySql(sqlEval(stmt.where, row, ctx))) {
              stmt.sets.forEach(function (s) { row[s.col] = sqlEval(s.expr, row, ctx); });
            }
          });
          break;
        }
        case 'delete': {
          var dt = self.tables[stmt.table];
          if (!dt) break;
          dt.rows = dt.rows.filter(function (row) {
            return stmt.where ? !truthySql(sqlEval(stmt.where, row, ctx)) : false;
          });
          break;
        }
        case 'drop':
          delete self.tables[stmt.table];
          break;
        case 'select': {
          var r = self.select(stmt, ctx);
          lastRows = r.rows;
          lastCols = r.cols;
          break;
        }
      }
    });
    return { rows: lastRows, cols: lastCols };
  };

  SqlDb.prototype.select = function (stmt, ctx) {
    var tbl = stmt.from ? this.tables[stmt.from] : null;
    if (stmt.from && !tbl) {
      var e = new Error('no such table: ' + stmt.from);
      e.sqlError = true;
      throw e;
    }
    var source = tbl ? tbl.rows : [{}];
    var matched = source.filter(function (row) {
      return stmt.where ? truthySql(sqlEval(stmt.where, row, ctx)) : true;
    });
    var colNames = [];
    var wantsStar = stmt.cols.some(function (c) { return c.expr.op === 'star'; });
    if (wantsStar && tbl) colNames = tbl.cols.slice();
    else colNames = stmt.cols.map(function (c, i) {
      return c.alias || (c.expr.op === 'col' ? c.expr.name : 'col' + (i + 1));
    });

    var out = matched.map(function (row) {
      if (wantsStar && tbl) return tbl.cols.map(function (c) { return row[c]; });
      return stmt.cols.map(function (c) { return sqlEval(c.expr, row, ctx); });
    });
    if (stmt.orderBy) {
      out.sort(function (a, b) { return 0; });
      matched.sort(function (x, y) {
        var a = sqlEval(stmt.orderBy.expr, x, ctx);
        var b = sqlEval(stmt.orderBy.expr, y, ctx);
        return (a < b ? -1 : a > b ? 1 : 0) * (stmt.orderBy.desc ? -1 : 1);
      });
      out = matched.map(function (row) {
        if (wantsStar && tbl) return tbl.cols.map(function (c) { return row[c]; });
        return stmt.cols.map(function (c) { return sqlEval(c.expr, row, ctx); });
      });
    }
    if (stmt.limit !== null && stmt.limit !== undefined) out = out.slice(0, stmt.limit);
    if (stmt.union) {
      var u = this.select(stmt.union, ctx);
      out = out.concat(u.rows);
    }
    return { rows: out, cols: colNames };
  };

  root.PySql = { SqlDb: SqlDb, parse: sqlParse };

  // ===========================================================================
  // The simulated network
  // ===========================================================================

  function buildWorld() {
    var db = new SqlDb();
    db.exec("CREATE TABLE users (id, username, password, email, role, secret_note)");
    db.exec("INSERT INTO users (id, username, password, email, role, secret_note) VALUES " +
      "(1, 'admin', 'S3cur3!Adm1n', 'admin@shop.local', 'admin', 'CTF{sql_injection_is_a_parameterisation_bug}')," +
      "(2, 'alice', 'password123', 'alice@shop.local', 'user', 'likes hiking')," +
      "(3, 'bob', 'letmein', 'bob@shop.local', 'user', 'owns a boat')," +
      "(4, 'carol', 'qwerty', 'carol@shop.local', 'user', 'plays bass')");
    db.exec("CREATE TABLE products (id, name, price, stock)");
    db.exec("INSERT INTO products (id, name, price, stock) VALUES " +
      "(1, 'Rubber Duck', 9.99, 42), (2, 'Faraday Pouch', 24.5, 7), " +
      "(3, 'YubiKey Clone', 19.0, 0), (4, 'Cable Tester', 55.25, 13)");

    var files = {
      '/var/www/public/index.html': '<h1>Shop</h1>',
      '/var/www/public/robots.txt': 'User-agent: *\nDisallow: /admin\nDisallow: /backup/',
      '/var/www/backup/db.sql.bak': "INSERT INTO users VALUES (1,'admin','S3cur3!Adm1n','admin@shop.local','admin');",
      '/etc/passwd': 'root:x:0:0:root:/root:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\n' +
                     'analyst:x:1000:1000:Analyst:/home/analyst:/bin/bash',
      '/etc/shadow': 'root:$6$rounds=656000$abcd$REDACTED:19000:0:99999:7:::',
      '/home/analyst/.ssh/id_rsa': '-----BEGIN OPENSSH PRIVATE KEY-----\nCTF{never_expose_private_keys}\n-----END OPENSSH PRIVATE KEY-----'
    };

    function html(title, body) {
      return '<!doctype html><html><head><title>' + title + '</title></head><body>' + body + '</body></html>';
    }

    var sessions = Object.create(null);

    var shop = {
      name: 'shop.local',
      routes: function (req) {
        var q = req.query;
        if (req.path === '/' || req.path === '/index.html') {
          return { status: 200, body: html('Shop', '<h1>Vuln Shop</h1><p>Try /login, /search, /account, /download, /ping</p>') };
        }
        if (req.path === '/robots.txt') return { status: 200, body: files['/var/www/public/robots.txt'], type: 'text/plain' };

        if (req.path === '/login') {
          if (req.method !== 'POST') {
            return { status: 200, body: html('Login', '<form method=post><input name=username><input name=password type=password></form>') };
          }
          var u = req.form.username || '';
          var p = req.form.password || '';
          // Deliberately concatenated: this is the bug the SQLi lesson teaches.
          var sql = "SELECT id, username, role, secret_note FROM users WHERE username = '" + u +
                    "' AND password = '" + p + "'";
          var res;
          try { res = db.exec(sql); }
          catch (e) { return { status: 500, body: html('Error', '<pre>SQL error: ' + e.message + '</pre>'), sql: sql }; }
          if (res.rows.length) {
            var row = res.rows[0];
            var token = 'sess_' + (row[1] || 'x') + '_' + res.rows.length;
            sessions[token] = { user: row[1], role: row[2] };
            return {
              status: 200,
              headers: { 'Set-Cookie': 'session=' + token + '; HttpOnly' },
              body: html('Welcome', '<h1>Welcome back, ' + row[1] + '</h1><p>role=' + row[2] +
                '</p><p>rows returned: ' + res.rows.length + '</p><pre>' +
                res.rows.map(function (r) { return r.join(' | '); }).join('\n') + '</pre>'),
              sql: sql
            };
          }
          return { status: 401, body: html('Denied', '<h1>Invalid credentials</h1>'), sql: sql };
        }

        if (req.path === '/search') {
          var term = q.q || '';
          // Reflected, unescaped: the XSS lesson.
          return {
            status: 200,
            body: html('Search', '<h1>Results for ' + term + '</h1><ul>' +
              db.exec("SELECT name, price FROM products").rows
                .filter(function (r) { return String(r[0]).toLowerCase().indexOf(String(term).toLowerCase()) >= 0; })
                .map(function (r) { return '<li>' + r[0] + ' — $' + r[1] + '</li>'; }).join('') + '</ul>')
          };
        }

        if (req.path === '/account') {
          // No ownership check: the IDOR lesson.
          var id = q.id || '2';
          var rows = db.exec("SELECT id, username, email, secret_note FROM users WHERE id = ?", [parseFloat(id)]).rows;
          if (!rows.length) return { status: 404, body: html('Not found', 'no such account') };
          var r2 = rows[0];
          return {
            status: 200,
            body: html('Account', '<h1>Account ' + r2[0] + '</h1><p>user: ' + r2[1] +
              '</p><p>email: ' + r2[2] + '</p><p>note: ' + r2[3] + '</p>')
          };
        }

        if (req.path === '/download') {
          // No normalisation: the path-traversal lesson.
          var f = q.file || 'index.html';
          var full = '/var/www/public/' + f;
          var parts = [];
          full.split('/').forEach(function (seg) {
            if (seg === '..') parts.pop();
            else if (seg !== '.' && seg !== '') parts.push(seg);
          });
          var resolved = '/' + parts.join('/');
          if (files[resolved] === undefined) return { status: 404, body: 'File not found: ' + resolved, type: 'text/plain' };
          return { status: 200, body: files[resolved], type: 'text/plain' };
        }

        if (req.path === '/ping') {
          // Shell metacharacters pass straight through: command injection.
          var host = q.host || '127.0.0.1';
          var out = 'PING ' + host.split(/[;&|]/)[0].trim() + ': 3 packets transmitted, 3 received\n';
          var extra = /[;&|`]/.exec(host);
          if (extra) {
            var cmd = host.slice(extra.index + 1).trim();
            out += runFakeShell(cmd, files);
          }
          return { status: 200, body: out, type: 'text/plain' };
        }

        if (req.path === '/admin' || req.path === '/flag') {
          var cookie = (req.headers.Cookie || req.headers.cookie || '');
          var mm = /session=([^;]+)/.exec(cookie);
          var sess = mm ? sessions[mm[1]] : null;
          if (!sess || sess.role !== 'admin') {
            return { status: 403, body: html('Forbidden', '<h1>403 — admin only</h1>') };
          }
          return { status: 200, body: html('Flag', '<h1>CTF{admin_panel_reached}</h1>') };
        }

        if (req.path === '/api/products') {
          var rows3 = db.exec('SELECT id, name, price, stock FROM products').rows;
          return {
            status: 200, type: 'application/json',
            body: JSON.stringify(rows3.map(function (r) {
              return { id: r[0], name: r[1], price: r[2], stock: r[3] };
            }))
          };
        }
        return { status: 404, body: html('404', '<h1>404 Not Found</h1>') };
      }
    };

    var intranet = {
      name: 'intranet.local',
      routes: function (req) {
        if (req.path === '/api/me' || req.path === '/api/admin') {
          var auth = req.headers.Authorization || req.headers.authorization || '';
          var token = auth.replace(/^Bearer\s+/i, '');
          if (!token) return { status: 401, type: 'application/json', body: '{"error":"missing token"}' };
          var parts = token.split('.');
          if (parts.length !== 3) return { status: 400, type: 'application/json', body: '{"error":"malformed token"}' };
          var payload;
          try {
            payload = JSON.parse(atobUrl(parts[1]));
          } catch (e) {
            return { status: 400, type: 'application/json', body: '{"error":"bad payload"}' };
          }
          var header;
          try { header = JSON.parse(atobUrl(parts[0])); } catch (e) { header = {}; }
          // The bug: the server trusts the header's algorithm claim.
          if (header.alg === 'none') {
            // signature not checked at all
          } else if (parts[2].length < 10) {
            return { status: 401, type: 'application/json', body: '{"error":"invalid signature"}' };
          }
          if (req.path === '/api/admin') {
            if (payload.role !== 'admin') {
              return { status: 403, type: 'application/json', body: '{"error":"admin required"}' };
            }
            return { status: 200, type: 'application/json', body: '{"flag":"CTF{alg_none_is_not_a_signature}"}' };
          }
          return { status: 200, type: 'application/json', body: JSON.stringify(payload) };
        }
        if (req.path === '/') {
          return { status: 200, body: '<h1>Intranet</h1><p>API: /api/me, /api/admin (Bearer JWT)</p>' };
        }
        return { status: 404, body: '404' };
      }
    };

    var metadata = {
      name: '169.254.169.254',
      routes: function (req) {
        if (req.path.indexOf('/latest/meta-data') === 0) {
          if (req.path.indexOf('iam/security-credentials') >= 0) {
            return {
              status: 200, type: 'application/json',
              body: '{"AccessKeyId":"AKIA_SIMULATED","SecretAccessKey":"CTF{ssrf_reached_the_metadata_service}"}'
            };
          }
          return { status: 200, type: 'text/plain', body: 'ami-id\nhostname\niam/\ninstance-id\n' };
        }
        return { status: 404, body: 'not found' };
      }
    };

    var hosts = {
      '10.10.0.5': shop,
      '10.10.0.9': intranet,
      '169.254.169.254': metadata
    };
    var dns = {
      'shop.local': '10.10.0.5',
      'www.shop.local': '10.10.0.5',
      'intranet.local': '10.10.0.9',
      'metadata.internal': '169.254.169.254',
      'localhost': '127.0.0.1',
      'scanme.local': '192.168.56.101'
    };
    var openPorts = {
      '10.10.0.5': { 22: 'OpenSSH 8.9p1', 80: 'nginx 1.22.1', 443: 'nginx 1.22.1 (TLS)' },
      '10.10.0.9': { 80: 'gunicorn 21.2.0', 8080: 'gunicorn 21.2.0' },
      '192.168.56.101': { 21: 'vsftpd 2.3.4', 22: 'OpenSSH 4.7p1', 80: 'Apache 2.2.8',
                          139: 'Samba smbd 3.X', 3306: 'MySQL 5.0.51a', 8180: 'Apache Tomcat 5.5' },
      '127.0.0.1': { 22: 'OpenSSH 9.6p1', 8000: 'python http.server' }
    };

    return { db: db, hosts: hosts, dns: dns, openPorts: openPorts, files: files, sessions: sessions };
  }

  function atobUrl(s) {
    var t = s.replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    if (typeof atob === 'function') return atob(t);
    return Buffer.from(t, 'base64').toString('binary');
  }

  function runFakeShell(cmd, files) {
    cmd = cmd.trim();
    if (/^whoami/.test(cmd)) return 'www-data\n';
    if (/^id\b/.test(cmd)) return 'uid=33(www-data) gid=33(www-data) groups=33(www-data)\n';
    if (/^pwd/.test(cmd)) return '/var/www/public\n';
    if (/^uname/.test(cmd)) return 'Linux web01 6.1.0 x86_64 GNU/Linux\n';
    if (/^ls/.test(cmd)) return 'index.html\nrobots.txt\n';
    var catM = /^cat\s+(\S+)/.exec(cmd);
    if (catM) {
      var f = catM[1];
      if (files[f] !== undefined) return files[f] + '\n';
      return 'cat: ' + f + ': No such file or directory\n';
    }
    if (/^env/.test(cmd)) return 'PATH=/usr/bin\nDB_PASSWORD=CTF{command_injection_leaks_env}\n';
    return 'sh: 1: ' + cmd.split(/\s+/)[0] + ': not found\n';
  }

  function getWorld(interp) {
    if (!interp.__world__) interp.__world__ = buildWorld();
    return interp.__world__;
  }
  root.PyWorld = { build: buildWorld, get: getWorld };

  // ===========================================================================
  // urllib.parse
  // ===========================================================================
  function parseUrl(url) {
    var m = /^(?:([a-zA-Z][\w+.-]*):)?(?:\/\/(?:([^@\/]*)@)?([^\/?#:]*)(?::(\d+))?)?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/.exec(url);
    return {
      scheme: m[1] || '', userinfo: m[2] || '', host: m[3] || '',
      port: m[4] ? parseInt(m[4], 10) : null, path: m[5] || '',
      query: m[6] || '', fragment: m[7] || ''
    };
  }
  function parseQs(qs) {
    var out = {};
    if (!qs) return out;
    qs.split('&').forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf('=');
      var k = i < 0 ? pair : pair.slice(0, i);
      var v = i < 0 ? '' : pair.slice(i + 1);
      k = decodeURIComponent(k.replace(/\+/g, ' '));
      v = decodeURIComponent(v.replace(/\+/g, ' '));
      if (!out[k]) out[k] = [];
      out[k].push(v);
    });
    return out;
  }
  root.PyUrl = { parseUrl: parseUrl, parseQs: parseQs };

  S.define('urllib', function (interp) {
    var m = S.makeModule('urllib');
    var parse = S.makeModule('urllib.parse');
    parse.fn('urlparse', function (args, k, it) {
      var u = parseUrl(str(args[0]));
      var netloc = (u.userinfo ? u.userinfo + '@' : '') + u.host + (u.port ? ':' + u.port : '');
      var cls = new PyClass('ParseResult', [], new Map());
      var inst = new PyInstance(cls);
      inst.__dict__.set('scheme', u.scheme);
      inst.__dict__.set('netloc', netloc);
      inst.__dict__.set('path', u.path);
      inst.__dict__.set('params', '');
      inst.__dict__.set('query', u.query);
      inst.__dict__.set('fragment', u.fragment);
      inst.__dict__.set('hostname', u.host.toLowerCase());
      inst.__dict__.set('port', u.port === null ? null : BigInt(u.port));
      cls.dict.set('__repr__', new PyBuiltin('__repr__', function () {
        return "ParseResult(scheme=" + repr(u.scheme) + ", netloc=" + repr(netloc) +
          ', path=' + repr(u.path) + ", params='', query=" + repr(u.query) +
          ', fragment=' + repr(u.fragment) + ')';
      }));
      return inst;
    });
    parse.fn('parse_qs', function (args, k, it) {
      var parsed = parseQs(str(args[0]));
      var d = new PyDict();
      Object.keys(parsed).forEach(function (key) { d.set(key, new PyList(parsed[key])); });
      return d;
    });
    parse.fn('parse_qsl', function (args, k, it) {
      var parsed = parseQs(str(args[0]));
      var out = [];
      Object.keys(parsed).forEach(function (key) {
        parsed[key].forEach(function (v) { out.push(new PyTuple([key, v])); });
      });
      return new PyList(out);
    });
    parse.fn('urlencode', function (args, k, it) {
      var d = args[0];
      var pairs = [];
      if (d instanceof PyDict) {
        d.map.forEach(function (e) {
          pairs.push(encodeURIComponent(str(e.k)).replace(/%20/g, '+') + '=' +
                     encodeURIComponent(str(e.v)).replace(/%20/g, '+'));
        });
      } else {
        it.toArray(d).forEach(function (p) {
          var pr = it.toArray(p);
          pairs.push(encodeURIComponent(str(pr[0])) + '=' + encodeURIComponent(str(pr[1])));
        });
      }
      return pairs.join('&');
    });
    parse.fn('quote', function (args) {
      var safe = args.length > 1 ? str(args[1]) : '/';
      return str(args[0]).split('').map(function (c) {
        if (/[A-Za-z0-9_.\-~]/.test(c) || safe.indexOf(c) >= 0) return c;
        return encodeURIComponent(c);
      }).join('');
    });
    parse.fn('quote_plus', function (args) {
      return encodeURIComponent(str(args[0])).replace(/%20/g, '+');
    });
    parse.fn('unquote', function (args) {
      try { return decodeURIComponent(str(args[0])); } catch (e) { return str(args[0]); }
    });
    parse.fn('unquote_plus', function (args) {
      try { return decodeURIComponent(str(args[0]).replace(/\+/g, ' ')); } catch (e) { return str(args[0]); }
    });
    parse.fn('urljoin', function (args) {
      var base = str(args[0]), rel = str(args[1]);
      if (/^[a-zA-Z][\w+.-]*:/.test(rel)) return rel;
      var b = parseUrl(base);
      if (rel.startsWith('//')) return b.scheme + ':' + rel;
      var prefix = b.scheme + '://' + b.host + (b.port ? ':' + b.port : '');
      if (rel.startsWith('/')) return prefix + rel;
      var dir = b.path.replace(/[^\/]*$/, '');
      return prefix + dir + rel;
    });
    m.val('parse', parse.mod);
    interp.registerModule('urllib.parse', function () { return parse.mod; });
    return m.mod;
  });

  // ===========================================================================
  // ipaddress
  // ===========================================================================
  S.define('ipaddress', function (interp) {
    var m = S.makeModule('ipaddress');
    var addrCls = new PyClass('IPv4Address', [], new Map());
    var netCls = new PyClass('IPv4Network', [], new Map());

    function ipToInt(s, it) {
      var parts = String(s).split('.');
      if (parts.length !== 4) it.valueError(repr(s) + ' does not appear to be an IPv4 or IPv6 address');
      var n = 0;
      parts.forEach(function (p) {
        var v = parseInt(p, 10);
        if (Number.isNaN(v) || v < 0 || v > 255 || !/^\d+$/.test(p)) {
          it.valueError(repr(s) + ' does not appear to be an IPv4 or IPv6 address');
        }
        n = n * 256 + v;
      });
      return n;
    }
    function intToIp(n) {
      return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
    }
    function mkAddr(n) {
      var inst = new PyInstance(addrCls);
      inst.__ip__ = n >>> 0;
      return inst;
    }
    addrCls.dict.set('__str__', new PyBuiltin('__str__', function (a) { return intToIp(a[0].__ip__); }));
    addrCls.dict.set('__repr__', new PyBuiltin('__repr__', function (a) { return "IPv4Address('" + intToIp(a[0].__ip__) + "')"; }));
    addrCls.dict.set('__int__', new PyBuiltin('__int__', function (a) { return BigInt(a[0].__ip__); }));
    addrCls.dict.set('__eq__', new PyBuiltin('__eq__', function (a) {
      return a[1] instanceof PyInstance && a[1].__ip__ === a[0].__ip__;
    }));
    addrCls.dict.set('__lt__', new PyBuiltin('__lt__', function (a) { return a[0].__ip__ < a[1].__ip__; }));
    function addrProp(name, fn) {
      addrCls.dict.set(name, new O.PyProperty(new PyBuiltin(name, function (a) { return fn(a[0].__ip__); }), null, null, null));
    }
    addrProp('is_private', function (n) {
      return (n >>> 24) === 10 || ((n >>> 20) === 0xac1) || ((n >>> 16) === 0xc0a8) ||
             ((n >>> 24) === 127) || ((n >>> 16) === 0xa9fe);
    });
    addrProp('is_loopback', function (n) { return (n >>> 24) === 127; });
    addrProp('is_multicast', function (n) { return (n >>> 24) >= 224 && (n >>> 24) <= 239; });
    addrProp('is_link_local', function (n) { return (n >>> 16) === 0xa9fe; });
    addrProp('is_global', function (n) {
      return !((n >>> 24) === 10 || ((n >>> 20) === 0xac1) || ((n >>> 16) === 0xc0a8) ||
               ((n >>> 24) === 127) || ((n >>> 16) === 0xa9fe));
    });
    addrProp('version', function () { return 4n; });
    addrProp('packed', function (n) { return new PyBytes([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]); });

    m.fn('ip_address', function (args, k, it) {
      var v = args[0];
      if (typeof v === 'bigint') return mkAddr(Number(v));
      return mkAddr(ipToInt(str(v), it));
    });
    m.val('IPv4Address', addrCls);

    function mkNet(base, prefix) {
      var inst = new PyInstance(netCls);
      var mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
      inst.__net__ = (base & mask) >>> 0;
      inst.__prefix__ = prefix;
      inst.__mask__ = mask;
      return inst;
    }
    netCls.dict.set('__str__', new PyBuiltin('__str__', function (a) {
      return intToIp(a[0].__net__) + '/' + a[0].__prefix__;
    }));
    netCls.dict.set('__repr__', new PyBuiltin('__repr__', function (a) {
      return "IPv4Network('" + intToIp(a[0].__net__) + '/' + a[0].__prefix__ + "')";
    }));
    netCls.dict.set('__contains__', new PyBuiltin('__contains__', function (a, k, it) {
      var self = a[0];
      var other = a[1];
      var n = other instanceof PyInstance ? other.__ip__ : ipToInt(str(other), it);
      return ((n & self.__mask__) >>> 0) === self.__net__;
    }));
    netCls.dict.set('__iter__', new PyBuiltin('__iter__', function (a) {
      var self = a[0];
      var size = self.__prefix__ === 32 ? 1 : Math.pow(2, 32 - self.__prefix__);
      var i = 0;
      return lazyIter(function () {
        if (i >= size || i > 70000) return { done: true };
        return { value: mkAddr((self.__net__ + i++) >>> 0), done: false };
      }, 'network_iter');
    }));
    netCls.dict.set('hosts', new PyBuiltin('hosts', function (a) {
      var self = a[0];
      var size = self.__prefix__ >= 31 ? 1 : Math.pow(2, 32 - self.__prefix__) - 2;
      var i = 0;
      var start = self.__prefix__ >= 31 ? 0 : 1;
      return lazyIter(function () {
        if (i >= size || i > 70000) return { done: true };
        return { value: mkAddr((self.__net__ + start + i++) >>> 0), done: false };
      }, 'hosts_iter');
    }));
    function netProp(name, fn) {
      netCls.dict.set(name, new O.PyProperty(new PyBuiltin(name, function (a) { return fn(a[0]); }), null, null, null));
    }
    netProp('num_addresses', function (s) { return BigInt(Math.pow(2, 32 - s.__prefix__)); });
    netProp('network_address', function (s) { return mkAddr(s.__net__); });
    netProp('broadcast_address', function (s) { return mkAddr((s.__net__ | (~s.__mask__ >>> 0)) >>> 0); });
    netProp('netmask', function (s) { return mkAddr(s.__mask__); });
    netProp('prefixlen', function (s) { return BigInt(s.__prefix__); });

    m.fn('ip_network', function (args, kwargs, it) {
      var text = str(args[0]);
      var parts = text.split('/');
      var prefix = parts.length > 1 ? parseInt(parts[1], 10) : 32;
      if (parts[1] && parts[1].indexOf('.') >= 0) {
        var maskInt = ipToInt(parts[1], it);
        prefix = 32 - Math.round(Math.log2((~maskInt >>> 0) + 1));
      }
      var base = ipToInt(parts[0], it);
      var strict = truthy(kwget(kwargs, 'strict', true));
      var mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
      if (strict && ((base & mask) >>> 0) !== base) {
        it.valueError(repr(text) + ' has host bits set');
      }
      return mkNet(base, prefix);
    });
    m.val('IPv4Network', netCls);
    m.fn('ip_interface', function (args, k, it) { return it.callSync(m.get('ip_network'), args, null); });
    return m.mod;
  });

  // ===========================================================================
  // socket
  // ===========================================================================
  S.define('socket', function (interp) {
    var m = S.makeModule('socket');
    m.val('AF_INET', 2n).val('AF_INET6', 10n)
     .val('SOCK_STREAM', 1n).val('SOCK_DGRAM', 2n).val('SOCK_RAW', 3n)
     .val('SOL_SOCKET', 1n).val('SO_REUSEADDR', 2n).val('IPPROTO_TCP', 6n);
    m.val('timeout', interp.exceptionClasses.TimeoutError);
    m.val('error', interp.exceptionClasses.OSError);
    m.val('gaierror', interp.exceptionClasses.OSError);

    function resolve(it, name) {
      var w = getWorld(it);
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(name)) return name;
      if (w.dns[name]) return w.dns[name];
      it.throwPy('OSError', '[Errno -2] Name or service not known: ' + repr(name));
    }

    m.fn('gethostbyname', function (args, k, it) { return resolve(it, str(args[0])); });
    m.fn('gethostbyaddr', function (args, k, it) {
      var w = getWorld(it);
      var ip = str(args[0]);
      var name = Object.keys(w.dns).find(function (n) { return w.dns[n] === ip; }) || ip;
      return new PyTuple([name, new PyList([]), new PyList([ip])]);
    });
    m.fn('gethostname', function () { return 'training-vm'; });
    m.fn('getfqdn', function () { return 'training-vm.lab.local'; });

    var sockCls = new PyClass('socket', [], new Map());
    sockCls.nativeNew = function (args, kwargs, it) {
      var inst = new PyInstance(sockCls);
      inst.__connected__ = null;
      inst.__buffer__ = '';
      inst.__timeout__ = 5;
      return inst;
    };
    function sm(name, fn) {
      sockCls.dict.set(name, new PyBuiltin(name, function (args, kwargs, it) {
        return fn(args[0], args.slice(1), kwargs, it);
      }));
    }
    sm('settimeout', function (self, args) { self.__timeout__ = toNumber(args[0]); return null; });
    sm('setsockopt', function () { return null; });
    sm('connect', function (self, args, kwargs, it) {
      var addr = it.toArray(args[0]);
      var host = str(addr[0]);
      var port = inum(addr[1]);
      var ip = resolve(it, host);
      var w = getWorld(it);
      var ports = w.openPorts[ip] || {};
      if (!ports[port]) {
        it.throwPy('ConnectionRefusedError', '[Errno 111] Connection refused');
      }
      self.__connected__ = { ip: ip, host: host, port: port, banner: ports[port] };
      self.__buffer__ = bannerFor(port, ports[port]);
      return null;
    });
    sm('connect_ex', function (self, args, kwargs, it) {
      try {
        it.callSync(it.getattr(self, 'connect'), args, null);
        return 0n;
      } catch (e) {
        return 111n;
      }
    });
    sm('send', function (self, args, kwargs, it) {
      if (!self.__connected__) it.throwPy('OSError', 'socket not connected');
      var data = args[0] instanceof PyBytes ? B.bytesToLatin1(args[0]) : str(args[0]);
      self.__buffer__ += respondToProbe(it, self.__connected__, data);
      return BigInt(data.length);
    });
    sm('sendall', function (self, args, kwargs, it) {
      it.callSync(it.getattr(self, 'send'), args, null);
      return null;
    });
    sm('recv', function (self, args, kwargs, it) {
      var n = args.length ? inum(args[0]) : 4096;
      var chunk = self.__buffer__.slice(0, n);
      self.__buffer__ = self.__buffer__.slice(chunk.length);
      return B.latin1ToBytes(chunk);
    });
    sm('close', function (self) { self.__connected__ = null; return null; });
    sm('__enter__', function (self) { return self; });
    sm('__exit__', function (self) { self.__connected__ = null; return false; });
    sm('bind', function () { return null; });
    sm('listen', function () { return null; });
    sm('getpeername', function (self, args, kwargs, it) {
      if (!self.__connected__) it.throwPy('OSError', 'socket not connected');
      return new PyTuple([self.__connected__.ip, BigInt(self.__connected__.port)]);
    });
    sm('__repr__', function (self) {
      return '<socket object' + (self.__connected__ ? ' connected to ' + self.__connected__.ip +
        ':' + self.__connected__.port : '') + '>';
    });
    m.val('socket', sockCls);

    function bannerFor(port, service) {
      if (port === 22) return 'SSH-2.0-' + service.replace(/\s+/g, '_') + '\r\n';
      if (port === 21) return '220 (' + service + ')\r\n';
      if (port === 3306) return '\x0a' + service + '\x00';
      if (port === 25) return '220 mail.local ESMTP\r\n';
      return '';
    }
    function respondToProbe(it, conn, data) {
      if (conn.port === 80 || conn.port === 8080 || conn.port === 8180 || conn.port === 443) {
        var lines = data.split('\r\n');
        var first = lines[0] || '';
        var mm = /^(\w+)\s+(\S+)/.exec(first);
        if (!mm) return '';
        var hostHeader = '';
        lines.forEach(function (l) {
          var h = /^Host:\s*(.+)$/i.exec(l);
          if (h) hostHeader = h[1].trim();
        });
        var res = httpRequest(it, {
          method: mm[1], url: 'http://' + (hostHeader || conn.ip) + mm[2], headers: {}, body: ''
        });
        var head = 'HTTP/1.1 ' + res.status + ' ' + statusText(res.status) + '\r\n' +
          'Server: ' + conn.banner + '\r\n' +
          'Content-Type: ' + (res.type || 'text/html') + '\r\n' +
          'Content-Length: ' + res.body.length + '\r\n\r\n';
        return head + res.body;
      }
      return '';
    }
    m.__respond__ = respondToProbe;
    return m.mod;
  });

  function statusText(code) {
    return { 200: 'OK', 301: 'Moved Permanently', 302: 'Found', 400: 'Bad Request',
             401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 500: 'Internal Server Error' }[code] || 'OK';
  }

  /** Route an HTTP request into the simulated world. */
  function httpRequest(interp, opts) {
    var w = getWorld(interp);
    var u = parseUrl(opts.url);
    if (!u.scheme) u = parseUrl('http://' + opts.url);
    var hostName = u.host.toLowerCase();
    var ip = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostName) ? hostName : w.dns[hostName];
    if (!ip) {
      throw new PyError(interp.makeExc('ConnectionError',
        'Failed to resolve ' + repr(hostName) + '. Known hosts in this lab: ' +
        Object.keys(w.dns).join(', ')));
    }
    var host = w.hosts[ip];
    if (!host) {
      throw new PyError(interp.makeExc('ConnectionError',
        'Connection refused: nothing is listening on ' + ip));
    }
    var query = parseQs(u.query);
    var flatQuery = {};
    Object.keys(query).forEach(function (k) { flatQuery[k] = query[k][0]; });
    var form = {};
    if (opts.body) {
      var parsedForm = parseQs(opts.body);
      Object.keys(parsedForm).forEach(function (k) { form[k] = parsedForm[k][0]; });
    }
    if (opts.formObj) form = opts.formObj;
    var req = {
      method: (opts.method || 'GET').toUpperCase(),
      path: u.path || '/',
      query: flatQuery,
      rawQuery: u.query,
      headers: opts.headers || {},
      body: opts.body || '',
      form: form,
      host: hostName,
      ip: ip
    };
    var res = host.routes(req);
    res.status = res.status || 200;
    res.body = res.body === undefined ? '' : res.body;
    res.headers = res.headers || {};
    return res;
  }
  root.PyHttp = { request: httpRequest, statusText: statusText };

  // ===========================================================================
  // requests
  // ===========================================================================
  S.define('requests', function (interp) {
    var m = S.makeModule('requests');
    var respCls = new PyClass('Response', [], new Map());

    function makeResponse(it, res, url) {
      var inst = new PyInstance(respCls);
      inst.__res__ = res;
      inst.__url__ = url;
      return inst;
    }
    function rm(name, fn) {
      respCls.dict.set(name, new PyBuiltin(name, function (args, kwargs, it) {
        return fn(args[0], args.slice(1), kwargs, it);
      }));
    }
    function rprop(name, fn) {
      respCls.dict.set(name, new O.PyProperty(new PyBuiltin(name, function (a, k, it) {
        return fn(a[0], it);
      }), null, null, null));
    }
    rprop('status_code', function (self) { return BigInt(self.__res__.status); });
    rprop('text', function (self) { return self.__res__.body; });
    rprop('content', function (self) { return B.latin1ToBytes(self.__res__.body); });
    rprop('url', function (self) { return self.__url__; });
    rprop('ok', function (self) { return self.__res__.status < 400; });
    rprop('reason', function (self) { return statusText(self.__res__.status); });
    rprop('headers', function (self) {
      var h = { 'Content-Type': self.__res__.type || 'text/html; charset=utf-8',
                'Content-Length': String(self.__res__.body.length),
                'Server': 'sim-httpd/1.0' };
      Object.keys(self.__res__.headers || {}).forEach(function (k) { h[k] = self.__res__.headers[k]; });
      return dictOf(h);
    });
    rprop('cookies', function (self) {
      var c = {};
      var sc = (self.__res__.headers || {})['Set-Cookie'];
      if (sc) {
        var mm = /^([^=]+)=([^;]+)/.exec(sc);
        if (mm) c[mm[1]] = mm[2];
      }
      return dictOf(c);
    });
    rm('json', function (self, args, kwargs, it) {
      var jsonMod = it.importModule('json');
      return it.callSync(jsonMod.dict.get('loads'), [self.__res__.body], null);
    });
    rm('raise_for_status', function (self, args, kwargs, it) {
      if (self.__res__.status >= 400) {
        it.throwPy('RuntimeError', self.__res__.status + ' Client Error for url: ' + self.__url__);
      }
      return null;
    });
    rm('__repr__', function (self) { return '<Response [' + self.__res__.status + ']>'; });
    m.val('Response', respCls);

    function headersFromKw(it, kwargs, cookieJar) {
      var headers = {};
      var h = kwget(kwargs, 'headers', null);
      if (h instanceof PyDict) h.map.forEach(function (e) { headers[str(e.k)] = str(e.v); });
      var cookies = kwget(kwargs, 'cookies', null);
      var cookieParts = [];
      if (cookieJar) Object.keys(cookieJar).forEach(function (k) { cookieParts.push(k + '=' + cookieJar[k]); });
      if (cookies instanceof PyDict) {
        cookies.map.forEach(function (e) { cookieParts.push(str(e.k) + '=' + str(e.v)); });
      }
      if (cookieParts.length) headers.Cookie = cookieParts.join('; ');
      var auth = kwget(kwargs, 'auth', null);
      if (auth) {
        var parts = it.toArray(auth).map(str);
        headers.Authorization = 'Basic ' + btoaSafe(parts[0] + ':' + parts[1]);
      }
      return headers;
    }
    function bodyFromKw(it, kwargs) {
      var data = kwget(kwargs, 'data', null);
      var jsonArg = kwget(kwargs, 'json', null);
      if (jsonArg !== null && jsonArg !== undefined) {
        var jsonMod = it.importModule('json');
        return { body: str(it.callSync(jsonMod.dict.get('dumps'), [jsonArg], null)), formObj: null };
      }
      if (data instanceof PyDict) {
        var formObj = {};
        var pairs = [];
        data.map.forEach(function (e) {
          formObj[str(e.k)] = str(e.v);
          pairs.push(encodeURIComponent(str(e.k)) + '=' + encodeURIComponent(str(e.v)));
        });
        return { body: pairs.join('&'), formObj: formObj };
      }
      if (typeof data === 'string') return { body: data, formObj: null };
      return { body: '', formObj: null };
    }
    function appendParams(url, kwargs, it) {
      var params = kwget(kwargs, 'params', null);
      if (!(params instanceof PyDict)) return url;
      var pairs = [];
      params.map.forEach(function (e) {
        pairs.push(encodeURIComponent(str(e.k)) + '=' + encodeURIComponent(str(e.v)));
      });
      if (!pairs.length) return url;
      return url + (url.indexOf('?') >= 0 ? '&' : '?') + pairs.join('&');
    }

    function doRequest(method, args, kwargs, it, cookieJar) {
      var url = appendParams(str(args[0]), kwargs, it);
      var body = bodyFromKw(it, kwargs);
      var res = httpRequest(it, {
        method: method,
        url: url,
        headers: headersFromKw(it, kwargs, cookieJar),
        body: body.body,
        formObj: body.formObj
      });
      if (cookieJar) {
        var sc = (res.headers || {})['Set-Cookie'];
        if (sc) {
          var mm = /^([^=]+)=([^;]+)/.exec(sc);
          if (mm) cookieJar[mm[1]] = mm[2];
        }
      }
      it.tick(200);
      return makeResponse(it, res, url);
    }

    ['get', 'post', 'put', 'delete', 'head', 'patch', 'options'].forEach(function (verb) {
      m.fn(verb, function (args, kwargs, it) {
        return doRequest(verb.toUpperCase(), args, kwargs, it, null);
      });
    });
    m.fn('request', function (args, kwargs, it) {
      return doRequest(str(args[0]).toUpperCase(), args.slice(1), kwargs, it, null);
    });

    var sessCls = new PyClass('Session', [], new Map());
    sessCls.nativeNew = function () {
      var inst = new PyInstance(sessCls);
      inst.__cookies__ = {};
      return inst;
    };
    ['get', 'post', 'put', 'delete', 'head'].forEach(function (verb) {
      sessCls.dict.set(verb, new PyBuiltin(verb, function (args, kwargs, it) {
        var self = args[0];
        return doRequest(verb.toUpperCase(), args.slice(1), kwargs, it, self.__cookies__);
      }));
    });
    sessCls.dict.set('cookies', new O.PyProperty(new PyBuiltin('cookies', function (a) {
      return dictOf(a[0].__cookies__);
    }), null, null, null));
    sessCls.dict.set('__enter__', new PyBuiltin('__enter__', function (a) { return a[0]; }));
    sessCls.dict.set('__exit__', new PyBuiltin('__exit__', function () { return false; }));
    m.val('Session', sessCls);

    var excMod = S.makeModule('requests.exceptions');
    excMod.val('RequestException', interp.exceptionClasses.OSError);
    excMod.val('ConnectionError', interp.exceptionClasses.ConnectionError);
    excMod.val('Timeout', interp.exceptionClasses.TimeoutError);
    excMod.val('HTTPError', interp.exceptionClasses.RuntimeError);
    m.val('exceptions', excMod.mod);
    m.val('ConnectionError', interp.exceptionClasses.ConnectionError);
    m.val('Timeout', interp.exceptionClasses.TimeoutError);
    m.val('HTTPError', interp.exceptionClasses.RuntimeError);
    interp.registerModule('requests.exceptions', function () { return excMod.mod; });
    return m.mod;
  });

  function btoaSafe(s) {
    if (typeof btoa === 'function') return btoa(s);
    return Buffer.from(s, 'binary').toString('base64');
  }

  // ===========================================================================
  // sqlite3
  // ===========================================================================
  S.define('sqlite3', function (interp) {
    var m = S.makeModule('sqlite3');
    var connCls = new PyClass('Connection', [], new Map());
    var curCls = new PyClass('Cursor', [], new Map());

    function toPy(v) {
      if (v === null || v === undefined) return null;
      if (typeof v === 'number') return Number.isInteger(v) ? BigInt(v) : v;
      return v;
    }
    function fromPy(v) {
      if (v === null) return null;
      if (typeof v === 'bigint') return Number(v);
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (v instanceof PyBytes) return B.bytesToLatin1(v);
      return str(v);
    }

    connCls.nativeNew = function (args, kwargs, it) {
      var inst = new PyInstance(connCls);
      var path = args.length ? str(args[0]) : ':memory:';
      if (!it.__sqliteDbs__) it.__sqliteDbs__ = Object.create(null);
      if (path === ':memory:') inst.__db__ = new SqlDb();
      else {
        if (!it.__sqliteDbs__[path]) it.__sqliteDbs__[path] = new SqlDb();
        inst.__db__ = it.__sqliteDbs__[path];
      }
      return inst;
    };
    function runSql(it, db, sqlText, params) {
      try {
        return db.exec(sqlText, params);
      } catch (e) {
        if (e && e.sqlError) throw new PyError(it.makeExc('RuntimeError', 'sqlite3.OperationalError: ' + e.message));
        throw e;
      }
    }
    function makeCursor(it, conn) {
      var inst = new PyInstance(curCls);
      inst.__conn__ = conn;
      inst.__rows__ = [];
      inst.__cols__ = [];
      inst.__pos__ = 0;
      return inst;
    }
    curCls.dict.set('execute', new PyBuiltin('execute', function (args, kwargs, it) {
      var self = args[0];
      var sqlText = str(args[1]);
      var params = args.length > 2 ? it.toArray(args[2]).map(fromPy) : [];
      var r = runSql(it, self.__conn__.__db__, sqlText, params);
      self.__rows__ = r.rows;
      self.__cols__ = r.cols;
      self.__pos__ = 0;
      return self;
    }));
    curCls.dict.set('executemany', new PyBuiltin('executemany', function (args, kwargs, it) {
      var self = args[0];
      var sqlText = str(args[1]);
      it.toArray(args[2]).forEach(function (row) {
        runSql(it, self.__conn__.__db__, sqlText, it.toArray(row).map(fromPy));
      });
      return self;
    }));
    curCls.dict.set('executescript', new PyBuiltin('executescript', function (args, kwargs, it) {
      var self = args[0];
      runSql(it, self.__conn__.__db__, str(args[1]), []);
      return self;
    }));
    curCls.dict.set('fetchone', new PyBuiltin('fetchone', function (args) {
      var self = args[0];
      if (self.__pos__ >= self.__rows__.length) return null;
      return new PyTuple(self.__rows__[self.__pos__++].map(toPy));
    }));
    curCls.dict.set('fetchall', new PyBuiltin('fetchall', function (args) {
      var self = args[0];
      var out = self.__rows__.slice(self.__pos__).map(function (r) { return new PyTuple(r.map(toPy)); });
      self.__pos__ = self.__rows__.length;
      return new PyList(out);
    }));
    curCls.dict.set('fetchmany', new PyBuiltin('fetchmany', function (args) {
      var self = args[0];
      var n = args.length > 1 ? inum(args[1]) : 1;
      var out = self.__rows__.slice(self.__pos__, self.__pos__ + n).map(function (r) { return new PyTuple(r.map(toPy)); });
      self.__pos__ += out.length;
      return new PyList(out);
    }));
    curCls.dict.set('__iter__', new PyBuiltin('__iter__', function (args) {
      var self = args[0];
      return lazyIter(function () {
        if (self.__pos__ >= self.__rows__.length) return { done: true };
        return { value: new PyTuple(self.__rows__[self.__pos__++].map(toPy)), done: false };
      }, 'cursor_iter');
    }));
    curCls.dict.set('description', new O.PyProperty(new PyBuiltin('description', function (a) {
      return new PyTuple(a[0].__cols__.map(function (c) {
        return new PyTuple([c, null, null, null, null, null, null]);
      }));
    }), null, null, null));
    curCls.dict.set('close', new PyBuiltin('close', function () { return null; }));

    connCls.dict.set('cursor', new PyBuiltin('cursor', function (args, kwargs, it) {
      return makeCursor(it, args[0]);
    }));
    connCls.dict.set('execute', new PyBuiltin('execute', function (args, kwargs, it) {
      var cur = makeCursor(it, args[0]);
      return it.callSync(it.getattr(cur, 'execute'), args.slice(1), kwargs);
    }));
    connCls.dict.set('executescript', new PyBuiltin('executescript', function (args, kwargs, it) {
      runSql(it, args[0].__db__, str(args[1]), []);
      return null;
    }));
    connCls.dict.set('commit', new PyBuiltin('commit', function () { return null; }));
    connCls.dict.set('close', new PyBuiltin('close', function () { return null; }));
    connCls.dict.set('__enter__', new PyBuiltin('__enter__', function (a) { return a[0]; }));
    connCls.dict.set('__exit__', new PyBuiltin('__exit__', function () { return false; }));

    m.fn('connect', function (args, kwargs, it) { return connCls.nativeNew(args, kwargs, it); });
    m.val('Connection', connCls).val('Cursor', curCls);
    m.val('OperationalError', interp.exceptionClasses.RuntimeError);
    m.val('DatabaseError', interp.exceptionClasses.RuntimeError);
    m.val('IntegrityError', interp.exceptionClasses.RuntimeError);
    m.val('version', '2.6.0');
    return m.mod;
  });

  // ===========================================================================
  // subprocess (simulated shell) / pickle / yaml
  // ===========================================================================
  S.define('subprocess', function (interp) {
    var m = S.makeModule('subprocess');
    m.val('PIPE', -1n).val('STDOUT', -2n).val('DEVNULL', -3n);

    function runCommand(it, cmdValue, shell) {
      var w = getWorld(it);
      var cmd;
      if (typeof cmdValue === 'string') cmd = cmdValue;
      else cmd = it.toArray(cmdValue).map(str).join(' ');
      if (!shell && typeof cmdValue !== 'string') {
        // argv form: metacharacters are inert, which is exactly the lesson.
        var argv = it.toArray(cmdValue).map(str);
        return runFakeShell(argv.join(' ').replace(/[;&|`$]/g, function (c) { return '\\' + c; }), w.files);
      }
      var out = '';
      cmd.split(/;|&&|\|\|/).forEach(function (piece) {
        out += runFakeShell(piece.trim(), w.files);
      });
      return out;
    }

    var cpCls = new PyClass('CompletedProcess', [], new Map());
    cpCls.dict.set('__repr__', new PyBuiltin('__repr__', function (a) {
      return 'CompletedProcess(args=' + repr(a[0].__dict__.get('args')) +
        ', returncode=' + repr(a[0].__dict__.get('returncode')) + ')';
    }));

    m.fn('run', function (args, kwargs, it) {
      var shell = truthy(kwget(kwargs, 'shell', false));
      var capture = truthy(kwget(kwargs, 'capture_output', false)) ||
                    kwget(kwargs, 'stdout', null) !== null;
      var text = truthy(kwget(kwargs, 'text', false));
      var out = runCommand(it, args[0], shell);
      var inst = new PyInstance(cpCls);
      inst.__dict__.set('args', args[0]);
      inst.__dict__.set('returncode', 0n);
      inst.__dict__.set('stdout', capture ? (text ? out : B.latin1ToBytes(out)) : null);
      inst.__dict__.set('stderr', capture ? (text ? '' : B.latin1ToBytes('')) : null);
      if (!capture) it.write(out);
      return inst;
    });
    m.fn('check_output', function (args, kwargs, it) {
      var shell = truthy(kwget(kwargs, 'shell', false));
      var text = truthy(kwget(kwargs, 'text', false));
      var out = runCommand(it, args[0], shell);
      return text ? out : B.latin1ToBytes(out);
    });
    m.fn('call', function (args, kwargs, it) {
      it.write(runCommand(it, args[0], truthy(kwget(kwargs, 'shell', false))));
      return 0n;
    });
    m.fn('getoutput', function (args, kwargs, it) { return runCommand(it, args[0], true); });
    m.val('CalledProcessError', interp.exceptionClasses.RuntimeError);
    return m.mod;
  });

  S.define('pickle', function (interp) {
    var m = S.makeModule('pickle');
    // A readable stand-in: pickle.dumps produces a marker string, and loads
    // *demonstrates* why untrusted pickles execute code, without doing so.
    m.fn('dumps', function (args, kwargs, it) {
      var jsonMod = it.importModule('json');
      var payload;
      try { payload = str(it.callSync(jsonMod.dict.get('dumps'), [args[0]], null)); }
      catch (e) { payload = repr(args[0]); }
      return B.latin1ToBytes('\x80\x04PYFORGE-PICKLE:' + payload);
    });
    m.fn('loads', function (args, kwargs, it) {
      var raw = B.bytesToLatin1(B.toBytesLike(it, args[0]));
      if (raw.indexOf('PYFORGE-PICKLE:') < 0) {
        it.throwPy('ValueError', 'unsupported pickle protocol in this sandbox');
      }
      var payload = raw.slice(raw.indexOf('PYFORGE-PICKLE:') + 15);
      if (/__reduce__|os\.system|subprocess/.test(payload)) {
        it.throwPy('RuntimeError',
          'A pickle containing __reduce__ would have executed a shell command here. ' +
          'That is the whole point: never unpickle untrusted data.');
      }
      var jsonMod = it.importModule('json');
      return it.callSync(jsonMod.dict.get('loads'), [payload], null);
    });
    m.fn('dump', function (args, kwargs, it) {
      var data = it.callSync(m.get('dumps'), [args[0]], null);
      it.callSync(it.getattr(args[1], 'write'), [data], null);
      return null;
    });
    m.fn('load', function (args, kwargs, it) {
      var data = it.callSync(it.getattr(args[0], 'read'), [], null);
      return it.callSync(m.get('loads'), [data], null);
    });
    return m.mod;
  });

  S.define('yaml', function (interp) {
    var m = S.makeModule('yaml');
    function parseYaml(text, it, allowTags) {
      var lines = str(text).split('\n');
      var root = new PyDict();
      var stack = [{ indent: -1, node: root }];
      lines.forEach(function (line) {
        if (!line.trim() || /^\s*#/.test(line)) return;
        var indent = /^\s*/.exec(line)[0].length;
        var content = line.trim();
        while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
        var parent = stack[stack.length - 1].node;
        var mm = /^([^:]+):\s*(.*)$/.exec(content);
        if (content.startsWith('- ')) {
          var val = content.slice(2).trim();
          if (!(parent instanceof PyList)) return;
          parent.items.push(coerce(val, it, allowTags));
          return;
        }
        if (mm) {
          var key = mm[1].trim();
          var rest = mm[2].trim();
          if (rest === '') {
            var child = new PyDict();
            parent.set(key, child);
            stack.push({ indent: indent, node: child });
          } else if (rest === '[]') {
            parent.set(key, new PyList([]));
          } else {
            parent.set(key, coerce(rest, it, allowTags));
          }
        }
      });
      return root;
    }
    function coerce(v, it, allowTags) {
      if (/^!!python\//.test(v) || /^!!/.test(v)) {
        if (!allowTags) {
          it.throwPy('RuntimeError',
            'yaml.safe_load refused the tag ' + repr(v.split(' ')[0]) +
            '. yaml.load() without SafeLoader would have constructed it — that is the vulnerability.');
        }
        it.throwPy('RuntimeError',
          'yaml.load() would have instantiated ' + repr(v) + ' here. ' +
          'This is remote code execution: always use yaml.safe_load().');
      }
      if (/^(true|yes)$/i.test(v)) return true;
      if (/^(false|no)$/i.test(v)) return false;
      if (/^null$|^~$/i.test(v)) return null;
      if (/^-?\d+$/.test(v)) return BigInt(v);
      if (/^-?\d*\.\d+$/.test(v)) return parseFloat(v);
      return v.replace(/^['"]|['"]$/g, '');
    }
    m.fn('safe_load', function (args, kwargs, it) { return parseYaml(args[0], it, false); });
    m.fn('load', function (args, kwargs, it) {
      var loader = kwget(kwargs, 'Loader', null);
      return parseYaml(args[0], it, loader === null);
    });
    m.fn('dump', function (args, kwargs, it) {
      var d = args[0];
      var out = '';
      if (d instanceof PyDict) {
        d.map.forEach(function (e) { out += str(e.k) + ': ' + str(e.v) + '\n'; });
      }
      return out;
    });
    m.val('SafeLoader', 'SafeLoader');
    m.val('YAMLError', interp.exceptionClasses.ValueError);
    return m.mod;
  });

  // ===========================================================================
  // scapy (very small, canned capture)
  // ===========================================================================
  S.define('scapy', function (interp) {
    var m = S.makeModule('scapy');
    var allMod = S.makeModule('scapy.all');
    var pktCls = new PyClass('Packet', [], new Map());

    var CAPTURE = [
      { src: '10.10.0.42', dst: '10.10.0.5', proto: 'TCP', sport: 51244, dport: 80, len: 74, flags: 'S', payload: '' },
      { src: '10.10.0.5', dst: '10.10.0.42', proto: 'TCP', sport: 80, dport: 51244, len: 74, flags: 'SA', payload: '' },
      { src: '10.10.0.42', dst: '10.10.0.5', proto: 'TCP', sport: 51244, dport: 80, len: 380, flags: 'PA',
        payload: 'GET /login HTTP/1.1\r\nHost: shop.local\r\nAuthorization: Basic YWRtaW46UzNjdXIzIUFkbTFu\r\n\r\n' },
      { src: '10.10.0.42', dst: '8.8.8.8', proto: 'UDP', sport: 5353, dport: 53, len: 68, flags: '', payload: 'shop.local A?' },
      { src: '10.10.0.66', dst: '10.10.0.5', proto: 'TCP', sport: 44001, dport: 22, len: 60, flags: 'S', payload: '' },
      { src: '10.10.0.66', dst: '10.10.0.5', proto: 'TCP', sport: 44002, dport: 23, len: 60, flags: 'S', payload: '' },
      { src: '10.10.0.66', dst: '10.10.0.5', proto: 'TCP', sport: 44003, dport: 25, len: 60, flags: 'S', payload: '' },
      { src: '10.10.0.66', dst: '10.10.0.5', proto: 'TCP', sport: 44004, dport: 80, len: 60, flags: 'S', payload: '' },
      { src: '10.10.0.66', dst: '10.10.0.5', proto: 'TCP', sport: 44005, dport: 443, len: 60, flags: 'S', payload: '' },
      { src: '10.10.0.7', dst: '10.10.0.5', proto: 'ICMP', sport: 0, dport: 0, len: 98, flags: '', payload: 'echo-request' }
    ];

    function mkPacket(rec) {
      var inst = new PyInstance(pktCls);
      inst.__rec__ = rec;
      Object.keys(rec).forEach(function (k) {
        inst.__dict__.set(k, typeof rec[k] === 'number' ? BigInt(rec[k]) : rec[k]);
      });
      return inst;
    }
    pktCls.dict.set('summary', new PyBuiltin('summary', function (a) {
      var r = a[0].__rec__;
      return 'IP / ' + r.proto + ' ' + r.src + ':' + r.sport + ' > ' + r.dst + ':' + r.dport +
        (r.flags ? ' ' + r.flags : '');
    }));
    pktCls.dict.set('show', new PyBuiltin('show', function (a, k, it) {
      var r = a[0].__rec__;
      it.write('###[ IP ]###\n  src = ' + r.src + '\n  dst = ' + r.dst +
        '\n  proto = ' + r.proto + '\n  len = ' + r.len + '\n');
      if (r.payload) it.write('###[ Raw ]###\n  load = ' + repr(r.payload) + '\n');
      return null;
    }));
    pktCls.dict.set('__repr__', new PyBuiltin('__repr__', function (a) {
      var r = a[0].__rec__;
      return '<' + r.proto + ' ' + r.src + ' > ' + r.dst + '>';
    }));
    pktCls.dict.set('__contains__', new PyBuiltin('__contains__', function (a) {
      var want = str(a[1]);
      var r = a[0].__rec__;
      if (want === 'TCP' || want === 'UDP' || want === 'ICMP') return r.proto === want;
      if (want === 'Raw') return !!r.payload;
      if (want === 'IP') return true;
      return false;
    }));
    pktCls.dict.set('haslayer', pktCls.dict.get('__contains__'));

    allMod.fn('sniff', function (args, kwargs, it) {
      var count = inum(kwget(kwargs, 'count', BigInt(CAPTURE.length)));
      var filterExpr = kwget(kwargs, 'filter', null);
      var pkts = CAPTURE.slice(0, count).map(mkPacket);
      if (filterExpr) {
        var f = str(filterExpr).toLowerCase();
        pkts = pkts.filter(function (p) {
          if (/tcp/.test(f) && p.__rec__.proto !== 'TCP') return false;
          if (/udp/.test(f) && p.__rec__.proto !== 'UDP') return false;
          if (/icmp/.test(f) && p.__rec__.proto !== 'ICMP') return false;
          var portM = /port\s+(\d+)/.exec(f);
          if (portM && p.__rec__.dport !== parseInt(portM[1], 10) && p.__rec__.sport !== parseInt(portM[1], 10)) return false;
          return true;
        });
      }
      return new PyList(pkts);
    });
    allMod.fn('rdpcap', function (args, kwargs, it) {
      return new PyList(CAPTURE.map(mkPacket));
    });
    allMod.fn('IP', function (args, kwargs, it) {
      return mkPacket({
        src: str(kwget(kwargs, 'src', '10.10.0.42')),
        dst: str(kwget(kwargs, 'dst', '10.10.0.5')),
        proto: 'IP', sport: 0, dport: 0, len: 20, flags: '', payload: ''
      });
    });
    allMod.fn('TCP', function (args, kwargs, it) {
      return mkPacket({
        src: '', dst: '', proto: 'TCP',
        sport: inum(kwget(kwargs, 'sport', 12345n)),
        dport: inum(kwget(kwargs, 'dport', 80n)),
        len: 20, flags: str(kwget(kwargs, 'flags', 'S')), payload: ''
      });
    });
    allMod.val('Packet', pktCls);
    allMod.fn('hexdump', function (args, kwargs, it) {
      var r = args[0] instanceof PyInstance ? args[0].__rec__.payload : str(args[0]);
      for (var i = 0; i < r.length; i += 16) {
        var chunk = r.slice(i, i + 16);
        var hex = Array.from(chunk).map(function (c) { return c.charCodeAt(0).toString(16).padStart(2, '0'); }).join(' ');
        var ascii = Array.from(chunk).map(function (c) {
          var code = c.charCodeAt(0);
          return code >= 32 && code < 127 ? c : '.';
        }).join('');
        it.write(String(i).padStart(4, '0') + '  ' + hex.padEnd(47) + '  ' + ascii + '\n');
      }
      return null;
    });
    m.val('all', allMod.mod);
    interp.registerModule('scapy.all', function () { return allMod.mod; });
    return m.mod;
  });

  // ===========================================================================
  // A tiny helper module the lessons use to talk about the lab itself
  // ===========================================================================
  S.define('lab', function (interp) {
    var m = S.makeModule('lab');
    m.fn('hosts', function (args, kwargs, it) {
      var w = getWorld(it);
      var d = new PyDict();
      Object.keys(w.dns).forEach(function (name) { d.set(name, w.dns[name]); });
      return d;
    });
    m.fn('ports', function (args, kwargs, it) {
      var w = getWorld(it);
      var ip = str(args[0]);
      var d = new PyDict();
      Object.keys(w.openPorts[ip] || {}).forEach(function (p) {
        d.set(BigInt(p), w.openPorts[ip][p]);
      });
      return d;
    });
    m.fn('reset', function (args, kwargs, it) {
      it.__world__ = buildWorld();
      return null;
    });
    return m.mod;
  });
})(typeof window !== 'undefined' ? window : globalThis);
