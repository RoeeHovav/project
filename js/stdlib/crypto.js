/* ============================================================================
 * crypto.js — hashlib, hmac, base64, binascii, secrets, zlib, and the
 *             teaching shims for bcrypt / Fernet / JWT.
 *
 * The digests are genuine implementations, so every hash a learner prints here
 * matches what CPython would print. That matters: the whole point of the
 * hashing chapters is that the numbers are real.
 * ========================================================================== */
(function (root) {
  'use strict';

  var O = root.PyObjects;
  var B = root.PyBuiltins;
  var S = root.PyStdlib;
  var PyList = O.PyList, PyTuple = O.PyTuple, PyDict = O.PyDict,
      PyBytes = O.PyBytes, PyBuiltin = O.PyBuiltin, PyClass = O.PyClass,
      PyInstance = O.PyInstance, PyError = O.PyError,
      truthy = O.truthy, repr = O.repr, str = O.str, typeName = O.typeName,
      toBigInt = O.toBigInt, toNumber = O.toNumber;
  var kwget = S.kwget, argk = S.argk, inum = S.inum;

  // ---------------------------------------------------------------------------
  // MD5
  // ---------------------------------------------------------------------------
  function md5(bytes) {
    var S_SHIFT = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
                   5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
                   4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
                   6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
    var K = new Uint32Array(64);
    for (var ki = 0; ki < 64; ki++) K[ki] = Math.floor(Math.abs(Math.sin(ki + 1)) * 4294967296) >>> 0;

    var msgLen = bytes.length;
    var withPad = new Uint8Array((((msgLen + 8) >> 6) + 1) * 64);
    withPad.set(bytes);
    withPad[msgLen] = 0x80;
    var bitLen = msgLen * 8;
    var dv = new DataView(withPad.buffer);
    dv.setUint32(withPad.length - 8, bitLen >>> 0, true);
    dv.setUint32(withPad.length - 4, Math.floor(bitLen / 4294967296), true);

    var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (var off = 0; off < withPad.length; off += 64) {
      var M = new Uint32Array(16);
      for (var j = 0; j < 16; j++) M[j] = dv.getUint32(off + j * 4, true);
      var A = a0, Bv = b0, C = c0, D = d0;
      for (var i = 0; i < 64; i++) {
        var F, g;
        if (i < 16) { F = (Bv & C) | (~Bv & D); g = i; }
        else if (i < 32) { F = (D & Bv) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = Bv ^ C ^ D; g = (3 * i + 5) % 16; }
        else { F = C ^ (Bv | ~D); g = (7 * i) % 16; }
        F = (F + A + K[i] + M[g]) >>> 0;
        A = D; D = C; C = Bv;
        Bv = (Bv + (((F << S_SHIFT[i]) | (F >>> (32 - S_SHIFT[i]))) >>> 0)) >>> 0;
      }
      a0 = (a0 + A) >>> 0; b0 = (b0 + Bv) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    var out = new Uint8Array(16);
    var odv = new DataView(out.buffer);
    odv.setUint32(0, a0, true); odv.setUint32(4, b0, true);
    odv.setUint32(8, c0, true); odv.setUint32(12, d0, true);
    return out;
  }

  // ---------------------------------------------------------------------------
  // SHA-1
  // ---------------------------------------------------------------------------
  function sha1(bytes) {
    var msgLen = bytes.length;
    var withPad = new Uint8Array((((msgLen + 8) >> 6) + 1) * 64);
    withPad.set(bytes);
    withPad[msgLen] = 0x80;
    var dv = new DataView(withPad.buffer);
    var bitLen = msgLen * 8;
    dv.setUint32(withPad.length - 8, Math.floor(bitLen / 4294967296));
    dv.setUint32(withPad.length - 4, bitLen >>> 0);

    var h = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
    var w = new Uint32Array(80);
    for (var off = 0; off < withPad.length; off += 64) {
      for (var i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (i = 16; i < 80; i++) {
        var v = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
        w[i] = ((v << 1) | (v >>> 31)) >>> 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4];
      for (i = 0; i < 80; i++) {
        var f, k;
        if (i < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
        else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
        else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
        else { f = b ^ c ^ d; k = 0xCA62C1D6; }
        var temp = ((((a << 5) | (a >>> 27)) >>> 0) + f + e + k + w[i]) >>> 0;
        e = d; d = c;
        c = ((b << 30) | (b >>> 2)) >>> 0;
        b = a; a = temp;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0;
      h[3] = (h[3] + d) >>> 0; h[4] = (h[4] + e) >>> 0;
    }
    var out = new Uint8Array(20);
    var odv = new DataView(out.buffer);
    for (i = 0; i < 5; i++) odv.setUint32(i * 4, h[i]);
    return out;
  }

  // ---------------------------------------------------------------------------
  // SHA-224 / SHA-256
  // ---------------------------------------------------------------------------
  var SHA256_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  function sha256core(bytes, initial, outWords) {
    var msgLen = bytes.length;
    var withPad = new Uint8Array((((msgLen + 8) >> 6) + 1) * 64);
    withPad.set(bytes);
    withPad[msgLen] = 0x80;
    var dv = new DataView(withPad.buffer);
    var bitLen = msgLen * 8;
    dv.setUint32(withPad.length - 8, Math.floor(bitLen / 4294967296));
    dv.setUint32(withPad.length - 4, bitLen >>> 0);

    var h = initial.slice();
    var w = new Uint32Array(64);
    for (var off = 0; off < withPad.length; off += 64) {
      for (var i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (i = 16; i < 64; i++) {
        var s0 = (((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^ ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^ (w[i - 15] >>> 3)) >>> 0;
        var s1 = (((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^ ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^ (w[i - 2] >>> 10)) >>> 0;
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (i = 0; i < 64; i++) {
        var S1 = (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
        var ch = ((e & f) ^ (~e & g)) >>> 0;
        var t1 = (hh + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
        var S0 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
        var maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        var t2 = (S0 + maj) >>> 0;
        hh = g; g = f; f = e;
        e = (d + t1) >>> 0;
        d = c; c = b; b = a;
        a = (t1 + t2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    var out = new Uint8Array(outWords * 4);
    var odv = new DataView(out.buffer);
    for (i = 0; i < outWords; i++) odv.setUint32(i * 4, h[i]);
    return out;
  }
  function sha256(bytes) {
    return sha256core(bytes, [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
                              0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], 8);
  }
  function sha224(bytes) {
    return sha256core(bytes, [0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939,
                              0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4], 7);
  }

  // ---------------------------------------------------------------------------
  // SHA-384 / SHA-512 (BigInt 64-bit arithmetic)
  // ---------------------------------------------------------------------------
  var MASK64 = (1n << 64n) - 1n;
  var SHA512_K = [
    '428a2f98d728ae22', '7137449123ef65cd', 'b5c0fbcfec4d3b2f', 'e9b5dba58189dbbc',
    '3956c25bf348b538', '59f111f1b605d019', '923f82a4af194f9b', 'ab1c5ed5da6d8118',
    'd807aa98a3030242', '12835b0145706fbe', '243185be4ee4b28c', '550c7dc3d5ffb4e2',
    '72be5d74f27b896f', '80deb1fe3b1696b1', '9bdc06a725c71235', 'c19bf174cf692694',
    'e49b69c19ef14ad2', 'efbe4786384f25e3', '0fc19dc68b8cd5b5', '240ca1cc77ac9c65',
    '2de92c6f592b0275', '4a7484aa6ea6e483', '5cb0a9dcbd41fbd4', '76f988da831153b5',
    '983e5152ee66dfab', 'a831c66d2db43210', 'b00327c898fb213f', 'bf597fc7beef0ee4',
    'c6e00bf33da88fc2', 'd5a79147930aa725', '06ca6351e003826f', '142929670a0e6e70',
    '27b70a8546d22ffc', '2e1b21385c26c926', '4d2c6dfc5ac42aed', '53380d139d95b3df',
    '650a73548baf63de', '766a0abb3c77b2a8', '81c2c92e47edaee6', '92722c851482353b',
    'a2bfe8a14cf10364', 'a81a664bbc423001', 'c24b8b70d0f89791', 'c76c51a30654be30',
    'd192e819d6ef5218', 'd69906245565a910', 'f40e35855771202a', '106aa07032bbd1b8',
    '19a4c116b8d2d0c8', '1e376c085141ab53', '2748774cdf8eeb99', '34b0bcb5e19b48a8',
    '391c0cb3c5c95a63', '4ed8aa4ae3418acb', '5b9cca4f7763e373', '682e6ff3d6b2b8a3',
    '748f82ee5defb2fc', '78a5636f43172f60', '84c87814a1f0ab72', '8cc702081a6439ec',
    '90befffa23631e28', 'a4506cebde82bde9', 'bef9a3f7b2c67915', 'c67178f2e372532b',
    'ca273eceea26619c', 'd186b8c721c0c207', 'eada7dd6cde0eb1e', 'f57d4f7fee6ed178',
    '06f067aa72176fba', '0a637dc5a2c898a6', '113f9804bef90dae', '1b710b35131c471b',
    '28db77f523047d84', '32caab7b40c72493', '3c9ebe0a15c9bebc', '431d67c49c100d4c',
    '4cc5d4becb3e42b6', '597f299cfc657e2a', '5fcb6fab3ad6faec', '6c44198c4a475817'
  ].map(function (h) { return BigInt('0x' + h); });

  function rotr64(x, n) { return ((x >> n) | (x << (64n - n))) & MASK64; }

  function sha512core(bytes, initial, outWords) {
    var msgLen = bytes.length;
    var blocks = Math.floor((msgLen + 16) / 128) + 1;
    var withPad = new Uint8Array(blocks * 128);
    withPad.set(bytes);
    withPad[msgLen] = 0x80;
    var dv = new DataView(withPad.buffer);
    var bitLen = BigInt(msgLen) * 8n;
    dv.setBigUint64(withPad.length - 8, bitLen & MASK64);

    var h = initial.slice();
    var w = new Array(80);
    for (var off = 0; off < withPad.length; off += 128) {
      for (var i = 0; i < 16; i++) w[i] = dv.getBigUint64(off + i * 8);
      for (i = 16; i < 80; i++) {
        var s0 = (rotr64(w[i - 15], 1n) ^ rotr64(w[i - 15], 8n) ^ (w[i - 15] >> 7n)) & MASK64;
        var s1 = (rotr64(w[i - 2], 19n) ^ rotr64(w[i - 2], 61n) ^ (w[i - 2] >> 6n)) & MASK64;
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) & MASK64;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (i = 0; i < 80; i++) {
        var S1 = (rotr64(e, 14n) ^ rotr64(e, 18n) ^ rotr64(e, 41n)) & MASK64;
        var ch = ((e & f) ^ (~e & MASK64 & g)) & MASK64;
        var t1 = (hh + S1 + ch + SHA512_K[i] + w[i]) & MASK64;
        var S0 = (rotr64(a, 28n) ^ rotr64(a, 34n) ^ rotr64(a, 39n)) & MASK64;
        var maj = ((a & b) ^ (a & c) ^ (b & c)) & MASK64;
        var t2 = (S0 + maj) & MASK64;
        hh = g; g = f; f = e;
        e = (d + t1) & MASK64;
        d = c; c = b; b = a;
        a = (t1 + t2) & MASK64;
      }
      h[0] = (h[0] + a) & MASK64; h[1] = (h[1] + b) & MASK64;
      h[2] = (h[2] + c) & MASK64; h[3] = (h[3] + d) & MASK64;
      h[4] = (h[4] + e) & MASK64; h[5] = (h[5] + f) & MASK64;
      h[6] = (h[6] + g) & MASK64; h[7] = (h[7] + hh) & MASK64;
    }
    var out = new Uint8Array(outWords * 8);
    var odv = new DataView(out.buffer);
    for (i = 0; i < outWords; i++) odv.setBigUint64(i * 8, h[i]);
    return out;
  }
  function sha512(bytes) {
    return sha512core(bytes, [
      0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
      0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n], 8);
  }
  function sha384(bytes) {
    return sha512core(bytes, [
      0xcbbb9d5dc1059ed8n, 0x629a292a367cd507n, 0x9159015a3070dd17n, 0x152fecd8f70e5939n,
      0x67332667ffc00b31n, 0x8eb44a8768581511n, 0xdb0c2e0d64f98fa7n, 0x47b5481dbefa4fa4n], 6);
  }

  var ALGOS = {
    md5: { fn: md5, block: 64, size: 16 },
    sha1: { fn: sha1, block: 64, size: 20 },
    sha224: { fn: sha224, block: 64, size: 28 },
    sha256: { fn: sha256, block: 64, size: 32 },
    sha384: { fn: sha384, block: 128, size: 48 },
    sha512: { fn: sha512, block: 128, size: 64 }
  };

  function hexOf(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
    return s;
  }
  function concatBytes(a, b) {
    var out = new Uint8Array(a.length + b.length);
    out.set(a, 0); out.set(b, a.length);
    return out;
  }
  function hmacRaw(algoName, key, msg) {
    var algo = ALGOS[algoName];
    var blockSize = algo.block;
    var k = key;
    if (k.length > blockSize) k = algo.fn(k);
    if (k.length < blockSize) {
      var padded = new Uint8Array(blockSize);
      padded.set(k);
      k = padded;
    }
    var opad = new Uint8Array(blockSize), ipad = new Uint8Array(blockSize);
    for (var i = 0; i < blockSize; i++) {
      opad[i] = k[i] ^ 0x5c;
      ipad[i] = k[i] ^ 0x36;
    }
    return algo.fn(concatBytes(opad, algo.fn(concatBytes(ipad, msg))));
  }
  root.PyCryptoPrimitives = {
    md5: md5, sha1: sha1, sha256: sha256, sha512: sha512, sha224: sha224, sha384: sha384,
    hmacRaw: hmacRaw, hexOf: hexOf, ALGOS: ALGOS, concatBytes: concatBytes
  };

  // ===========================================================================
  // hashlib
  // ===========================================================================
  S.define('hashlib', function (interp) {
    var m = S.makeModule('hashlib');
    var hashCls = new PyClass('HASH', [], new Map());

    function makeHash(algoName, initial) {
      var inst = new PyInstance(hashCls);
      inst.__algo__ = algoName;
      inst.__data__ = initial || new Uint8Array(0);
      return inst;
    }
    function hm(name, fn) {
      hashCls.dict.set(name, new PyBuiltin(name, function (args, kwargs, it) {
        return fn(args[0], args.slice(1), kwargs, it);
      }));
    }
    hm('update', function (self, args, kwargs, it) {
      var extra = B.toBytesLike(it, args[0]);
      self.__data__ = concatBytes(self.__data__, extra.b);
      return null;
    });
    hm('hexdigest', function (self) { return hexOf(ALGOS[self.__algo__].fn(self.__data__)); });
    hm('digest', function (self) { return new PyBytes(ALGOS[self.__algo__].fn(self.__data__)); });
    hm('copy', function (self) { return makeHash(self.__algo__, self.__data__.slice()); });
    hm('__repr__', function (self) { return '<' + self.__algo__ + ' hashlib.HASH object>'; });
    hashCls.dict.set('name', new O.PyProperty(new PyBuiltin('name', function (a) { return a[0].__algo__; }), null, null, null));
    hashCls.dict.set('digest_size', new O.PyProperty(new PyBuiltin('digest_size', function (a) {
      return BigInt(ALGOS[a[0].__algo__].size);
    }), null, null, null));
    hashCls.dict.set('block_size', new O.PyProperty(new PyBuiltin('block_size', function (a) {
      return BigInt(ALGOS[a[0].__algo__].block);
    }), null, null, null));

    Object.keys(ALGOS).forEach(function (name) {
      m.fn(name, function (args, kwargs, it) {
        var initial = args.length && args[0] !== null ? B.toBytesLike(it, args[0]).b : new Uint8Array(0);
        return makeHash(name, initial);
      });
    });
    m.fn('new', function (args, kwargs, it) {
      var name = str(args[0]).toLowerCase();
      if (!ALGOS[name]) it.valueError('unsupported hash type ' + name);
      var initial = args.length > 1 ? B.toBytesLike(it, args[1]).b : new Uint8Array(0);
      return makeHash(name, initial);
    });
    var algoSet = new O.PySet(Object.keys(ALGOS));
    m.val('algorithms_available', algoSet);
    m.val('algorithms_guaranteed', algoSet);

    m.fn('pbkdf2_hmac', function (args, kwargs, it) {
      var algoName = str(argk(args, kwargs, 0, 'hash_name', 'sha256')).toLowerCase();
      var password = B.toBytesLike(it, argk(args, kwargs, 1, 'password', null)).b;
      var salt = B.toBytesLike(it, argk(args, kwargs, 2, 'salt', null)).b;
      var iterations = inum(argk(args, kwargs, 3, 'iterations', 1000n));
      var dklen = argk(args, kwargs, 4, 'dklen', null);
      if (!ALGOS[algoName]) it.valueError('unsupported hash type ' + algoName);
      var hLen = ALGOS[algoName].size;
      var wanted = dklen === null || dklen === undefined ? hLen : inum(dklen);
      if (iterations > 60000) {
        it.valueError('This sandbox caps PBKDF2 at 60000 iterations so the page stays responsive. ' +
          'Real deployments should use 600000+ for PBKDF2-HMAC-SHA256.');
      }
      it.tick(iterations * 8);
      var blocks = Math.ceil(wanted / hLen);
      var out = new Uint8Array(blocks * hLen);
      for (var bIdx = 1; bIdx <= blocks; bIdx++) {
        var idxBytes = new Uint8Array([(bIdx >>> 24) & 255, (bIdx >>> 16) & 255, (bIdx >>> 8) & 255, bIdx & 255]);
        var u = hmacRaw(algoName, password, concatBytes(salt, idxBytes));
        var acc = u.slice();
        for (var c = 1; c < iterations; c++) {
          u = hmacRaw(algoName, password, u);
          for (var x = 0; x < acc.length; x++) acc[x] ^= u[x];
        }
        out.set(acc, (bIdx - 1) * hLen);
      }
      return new PyBytes(out.slice(0, wanted));
    });
    m.fn('scrypt', function (args, kwargs, it) {
      it.throwPy('NotImplementedError',
        'scrypt is not implemented in this sandbox. Use hashlib.pbkdf2_hmac here, and argon2/scrypt in production.');
    });
    return m.mod;
  });

  // ===========================================================================
  // hmac
  // ===========================================================================
  S.define('hmac', function (interp) {
    var m = S.makeModule('hmac');
    var hmacCls = new PyClass('HMAC', [], new Map());

    function makeHmac(algoName, key, msg) {
      var inst = new PyInstance(hmacCls);
      inst.__algo__ = algoName;
      inst.__key__ = key;
      inst.__msg__ = msg || new Uint8Array(0);
      return inst;
    }
    function hm(name, fn) {
      hmacCls.dict.set(name, new PyBuiltin(name, function (args, kwargs, it) {
        return fn(args[0], args.slice(1), kwargs, it);
      }));
    }
    hm('update', function (self, args, kwargs, it) {
      self.__msg__ = concatBytes(self.__msg__, B.toBytesLike(it, args[0]).b);
      return null;
    });
    hm('hexdigest', function (self) { return hexOf(hmacRaw(self.__algo__, self.__key__, self.__msg__)); });
    hm('digest', function (self) { return new PyBytes(hmacRaw(self.__algo__, self.__key__, self.__msg__)); });
    hm('__repr__', function (self) { return '<hmac.HMAC object>'; });

    function algoNameOf(it, digestmod) {
      if (digestmod === null || digestmod === undefined) return 'sha256';
      if (typeof digestmod === 'string') return digestmod.toLowerCase();
      if (digestmod instanceof PyBuiltin) return digestmod.name.toLowerCase();
      return 'sha256';
    }
    m.fn('new', function (args, kwargs, it) {
      var key = B.toBytesLike(it, args[0]).b;
      var msg = args.length > 1 && args[1] !== null ? B.toBytesLike(it, args[1]).b : new Uint8Array(0);
      var algo = algoNameOf(it, argk(args, kwargs, 2, 'digestmod', null));
      if (!ALGOS[algo]) it.valueError('unsupported hash type ' + algo);
      return makeHmac(algo, key, msg);
    });
    m.fn('digest', function (args, kwargs, it) {
      var algo = algoNameOf(it, args[2]);
      return new PyBytes(hmacRaw(algo, B.toBytesLike(it, args[0]).b, B.toBytesLike(it, args[1]).b));
    });
    m.fn('compare_digest', function (args, kwargs, it) {
      var a = args[0] instanceof PyBytes ? B.bytesToLatin1(args[0]) : str(args[0]);
      var b = args[1] instanceof PyBytes ? B.bytesToLatin1(args[1]) : str(args[1]);
      // Constant-time in spirit: always compare every byte.
      var diff = a.length ^ b.length;
      var n = Math.max(a.length, b.length);
      for (var i = 0; i < n; i++) {
        diff |= (a.charCodeAt(i % (a.length || 1)) || 0) ^ (b.charCodeAt(i % (b.length || 1)) || 0);
      }
      return a.length === b.length && a === b;
    });
    return m.mod;
  });

  // ===========================================================================
  // base64 / binascii
  // ===========================================================================
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  var B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  function b64encode(bytes, alphabet, pad) {
    var out = '';
    for (var i = 0; i < bytes.length; i += 3) {
      var b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
      out += alphabet[b0 >> 2];
      out += alphabet[((b0 & 3) << 4) | ((b1 === undefined ? 0 : b1) >> 4)];
      out += b1 === undefined ? (pad ? '=' : '') : alphabet[((b1 & 15) << 2) | ((b2 === undefined ? 0 : b2) >> 6)];
      out += b2 === undefined ? (pad ? '=' : '') : alphabet[b2 & 63];
    }
    return out;
  }
  function b64decode(text, alphabet, interp, validate) {
    var clean = text.replace(/[\r\n]/g, '');
    if (!validate) clean = clean.replace(new RegExp('[^' + alphabet.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '=]', 'g'), '');
    clean = clean.replace(/=+$/, '');
    var out = [];
    var buffer = 0, bits = 0;
    for (var i = 0; i < clean.length; i++) {
      var v = alphabet.indexOf(clean[i]);
      if (v < 0) {
        if (interp) interp.throwPy('ValueError', 'Invalid base64-encoded string: character ' + repr(clean[i]));
        continue;
      }
      buffer = (buffer << 6) | v;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out.push((buffer >> bits) & 0xff);
      }
    }
    return new Uint8Array(out);
  }

  S.define('base64', function (interp) {
    var m = S.makeModule('base64');
    m.fn('b64encode', function (args, k, it) {
      return B.latin1ToBytes(b64encode(B.toBytesLike(it, args[0]).b, B64, true));
    });
    m.fn('b64decode', function (args, kwargs, it) {
      var text = args[0] instanceof PyBytes ? B.bytesToLatin1(args[0]) : str(args[0]);
      return new PyBytes(b64decode(text, B64, truthy(kwget(kwargs, 'validate', false)) ? it : null, false));
    });
    m.fn('urlsafe_b64encode', function (args, k, it) {
      return B.latin1ToBytes(b64encode(B.toBytesLike(it, args[0]).b, B64URL, true));
    });
    m.fn('urlsafe_b64decode', function (args, k, it) {
      var text = args[0] instanceof PyBytes ? B.bytesToLatin1(args[0]) : str(args[0]);
      return new PyBytes(b64decode(text, B64URL, null, false));
    });
    m.fn('b16encode', function (args, k, it) {
      return B.latin1ToBytes(hexOf(B.toBytesLike(it, args[0]).b).toUpperCase());
    });
    m.fn('b16decode', function (args, k, it) {
      var text = (args[0] instanceof PyBytes ? B.bytesToLatin1(args[0]) : str(args[0])).toLowerCase();
      var out = [];
      for (var i = 0; i < text.length; i += 2) out.push(parseInt(text.substr(i, 2), 16));
      return new PyBytes(out);
    });
    m.fn('b32encode', function (args, k, it) {
      var bytes = B.toBytesLike(it, args[0]).b;
      var out = '';
      for (var i = 0; i < bytes.length; i += 5) {
        var chunk = Array.from(bytes.slice(i, i + 5));
        var bits = '';
        chunk.forEach(function (b) { bits += b.toString(2).padStart(8, '0'); });
        while (bits.length % 5) bits += '0';
        for (var j = 0; j < bits.length; j += 5) out += B32[parseInt(bits.substr(j, 5), 2)];
        while (out.length % 8) out += '=';
      }
      return B.latin1ToBytes(out);
    });
    m.fn('b32decode', function (args, k, it) {
      var text = (args[0] instanceof PyBytes ? B.bytesToLatin1(args[0]) : str(args[0])).replace(/=+$/, '');
      var bits = '';
      for (var i = 0; i < text.length; i++) bits += B32.indexOf(text[i]).toString(2).padStart(5, '0');
      var out = [];
      for (var j = 0; j + 8 <= bits.length; j += 8) out.push(parseInt(bits.substr(j, 8), 2));
      return new PyBytes(out);
    });
    m.fn('b85encode', function (args, k, it) {
      it.throwPy('NotImplementedError', 'b85encode is not available in this sandbox');
    });
    return m.mod;
  });

  // CRC-32 table, shared by binascii and zlib.
  var CRC_TABLE = (function () {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();
  function crc32(bytes, seed) {
    var c = (seed === undefined ? 0 : seed) ^ 0xffffffff;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  S.define('binascii', function (interp) {
    var m = S.makeModule('binascii');
    m.fn('hexlify', function (args, k, it) { return B.latin1ToBytes(hexOf(B.toBytesLike(it, args[0]).b)); });
    m.fn('unhexlify', function (args, k, it) {
      var text = args[0] instanceof PyBytes ? B.bytesToLatin1(args[0]) : str(args[0]);
      if (text.length % 2) it.throwPy('ValueError', 'Odd-length string');
      var out = [];
      for (var i = 0; i < text.length; i += 2) {
        var v = parseInt(text.substr(i, 2), 16);
        if (Number.isNaN(v)) it.throwPy('ValueError', 'Non-hexadecimal digit found');
        out.push(v);
      }
      return new PyBytes(out);
    });
    m.alias('b2a_hex', 'hexlify');
    m.alias('a2b_hex', 'unhexlify');
    m.fn('crc32', function (args, k, it) {
      var seed = args.length > 1 ? Number(toBigInt(args[1])) >>> 0 : 0;
      return BigInt(crc32(B.toBytesLike(it, args[0]).b, seed));
    });
    m.fn('b2a_base64', function (args, k, it) {
      return B.latin1ToBytes(b64encode(B.toBytesLike(it, args[0]).b, B64, true) + '\n');
    });
    m.fn('a2b_base64', function (args, k, it) {
      var text = args[0] instanceof PyBytes ? B.bytesToLatin1(args[0]) : str(args[0]);
      return new PyBytes(b64decode(text, B64, null, false));
    });
    return m.mod;
  });

  S.define('zlib', function (interp) {
    var m = S.makeModule('zlib');
    m.fn('crc32', function (args, k, it) {
      var seed = args.length > 1 ? Number(toBigInt(args[1])) >>> 0 : 0;
      return BigInt(crc32(B.toBytesLike(it, args[0]).b, seed));
    });
    m.fn('adler32', function (args, k, it) {
      var bytes = B.toBytesLike(it, args[0]).b;
      var a = 1, b = 0;
      for (var i = 0; i < bytes.length; i++) {
        a = (a + bytes[i]) % 65521;
        b = (b + a) % 65521;
      }
      return BigInt(((b << 16) | a) >>> 0);
    });
    m.fn('compress', function (args, k, it) {
      it.throwPy('NotImplementedError',
        'zlib.compress is not implemented here — use zlib.crc32/adler32 for the checksum exercises.');
    });
    return m.mod;
  });

  // ===========================================================================
  // secrets
  // ===========================================================================
  S.define('secrets', function (interp) {
    var m = S.makeModule('secrets');
    function randomBytes(n) {
      var out = new Uint8Array(n);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(out);
      else for (var i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
      return out;
    }
    m.fn('token_bytes', function (args) { return new PyBytes(randomBytes(args.length ? inum(args[0]) : 32)); });
    m.fn('token_hex', function (args) { return hexOf(randomBytes(args.length ? inum(args[0]) : 32)); });
    m.fn('token_urlsafe', function (args) {
      return b64encode(randomBytes(args.length ? inum(args[0]) : 32), B64URL, false);
    });
    m.fn('randbelow', function (args, k, it) {
      var n = toBigInt(args[0]);
      if (n <= 0n) it.valueError('Upper bound must be positive');
      var bits = n.toString(2).length;
      var bytes = Math.ceil(bits / 8);
      for (;;) {
        var r = randomBytes(bytes);
        var v = 0n;
        for (var i = 0; i < r.length; i++) v = (v << 8n) | BigInt(r[i]);
        v >>= BigInt(bytes * 8 - bits);
        if (v < n) return v;
      }
    });
    m.fn('randbits', function (args) {
      var bits = inum(args[0]);
      var r = randomBytes(Math.ceil(bits / 8));
      var v = 0n;
      for (var i = 0; i < r.length; i++) v = (v << 8n) | BigInt(r[i]);
      return v >> BigInt(r.length * 8 - bits);
    });
    m.fn('choice', function (args, k, it) {
      var seq = it.toArray(args[0]);
      if (!seq.length) it.indexError('Cannot choose from an empty sequence');
      return seq[Math.floor(Math.random() * seq.length)];
    });
    m.fn('compare_digest', function (args, kwargs, it) {
      var a = args[0] instanceof PyBytes ? B.bytesToLatin1(args[0]) : str(args[0]);
      var b = args[1] instanceof PyBytes ? B.bytesToLatin1(args[1]) : str(args[1]);
      return a.length === b.length && a === b;
    });
    return m.mod;
  });

  // ===========================================================================
  // Teaching shims: bcrypt, cryptography.fernet, jwt
  // ===========================================================================
  S.define('bcrypt', function (interp) {
    var m = S.makeModule('bcrypt');
    // A deliberately simplified stand-in: the API and the *shape* of the output
    // match real bcrypt, the KDF does not. Lessons say so explicitly.
    function b64s(bytes) { return b64encode(bytes, './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', false); }
    m.fn('gensalt', function (args, kwargs, it) {
      var rounds = inum(argk(args, kwargs, 0, 'rounds', 12n));
      var raw = new Uint8Array(16);
      for (var i = 0; i < 16; i++) raw[i] = Math.floor(Math.random() * 256);
      return B.latin1ToBytes('$2b$' + String(rounds).padStart(2, '0') + '$' + b64s(raw).slice(0, 22));
    });
    m.fn('hashpw', function (args, kwargs, it) {
      var pw = B.toBytesLike(it, args[0]).b;
      var salt = B.bytesToLatin1(B.toBytesLike(it, args[1]));
      var parts = salt.split('$');
      var rounds = parseInt(parts[2], 10) || 12;
      var saltPart = parts[3] ? parts[3].slice(0, 22) : '';
      var iterations = Math.min(4096, 1 << Math.min(12, rounds));
      it.tick(iterations * 4);
      var derived = hmacRaw('sha256', B.utf8Encode(saltPart), pw);
      for (var i = 1; i < iterations; i++) derived = hmacRaw('sha256', B.utf8Encode(saltPart), derived);
      return B.latin1ToBytes('$2b$' + String(rounds).padStart(2, '0') + '$' + saltPart + b64s(derived).slice(0, 31));
    });
    m.fn('checkpw', function (args, kwargs, it) {
      var stored = B.bytesToLatin1(B.toBytesLike(it, args[1]));
      var recomputed = B.bytesToLatin1(it.callSync(m.get('hashpw'), [args[0], args[1]], null));
      return stored === recomputed;
    });
    return m.mod;
  });

  S.define('cryptography', function (interp) {
    var m = S.makeModule('cryptography');
    var fernetMod = S.makeModule('cryptography.fernet');
    var fernetCls = new PyClass('Fernet', [], new Map());

    function xorStream(key, nonce, data) {
      // Keystream = SHA256(key || nonce || counter). Not AES — a stand-in with
      // the same interface so learners practise key handling and integrity.
      var out = new Uint8Array(data.length);
      var counter = 0;
      for (var i = 0; i < data.length; i += 32) {
        var cbytes = new Uint8Array([(counter >>> 24) & 255, (counter >>> 16) & 255, (counter >>> 8) & 255, counter & 255]);
        var block = sha256(concatBytes(concatBytes(key, nonce), cbytes));
        for (var j = 0; j < 32 && i + j < data.length; j++) out[i + j] = data[i + j] ^ block[j];
        counter++;
      }
      return out;
    }

    fernetCls.nativeNew = function (args, kwargs, it) {
      var inst = new PyInstance(fernetCls);
      var keyText = args[0] instanceof PyBytes ? B.bytesToLatin1(args[0]) : str(args[0]);
      inst.__key__ = b64decode(keyText, B64URL, null, false);
      if (inst.__key__.length !== 32) {
        it.valueError('Fernet key must be 32 url-safe base64-encoded bytes. Use Fernet.generate_key().');
      }
      return inst;
    };
    fernetCls.dict.set('generate_key', new PyBuiltin('generate_key', function () {
      var raw = new Uint8Array(32);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(raw);
      else for (var i = 0; i < 32; i++) raw[i] = Math.floor(Math.random() * 256);
      return B.latin1ToBytes(b64encode(raw, B64URL, true));
    }));
    fernetCls.dict.set('encrypt', new PyBuiltin('encrypt', function (args, kwargs, it) {
      var self = args[0];
      var data = B.toBytesLike(it, args[1]).b;
      var nonce = new Uint8Array(16);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(nonce);
      else for (var i = 0; i < 16; i++) nonce[i] = Math.floor(Math.random() * 256);
      var ct = xorStream(self.__key__, nonce, data);
      var body = concatBytes(new Uint8Array([0x80]), concatBytes(nonce, ct));
      var tag = hmacRaw('sha256', self.__key__, body);
      return B.latin1ToBytes(b64encode(concatBytes(body, tag), B64URL, true));
    }));
    fernetCls.dict.set('decrypt', new PyBuiltin('decrypt', function (args, kwargs, it) {
      var self = args[0];
      var token = args[1] instanceof PyBytes ? B.bytesToLatin1(args[1]) : str(args[1]);
      var raw = b64decode(token, B64URL, null, false);
      if (raw.length < 49) it.throwPy('ValueError', 'InvalidToken');
      var body = raw.slice(0, raw.length - 32);
      var tag = raw.slice(raw.length - 32);
      var expect = hmacRaw('sha256', self.__key__, body);
      var same = tag.length === expect.length;
      for (var i = 0; i < expect.length; i++) if (tag[i] !== expect[i]) same = false;
      if (!same) it.throwPy('ValueError', 'InvalidToken — the ciphertext was modified or the key is wrong');
      var nonce = body.slice(1, 17);
      return new PyBytes(xorStream(self.__key__, nonce, body.slice(17)));
    }));
    fernetMod.val('Fernet', fernetCls);
    fernetMod.val('InvalidToken', interp.exceptionClasses.ValueError);
    m.val('fernet', fernetMod.mod);
    interp.registerModule('cryptography.fernet', function () { return fernetMod.mod; });
    return m.mod;
  });

  S.define('jwt', function (interp) {
    var m = S.makeModule('jwt');
    function j64(objText) { return b64encode(B.utf8Encode(objText), B64URL, false); }
    function unb64(text) { return b64decode(text, B64URL, null, false); }

    m.fn('encode', function (args, kwargs, it) {
      var payload = argk(args, kwargs, 0, 'payload', null);
      var key = argk(args, kwargs, 1, 'key', '');
      var alg = str(argk(args, kwargs, 2, 'algorithm', 'HS256'));
      var jsonMod = it.importModule('json');
      var payloadText = str(it.callSync(jsonMod.dict.get('dumps'), [payload],
        (function () { var d = new PyDict(); d.set('separators', new PyTuple([',', ':'])); return d; })()));
      var headerText = '{"alg":"' + alg + '","typ":"JWT"}';
      var signingInput = j64(headerText) + '.' + j64(payloadText);
      var sig = '';
      if (alg === 'none') sig = '';
      else {
        var algoName = { HS256: 'sha256', HS384: 'sha384', HS512: 'sha512' }[alg];
        if (!algoName) it.throwPy('NotImplementedError', 'Algorithm ' + alg + ' is not supported in this sandbox (HS256/384/512 and none are).');
        sig = b64encode(hmacRaw(algoName, B.toBytesLike(it, key).b, B.utf8Encode(signingInput)), B64URL, false);
      }
      return signingInput + '.' + sig;
    });
    m.fn('decode', function (args, kwargs, it) {
      var token = str(argk(args, kwargs, 0, 'jwt', ''));
      var key = argk(args, kwargs, 1, 'key', '');
      var algs = kwget(kwargs, 'algorithms', null);
      var verify = truthy(kwget(kwargs, 'verify', true));
      var parts = token.split('.');
      if (parts.length !== 3) it.throwPy('ValueError', 'Not enough segments');
      var header = JSON.parse(B.utf8Decode(unb64(parts[0]), it));
      var jsonMod = it.importModule('json');
      var payload = it.callSync(jsonMod.dict.get('loads'), [B.utf8Decode(unb64(parts[1]), it)], null);
      if (verify) {
        var allowed = algs ? it.toArray(algs).map(str) : null;
        if (allowed && allowed.indexOf(header.alg) < 0) {
          it.throwPy('ValueError', 'The specified alg value is not allowed');
        }
        if (header.alg === 'none') {
          it.throwPy('ValueError', 'Algorithm "none" is not allowed when verifying');
        }
        var algoName = { HS256: 'sha256', HS384: 'sha384', HS512: 'sha512' }[header.alg];
        if (!algoName) it.throwPy('NotImplementedError', 'Algorithm ' + header.alg + ' is not supported in this sandbox');
        var expect = b64encode(hmacRaw(algoName, B.toBytesLike(it, key).b,
          B.utf8Encode(parts[0] + '.' + parts[1])), B64URL, false);
        if (expect !== parts[2]) it.throwPy('ValueError', 'Signature verification failed');
      }
      return payload;
    });
    m.fn('get_unverified_header', function (args, k, it) {
      var parts = str(args[0]).split('.');
      var header = JSON.parse(B.utf8Decode(unb64(parts[0]), it));
      var d = new PyDict();
      Object.keys(header).forEach(function (kk) { d.set(kk, header[kk]); });
      return d;
    });
    m.val('InvalidSignatureError', interp.exceptionClasses.ValueError);
    m.val('DecodeError', interp.exceptionClasses.ValueError);
    return m.mod;
  });
})(typeof window !== 'undefined' ? window : globalThis);
