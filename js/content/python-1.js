/* Python track, chapters 1-17. */
(function (root) {
  'use strict';
  var L = (root.PyForgeContent = root.PyForgeContent || { python: [], cyber: [] });

  L.python.push(

  // ==========================================================================
  {
    id: 'py01', title: 'First Contact', sub: 'print, comments, and how a program runs',
    teach: [
      { p: 'A Python program is a list of instructions run top to bottom, one line at a time. The first instruction almost everyone writes is `print()` — it puts a value on the screen.' },
      { code: 'print("Hello, operator.")\nprint("Systems online.")' },
      { p: 'Everything inside the quotes is a **string** — literal text. The parentheses are how you *call* a function: `print` is the function, the thing in brackets is what you hand it.' },
      { h: 'Comments' },
      { p: 'A `#` marks the rest of the line as a note for humans. Python ignores it completely. Good comments explain **why**, not what.' },
      { code: '# Retry budget: the API rate-limits after 5 calls/minute.\nmax_retries = 3  # trailing comments work too' },
      { h: 'print takes more than one thing' },
      { code: 'print("user", "alice", "logged in")   # spaces between\nprint("a", "b", sep="-")              # choose the separator\nprint("no newline", end=" ")\nprint("...continues on the same line")' },
      { tip: 'In this game every code box is live. Edit it, hit Run, and see what actually happens — that beats reading about it.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Print exactly: `Access granted`', starter: '', expect: 'Access granted',
        hint: 'One print() call with the text in quotes.', solution: 'print("Access granted")' },
      { kind: 'predict', prompt: 'What does this print?', code: 'print("id", 7, sep=":")', answer: 'id:7',
        explain: 'sep replaces the default single space between the arguments.' },
      { kind: 'mc', prompt: 'What does Python do with the line `# TODO: rotate keys`?',
        options: ['Prints it', 'Ignores it entirely', 'Treats it as a string', 'Raises an error'],
        answer: 1, explain: 'Everything after # on a line is a comment and never runs.' },
      { kind: 'code', prompt: 'Print three lines: `boot`, `scan`, `report` — in that order.',
        expect: 'boot\nscan\nreport', starter: '',
        solution: 'print("boot")\nprint("scan")\nprint("report")' },
      { kind: 'fill', prompt: 'Make this print `a|b` with no spaces.', template: 'print("a", "b", ___="|")',
        answer: 'sep', explain: 'sep controls what goes *between* values; end controls what goes after.' }
    ]
  },

  // ==========================================================================
  {
    id: 'py02', title: 'Variables & Types', sub: 'names, values, and what kind of thing you are holding',
    teach: [
      { p: 'A variable is a **name pointing at a value**. `=` is assignment, not equality.' },
      { code: 'target = "10.10.0.5"\nport = 443\nencrypted = True\nlatency = 12.5\nprint(target, port, encrypted, latency)' },
      { h: 'The core built-in types' },
      { list: [
        '`str` — text: `"nmap"`, `\'-sV\'`',
        '`int` — whole numbers, any size: `443`, `-1`, `2**300`',
        '`float` — decimals: `12.5`, `1e-9`',
        '`bool` — `True` / `False`',
        '`NoneType` — the single value `None`, meaning "nothing here yet"'
      ] },
      { p: 'Ask what something is with `type()`, and convert with the type names themselves.' },
      { code: 'print(type(443), type("443"))\nprint(int("443") + 1)\nprint(str(443) + "1")\nprint(float("2.5"), bool(0), bool("x"))' },
      { warn: 'Python will not silently mix types: `"443" + 1` is a TypeError. That strictness catches real bugs — a port read from a config file is text until you convert it.' },
      { h: 'Naming rules' },
      { p: 'Names use letters, digits and underscores, and cannot start with a digit. The convention is `snake_case` for variables, `SHOUTING_CASE` for constants.' },
      { code: 'MAX_RETRIES = 3\nfailed_attempts = 0\nfailed_attempts = failed_attempts + 1\nprint(failed_attempts, MAX_RETRIES)' },
      { tip: 'Names are re-bindable: `x = 1` then `x = "one"` is legal. Python is *dynamically* typed but *strongly* typed — the value has a firm type, the name does not.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Create `host` = "srv-01" and `port` = 8080, then print them as `srv-01:8080` (use str()).',
        expect: 'srv-01:8080',
        solution: 'host = "srv-01"\nport = 8080\nprint(host + ":" + str(port))' },
      { kind: 'predict', prompt: 'Output?', code: 'x = 5\ny = x\nx = 9\nprint(y)', answer: '5',
        explain: 'y was bound to the value 5; rebinding x does not follow through to y.' },
      { kind: 'mc', prompt: 'What is `type(True)`?',
        options: ['<class \'int\'>', '<class \'bool\'>', '<class \'str\'>', 'TypeError'],
        answer: 1, explain: 'bool is its own type — though it is a subclass of int, which is why True + True == 2.' },
      { kind: 'predict', prompt: 'Output?', code: 'print(int("7") + int(3.9))', answer: '10',
        explain: 'int() on a float truncates toward zero: 3.9 becomes 3.' },
      { kind: 'mc', prompt: 'Which line raises TypeError?',
        options: ['"a" * 3', '3 + True', '"3" + 3', 'float("3")'],
        answer: 2, explain: 'str + int is refused. "a"*3 repeats, and True counts as 1.' },
      { kind: 'code', prompt: 'A config gives `raw = "22"`. Print the port number plus one, as a number.',
        starter: 'raw = "22"\n', expect: '23', solution: 'raw = "22"\nprint(int(raw) + 1)' }
    ]
  },

  // ==========================================================================
  {
    id: 'py03', title: 'Numbers & Arithmetic', sub: 'integer division, modulo, bit twiddling',
    teach: [
      { code: 'print(7 + 2, 7 - 2, 7 * 2)\nprint(7 / 2)    # true division -> 3.5, always a float\nprint(7 // 2)   # floor division -> 3\nprint(7 % 2)    # remainder -> 1\nprint(7 ** 2)   # power -> 49' },
      { warn: '`//` and `%` **floor** toward negative infinity: `-7 // 2` is `-4`, and `-7 % 2` is `1`. That differs from C and from JavaScript, and it is the behaviour you want for wrap-around maths.' },
      { h: 'Modulo is the workhorse' },
      { p: 'Use `%` for "every Nth", for cycling through a list, and for the Caesar cipher you will write later.' },
      { code: 'for i in range(7):\n    if i % 3 == 0:\n        print(i, "tick")' },
      { h: 'Python integers never overflow' },
      { code: 'print(2 ** 256)\nprint(len(str(2 ** 4096)))' },
      { p: 'That is exactly why RSA maths works in plain Python with no special library.' },
      { h: 'Bitwise operators' },
      { code: 'flags = 0b1010\nprint(flags & 0b0010)  # AND  -> is bit 1 set?\nprint(flags | 0b0001)  # OR   -> set bit 0\nprint(flags ^ 0b1111)  # XOR  -> flip\nprint(flags >> 1, flags << 2)\nprint(bin(flags), hex(255), oct(8))' },
      { tip: 'XOR (`^`) is its own inverse: `a ^ k ^ k == a`. Half of classical cryptography is that one line.' },
      { h: 'Floats are approximations' },
      { code: 'print(0.1 + 0.2)\nprint(0.1 + 0.2 == 0.3)\nprint(round(0.1 + 0.2, 10) == 0.3)' },
      { p: 'Never compare floats with `==`. Compare with a tolerance, or use integers (count cents, not euros).' }
    ],
    challenges: [
      { kind: 'predict', prompt: 'Output?', code: 'print(-7 // 2, -7 % 2)', answer: '-4 1',
        explain: 'Floor division rounds down, and the remainder takes the sign of the divisor.' },
      { kind: 'predict', prompt: 'Output?', code: 'print(0b1100 ^ 0b1010)', answer: '6',
        explain: '1100 XOR 1010 = 0110 = 6.' },
      { kind: 'code', prompt: 'Print how many seconds are left over when 3725 seconds is split into whole hours.',
        expect: '125', hint: '3725 % 3600', solution: 'print(3725 % 3600)' },
      { kind: 'code', prompt: 'Print 2 raised to the power 100.', expect: '1267650600228229401496703205376',
        solution: 'print(2 ** 100)' },
      { kind: 'mc', prompt: 'Why is `0.1 + 0.2 == 0.3` False?',
        options: ['Python rounds badly', 'Binary floats cannot represent 0.1 exactly',
                  '== is broken for floats', 'It is actually True'],
        answer: 1, explain: 'Base-2 fractions cannot express 1/10 finitely, so tiny error accumulates.' },
      { kind: 'code', prompt: 'XOR the number 77 with the key 42, then XOR the result with 42 again. Print both values on one line separated by a space.',
        expect: '103 77', solution: 'a = 77 ^ 42\nprint(a, a ^ 42)' }
    ]
  },

  // ==========================================================================
  {
    id: 'py04', title: 'Strings', sub: 'slicing, searching, and the methods you will use daily',
    teach: [
      { p: 'Strings are **immutable sequences of characters**. Every "modifying" method returns a *new* string.' },
      { code: 'log = "2026-01-05 WARN failed login for admin"\nprint(len(log))\nprint(log[0], log[-1])       # index from the front or the back\nprint(log[0:10])             # slice [start:stop) -> the date\nprint(log[11:])              # from 11 to the end\nprint(log[::-1][:12])        # reversed, then sliced' },
      { h: 'Slicing rules' },
      { list: [
        '`s[a:b]` includes `a`, excludes `b`',
        'Missing start means 0; missing stop means the end',
        '`s[::2]` takes every second character; `s[::-1]` reverses',
        'Out-of-range slices clip silently — out-of-range *indexes* raise IndexError'
      ] },
      { h: 'The methods worth memorising' },
      { code: 's = "  Admin:PASSWORD123  "\nprint(s.strip())\nprint(s.strip().lower())\nprint(s.strip().split(":"))\nprint("-".join(["a", "b", "c"]))\nprint(s.replace("PASSWORD", "*" * 8).strip())\nprint(s.strip().startswith("Admin"), "123" in s)\nprint(s.find("PASS"), s.strip().count("A"))' },
      { code: 'print("a1".isalnum(), "abc".isalpha(), "42".isdigit(), "  ".isspace())\nprint("x".rjust(5, "0"), "x".center(5, "-"), "7".zfill(3))\nprint("a,b,,c".split(","))\nprint("key=value".partition("="))' },
      { warn: '`split()` with no argument splits on *runs* of whitespace and drops empties — `split(" ")` does not. For log parsing you almost always want the bare `split()`.' },
      { h: 'Multi-line and raw strings' },
      { code: 'banner = """usage:\n  scan <host>\n  report"""\nprint(banner)\nprint(r"C:\\Users\\new")   # r"" turns off backslash escapes' }
    ],
    challenges: [
      { kind: 'predict', prompt: 'Output?', code: 'print("cybersecurity"[6:12])', answer: 'curity',
        explain: 'Index 6 through 11 inclusive.' },
      { kind: 'predict', prompt: 'Output?', code: 'print("abcdef"[::-2])', answer: 'fdb',
        explain: 'Step -2 walks backwards taking every second character.' },
      { kind: 'code', prompt: 'Given `line`, print just the username (the text after "user=").',
        starter: 'line = "src=10.0.0.9 user=jdoe action=login"\n', expect: 'jdoe',
        hint: 'split() into fields, then split the right field on "=".',
        solution: 'line = "src=10.0.0.9 user=jdoe action=login"\nfor field in line.split():\n    if field.startswith("user="):\n        print(field.split("=")[1])' },
      { kind: 'code', prompt: 'Mask a card number: print all but the last 4 digits as `*`.',
        starter: 'card = "4111111111111234"\n', expect: '************1234',
        solution: 'card = "4111111111111234"\nprint("*" * (len(card) - 4) + card[-4:])' },
      { kind: 'mc', prompt: 'What does `"a b  c".split()` return?',
        options: ["['a', 'b', '', 'c']", "['a', 'b', 'c']", "['a b  c']", 'TypeError'],
        answer: 1, explain: 'Bare split() collapses runs of whitespace and discards empty fields.' },
      { kind: 'code', prompt: 'Print `True` if the string is a palindrome ignoring case, else `False`.',
        starter: 'word = "Rotator"\n', expect: 'True',
        solution: 'word = "Rotator"\nw = word.lower()\nprint(w == w[::-1])' }
    ]
  },

  // ==========================================================================
  {
    id: 'py05', title: 'String Formatting', sub: 'f-strings and the format mini-language',
    teach: [
      { p: 'f-strings are the modern way: put `f` before the quote and `{}` around any expression.' },
      { code: 'user = "alice"\nfails = 3\nprint(f"{user} failed {fails} times")\nprint(f"{fails * 2} is double, {user.upper()} shouts")' },
      { h: 'The format spec after a colon' },
      { code: 'print(f"{3.14159:.2f}")      # 2 decimal places\nprint(f"{42:05d}")           # zero-padded width 5\nprint(f"{255:x} {255:#x} {255:b}")\nprint(f"{1234567:,}")        # thousands separator\nprint(f"{0.8734:.1%}")       # percentage' },
      { code: 'print(f"|{\'left\':<10}|{\'mid\':^10}|{\'right\':>10}|")\nfor name, n in [("ssh", 22), ("https", 443)]:\n    print(f"{name:<8}{n:>6}")' },
      { h: 'Debugging shortcut' },
      { code: 'port = 8080\nprint(f"{port=}")            # prints: port=8080\nprint(f"{port!r}")           # repr() instead of str()' },
      { h: 'The older forms still appear in the wild' },
      { code: 'print("{} scored {}".format("bob", 9))\nprint("{1} before {0}".format("a", "b"))\nprint("%s has %d alerts" % ("web01", 4))' },
      { warn: 'Never build SQL or shell commands with f-strings. `f"SELECT * FROM t WHERE id={x}"` is the single most common source of SQL injection — you will exploit exactly that bug in the security track.' }
    ],
    challenges: [
      { kind: 'predict', prompt: 'Output?', code: 'print(f"{7:03d}")', answer: '007',
        explain: '0 fill, width 3, decimal.' },
      { kind: 'predict', prompt: 'Output?', code: 'x = 5\nprint(f"{x=}")', answer: 'x=5',
        explain: 'The = suffix prints the expression source then its value.' },
      { kind: 'code', prompt: 'Print `CPU: 87.5%` from the float 0.875.',
        starter: 'load = 0.875\n', expect: 'CPU: 87.5%',
        solution: 'load = 0.875\nprint(f"CPU: {load:.1%}")' },
      { kind: 'code', prompt: 'Print a right-aligned table of these ports, name in 10 columns then the number in 6.',
        starter: 'rows = [("ftp", 21), ("ssh", 22), ("http", 80)]\n',
        expect: '       ftp    21\n       ssh    22\n      http    80',
        solution: 'rows = [("ftp", 21), ("ssh", 22), ("http", 80)]\nfor name, port in rows:\n    print(f"{name:>10}{port:>6}")' },
      { kind: 'mc', prompt: 'Which is the safe way to put a user value into a SQL query?',
        options: ['f"... WHERE u=\'{name}\'"', '"... WHERE u=\'%s\'" % name',
                  'cur.execute("... WHERE u=?", (name,))', '"... WHERE u=" + name'],
        answer: 2, explain: 'Only a parameterised query keeps the value out of the SQL grammar.' }
    ]
  },

  // ==========================================================================
  {
    id: 'py06', title: 'Booleans & Truthiness', sub: 'comparison, and/or/not, and what counts as false',
    teach: [
      { code: 'print(3 == 3, 3 != 4, 3 < 4, 3 >= 3)\nprint("abc" == "ABC", "abc".lower() == "ABC".lower())' },
      { h: 'Chained comparisons' },
      { code: 'port = 8080\nprint(1024 <= port <= 65535)   # reads like maths, evaluates once' },
      { h: 'Truthiness: what is falsy' },
      { list: [
        '`False`, `None`', '`0`, `0.0`', 'empty `""`, `[]`, `()`, `{}`, `set()`',
        '**everything else is truthy**'
      ] },
      { code: 'findings = []\nif not findings:\n    print("clean scan")\nif findings:\n    print("never reached")' },
      { h: 'and / or return operands, not booleans' },
      { code: 'print(0 or "default")      # -> default\nprint("set" or "default")  # -> set\nprint(1 and 2)             # -> 2\nname = None\nprint(name or "anonymous")' },
      { p: 'They also **short-circuit**: `or` stops at the first truthy value, `and` at the first falsy one. That lets you guard safely:' },
      { code: 'items = []\nif items and items[0] == "x":     # items[0] never runs on an empty list\n    print("match")\nelse:\n    print("no crash")' },
      { h: 'is versus ==' },
      { code: 'a = [1, 2]\nb = [1, 2]\nprint(a == b, a is b)\nprint(None is None)' },
      { warn: '`==` asks "same value", `is` asks "same object in memory". Use `is` only with `None`, `True`, `False`.' }
    ],
    challenges: [
      { kind: 'predict', prompt: 'Output?', code: 'print([] or "fallback")', answer: 'fallback',
        explain: 'An empty list is falsy, so or moves on and returns the next operand.' },
      { kind: 'predict', prompt: 'Output?', code: 'print(bool("False"), bool(""))', answer: 'True False',
        explain: 'Any non-empty string is truthy, including the text "False".' },
      { kind: 'mc', prompt: 'Which check correctly tests "the list is empty"?',
        options: ['if len(x) == 0:', 'if not x:', 'if x == []:', 'All three work'],
        answer: 3, explain: 'All work; `if not x:` is the idiomatic one.' },
      { kind: 'code', prompt: 'Print `True` if `port` is a valid non-privileged port (1024 to 65535 inclusive).',
        starter: 'port = 8080\n', expect: 'True',
        solution: 'port = 8080\nprint(1024 <= port <= 65535)' },
      { kind: 'predict', prompt: 'Output?', code: 'a = "hi"\nb = "hi"\nprint(a == b, a is b)', answer: 'True True',
        explain: 'Short identical literals are interned so they share one object — which is exactly why you must not rely on `is` for values.' }
    ]
  },

  // ==========================================================================
  {
    id: 'py07', title: 'Conditionals', sub: 'if / elif / else and the match statement',
    teach: [
      { code: 'score = 74\nif score >= 90:\n    grade = "critical"\nelif score >= 70:\n    grade = "high"\nelif score >= 40:\n    grade = "medium"\nelse:\n    grade = "low"\nprint(grade)' },
      { p: '**Indentation is the syntax.** Four spaces per level, consistently. There are no braces, and a wrong indent changes the meaning of your program.' },
      { h: 'Only the first matching branch runs' },
      { code: 'n = 100\nif n > 10:\n    print("big")\nelif n > 50:\n    print("never prints - the first branch already won")' },
      { h: 'Conditional expressions' },
      { code: 'attempts = 5\nstatus = "locked" if attempts >= 3 else "ok"\nprint(status)' },
      { h: 'match (Python 3.10+)' },
      { code: 'code = 404\nmatch code:\n    case 200:\n        print("ok")\n    case 301 | 302:\n        print("redirect")\n    case _:\n        print("error", code)' },
      { tip: 'Deeply nested ifs are a smell. Prefer *guard clauses*: check the bad cases first and return/continue early, so the happy path stays flat.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Print `blocked` if `fails` is 3 or more, `warn` if 1 or 2, else `clear`.',
        starter: 'fails = 2\n', expect: 'warn',
        solution: 'fails = 2\nif fails >= 3:\n    print("blocked")\nelif fails >= 1:\n    print("warn")\nelse:\n    print("clear")' },
      { kind: 'predict', prompt: 'Output?',
        code: 'x = 15\nif x > 10:\n    print("a")\nelif x > 5:\n    print("b")\nelse:\n    print("c")', answer: 'a',
        explain: 'elif chains stop at the first true test.' },
      { kind: 'mc', prompt: 'What happens if you indent inconsistently inside one block?',
        options: ['Python guesses', 'IndentationError', 'It runs but slowly', 'Only a warning'],
        answer: 1, explain: 'Indentation is structural; mismatches are a hard syntax error.' },
      { kind: 'code', prompt: 'FizzBuzz for 1..15, one value per line: multiples of 3 -> Fizz, of 5 -> Buzz, of both -> FizzBuzz, else the number.',
        expect: '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz',
        hint: 'Test the "both" case first.',
        solution: 'for i in range(1, 16):\n    if i % 15 == 0:\n        print("FizzBuzz")\n    elif i % 3 == 0:\n        print("Fizz")\n    elif i % 5 == 0:\n        print("Buzz")\n    else:\n        print(i)' },
      { kind: 'code', prompt: 'Classify a port: print `web` for 80/443, `mail` for 25/587, else `other`.',
        starter: 'port = 587\n', expect: 'mail',
        solution: 'port = 587\nif port in (80, 443):\n    print("web")\nelif port in (25, 587):\n    print("mail")\nelse:\n    print("other")' }
    ]
  },

  // ==========================================================================
  {
    id: 'py08', title: 'Lists', sub: 'the ordered, mutable workhorse',
    teach: [
      { code: 'ports = [22, 80, 443]\nports.append(8080)\nports.insert(0, 21)\nprint(ports, len(ports))\nprint(ports[0], ports[-1], ports[1:3])' },
      { h: 'The methods' },
      { code: 'x = [3, 1, 4, 1, 5]\nx.remove(1)      # first matching VALUE\nprint(x)\nprint(x.pop())   # last item, and returns it\nprint(x.pop(0))  # by index\nx.extend([9, 2])\nprint(x, x.index(4), x.count(1))\nx.sort()\nprint(x)\nx.reverse()\nprint(x)' },
      { warn: '`sort()` sorts **in place and returns None**. `sorted(x)` returns a new list. `x = x.sort()` is a classic bug that leaves you holding None.' },
      { code: 'x = [3, 1, 2]\nprint(sorted(x), x)\nprint(sorted(["bb", "a", "ccc"], key=len))\nprint(sorted([3, 1, 2], reverse=True))' },
      { h: 'Lists are mutable and shared by reference' },
      { code: 'a = [1, 2, 3]\nb = a          # same list!\nb.append(4)\nprint(a)\nc = a.copy()   # or a[:] or list(a)\nc.append(5)\nprint(a, c)' },
      { warn: 'A copy is **shallow**: nested lists inside are still shared. Use `copy.deepcopy` when the structure is nested.' },
      { h: 'Nesting' },
      { code: 'grid = [[1, 2], [3, 4]]\nprint(grid[1][0])\nfor row in grid:\n    print(sum(row))' }
    ],
    challenges: [
      { kind: 'predict', prompt: 'Output?', code: 'x = [1, 2, 3]\ny = x.sort()\nprint(y)', answer: 'None',
        explain: 'sort() mutates and returns None.' },
      { kind: 'predict', prompt: 'Output?', code: 'a = [1, 2]\nb = a\nb.append(3)\nprint(a)', answer: '[1, 2, 3]',
        explain: 'b and a name the same list object.' },
      { kind: 'code', prompt: 'Print the second-largest number in the list.',
        starter: 'nums = [12, 45, 7, 45, 3, 31]\n', expect: '31',
        hint: 'Deduplicate with set() first, then sort.',
        solution: 'nums = [12, 45, 7, 45, 3, 31]\nprint(sorted(set(nums))[-2]);' },
      { kind: 'code', prompt: 'Given the log lines, print only the lines containing "FAIL", one per line.',
        starter: 'lines = ["OK boot", "FAIL auth", "OK sync", "FAIL disk"]\n',
        expect: 'FAIL auth\nFAIL disk',
        solution: 'lines = ["OK boot", "FAIL auth", "OK sync", "FAIL disk"]\nfor line in lines:\n    if "FAIL" in line:\n        print(line)' },
      { kind: 'code', prompt: 'Sort these hosts by their port number (the part after the colon) and print the resulting list.',
        starter: 'hosts = ["a:443", "b:22", "c:80"]\n', expect: "['b:22', 'c:80', 'a:443']",
        hint: 'key=lambda h: int(h.split(":")[1])',
        solution: 'hosts = ["a:443", "b:22", "c:80"]\nprint(sorted(hosts, key=lambda h: int(h.split(":")[1])))' },
      { kind: 'mc', prompt: 'What does `[0] * 3` produce?',
        options: ['[0, 3]', '[0, 0, 0]', '[[0], [0], [0]]', 'TypeError'],
        answer: 1, explain: 'Multiplying a list repeats its elements — handy for fixed-size buffers.' }
    ]
  },

  // ==========================================================================
  {
    id: 'py09', title: 'Tuples', sub: 'immutable records and multiple return values',
    teach: [
      { p: 'A tuple is a list that cannot change. That makes it **hashable**, so it can be a dict key or a set member.' },
      { code: 'point = (10, 20)\nendpoint = ("10.0.0.5", 443)\nprint(point[0], len(endpoint))\nsingle = (5,)      # the comma is what makes it a tuple\nprint(type(single), type((5)))' },
      { h: 'Unpacking is everywhere' },
      { code: 'host, port = endpoint\nprint(host, port)\n\na, b = 1, 2\na, b = b, a           # swap, no temp variable\nprint(a, b)\n\nfirst, *rest = [1, 2, 3, 4]\nprint(first, rest)' },
      { h: 'Functions return tuples to return several things' },
      { code: 'def split_hostport(text):\n    host, _, port = text.partition(":")\n    return host, int(port)\n\nh, p = split_hostport("srv:8080")\nprint(h, p)' },
      { code: 'for index, value in enumerate(["a", "b"]):\n    print(index, value)\nfor name, port in [("ssh", 22), ("dns", 53)]:\n    print(f"{name}={port}")' },
      { tip: 'Use a tuple when the *position* has meaning and the value should not change: coordinates, an (ip, port) pair, a database row.' }
    ],
    challenges: [
      { kind: 'predict', prompt: 'Output?', code: 'print(type((5)), type((5,)))',
        answer: "<class 'int'> <class 'tuple'>",
        explain: 'Parentheses alone just group; the comma creates the tuple.' },
      { kind: 'code', prompt: 'Swap the two variables and print them.',
        starter: 'a, b = "left", "right"\n', expect: 'right left',
        solution: 'a, b = "left", "right"\na, b = b, a\nprint(a, b)' },
      { kind: 'code', prompt: 'Unpack `record` into three names and print them separated by " / ".',
        starter: 'record = ("web01", "10.0.0.9", 443)\n', expect: 'web01 / 10.0.0.9 / 443',
        solution: 'record = ("web01", "10.0.0.9", 443)\nname, ip, port = record\nprint(f"{name} / {ip} / {port}")' },
      { kind: 'mc', prompt: 'Why can a tuple be a dictionary key but a list cannot?',
        options: ['Tuples are shorter', 'Tuples are hashable because they are immutable',
                  'Lists are too slow', 'Lists can be, actually'],
        answer: 1, explain: 'A key\'s hash must never change; mutability would break the dictionary.' },
      { kind: 'code', prompt: 'Use enumerate (starting at 1) to print each host with its position, like `1. alpha`.',
        starter: 'hosts = ["alpha", "beta"]\n', expect: '1. alpha\n2. beta',
        solution: 'hosts = ["alpha", "beta"]\nfor i, h in enumerate(hosts, start=1):\n    print(f"{i}. {h}")' }
    ]
  },

  // ==========================================================================
  {
    id: 'py10', title: 'Sets', sub: 'membership, deduplication and set algebra',
    teach: [
      { code: 'seen = {"10.0.0.1", "10.0.0.2", "10.0.0.1"}\nprint(seen, len(seen))\nseen.add("10.0.0.3")\nseen.discard("missing")   # no error; remove() would raise\nprint("10.0.0.2" in seen)' },
      { p: 'Sets are **unordered**, hold no duplicates, and test membership in constant time. Checking `x in big_set` is dramatically faster than `x in big_list`.' },
      { h: 'Set algebra reads like maths' },
      { code: 'allowed = {22, 80, 443}\nopen_ports = {22, 80, 3306, 8080}\nprint(sorted(open_ports - allowed))    # unexpected\nprint(sorted(open_ports & allowed))    # both\nprint(sorted(open_ports | allowed))    # either\nprint(sorted(open_ports ^ allowed))    # exactly one' },
      { code: 'print({22, 80}.issubset(allowed))\nprint(allowed.isdisjoint({9999}))' },
      { h: 'Deduplicate while keeping order' },
      { code: 'items = ["b", "a", "b", "c", "a"]\nprint(list(dict.fromkeys(items)))' },
      { warn: '`{}` is an empty **dict**, not a set. Use `set()` for an empty set.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Print the sorted list of ports that are open but not on the allow-list.',
        starter: 'allowed = {22, 443}\nopen_ports = {22, 80, 443, 3306}\n', expect: '[80, 3306]',
        solution: 'allowed = {22, 443}\nopen_ports = {22, 80, 443, 3306}\nprint(sorted(open_ports - allowed))' },
      { kind: 'predict', prompt: 'Output?', code: 'print(len({1, 2, 2, 3, 3, 3}))', answer: '3',
        explain: 'Duplicates collapse.' },
      { kind: 'mc', prompt: 'What is `type({})`?',
        options: ['set', 'dict', 'frozenset', 'tuple'], answer: 1,
        explain: 'Empty braces make a dict; use set() for an empty set.' },
      { kind: 'code', prompt: 'Two IOC feeds overlap. Print how many indicators appear in **both**.',
        starter: 'feed_a = {"a1", "b2", "c3", "d4"}\nfeed_b = {"c3", "d4", "e5"}\n', expect: '2',
        solution: 'feed_a = {"a1", "b2", "c3", "d4"}\nfeed_b = {"c3", "d4", "e5"}\nprint(len(feed_a & feed_b))' },
      { kind: 'code', prompt: 'Remove duplicate usernames keeping first-seen order, and print the list.',
        starter: 'users = ["root", "alice", "root", "bob", "alice"]\n',
        expect: "['root', 'alice', 'bob']",
        solution: 'users = ["root", "alice", "root", "bob", "alice"]\nprint(list(dict.fromkeys(users)))' }
    ]
  },

  // ==========================================================================
  {
    id: 'py11', title: 'Dictionaries', sub: 'key-value maps, the most used structure in Python',
    teach: [
      { code: 'alert = {"host": "web01", "severity": "high", "count": 3}\nprint(alert["host"], len(alert))\nalert["count"] += 1\nalert["source"] = "ids"\nprint(alert)' },
      { warn: '`alert["missing"]` raises KeyError. `alert.get("missing")` returns None, and `alert.get("missing", 0)` returns your default. Reach for `.get()` whenever the key might be absent.' },
      { h: 'Iterating' },
      { code: 'for key in alert:\n    print(key, "->", alert[key])\n\nfor key, value in alert.items():\n    print(f"{key}={value}")\n\nprint(list(alert.keys()), list(alert.values()))' },
      { h: 'Counting — the pattern you will use constantly' },
      { code: 'ips = ["10.0.0.1", "10.0.0.2", "10.0.0.1", "10.0.0.1"]\ncounts = {}\nfor ip in ips:\n    counts[ip] = counts.get(ip, 0) + 1\nprint(counts)\n\nfrom collections import Counter\nprint(Counter(ips).most_common(1))' },
      { h: 'Useful methods' },
      { code: 'd = {"a": 1}\nd.setdefault("b", []).append(2)\nd.update({"c": 3}, e=5)\nprint(d)\nprint(d.pop("a"), d)\nprint("b" in d)\nnested = {"user": {"name": "amy", "roles": ["admin"]}}\nprint(nested["user"]["roles"][0])' },
      { p: 'Keys must be hashable (str, int, tuple, frozenset). Since Python 3.7 dicts keep **insertion order**.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Print how many times each status code appears, as a dict.',
        starter: 'codes = [200, 404, 200, 500, 404, 200]\n', expect: '{200: 3, 404: 2, 500: 1}',
        solution: 'codes = [200, 404, 200, 500, 404, 200]\ncounts = {}\nfor c in codes:\n    counts[c] = counts.get(c, 0) + 1\nprint(counts)' },
      { kind: 'predict', prompt: 'Output?', code: 'd = {"a": 1}\nprint(d.get("z", "none"))', answer: 'none',
        explain: 'get() returns the supplied default instead of raising.' },
      { kind: 'code', prompt: 'Print the host with the highest alert count.',
        starter: 'alerts = {"web01": 3, "db02": 11, "app03": 7}\n', expect: 'db02',
        hint: 'max(d, key=d.get)',
        solution: 'alerts = {"web01": 3, "db02": 11, "app03": 7}\nprint(max(alerts, key=alerts.get))' },
      { kind: 'code', prompt: 'Invert the dict so values become keys. Print the result.',
        starter: 'ports = {"ssh": 22, "http": 80}\n', expect: "{22: 'ssh', 80: 'http'}",
        solution: 'ports = {"ssh": 22, "http": 80}\nprint({v: k for k, v in ports.items()})' },
      { kind: 'mc', prompt: 'Which cannot be a dict key?',
        options: ['(1, 2)', '"abc"', '[1, 2]', '42'], answer: 2,
        explain: 'Lists are mutable and therefore unhashable.' },
      { kind: 'code', prompt: 'Print the value of the nested field `user.roles[0]`.',
        starter: 'data = {"user": {"name": "amy", "roles": ["admin", "dev"]}}\n', expect: 'admin',
        solution: 'data = {"user": {"name": "amy", "roles": ["admin", "dev"]}}\nprint(data["user"]["roles"][0])' }
    ]
  },

  // ==========================================================================
  {
    id: 'py12', title: 'Loops', sub: 'for, while, break, continue — and the for/else nobody knows',
    teach: [
      { code: 'for port in [22, 80, 443]:\n    print("checking", port)\n\nfor i in range(3):\n    print(i)\nfor i in range(2, 9, 3):\n    print(i)\nfor ch in "abc":\n    print(ch)' },
      { p: '`range(start, stop, step)` stops **before** `stop` and produces values lazily — `range(10**9)` costs nothing until you iterate it.' },
      { h: 'while: loop until a condition changes' },
      { code: 'attempts = 0\nwhile attempts < 3:\n    attempts += 1\n    print("try", attempts)\nprint("done")' },
      { h: 'break, continue and else' },
      { code: 'for n in [4, 9, 15, 22]:\n    if n % 2 == 0:\n        continue          # skip the rest of this iteration\n    if n > 10:\n        print("found odd >10:", n)\n        break             # leave the loop entirely\nelse:\n    print("loop finished without break")' },
      { p: 'The `else` on a loop runs **only if the loop was never broken**. It is the clean way to express "searched everything and found nothing".' },
      { code: 'haystack = [1, 3, 5]\nfor x in haystack:\n    if x == 4:\n        print("hit")\n        break\nelse:\n    print("no match anywhere")' },
      { warn: 'Never mutate a list while iterating it — you will skip elements. Build a new list, or iterate a copy with `for x in items[:]`.' },
      { h: 'Looping over several things at once' },
      { code: 'names = ["a", "b", "c"]\nports = [22, 80]\nfor name, port in zip(names, ports):\n    print(name, port)      # stops at the shorter one' }
    ],
    challenges: [
      { kind: 'predict', prompt: 'Output?',
        code: 'for i in range(5):\n    if i == 3:\n        break\nelse:\n    print("done")\nprint(i)', answer: '3',
        explain: 'The break skips the else clause; i keeps its last value.' },
      { kind: 'code', prompt: 'Print the sum of numbers 1..100.', expect: '5050',
        solution: 'total = 0\nfor i in range(1, 101):\n    total += i\nprint(total)' },
      { kind: 'code', prompt: 'Print every port from the list that is NOT in the allow-list; if all are allowed print `all clear`.',
        starter: 'ports = [22, 80, 443]\nallowed = {22, 80, 443}\n', expect: 'all clear',
        hint: 'Use for/else.',
        solution: 'ports = [22, 80, 443]\nallowed = {22, 80, 443}\nfor p in ports:\n    if p not in allowed:\n        print(p)\n        break\nelse:\n    print("all clear")' },
      { kind: 'code', prompt: 'Countdown from 5 to 1, then print `liftoff`.',
        expect: '5\n4\n3\n2\n1\nliftoff',
        solution: 'n = 5\nwhile n > 0:\n    print(n)\n    n -= 1\nprint("liftoff")' },
      { kind: 'mc', prompt: 'When does a `for ... else` block run?',
        options: ['Always at the end', 'Only if the loop body never ran',
                  'Only if the loop finished without break', 'Never'],
        answer: 2, explain: 'else means "no break happened".' },
      { kind: 'code', prompt: 'Print the first number in the list divisible by 7. Print `none` if there is not one.',
        starter: 'nums = [3, 10, 21, 35]\n', expect: '21',
        solution: 'nums = [3, 10, 21, 35]\nfor n in nums:\n    if n % 7 == 0:\n        print(n)\n        break\nelse:\n    print("none")' }
    ]
  },

  // ==========================================================================
  {
    id: 'py13', title: 'Comprehensions', sub: 'building collections in one expressive line',
    teach: [
      { p: 'A comprehension is a loop that *produces* a collection. Read it as "give me EXPRESSION for each ITEM in SOURCE (where CONDITION)".' },
      { code: 'squares = [n * n for n in range(6)]\nprint(squares)\n\nodds = [n for n in range(10) if n % 2]\nprint(odds)\n\nports = ["22/tcp", "80/tcp", "53/udp"]\ntcp = [p.split("/")[0] for p in ports if p.endswith("tcp")]\nprint(tcp)' },
      { h: 'Dict and set comprehensions' },
      { code: 'names = ["ssh", "http"]\nnums = [22, 80]\nprint({n: p for n, p in zip(names, nums)})\nprint({len(w) for w in ["a", "bb", "cc"]})' },
      { h: 'Conditional expression inside' },
      { code: 'levels = [7, 2, 9]\nprint(["high" if n > 5 else "low" for n in levels])' },
      { p: 'Note the difference: a trailing `if` **filters**; an `if/else` before the `for` **transforms**.' },
      { h: 'Nested loops' },
      { code: 'grid = [[1, 2], [3, 4]]\nprint([cell for row in grid for cell in row])\nprint([(x, y) for x in "ab" for y in [1, 2]])' },
      { h: 'Generator expressions: same syntax, lazy' },
      { code: 'total = sum(n * n for n in range(1000))\nprint(total)\nprint(any(p == 443 for p in [22, 443, 80]))' },
      { warn: 'If a comprehension needs more than one filter plus a transform, write the loop. Clever is not the goal; readable is.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Build a list of the cubes of 1..5 and print it.', expect: '[1, 8, 27, 64, 125]',
        solution: 'print([n ** 3 for n in range(1, 6)])' },
      { kind: 'predict', prompt: 'Output?', code: 'print([x for x in "hacker" if x not in "aeiou"])',
        answer: "['h', 'c', 'k', 'r']", explain: 'The trailing if filters out the vowels.' },
      { kind: 'code', prompt: 'From the log lines, build a list of just the IP addresses (the second field) and print it.',
        starter: 'lines = ["OK 10.0.0.1 200", "FAIL 10.0.0.9 401"]\n', expect: "['10.0.0.1', '10.0.0.9']",
        solution: 'lines = ["OK 10.0.0.1 200", "FAIL 10.0.0.9 401"]\nprint([l.split()[1] for l in lines])' },
      { kind: 'code', prompt: 'Build a dict mapping each word to its length, for words longer than 3 characters.',
        starter: 'words = ["id", "hash", "salt", "key"]\n', expect: "{'hash': 4, 'salt': 4}",
        solution: 'words = ["id", "hash", "salt", "key"]\nprint({w: len(w) for w in words if len(w) > 3})' },
      { kind: 'mc', prompt: 'Which produces `[0, 2, 4]`?',
        options: ['[x for x in range(5) if x % 2]', '[x for x in range(5) if not x % 2]',
                  '[x if x % 2 else 0 for x in range(5)]', '[x * 2 for x in range(5)]'],
        answer: 1, explain: '`not x % 2` keeps the even numbers.' },
      { kind: 'code', prompt: 'Flatten the nested list into one list and print it.',
        starter: 'nested = [[1, 2], [3], [4, 5]]\n', expect: '[1, 2, 3, 4, 5]',
        solution: 'nested = [[1, 2], [3], [4, 5]]\nprint([x for sub in nested for x in sub])' }
    ]
  },

  // ==========================================================================
  {
    id: 'py14', title: 'Functions', sub: 'parameters, defaults, *args and **kwargs',
    teach: [
      { code: 'def banner(name, version="1.0"):\n    """Return a one-line banner."""\n    return f"{name} v{version}"\n\nprint(banner("scanner"))\nprint(banner("scanner", "2.3"))\nprint(banner(version="0.9", name="probe"))   # keyword arguments, any order' },
      { p: 'A function without a `return` gives back `None`. The triple-quoted string just under `def` is the **docstring** — `help(banner)` prints it.' },
      { h: 'Variable numbers of arguments' },
      { code: 'def audit(action, *targets, dry_run=False, **options):\n    print("action:", action)\n    print("targets:", targets)          # a tuple\n    print("dry_run:", dry_run)\n    print("options:", options)          # a dict\n\naudit("scan", "web01", "db02", dry_run=True, depth=3)' },
      { list: [
        '`*targets` collects extra positional arguments into a tuple',
        '`**options` collects extra keyword arguments into a dict',
        'Anything after `*` is **keyword-only** — callers must name it'
      ] },
      { h: 'Unpacking at the call site' },
      { code: 'args = ["a", "b"]\nkw = {"dry_run": True}\naudit("scan", *args, **kw)' },
      { warn: 'Never use a mutable default (`def f(items=[])`). The default is created **once**, at definition time, and every call shares it. Use `None` and build inside:' },
      { code: 'def add(item, bucket=None):\n    if bucket is None:\n        bucket = []\n    bucket.append(item)\n    return bucket\n\nprint(add(1), add(2))' },
      { h: 'Return several values' },
      { code: 'def stats(nums):\n    return min(nums), max(nums), sum(nums) / len(nums)\n\nlo, hi, avg = stats([3, 9, 6])\nprint(lo, hi, avg)' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Write `is_strong(pw)` returning True when the password is at least 12 characters and contains a digit. Print the result for the two test values.',
        starter: '\nprint(is_strong("short1"))\nprint(is_strong("correcthorse7battery"))',
        expect: 'False\nTrue',
        solution: 'def is_strong(pw):\n    return len(pw) >= 12 and any(c.isdigit() for c in pw)\n\nprint(is_strong("short1"))\nprint(is_strong("correcthorse7battery"))' },
      { kind: 'predict', prompt: 'Output?',
        code: 'def f(a, b=[]):\n    b.append(a)\n    return b\nprint(f(1))\nprint(f(2))', answer: '[1]\n[1, 2]',
        explain: 'The mutable default persists between calls — the classic Python trap.' },
      { kind: 'code', prompt: 'Write `total(*nums)` that returns the sum of any number of arguments, and print total(1, 2, 3, 4).',
        expect: '10', solution: 'def total(*nums):\n    return sum(nums)\n\nprint(total(1, 2, 3, 4))' },
      { kind: 'mc', prompt: 'In `def f(a, *b, c)`, how must `c` be passed?',
        options: ['Positionally', 'By keyword only', 'It is optional', 'It cannot be passed'],
        answer: 1, explain: 'Everything after *args is keyword-only.' },
      { kind: 'code', prompt: 'Write `describe(**kw)` that prints each key=value on its own line, sorted by key.',
        starter: '\ndescribe(port=22, host="a")', expect: 'host=a\nport=22',
        solution: 'def describe(**kw):\n    for k in sorted(kw):\n        print(f"{k}={kw[k]}")\n\ndescribe(port=22, host="a")' },
      { kind: 'code', prompt: 'Write `caesar(text, shift)` that shifts lowercase letters and leaves everything else alone. Print `caesar("attack at dawn", 3)`.',
        expect: 'dwwdfn dw gdzq',
        hint: 'ord(c) - 97, add the shift, % 26, then chr(... + 97).',
        solution: 'def caesar(text, shift):\n    out = ""\n    for c in text:\n        if "a" <= c <= "z":\n            out += chr((ord(c) - 97 + shift) % 26 + 97)\n        else:\n            out += c\n    return out\n\nprint(caesar("attack at dawn", 3))' }
    ]
  },

  // ==========================================================================
  {
    id: 'py15', title: 'Scope, Closures & Recursion', sub: 'where names live and how functions remember',
    teach: [
      { h: 'The LEGB rule' },
      { p: 'Python resolves a name by looking in **L**ocal, then **E**nclosing function, then **G**lobal (module), then **B**uilt-in.' },
      { code: 'count = 0            # global\n\ndef bump():\n    count = 99       # a NEW local, the global is untouched\n    print("inside", count)\n\nbump()\nprint("outside", count)' },
      { code: 'def bump_for_real():\n    global count\n    count += 1\n\nbump_for_real()\nprint(count)' },
      { warn: 'Reading a global is automatic; *assigning* to it makes a local unless you say `global`. Reaching for `global` is usually a sign the design wants a return value instead.' },
      { h: 'Closures: a function that carries its environment' },
      { code: 'def make_counter():\n    n = 0\n    def step():\n        nonlocal n     # rebind the enclosing n, not a new local\n        n += 1\n        return n\n    return step\n\nc = make_counter()\nprint(c(), c(), c())\nprint(make_counter()())    # a separate, independent counter' },
      { h: 'Recursion' },
      { code: 'def countdown(n):\n    if n == 0:            # base case FIRST\n        return ["liftoff"]\n    return [n] + countdown(n - 1)\n\nprint(countdown(4))\n\ndef depth(obj):\n    if not isinstance(obj, list):\n        return 0\n    return 1 + max((depth(x) for x in obj), default=0)\n\nprint(depth([1, [2, [3, [4]]]]))' },
      { p: 'Every recursion needs a **base case** that does not recurse, and each call must move toward it. Python caps recursion depth (about 1000) to turn runaway recursion into an error rather than a crash.' }
    ],
    challenges: [
      { kind: 'predict', prompt: 'Output?',
        code: 'x = 1\ndef f():\n    x = 2\nf()\nprint(x)', answer: '1',
        explain: 'Assignment inside a function creates a local name.' },
      { kind: 'code', prompt: 'Write a recursive `factorial(n)` and print factorial(10).', expect: '3628800',
        solution: 'def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n\nprint(factorial(10))' },
      { kind: 'code', prompt: 'Write `make_tagger(tag)` returning a function that wraps text: `make_tagger("b")("hi")` -> `<b>hi</b>`.',
        starter: '\nbold = make_tagger("b")\nprint(bold("hi"))', expect: '<b>hi</b>',
        solution: 'def make_tagger(tag):\n    def wrap(text):\n        return f"<{tag}>{text}</{tag}>"\n    return wrap\n\nbold = make_tagger("b")\nprint(bold("hi"))' },
      { kind: 'mc', prompt: 'What does `nonlocal` do?',
        options: ['Creates a global', 'Rebinds a name in the nearest enclosing function',
                  'Deletes a variable', 'Imports from another module'],
        answer: 1, explain: 'It reaches out one level, not all the way to module scope.' },
      { kind: 'code', prompt: 'Recursively sum all numbers in a nested list and print the total.',
        starter: 'data = [1, [2, [3, 4]], 5]\n', expect: '15',
        solution: 'def deep_sum(x):\n    if isinstance(x, list):\n        return sum(deep_sum(i) for i in x)\n    return x\n\ndata = [1, [2, [3, 4]], 5]\nprint(deep_sum(data))' }
    ]
  },

  // ==========================================================================
  {
    id: 'py16', title: 'Errors & Exceptions', sub: 'try/except/else/finally, raising, and custom errors',
    teach: [
      { p: 'An exception is not a crash — it is a control-flow signal you can catch.' },
      { code: 'def parse_port(text):\n    try:\n        port = int(text)\n    except ValueError:\n        print("not a number:", text)\n        return None\n    else:\n        print("parsed cleanly")\n        return port\n    finally:\n        print("always runs")\n\nprint(parse_port("443"))\nprint(parse_port("http"))' },
      { list: [
        '`try` — the risky code',
        '`except X as e` — handle one kind (or a tuple of kinds)',
        '`else` — runs only if no exception happened',
        '`finally` — always runs, even on return or re-raise. Cleanup lives here.'
      ] },
      { h: 'The hierarchy that matters' },
      { code: 'for bad in ["x", None]:\n    try:\n        int(bad)\n    except (ValueError, TypeError) as e:\n        print(type(e).__name__, "-", e)' },
      { warn: 'Never write a bare `except:` — it swallows KeyboardInterrupt and hides real bugs. Catch the narrowest exception you can actually handle.' },
      { h: 'Raising your own' },
      { code: 'class ScanError(Exception):\n    """Raised when a scan cannot continue."""\n\ndef scan(host):\n    if not host:\n        raise ScanError("host is required")\n    return f"scanned {host}"\n\ntry:\n    scan("")\nexcept ScanError as e:\n    print("caught:", e)' },
      { h: 'Chaining preserves the cause' },
      { code: 'try:\n    try:\n        int("nope")\n    except ValueError as e:\n        raise ScanError("bad config") from e\nexcept ScanError as e:\n    print(e)' },
      { tip: 'Python culture is "easier to ask forgiveness than permission": try the operation and handle the failure, rather than checking every precondition first.' }
    ],
    challenges: [
      { kind: 'predict', prompt: 'Output?',
        code: 'try:\n    print("a")\n    raise ValueError("x")\nexcept ValueError:\n    print("b")\nfinally:\n    print("c")', answer: 'a\nb\nc',
        explain: 'finally always runs, after the handler.' },
      { kind: 'code', prompt: 'Safely divide: print the result, or `undefined` if the divisor is zero.',
        starter: 'a, b = 10, 0\n', expect: 'undefined',
        solution: 'a, b = 10, 0\ntry:\n    print(a / b)\nexcept ZeroDivisionError:\n    print("undefined")' },
      { kind: 'code', prompt: 'Parse each value to int; print the number, or `skip: <value>` when it is not numeric.',
        starter: 'vals = ["10", "x", "7"]\n', expect: '10\nskip: x\n7',
        solution: 'vals = ["10", "x", "7"]\nfor v in vals:\n    try:\n        print(int(v))\n    except ValueError:\n        print(f"skip: {v}")' },
      { kind: 'mc', prompt: 'Which exception does `{"a":1}["b"]` raise?',
        options: ['IndexError', 'KeyError', 'ValueError', 'AttributeError'],
        answer: 1, explain: 'Missing dict keys raise KeyError; missing list indexes raise IndexError.' },
      { kind: 'code', prompt: 'Define `WeakPasswordError(Exception)`; raise it from `check(pw)` when the password is under 8 characters, and catch it to print `too weak`.',
        starter: '\ntry:\n    check("abc")\nexcept WeakPasswordError:\n    print("too weak")', expect: 'too weak',
        solution: 'class WeakPasswordError(Exception):\n    pass\n\ndef check(pw):\n    if len(pw) < 8:\n        raise WeakPasswordError(pw)\n    return True\n\ntry:\n    check("abc")\nexcept WeakPasswordError:\n    print("too weak")' }
    ]
  },

  // ==========================================================================
  {
    id: 'py17', title: 'Files & Paths', sub: 'reading, writing, and the with statement',
    teach: [
      { p: 'Always open files with `with` — it closes the handle even if an exception fires.' },
      { code: 'with open("notes.txt", "w") as f:\n    f.write("first line\\n")\n    f.write("second line\\n")\n\nwith open("notes.txt") as f:\n    print(f.read())' },
      { h: 'Modes' },
      { list: ['`"r"` read (default)', '`"w"` write — **truncates** the file', '`"a"` append',
               '`"r+"` read and write', 'add `"b"` for bytes: `"rb"`, `"wb"`'] },
      { h: 'Line by line, without loading the whole file' },
      { code: 'with open("notes.txt") as f:\n    for i, line in enumerate(f, 1):\n        print(i, line.rstrip())' },
      { p: 'Iterating the file object streams it — that is how you process a 10 GB log on a laptop.' },
      { code: 'with open("notes.txt") as f:\n    lines = f.readlines()\nprint(len(lines), lines[0].strip())' },
      { h: 'Binary files' },
      { code: 'with open("blob.bin", "wb") as f:\n    f.write(bytes([0x89, 0x50, 0x4E, 0x47]))\n\nwith open("blob.bin", "rb") as f:\n    magic = f.read(4)\nprint(magic, magic.hex())\nprint(magic == b"\\x89PNG")' },
      { tip: 'That four-byte check is real file-type identification — the same technique the forensics chapter uses to carve files out of a disk image.' },
      { h: 'Paths' },
      { code: 'import os\nprint(os.path.join("logs", "2026", "app.log"))\nprint(os.path.basename("/var/log/auth.log"))\nprint(os.path.splitext("report.tar.gz"))\nprint(os.path.exists("notes.txt"))' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Write three lines to `hosts.txt`, then read it back and print the number of lines.',
        expect: '3',
        solution: 'with open("hosts.txt", "w") as f:\n    f.write("a\\nb\\nc\\n")\n\nwith open("hosts.txt") as f:\n    print(len(f.readlines()))' },
      { kind: 'code', prompt: 'The file `auth.log` already exists. Print only the lines containing `FAIL`.',
        setup: 'with open("auth.log", "w") as f:\n    f.write("OK alice\\nFAIL bob\\nOK carol\\nFAIL dave\\n")\n',
        expect: 'FAIL bob\nFAIL dave',
        solution: 'with open("auth.log") as f:\n    for line in f:\n        if "FAIL" in line:\n            print(line.rstrip())' },
      { kind: 'mc', prompt: 'What does opening an existing file with mode `"w"` do?',
        options: ['Appends to it', 'Raises an error', 'Empties it immediately', 'Opens read-only'],
        answer: 2, explain: '"w" truncates. Use "a" to add without destroying.' },
      { kind: 'code', prompt: 'Append a line to the existing file and print the final contents.',
        setup: 'with open("log.txt", "w") as f:\n    f.write("one\\n")\n',
        expect: 'one\ntwo',
        solution: 'with open("log.txt", "a") as f:\n    f.write("two\\n")\nwith open("log.txt") as f:\n    print(f.read().rstrip())' },
      { kind: 'code', prompt: 'Write the bytes `FF D8 FF E0` to `img.bin`, read the first two back and print whether they are the JPEG magic `\\xff\\xd8`.',
        expect: 'True',
        solution: 'with open("img.bin", "wb") as f:\n    f.write(bytes([0xFF, 0xD8, 0xFF, 0xE0]))\nwith open("img.bin", "rb") as f:\n    print(f.read(2) == b"\\xff\\xd8")' }
    ]
  }

  );
})(typeof window !== 'undefined' ? window : globalThis);
