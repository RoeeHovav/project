/* Python track, chapters 18-34. */
(function (root) {
  'use strict';
  var L = (root.PyForgeContent = root.PyForgeContent || { python: [], cyber: [] });

  L.python.push(

  // ==========================================================================
  {
    id: 'py18', title: 'Modules & Packages', sub: 'import, the standard library, pip and virtualenvs',
    teach: [
      { code: 'import math\nfrom math import sqrt, pi\nfrom collections import Counter as Tally\nimport os.path as p\n\nprint(math.floor(3.7), sqrt(16), round(pi, 4))\nprint(Tally("aab").most_common())\nprint(p.basename("/etc/hosts"))' },
      { warn: 'Avoid `from module import *`. It dumps unknown names into your namespace and silently shadows your own variables.' },
      { h: 'A module is just a .py file' },
      { p: 'If you write `utils.py` next to your script, `import utils` works. The names you define become `utils.something`.' },
      { code: '# Inside a module, this guard means "only when run directly":\nif __name__ == "__main__":\n    print("running as a script")\nprint("__name__ here is", __name__)' },
      { h: 'The standard library is the real superpower' },
      { list: [
        '`os`, `sys`, `pathlib` — the machine',
        '`json`, `csv`, `sqlite3` — data',
        '`re` — text patterns', '`datetime` — time',
        '`hashlib`, `hmac`, `secrets` — cryptography primitives',
        '`socket`, `urllib` — the network',
        '`itertools`, `functools`, `collections` — sharper tools for the basics'
      ] },
      { h: 'Third-party code' },
      { code: '# In a real terminal:\n#   python -m venv .venv\n#   source .venv/bin/activate     (Windows: .venv\\Scripts\\activate)\n#   pip install requests\n#   pip freeze > requirements.txt\nprint("a virtualenv keeps each project\'s dependencies separate")' },
      { tip: 'Pin your dependencies. `requests==2.32.3` is reproducible; `requests` is whatever the internet felt like today — and it is a supply-chain risk you will study later.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Import Counter and print the single most common character in the string.',
        starter: 'text = "mississippi"\n', expect: 'i',
        solution: 'from collections import Counter\ntext = "mississippi"\nprint(Counter(text).most_common(1)[0][0])' },
      { kind: 'mc', prompt: 'What is `__name__` equal to inside a file you run directly?',
        options: ['The filename', '"__main__"', '"__module__"', 'None'],
        answer: 1, explain: 'That is why the `if __name__ == "__main__":` guard works.' },
      { kind: 'code', prompt: 'Use `math` to print the greatest common divisor of 1071 and 462.',
        expect: '21', solution: 'import math\nprint(math.gcd(1071, 462))' },
      { kind: 'mc', prompt: 'Why use a virtual environment?',
        options: ['It makes Python faster', 'It isolates each project\'s package versions',
                  'It encrypts your code', 'It is required by the interpreter'],
        answer: 1, explain: 'Isolation stops one project\'s upgrade from breaking another.' },
      { kind: 'code', prompt: 'Import `secrets` and print the length of a 16-byte hex token (it should be 32).',
        expect: '32', solution: 'import secrets\nprint(len(secrets.token_hex(16)))' }
    ]
  },

  // ==========================================================================
  {
    id: 'py19', title: 'Classes & Objects', sub: 'bundling state with the behaviour that uses it',
    teach: [
      { code: 'class Host:\n    """A machine we are tracking."""\n    kind = "asset"          # class attribute, shared by all instances\n\n    def __init__(self, name, ip):\n        self.name = name     # instance attributes, one per object\n        self.ip = ip\n        self.open_ports = []\n\n    def add_port(self, port):\n        self.open_ports.append(port)\n        return self          # returning self allows chaining\n\n    def summary(self):\n        return f"{self.name} ({self.ip}) {len(self.open_ports)} open"\n\nweb = Host("web01", "10.0.0.5")\nweb.add_port(80).add_port(443)\nprint(web.summary(), web.kind)' },
      { p: '`self` is the instance, handed to every method automatically. `__init__` is the *initialiser*, run right after the object is created.' },
      { h: 'Class vs instance attributes' },
      { code: 'class Counter:\n    total = 0            # shared\n    def __init__(self):\n        Counter.total += 1\n        self.id = Counter.total\n\na, b = Counter(), Counter()\nprint(a.id, b.id, Counter.total)' },
      { warn: 'A **mutable** class attribute is shared by every instance — the same trap as a mutable default argument. Create lists and dicts inside `__init__`.' },
      { h: 'Privacy is a convention' },
      { code: 'class Vault:\n    def __init__(self, secret):\n        self._secret = secret         # "internal, please do not touch"\n        self.__really = "mangled"     # becomes _Vault__really\n\nv = Vault("x")\nprint(v._secret)\nprint(v._Vault__really)' },
      { p: 'Python has no enforced private. A single underscore is a request; a double underscore triggers name mangling, mostly to avoid clashes in subclasses.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Write a `Finding` class with `title` and `severity`, and a `label()` method returning `[HIGH] SQLi`. Print label() for the example.',
        starter: '\nf = Finding("SQLi", "HIGH")\nprint(f.label())', expect: '[HIGH] SQLi',
        solution: 'class Finding:\n    def __init__(self, title, severity):\n        self.title = title\n        self.severity = severity\n    def label(self):\n        return f"[{self.severity}] {self.title}"\n\nf = Finding("SQLi", "HIGH")\nprint(f.label())' },
      { kind: 'predict', prompt: 'Output?',
        code: 'class A:\n    items = []\n    def add(self, x):\n        self.items.append(x)\na, b = A(), A()\na.add(1)\nprint(b.items)', answer: '[1]',
        explain: 'items is a class attribute, so both instances share one list.' },
      { kind: 'code', prompt: 'Write `BankAccount` with `deposit` and `withdraw` that refuses to go negative (print `insufficient`). Run the given calls.',
        starter: '\nacc = BankAccount(100)\nacc.deposit(50)\nacc.withdraw(500)\nprint(acc.balance)', expect: 'insufficient\n150',
        solution: 'class BankAccount:\n    def __init__(self, balance=0):\n        self.balance = balance\n    def deposit(self, n):\n        self.balance += n\n    def withdraw(self, n):\n        if n > self.balance:\n            print("insufficient")\n            return\n        self.balance -= n\n\nacc = BankAccount(100)\nacc.deposit(50)\nacc.withdraw(500)\nprint(acc.balance)' },
      { kind: 'mc', prompt: 'What is `self`?',
        options: ['A keyword', 'The class', 'The instance the method was called on', 'A module'],
        answer: 2, explain: 'It is an ordinary parameter that Python fills with the instance.' },
      { kind: 'code', prompt: 'Add a `Stack` class with push/pop/peek/is_empty. Run the given script.',
        starter: '\ns = Stack()\ns.push(1)\ns.push(2)\nprint(s.pop(), s.peek(), s.is_empty())', expect: '2 1 False',
        solution: 'class Stack:\n    def __init__(self):\n        self._items = []\n    def push(self, x):\n        self._items.append(x)\n    def pop(self):\n        return self._items.pop()\n    def peek(self):\n        return self._items[-1]\n    def is_empty(self):\n        return not self._items\n\ns = Stack()\ns.push(1)\ns.push(2)\nprint(s.pop(), s.peek(), s.is_empty())' }
    ]
  },

  // ==========================================================================
  {
    id: 'py20', title: 'Inheritance & Dunder Methods', sub: 'reusing behaviour and hooking into the language',
    teach: [
      { code: 'class Scanner:\n    def __init__(self, target):\n        self.target = target\n    def run(self):\n        return f"generic scan of {self.target}"\n\nclass PortScanner(Scanner):\n    def __init__(self, target, ports):\n        super().__init__(target)      # run the parent initialiser\n        self.ports = ports\n    def run(self):\n        base = super().run()          # extend, do not replace\n        return f"{base} on ports {self.ports}"\n\nps = PortScanner("10.0.0.5", [22, 80])\nprint(ps.run())\nprint(isinstance(ps, Scanner), issubclass(PortScanner, Scanner))' },
      { h: 'Dunder methods hook into syntax' },
      { code: 'class Money:\n    def __init__(self, cents):\n        self.cents = cents\n    def __repr__(self):\n        return f"Money({self.cents})"\n    def __str__(self):\n        return f"${self.cents / 100:.2f}"\n    def __add__(self, other):\n        return Money(self.cents + other.cents)\n    def __eq__(self, other):\n        return isinstance(other, Money) and self.cents == other.cents\n    def __lt__(self, other):\n        return self.cents < other.cents\n    def __len__(self):\n        return self.cents\n    def __bool__(self):\n        return self.cents != 0\n\na, b = Money(250), Money(175)\nprint(a, repr(a))\nprint(a + b)\nprint(a == Money(250), b < a, bool(Money(0)))\nprint(sorted([a, b]))' },
      { list: [
        '`__repr__` — unambiguous, for developers (fall back for `str`)',
        '`__str__` — friendly, for users',
        '`__eq__` / `__lt__` — comparison and sorting',
        '`__len__` / `__bool__` / `__contains__` — truthiness and `in`',
        '`__getitem__` / `__setitem__` — indexing',
        '`__iter__` / `__next__` — looping',
        '`__enter__` / `__exit__` — the `with` statement',
        '`__call__` — makes the instance callable'
      ] },
      { h: 'Method resolution order' },
      { code: 'class A:\n    def who(self): return "A"\nclass B(A):\n    def who(self): return "B"\nclass C(A):\n    def who(self): return "C"\nclass D(B, C):\n    pass\n\nprint(D().who())\nprint([c.__name__ for c in D.__mro__])' },
      { tip: 'Prefer **composition** over deep inheritance. "A scanner *has a* reporter" is usually healthier than "a scanner *is a* reporter".' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Give `Vector` `__add__` and `__repr__` so the script prints `Vector(4, 6)`.',
        starter: '\nprint(Vector(1, 2) + Vector(3, 4))', expect: 'Vector(4, 6)',
        solution: 'class Vector:\n    def __init__(self, x, y):\n        self.x, self.y = x, y\n    def __add__(self, o):\n        return Vector(self.x + o.x, self.y + o.y)\n    def __repr__(self):\n        return f"Vector({self.x}, {self.y})"\n\nprint(Vector(1, 2) + Vector(3, 4))' },
      { kind: 'mc', prompt: 'Which dunder makes `len(obj)` work?',
        options: ['__size__', '__len__', '__length__', '__count__'], answer: 1 },
      { kind: 'code', prompt: 'Subclass Exception as `RateLimited` carrying a `retry_after`; raise and catch it, printing `wait 30`.',
        starter: '\ntry:\n    raise RateLimited(30)\nexcept RateLimited as e:\n    print("wait", e.retry_after)', expect: 'wait 30',
        solution: 'class RateLimited(Exception):\n    def __init__(self, retry_after):\n        super().__init__(f"retry in {retry_after}s")\n        self.retry_after = retry_after\n\ntry:\n    raise RateLimited(30)\nexcept RateLimited as e:\n    print("wait", e.retry_after)' },
      { kind: 'predict', prompt: 'Output?',
        code: 'class A:\n    def hi(self): return "A"\nclass B(A):\n    def hi(self): return "B" + super().hi()\nprint(B().hi())', answer: 'BA',
        explain: 'super() calls the parent implementation from inside the override.' },
      { kind: 'code', prompt: 'Make `Bag` support `in` and `len` so the script prints `True 2`.',
        starter: '\nb = Bag(["a", "b"])\nprint("a" in b, len(b))', expect: 'True 2',
        solution: 'class Bag:\n    def __init__(self, items):\n        self.items = items\n    def __contains__(self, x):\n        return x in self.items\n    def __len__(self):\n        return len(self.items)\n\nb = Bag(["a", "b"])\nprint("a" in b, len(b))' }
    ]
  },

  // ==========================================================================
  {
    id: 'py21', title: 'Properties, Dataclasses & Enums', sub: 'less boilerplate, better invariants',
    teach: [
      { h: 'property: a method that looks like an attribute' },
      { code: 'class Temperature:\n    def __init__(self, celsius):\n        self._celsius = celsius\n\n    @property\n    def fahrenheit(self):\n        return self._celsius * 9 / 5 + 32\n\n    @fahrenheit.setter\n    def fahrenheit(self, value):\n        self._celsius = (value - 32) * 5 / 9\n\nt = Temperature(100)\nprint(t.fahrenheit)\nt.fahrenheit = 32\nprint(t._celsius)' },
      { p: 'This is how you add validation later without breaking every caller that used a plain attribute.' },
      { h: 'staticmethod and classmethod' },
      { code: 'class Port:\n    def __init__(self, number):\n        self.number = number\n\n    @staticmethod\n    def is_privileged(n):\n        return n < 1024\n\n    @classmethod\n    def from_text(cls, text):\n        return cls(int(text))\n\nprint(Port.is_privileged(80))\nprint(Port.from_text("8080").number)' },
      { h: 'dataclasses kill the boilerplate' },
      { code: 'from dataclasses import dataclass\n\n@dataclass\nclass Finding:\n    title: str\n    severity: str = "low"\n    score: float = 0.0\n\nf = Finding("Open redirect", "medium", 5.3)\nprint(f)\nprint(f == Finding("Open redirect", "medium", 5.3))' },
      { p: 'You get `__init__`, `__repr__` and `__eq__` for free. `@dataclass(frozen=True)` makes instances immutable and hashable.' },
      { h: 'Enums name your constants' },
      { code: 'from enum import Enum\n\nclass Severity(Enum):\n    LOW = 1\n    MEDIUM = 5\n    HIGH = 9\n\nprint(Severity.HIGH, Severity.HIGH.value, Severity.HIGH.name)\nprint(Severity(5))\nprint([s.name for s in Severity])' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Add a read-only `area` property to `Rect` so the script prints `12`.',
        starter: '\nprint(Rect(3, 4).area)', expect: '12',
        solution: 'class Rect:\n    def __init__(self, w, h):\n        self.w, self.h = w, h\n    @property\n    def area(self):\n        return self.w * self.h\n\nprint(Rect(3, 4).area)' },
      { kind: 'code', prompt: 'Use @dataclass to define `Alert(host, level)` and print the instance.',
        starter: '\nprint(Alert("web01", "high"))', expect: "Alert(host='web01', level='high')",
        solution: 'from dataclasses import dataclass\n\n@dataclass\nclass Alert:\n    host: str\n    level: str\n\nprint(Alert("web01", "high"))' },
      { kind: 'mc', prompt: 'What does @dataclass generate for you?',
        options: ['Only __init__', '__init__, __repr__ and __eq__', 'Nothing at runtime', 'A database table'],
        answer: 1 },
      { kind: 'code', prompt: 'Define an Enum `Proto` with TCP=6 and UDP=17, then print the name for value 17.',
        expect: 'UDP',
        solution: 'from enum import Enum\n\nclass Proto(Enum):\n    TCP = 6\n    UDP = 17\n\nprint(Proto(17).name)' },
      { kind: 'code', prompt: 'Add a classmethod `from_csv` to `Host` that builds one from "web01,10.0.0.5". Print the ip.',
        starter: '\nprint(Host.from_csv("web01,10.0.0.5").ip)', expect: '10.0.0.5',
        solution: 'class Host:\n    def __init__(self, name, ip):\n        self.name, self.ip = name, ip\n    @classmethod\n    def from_csv(cls, line):\n        name, ip = line.split(",")\n        return cls(name, ip)\n\nprint(Host.from_csv("web01,10.0.0.5").ip)' }
    ]
  },

  // ==========================================================================
  {
    id: 'py22', title: 'Iterators & Generators', sub: 'lazy sequences and streaming data',
    teach: [
      { p: 'Anything you can loop over is an **iterable**; `iter()` turns it into an **iterator**, which yields values one at a time via `next()` and raises `StopIteration` when spent.' },
      { code: 'it = iter([1, 2])\nprint(next(it), next(it))\ntry:\n    next(it)\nexcept StopIteration:\n    print("exhausted")' },
      { h: 'Generators: iterators written as functions' },
      { code: 'def countdown(n):\n    while n > 0:\n        yield n\n        n -= 1\n    yield "liftoff"\n\nfor value in countdown(3):\n    print(value)\nprint(list(countdown(2)))' },
      { p: '`yield` suspends the function, hands a value out, and **resumes exactly where it left off** on the next request. Nothing is computed until asked for.' },
      { h: 'Why it matters: memory' },
      { code: 'def first_n_squares(n):\n    for i in range(n):\n        yield i * i\n\ngen = first_n_squares(10 ** 9)   # instant, allocates nothing\nprint(next(gen), next(gen), next(gen))' },
      { h: 'Pipelines' },
      { code: 'def read_lines():\n    yield "OK 10.0.0.1"\n    yield "FAIL 10.0.0.9"\n    yield "FAIL 10.0.0.9"\n\ndef only_failures(lines):\n    for line in lines:\n        if line.startswith("FAIL"):\n            yield line\n\ndef ips(lines):\n    for line in lines:\n        yield line.split()[1]\n\nprint(list(ips(only_failures(read_lines()))))' },
      { h: 'yield from, and sending values in' },
      { code: 'def inner():\n    yield 1\n    yield 2\ndef outer():\n    yield from inner()\n    yield 3\nprint(list(outer()))\n\ndef accumulator():\n    total = 0\n    while True:\n        n = yield total\n        if n is None:\n            break\n        total += n\n\nacc = accumulator()\nprint(next(acc), acc.send(5), acc.send(10))' },
      { h: 'Custom iterator class' },
      { code: 'class Fib:\n    def __init__(self, limit):\n        self.limit = limit\n    def __iter__(self):\n        a, b = 0, 1\n        while a < self.limit:\n            yield a\n            a, b = b, a + b\n\nprint(list(Fib(30)))' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Write a generator `evens(n)` yielding even numbers below n, and print the list for n=10.',
        expect: '[0, 2, 4, 6, 8]',
        solution: 'def evens(n):\n    for i in range(n):\n        if i % 2 == 0:\n            yield i\n\nprint(list(evens(10)))' },
      { kind: 'predict', prompt: 'Output?',
        code: 'def g():\n    print("start")\n    yield 1\ngen = g()\nprint("created")\nprint(next(gen))', answer: 'created\nstart\n1',
        explain: 'Calling a generator function runs none of the body until the first next().' },
      { kind: 'code', prompt: 'Write a generator that yields the running total of a list, and print the result for [1,2,3,4].',
        expect: '[1, 3, 6, 10]',
        solution: 'def running(nums):\n    total = 0\n    for n in nums:\n        total += n\n        yield total\n\nprint(list(running([1, 2, 3, 4])))' },
      { kind: 'mc', prompt: 'What is the main advantage of a generator over a list?',
        options: ['It is always faster', 'It holds one item at a time instead of all of them',
                  'It can be indexed', 'It sorts automatically'],
        answer: 1, explain: 'Constant memory, regardless of how long the sequence is.' },
      { kind: 'code', prompt: 'Make `Countdown` iterable with __iter__ so the loop prints 3, 2, 1.',
        starter: '\nfor n in Countdown(3):\n    print(n)', expect: '3\n2\n1',
        solution: 'class Countdown:\n    def __init__(self, n):\n        self.n = n\n    def __iter__(self):\n        n = self.n\n        while n > 0:\n            yield n\n            n -= 1\n\nfor n in Countdown(3):\n    print(n)' }
    ]
  },

  // ==========================================================================
  {
    id: 'py23', title: 'Decorators', sub: 'wrapping behaviour around a function',
    teach: [
      { p: 'Functions are objects: you can pass them, return them and store them. A decorator is a function that takes a function and returns a replacement.' },
      { code: 'def shout(fn):\n    def wrapper(*args, **kwargs):\n        return fn(*args, **kwargs).upper()\n    return wrapper\n\n@shout\ndef greet(name):\n    return f"hello {name}"\n\nprint(greet("world"))\n# @shout is exactly:  greet = shout(greet)' },
      { h: 'A practical one: timing / counting calls' },
      { code: 'import functools\n\ndef counted(fn):\n    @functools.wraps(fn)          # keep the original name and docstring\n    def wrapper(*args, **kwargs):\n        wrapper.calls += 1\n        return fn(*args, **kwargs)\n    wrapper.calls = 0\n    return wrapper\n\n@counted\ndef probe(host):\n    """Probe a host."""\n    return f"probed {host}"\n\nprobe("a"); probe("b")\nprint(probe.calls, probe.__name__, probe.__doc__)' },
      { h: 'Decorators that take arguments need one more layer' },
      { code: 'def retry(times):\n    def decorator(fn):\n        def wrapper(*a, **k):\n            for attempt in range(1, times + 1):\n                try:\n                    return fn(*a, **k)\n                except ValueError:\n                    print("attempt", attempt, "failed")\n            return "gave up"\n        return wrapper\n    return decorator\n\nstate = {"n": 0}\n\n@retry(3)\ndef flaky():\n    state["n"] += 1\n    if state["n"] < 3:\n        raise ValueError("boom")\n    return "succeeded on attempt " + str(state["n"])\n\nprint(flaky())' },
      { h: 'The one from the standard library you will actually use' },
      { code: 'from functools import lru_cache\n\n@lru_cache(maxsize=None)\ndef fib(n):\n    return n if n < 2 else fib(n - 1) + fib(n - 2)\n\nprint(fib(60))' },
      { tip: 'Decorators are how web frameworks do `@app.route("/")` and how test frameworks mark tests. Recognising the pattern demystifies a lot of library code.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Write a decorator `double` that doubles a function\'s numeric return value. Print `double`d add(2,3).',
        starter: '\n@double\ndef add(a, b):\n    return a + b\n\nprint(add(2, 3))', expect: '10',
        solution: 'def double(fn):\n    def wrapper(*a, **k):\n        return fn(*a, **k) * 2\n    return wrapper\n\n@double\ndef add(a, b):\n    return a + b\n\nprint(add(2, 3))' },
      { kind: 'predict', prompt: 'Output?',
        code: 'def d(f):\n    def w():\n        print("before")\n        f()\n        print("after")\n    return w\n@d\ndef go():\n    print("go")\ngo()', answer: 'before\ngo\nafter' },
      { kind: 'code', prompt: 'Write `@logged` that prints `calling <name>` before running the function.',
        starter: '\n@logged\ndef scan():\n    print("scanning")\n\nscan()', expect: 'calling scan\nscanning',
        solution: 'def logged(fn):\n    def wrapper(*a, **k):\n        print("calling", fn.__name__)\n        return fn(*a, **k)\n    return wrapper\n\n@logged\ndef scan():\n    print("scanning")\n\nscan()' },
      { kind: 'mc', prompt: 'What does functools.wraps preserve?',
        options: ['Speed', 'The wrapped function\'s __name__ and __doc__',
                  'Type hints only', 'Nothing, it is decorative'],
        answer: 1 },
      { kind: 'code', prompt: 'Use lru_cache so this naive fib finishes instantly, and print fib(35).',
        starter: 'def fib(n):\n    return n if n < 2 else fib(n - 1) + fib(n - 2)\n\nprint(fib(35))',
        expect: '9227465',
        solution: 'from functools import lru_cache\n\n@lru_cache(maxsize=None)\ndef fib(n):\n    return n if n < 2 else fib(n - 1) + fib(n - 2)\n\nprint(fib(35))' }
    ]
  },

  // ==========================================================================
  {
    id: 'py24', title: 'Functional Tools', sub: 'map, filter, reduce, lambda, sort keys',
    teach: [
      { code: 'nums = [3, 1, 4, 1, 5]\nprint(list(map(str, nums)))\nprint(list(filter(lambda n: n > 2, nums)))\n\nfrom functools import reduce\nprint(reduce(lambda a, b: a * b, nums))' },
      { p: 'A `lambda` is a one-expression anonymous function. Use it for tiny throwaway callbacks; anything longer deserves a `def` with a name.' },
      { h: 'Sorting with a key is the highest-value skill here' },
      { code: 'findings = [("xss", 6.1), ("sqli", 9.8), ("info", 0.0)]\nprint(sorted(findings, key=lambda f: f[1], reverse=True))\n\nwords = ["delta", "a", "bcd"]\nprint(sorted(words, key=len))\nprint(sorted(words, key=lambda w: (len(w), w)))   # tuple key = tiebreak' },
      { code: 'from operator import itemgetter, attrgetter\nrows = [{"ip": "10.0.0.2", "hits": 9}, {"ip": "10.0.0.1", "hits": 41}]\nprint(sorted(rows, key=itemgetter("hits"))[0]["ip"])' },
      { h: 'any / all / zip / enumerate' },
      { code: 'pw = "Tr0ub4dor"\nprint(any(c.isdigit() for c in pw), all(c.isalnum() for c in pw))\nprint(list(zip("abc", [1, 2, 3])))\nprint(dict(zip("abc", [1, 2, 3])))\nrows = [[1, 2, 3], [4, 5, 6]]\nprint([list(c) for c in zip(*rows)])   # transpose' },
      { tip: 'A comprehension is usually clearer than `map`/`filter` in Python. `[f(x) for x in xs if p(x)]` beats `list(map(f, filter(p, xs)))`.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Sort the hosts by port descending and print the list of names only.',
        starter: 'hosts = [("a", 22), ("b", 443), ("c", 80)]\n', expect: "['b', 'c', 'a']",
        solution: 'hosts = [("a", 22), ("b", 443), ("c", 80)]\nprint([h[0] for h in sorted(hosts, key=lambda h: h[1], reverse=True)])' },
      { kind: 'predict', prompt: 'Output?', code: 'print(list(filter(None, [0, 1, "", "a", None, 2])))',
        answer: "[1, 'a', 2]", explain: 'filter(None, ...) keeps the truthy values.' },
      { kind: 'code', prompt: 'Use reduce to compute the XOR of all values and print it.',
        starter: 'vals = [12, 7, 12, 9]\n', expect: '14',
        solution: 'from functools import reduce\nvals = [12, 7, 12, 9]\nprint(reduce(lambda a, b: a ^ b, vals))' },
      { kind: 'code', prompt: 'Transpose the matrix and print it as a list of lists.',
        starter: 'm = [[1, 2, 3], [4, 5, 6]]\n', expect: '[[1, 4], [2, 5], [3, 6]]',
        solution: 'm = [[1, 2, 3], [4, 5, 6]]\nprint([list(c) for c in zip(*m)])' },
      { kind: 'mc', prompt: 'What does `sorted(x, key=lambda v: (len(v), v))` do?',
        options: ['Sorts by length only', 'Sorts by length, then alphabetically for ties',
                  'Sorts alphabetically only', 'Raises an error'],
        answer: 1, explain: 'Tuple keys compare element by element — the standard tiebreak idiom.' }
    ]
  },

  // ==========================================================================
  {
    id: 'py25', title: 'Regular Expressions', sub: 'the pattern language every analyst needs',
    teach: [
      { code: 'import re\n\nlog = "2026-01-05 12:44:01 WARN failed login user=admin from 203.0.113.7"\nm = re.search(r"\\d{1,3}(?:\\.\\d{1,3}){3}", log)\nprint(m.group(), m.start(), m.span())' },
      { warn: 'Always write patterns as **raw strings** (`r"..."`) so backslashes reach the regex engine untouched.' },
      { h: 'The building blocks' },
      { list: [
        '`.` any char · `\\d` digit · `\\w` word char · `\\s` whitespace (capitals negate)',
        '`*` 0+ · `+` 1+ · `?` 0 or 1 · `{2,5}` a range',
        '`^` start · `$` end · `\\b` word boundary',
        '`[abc]` a set · `[^abc]` not in set · `a|b` alternation',
        '`(...)` capturing group · `(?:...)` non-capturing · `(?P<name>...)` named'
      ] },
      { code: 'text = "user=admin role=root attempts=5"\nprint(re.findall(r"(\\w+)=(\\S+)", text))\nprint(dict(re.findall(r"(\\w+)=(\\S+)", text)))\n\nm = re.search(r"user=(?P<who>\\w+)", text)\nprint(m.group("who"), m.groupdict())' },
      { h: 'The five functions' },
      { code: 'print(re.match(r"\\d+", "123abc"))        # anchored at the start\nprint(re.search(r"\\d+", "abc123"))       # anywhere\nprint(re.findall(r"\\d+", "a1b22c333"))   # all matches, as strings\nprint(re.sub(r"\\d", "#", "a1b22"))       # replace\nprint(re.split(r"[,;]\\s*", "a, b; c"))' },
      { h: 'Greedy vs lazy' },
      { code: 'html = "<b>one</b><b>two</b>"\nprint(re.findall(r"<b>.*</b>", html))    # greedy: one huge match\nprint(re.findall(r"<b>.*?</b>", html))   # lazy: each tag' },
      { h: 'Compile when reusing' },
      { code: 'ip_re = re.compile(r"\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b")\nfor line in ["from 10.0.0.1 ok", "no address here"]:\n    found = ip_re.findall(line)\n    print(found or "-")' },
      { warn: 'Catastrophic backtracking is a real denial-of-service bug: a pattern like `(a+)+$` against a long non-matching string can hang for years. Keep quantifiers from nesting.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Print every IPv4 address in the text, as a list.',
        starter: 'import re\ntext = "src=10.0.0.1 dst=192.168.1.254 via 8.8.8.8"\n',
        expect: "['10.0.0.1', '192.168.1.254', '8.8.8.8']",
        solution: 'import re\ntext = "src=10.0.0.1 dst=192.168.1.254 via 8.8.8.8"\nprint(re.findall(r"\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b", text))' },
      { kind: 'code', prompt: 'Redact every email address, replacing it with `[EMAIL]`. Print the result.',
        starter: 'import re\nnote = "contact a.b@corp.com or ops@corp.com"\n',
        expect: 'contact [EMAIL] or [EMAIL]',
        solution: 'import re\nnote = "contact a.b@corp.com or ops@corp.com"\nprint(re.sub(r"[\\w.+-]+@[\\w-]+\\.[\\w.]+", "[EMAIL]", note))' },
      { kind: 'predict', prompt: 'Output?', code: 'import re\nprint(re.findall(r"a+?", "aaa"))',
        answer: "['a', 'a', 'a']", explain: 'The lazy quantifier matches as little as possible each time.' },
      { kind: 'code', prompt: 'Parse `key=value` pairs into a dict and print it.',
        starter: 'import re\ns = "host=web01 port=443 tls=on"\n',
        expect: "{'host': 'web01', 'port': '443', 'tls': 'on'}",
        solution: 'import re\ns = "host=web01 port=443 tls=on"\nprint(dict(re.findall(r"(\\w+)=(\\S+)", s)))' },
      { kind: 'mc', prompt: 'What does `\\b` match?',
        options: ['A backspace', 'A word boundary', 'A blank line', 'A literal b'],
        answer: 1, explain: 'Inside a raw string it is the zero-width boundary between \\w and \\W.' },
      { kind: 'code', prompt: 'Count how many lines are ERROR level (use MULTILINE and ^).',
        starter: 'import re\nlog = "INFO a\\nERROR b\\nWARN c\\nERROR d"\n', expect: '2',
        solution: 'import re\nlog = "INFO a\\nERROR b\\nWARN c\\nERROR d"\nprint(len(re.findall(r"^ERROR", log, re.MULTILINE)))' }
    ]
  },

  // ==========================================================================
  {
    id: 'py26', title: 'JSON, CSV & Serialization', sub: 'moving data in and out of your program',
    teach: [
      { code: 'import json\n\nalert = {"host": "web01", "ports": [22, 443], "active": True, "owner": None}\ntext = json.dumps(alert)\nprint(text)\nprint(json.dumps(alert, indent=2, sort_keys=True))\n\nback = json.loads(text)\nprint(back["ports"][1], type(back["active"]))' },
      { list: [
        'Python `dict` ↔ JSON object', '`list`/`tuple` ↔ array', '`str` ↔ string',
        '`int`/`float` ↔ number', '`True`/`False` ↔ true/false', '`None` ↔ null'
      ] },
      { warn: 'JSON has no tuples, no sets, no bytes and no dates. Convert them yourself before dumping, or supply a `default=` function.' },
      { h: 'Files' },
      { code: 'import json\nwith open("cfg.json", "w") as f:\n    json.dump({"debug": False, "retries": 3}, f)\nwith open("cfg.json") as f:\n    cfg = json.load(f)\nprint(cfg["retries"])' },
      { h: 'CSV' },
      { code: 'import csv, io\n\nraw = "host,port,service\\nweb01,443,https\\ndb02,3306,mysql\\n"\nfor row in csv.DictReader(io.StringIO(raw)):\n    print(row["host"], "->", row["service"])\n\nout = io.StringIO()\nw = csv.writer(out)\nw.writerow(["ip", "risk"])\nw.writerow(["10.0.0.1", "high, urgent"])\nprint(repr(out.getvalue()))' },
      { p: 'The csv module handles quoting and embedded commas correctly. Splitting on commas by hand does not — that is how analyst scripts corrupt data.' },
      { warn: 'Never use `pickle` on data you did not produce yourself. Unpickling arbitrary bytes executes arbitrary code; JSON is the safe interchange format.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Parse the JSON and print the value of `users[1]["name"]`.',
        starter: 'import json\ntext = \'{"users": [{"name": "amy"}, {"name": "bo"}]}\'\n', expect: 'bo',
        solution: 'import json\ntext = \'{"users": [{"name": "amy"}, {"name": "bo"}]}\'\nprint(json.loads(text)["users"][1]["name"])' },
      { kind: 'code', prompt: 'Dump the dict as JSON with sorted keys and no spaces after separators. Print it.',
        starter: 'import json\nd = {"b": 2, "a": 1}\n', expect: '{"a":1,"b":2}',
        solution: 'import json\nd = {"b": 2, "a": 1}\nprint(json.dumps(d, sort_keys=True, separators=(",", ":")))' },
      { kind: 'code', prompt: 'Read the CSV and print the total of the `port` column.',
        starter: 'import csv, io\nraw = "host,port\\na,22\\nb,443\\n"\n', expect: '465',
        solution: 'import csv, io\nraw = "host,port\\na,22\\nb,443\\n"\ntotal = 0\nfor row in csv.DictReader(io.StringIO(raw)):\n    total += int(row["port"])\nprint(total)' },
      { kind: 'mc', prompt: 'Which Python value has no JSON equivalent?',
        options: ['None', 'True', 'A set', 'A list'], answer: 2,
        explain: 'Sets must be converted (usually to a list) before serialising.' },
      { kind: 'mc', prompt: 'Why is pickle unsafe for untrusted input?',
        options: ['It is slow', 'It can execute arbitrary code while loading',
                  'It is not cross-platform', 'It loses precision'],
        answer: 1, explain: 'A crafted pickle can run any command during __reduce__.' }
    ]
  },

  // ==========================================================================
  {
    id: 'py27', title: 'Dates & Times', sub: 'timestamps, deltas and why UTC matters',
    teach: [
      { code: 'from datetime import datetime, date, timedelta\n\nd = datetime(2026, 3, 14, 15, 9, 26)\nprint(d.isoformat())\nprint(d.year, d.month, d.day, d.hour)\nprint(d.strftime("%Y/%m/%d %H:%M %A"))' },
      { h: 'Parsing' },
      { code: 'from datetime import datetime\nstamp = datetime.strptime("2026-01-05 12:44:01", "%Y-%m-%d %H:%M:%S")\nprint(stamp.isoformat())\nprint(datetime.fromisoformat("2026-02-02T08:00:00").day)' },
      { list: ['`%Y` 4-digit year', '`%m` month', '`%d` day', '`%H:%M:%S` time',
               '`%A` weekday name', '`%b` short month', '`%j` day of year'] },
      { h: 'Arithmetic with timedelta' },
      { code: 'from datetime import datetime, timedelta\na = datetime(2026, 1, 1)\nb = a + timedelta(days=45, hours=6)\nprint(b.isoformat())\ngap = b - a\nprint(gap.days, gap.total_seconds())' },
      { h: 'Log-analysis pattern: bucketing by time' },
      { code: 'from datetime import datetime\nevents = ["2026-01-05 12:01:00", "2026-01-05 12:02:30", "2026-01-05 13:00:00"]\nbuckets = {}\nfor e in events:\n    t = datetime.strptime(e, "%Y-%m-%d %H:%M:%S")\n    key = t.strftime("%Y-%m-%d %H:00")\n    buckets[key] = buckets.get(key, 0) + 1\nprint(buckets)' },
      { warn: 'Store and compare timestamps in **UTC**. Local times jump an hour twice a year, which silently creates duplicate or missing log entries exactly when you least want it.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Parse the timestamp and print just the weekday name.',
        starter: 'from datetime import datetime\ns = "2026-03-14 15:09:26"\n', expect: 'Saturday',
        solution: 'from datetime import datetime\ns = "2026-03-14 15:09:26"\nprint(datetime.strptime(s, "%Y-%m-%d %H:%M:%S").strftime("%A"))' },
      { kind: 'code', prompt: 'Print how many days there are between 2026-01-01 and 2026-03-01.',
        expect: '59',
        solution: 'from datetime import date\nprint((date(2026, 3, 1) - date(2026, 1, 1)).days)' },
      { kind: 'code', prompt: 'Print the ISO timestamp 90 minutes after 2026-01-01 00:00.',
        expect: '2026-01-01T01:30:00',
        solution: 'from datetime import datetime, timedelta\nprint((datetime(2026, 1, 1) + timedelta(minutes=90)).isoformat())' },
      { kind: 'mc', prompt: 'Why store timestamps in UTC?',
        options: ['It is faster', 'It avoids DST jumps and timezone ambiguity',
                  'It uses less space', 'Python requires it'],
        answer: 1 },
      { kind: 'code', prompt: 'Count events per hour and print the dict.',
        starter: 'from datetime import datetime\nevents = ["2026-01-05 12:01:00", "2026-01-05 12:40:00", "2026-01-05 14:00:00"]\n',
        expect: "{'12': 2, '14': 1}",
        solution: 'from datetime import datetime\nevents = ["2026-01-05 12:01:00", "2026-01-05 12:40:00", "2026-01-05 14:00:00"]\nb = {}\nfor e in events:\n    h = datetime.strptime(e, "%Y-%m-%d %H:%M:%S").strftime("%H")\n    b[h] = b.get(h, 0) + 1\nprint(b)' }
    ]
  },

  // ==========================================================================
  {
    id: 'py28', title: 'Type Hints', sub: 'documentation the tools can check',
    teach: [
      { p: 'Annotations do not change how Python runs — they let editors and `mypy` catch mistakes before you do.' },
      { code: 'def risk_score(findings: list, weight: float = 1.0) -> float:\n    return sum(f["cvss"] for f in findings) * weight\n\nprint(risk_score([{"cvss": 7.5}, {"cvss": 2.0}], 2))\nprint(risk_score.__annotations__)' },
      { h: 'Container types' },
      { code: 'from typing import Optional, Union\n\ndef find_host(name: str) -> Optional[str]:\n    hosts = {"web01": "10.0.0.5"}\n    return hosts.get(name)\n\nprint(find_host("web01"), find_host("nope"))' },
      { p: 'Modern syntax (3.9+) uses the builtins directly: `list[int]`, `dict[str, float]`, `str | None` instead of `Optional[str]`.' },
      { code: 'def parse_ports(text: str) -> list:\n    """Turn "22,80" into [22, 80]."""\n    return [int(p) for p in text.split(",") if p]\n\nprint(parse_ports("22,80,443"))' },
      { h: 'Dataclasses need them' },
      { code: 'from dataclasses import dataclass\n\n@dataclass\nclass Target:\n    host: str\n    port: int = 443\n    tags: tuple = ()\n\nprint(Target("a"), Target("b", 8080, ("prod",)))' },
      { tip: 'Annotate the boundaries — function signatures and data classes. Annotating every local variable is noise.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Annotate and implement `average(nums) -> float` returning the mean; print average([2, 4, 9]).',
        expect: '5.0',
        solution: 'def average(nums: list) -> float:\n    return sum(nums) / len(nums)\n\nprint(average([2, 4, 9]))' },
      { kind: 'mc', prompt: 'What does Python do at runtime if an annotation is violated?',
        options: ['Raises TypeError', 'Nothing — annotations are not enforced',
                  'Converts the value', 'Logs a warning'],
        answer: 1, explain: 'Checking is the job of a static checker like mypy or your editor.' },
      { kind: 'code', prompt: 'Print the __annotations__ dict of the given function.',
        starter: 'def f(a: int, b: str = "x") -> bool:\n    return True\n',
        expect: "{'a': <class 'int'>, 'b': <class 'str'>, 'return': <class 'bool'>}",
        solution: 'def f(a: int, b: str = "x") -> bool:\n    return True\n\nprint(f.__annotations__)' },
      { kind: 'mc', prompt: 'What does `Optional[str]` mean?',
        options: ['The argument may be omitted', 'str or None', 'Any type', 'A list of strings'],
        answer: 1 }
    ]
  },

  // ==========================================================================
  {
    id: 'py29', title: 'Testing & Debugging', sub: 'assert, unit tests, logging and reading tracebacks',
    teach: [
      { h: 'Read the traceback from the bottom up' },
      { p: 'The **last** line names the exception and the message. The lines above it are the call chain, most recent last. Ninety percent of debugging is reading that carefully instead of guessing.' },
      { code: 'def parse(text):\n    return int(text)\n\ntry:\n    parse("abc")\nexcept ValueError as e:\n    print("ValueError:", e)' },
      { h: 'assert for internal invariants' },
      { code: 'def normalise(score):\n    assert 0 <= score <= 100, f"score out of range: {score}"\n    return score / 100\n\nprint(normalise(75))\ntry:\n    normalise(150)\nexcept AssertionError as e:\n    print("caught:", e)' },
      { warn: '`assert` is stripped when Python runs with `-O`. Never use it to validate user input or enforce security checks — raise a real exception instead.' },
      { h: 'Writing tests' },
      { code: 'def add(a, b):\n    return a + b\n\ndef test_add():\n    assert add(2, 3) == 5\n    assert add(-1, 1) == 0\n    assert add(0, 0) == 0\n\ntest_add()\nprint("all tests passed")' },
      { p: 'In a real project you would put those in `test_math.py` and run `pytest`. The shape is the same: arrange, act, assert.' },
      { h: 'logging beats print' },
      { code: 'import logging\nlogging.basicConfig(level=logging.INFO)\nlogging.info("scan started")\nlogging.warning("host %s did not respond", "web01")\nlogging.error("aborting")' },
      { p: 'Logging gives you levels, timestamps and the ability to turn detail up or down without editing code.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Write `test_reverse()` asserting that reversing "abc" gives "cba" and reversing "" gives "". Call it and print `ok`.',
        expect: 'ok',
        solution: 'def rev(s):\n    return s[::-1]\n\ndef test_reverse():\n    assert rev("abc") == "cba"\n    assert rev("") == ""\n\ntest_reverse()\nprint("ok")' },
      { kind: 'mc', prompt: 'Where is the actual error named in a traceback?',
        options: ['The first line', 'The last line', 'The middle', 'It is not shown'],
        answer: 1 },
      { kind: 'code', prompt: 'This function has an off-by-one bug. Fix it so it prints `[1, 2, 3]`.',
        starter: 'def first_n(items, n):\n    return items[:n - 1]\n\nprint(first_n([1, 2, 3, 4, 5], 3))',
        expect: '[1, 2, 3]',
        solution: 'def first_n(items, n):\n    return items[:n]\n\nprint(first_n([1, 2, 3, 4, 5], 3))' },
      { kind: 'mc', prompt: 'Why should security checks not use assert?',
        options: ['Too slow', 'Assertions are removed when Python runs with -O',
                  'They cannot raise', 'They only work on ints'],
        answer: 1 },
      { kind: 'code', prompt: 'Use logging at WARNING level to emit `WARNING:root:disk 91% full`.',
        expect: 'WARNING:root:disk 91% full',
        solution: 'import logging\nlogging.basicConfig(level=logging.INFO)\nlogging.warning("disk %d%% full", 91)' }
    ]
  },

  // ==========================================================================
  {
    id: 'py30', title: 'Concurrency', sub: 'threads, processes, asyncio and the GIL',
    teach: [
      { h: 'Three different problems' },
      { list: [
        '**I/O-bound** (waiting on network/disk) → threads or asyncio. Huge wins.',
        '**CPU-bound** (hashing, crunching) → multiprocessing. Threads will not help.',
        '**Both** → processes, each running its own event loop.'
      ] },
      { h: 'The GIL, honestly' },
      { p: 'CPython\'s Global Interpreter Lock lets only one thread execute Python bytecode at a time. Threads still help enormously for I/O because the lock is released while waiting on a socket — but two threads will never speed up a pure-Python hash loop.' },
      { code: 'import time\n\ndef fetch(host):\n    time.sleep(0.1)          # stands in for a network round trip\n    return f"{host} ok"\n\nstart = time.time()\nresults = [fetch(h) for h in ["a", "b", "c"]]\nprint(results)\nprint("sequential took ~0.3s of waiting")' },
      { h: 'asyncio: one thread, many waits' },
      { code: 'import asyncio\n\nasync def probe(host):\n    await asyncio.sleep(0.05)\n    return f"{host} up"\n\nasync def main():\n    results = await asyncio.gather(probe("a"), probe("b"), probe("c"))\n    return results\n\nprint(asyncio.run(main()))' },
      { p: '`async def` defines a coroutine; `await` yields control back to the loop while something else runs. There is no parallelism — just no idle waiting.' },
      { warn: 'Shared mutable state across threads needs a `Lock`. A read-modify-write like `counter += 1` is three bytecodes and can interleave; that is a race condition, and in security code it is a vulnerability (TOCTOU).' },
      { code: 'import threading\nlock = threading.Lock()\ncounter = 0\n\ndef bump():\n    global counter\n    with lock:\n        counter += 1\n\nbump(); bump()\nprint(counter)' }
    ],
    challenges: [
      { kind: 'mc', prompt: 'You need to hash 10 million passwords faster. What helps?',
        options: ['Threads', 'asyncio', 'Multiprocessing', 'Nothing can help'],
        answer: 2, explain: 'CPU-bound work needs separate processes to escape the GIL.' },
      { kind: 'mc', prompt: 'You need to fetch 500 URLs. What helps most?',
        options: ['Multiprocessing', 'asyncio or threads', 'Recursion', 'A bigger list'],
        answer: 1, explain: 'The work is waiting, not computing.' },
      { kind: 'code', prompt: 'Use asyncio to run three coroutines concurrently and print the gathered list.',
        starter: 'import asyncio\n\nasync def job(n):\n    await asyncio.sleep(0.01)\n    return n * 2\n\n', expect: '[2, 4, 6]',
        solution: 'import asyncio\n\nasync def job(n):\n    await asyncio.sleep(0.01)\n    return n * 2\n\nasync def main():\n    return await asyncio.gather(job(1), job(2), job(3))\n\nprint(asyncio.run(main()))' },
      { kind: 'mc', prompt: 'What is a race condition?',
        options: ['Code that runs too fast', 'Two threads interleaving on shared state so the result depends on timing',
                  'A loop that never ends', 'A syntax error'],
        answer: 1 },
      { kind: 'code', prompt: 'Protect the shared counter with a Lock so the final value prints as 3.',
        starter: 'import threading\ncounter = 0\n\ndef bump():\n    global counter\n    counter += 1\n\nbump(); bump(); bump()\nprint(counter)', expect: '3',
        solution: 'import threading\nlock = threading.Lock()\ncounter = 0\n\ndef bump():\n    global counter\n    with lock:\n        counter += 1\n\nbump(); bump(); bump()\nprint(counter)' }
    ]
  },

  // ==========================================================================
  {
    id: 'py31', title: 'Performance & Memory', sub: 'choosing the right structure, and measuring instead of guessing',
    teach: [
      { h: 'Complexity you should know by heart' },
      { list: [
        'list index / append — O(1); `x in list` — **O(n)**',
        'set / dict lookup, insert — O(1) average',
        'list insert(0, x) / pop(0) — O(n); use `collections.deque` for queues',
        'sorting — O(n log n)',
        'string `+=` in a loop — O(n²); use `"".join(parts)`'
      ] },
      { code: 'words = ["a"] * 5\n# slow pattern\ns = ""\nfor w in words:\n    s += w\n# fast pattern\ns2 = "".join(words)\nprint(s == s2)' },
      { h: 'The single biggest win: set membership' },
      { code: 'blocklist_list = [f"10.0.0.{i}" for i in range(1000)]\nblocklist_set = set(blocklist_list)\nprint("10.0.0.999" in blocklist_list)   # scans up to 1000 items\nprint("10.0.0.999" in blocklist_set)    # one hash lookup' },
      { h: 'Measure, do not guess' },
      { code: 'import time\nstart = time.perf_counter()\ntotal = sum(i * i for i in range(200000))\nelapsed = time.perf_counter() - start\nprint(total > 0, "measured elapsed time in seconds")' },
      { p: 'In a real terminal use `timeit` for microbenchmarks and `cProfile` for whole programs: `python -m cProfile -s cumtime script.py`.' },
      { h: 'Memory' },
      { code: 'import sys\nprint(sys.getsizeof(0), sys.getsizeof("a" * 100))\ngen = (i for i in range(10 ** 7))     # tiny\nprint("generator created without allocating 10M items")' },
      { tip: 'Optimise only what you measured. The usual answer is not a clever trick — it is a dict instead of a scan, or doing the work once instead of in a loop.' }
    ],
    challenges: [
      { kind: 'mc', prompt: 'What is the cost of `x in my_list` for a list of n items?',
        options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'], answer: 2 },
      { kind: 'code', prompt: 'Rewrite this to run in linear time using a set, printing the count of matches.',
        starter: 'known = [f"h{i}" for i in range(500)]\nincoming = ["h1", "zz", "h499"]\ncount = 0\nfor item in incoming:\n    if item in known:\n        count += 1\nprint(count)', expect: '2',
        solution: 'known = set(f"h{i}" for i in range(500))\nincoming = ["h1", "zz", "h499"]\nprint(sum(1 for item in incoming if item in known))' },
      { kind: 'mc', prompt: 'Why is repeated `s += x` in a loop slow?',
        options: ['Strings are immutable so each step copies the whole string',
                  'Python checks types each time', 'It uses a lock', 'It is not slow'],
        answer: 0 },
      { kind: 'code', prompt: 'Join the list into one comma-separated string efficiently and print it.',
        starter: 'parts = ["a", "b", "c"]\n', expect: 'a,b,c',
        solution: 'parts = ["a", "b", "c"]\nprint(",".join(parts))' },
      { kind: 'mc', prompt: 'Which structure gives O(1) pops from BOTH ends?',
        options: ['list', 'tuple', 'collections.deque', 'set'], answer: 2 }
    ]
  },

  // ==========================================================================
  {
    id: 'py32', title: 'Pythonic Style', sub: 'PEP 8, idioms, and the traps that bite everyone',
    teach: [
      { h: 'Layout' },
      { list: [
        '4 spaces per indent, never tabs', 'lines under ~88 characters',
        '`snake_case` functions and variables, `PascalCase` classes, `UPPER_CASE` constants',
        'two blank lines between top-level definitions',
        'imports at the top: standard library, then third-party, then local'
      ] },
      { h: 'Idioms that mark fluent Python' },
      { code: 'items = ["a", "b"]\n\n# enumerate instead of a manual index\nfor i, x in enumerate(items):\n    print(i, x)\n\n# unpack instead of indexing\nhost, port = ("web01", 443)\n\n# truthiness instead of len()\nif items:\n    print("non-empty")\n\n# get() instead of a key check\nd = {}\nprint(d.get("k", "default"))\n\n# join instead of += in a loop\nprint(", ".join(items))\n\n# with instead of manual close\nwith open("x.txt", "w") as f:\n    f.write("safe")' },
      { h: 'The traps' },
      { code: '# 1. mutable default argument\ndef bad(items=[]):\n    items.append(1)\n    return items\nprint(bad(), bad())\n\n# 2. late binding in closures\nfuncs = [lambda: i for i in range(3)]\nprint([f() for f in funcs])        # all 2!\nfixed = [lambda i=i: i for i in range(3)]\nprint([f() for f in fixed])\n\n# 3. copying is shallow\nimport copy\nnested = [[1], [2]]\nshallow = nested[:]\nshallow[0].append(99)\nprint(nested)' },
      { tip: '"There should be one — and preferably only one — obvious way to do it." When two solutions look equally good, pick the one a stranger will understand faster at 3am during an incident.' }
    ],
    challenges: [
      { kind: 'predict', prompt: 'Output?', code: 'fs = [lambda: i for i in range(3)]\nprint([f() for f in fs])',
        answer: '[2, 2, 2]', explain: 'The lambdas close over the variable i, not its value at creation time.' },
      { kind: 'code', prompt: 'Rewrite this loop in the idiomatic way and print the same result.',
        starter: 'items = ["x", "y", "z"]\ni = 0\nfor item in items:\n    print(i, item)\n    i += 1', expect: '0 x\n1 y\n2 z',
        solution: 'items = ["x", "y", "z"]\nfor i, item in enumerate(items):\n    print(i, item)' },
      { kind: 'mc', prompt: 'Which is the PEP 8 name for a constant?',
        options: ['maxRetries', 'MaxRetries', 'MAX_RETRIES', 'max-retries'], answer: 2 },
      { kind: 'code', prompt: 'Fix the mutable default so each call returns a fresh list. Print both calls.',
        starter: 'def collect(x, bucket=[]):\n    bucket.append(x)\n    return bucket\n\nprint(collect(1))\nprint(collect(2))', expect: '[1]\n[2]',
        solution: 'def collect(x, bucket=None):\n    if bucket is None:\n        bucket = []\n    bucket.append(x)\n    return bucket\n\nprint(collect(1))\nprint(collect(2))' },
      { kind: 'mc', prompt: 'Why is `if len(x) > 0:` less Pythonic than `if x:`?',
        options: ['It is slower', 'It is more typing for the same meaning and works on fewer types',
                  'It raises on dicts', 'It is actually preferred'],
        answer: 1 }
    ]
  },

  // ==========================================================================
  {
    id: 'py33', title: 'Context Managers & Descriptors', sub: 'the with statement, and attribute interception',
    teach: [
      { h: 'Writing your own context manager' },
      { code: 'class Timer:\n    def __enter__(self):\n        print("start")\n        return self\n    def __exit__(self, exc_type, exc, tb):\n        print("stop, error:", exc_type is not None)\n        return False      # False re-raises, True swallows\n\nwith Timer() as t:\n    print("working")\n\ntry:\n    with Timer():\n        raise ValueError("boom")\nexcept ValueError:\n    print("propagated")' },
      { p: '`__exit__` receives the exception if one occurred. Returning **True** suppresses it — do that deliberately and rarely.' },
      { h: 'The decorator shortcut' },
      { code: 'from contextlib import contextmanager\n\n@contextmanager\ndef section(name):\n    print(f"-- {name} --")\n    try:\n        yield name\n    finally:\n        print(f"-- end {name} --")\n\nwith section("scan") as s:\n    print("inside", s)' },
      { h: 'Why it matters for security code' },
      { p: 'Context managers guarantee cleanup: closing sockets, releasing locks, wiping a decrypted buffer, restoring permissions. "It ran even though we crashed" is the whole point.' },
      { h: 'Descriptors: how property actually works' },
      { code: 'class Positive:\n    def __set_name__(self, owner, name):\n        self.name = "_" + name\n    def __get__(self, obj, owner=None):\n        return getattr(obj, self.name)\n    def __set__(self, obj, value):\n        if value < 0:\n            raise ValueError("must be >= 0")\n        setattr(obj, self.name, value)\n\nclass Budget:\n    amount = Positive()\n    def __init__(self, amount):\n        self.amount = amount\n\nb = Budget(10)\nprint(b.amount)\ntry:\n    b.amount = -5\nexcept ValueError as e:\n    print("rejected:", e)' },
      { tip: '`property`, `classmethod`, `staticmethod` and even plain methods are all descriptors. Once you see that, the object model stops being magic.' }
    ],
    challenges: [
      { kind: 'code', prompt: 'Write a context manager class `Quiet` whose __exit__ swallows ValueError. The script should print `after`.',
        starter: '\nwith Quiet():\n    raise ValueError("x")\nprint("after")', expect: 'after',
        solution: 'class Quiet:\n    def __enter__(self):\n        return self\n    def __exit__(self, exc_type, exc, tb):\n        return exc_type is ValueError\n\nwith Quiet():\n    raise ValueError("x")\nprint("after")' },
      { kind: 'predict', prompt: 'Output?',
        code: 'class M:\n    def __enter__(self):\n        print("in")\n        return 7\n    def __exit__(self, *a):\n        print("out")\n        return False\nwith M() as v:\n    print(v)', answer: 'in\n7\nout' },
      { kind: 'mc', prompt: 'What does returning True from __exit__ do?',
        options: ['Re-raises the exception', 'Suppresses the exception',
                  'Restarts the block', 'Nothing'], answer: 1 },
      { kind: 'code', prompt: 'Use contextlib.contextmanager to build `banner(name)` that prints `[name]` before and `[/name]` after.',
        starter: '\nwith banner("scan"):\n    print("work")', expect: '[scan]\nwork\n[/scan]',
        solution: 'from contextlib import contextmanager\n\n@contextmanager\ndef banner(name):\n    print(f"[{name}]")\n    try:\n        yield\n    finally:\n        print(f"[/{name}]")\n\nwith banner("scan"):\n    print("work")' }
    ]
  },

  // ==========================================================================
  {
    id: 'py34', title: 'The Object Model', sub: 'metaclasses, __slots__, and how attribute lookup really works',
    teach: [
      { h: 'Everything is an object, including classes' },
      { code: 'class A:\n    pass\nprint(type(A), type(type(A)))\n\n# Classes can be built at runtime:\nB = type("B", (), {"greet": lambda self: "hi"})\nprint(B().greet())' },
      { h: 'Attribute lookup order' },
      { list: [
        'data descriptors on the type (e.g. `property`)',
        'the instance `__dict__`',
        'the type and its MRO',
        '`__getattr__` as a last resort'
      ] },
      { code: 'class Lazy:\n    def __getattr__(self, name):\n        return f"<generated {name}>"\n\nl = Lazy()\nl.real = 1\nprint(l.real, l.anything)' },
      { h: '__slots__: fewer bytes, fixed shape' },
      { code: 'class Point:\n    __slots__ = ("x", "y")\n    def __init__(self, x, y):\n        self.x, self.y = x, y\n\np = Point(1, 2)\nprint(p.x, p.y)\ntry:\n    p.z = 3\nexcept AttributeError as e:\n    print("blocked:", e)' },
      { p: 'With `__slots__` there is no per-instance dict — a real memory win when you create millions of small objects, and a light form of typo protection.' },
      { h: 'Metaclasses: classes that build classes' },
      { code: 'registry = {}\n\nclass Registered(type):\n    def __init__(cls, name, bases, ns):\n        super().__init__(name, bases, ns)\n        registry[name] = cls\n\nclass Plugin(metaclass=Registered):\n    pass\nclass ScannerPlugin(Plugin):\n    pass\n\nprint(sorted(registry))' },
      { warn: 'Metaclasses are powerful and almost never the right answer. Try a decorator, `__init_subclass__`, or plain composition first — in that order.' }
    ],
    challenges: [
      { kind: 'predict', prompt: 'Output?', code: 'class A: pass\nprint(type(A).__name__)', answer: 'type',
        explain: 'The type of an ordinary class is `type` itself.' },
      { kind: 'code', prompt: 'Add __slots__ to make setting an undeclared attribute raise. Print `blocked` when it does.',
        starter: 'class P:\n    def __init__(self, x):\n        self.x = x\n\np = P(1)\ntry:\n    p.y = 2\n    print("allowed")\nexcept AttributeError:\n    print("blocked")', expect: 'blocked',
        solution: 'class P:\n    __slots__ = ("x",)\n    def __init__(self, x):\n        self.x = x\n\np = P(1)\ntry:\n    p.y = 2\n    print("allowed")\nexcept AttributeError:\n    print("blocked")' },
      { kind: 'code', prompt: 'Use __getattr__ so any missing attribute returns the string "unknown". Print `obj.whatever`.',
        starter: '\no = Flexible()\nprint(o.whatever)', expect: 'unknown',
        solution: 'class Flexible:\n    def __getattr__(self, name):\n        return "unknown"\n\no = Flexible()\nprint(o.whatever)' },
      { kind: 'mc', prompt: 'When is __getattr__ called?',
        options: ['On every attribute access', 'Only when normal lookup fails',
                  'Only for methods', 'Only for private names'], answer: 1 },
      { kind: 'code', prompt: 'Build a class at runtime with type() named `Tool` having a method `run` that returns "running". Print Tool().run().',
        expect: 'running',
        solution: 'Tool = type("Tool", (), {"run": lambda self: "running"})\nprint(Tool().run())' }
    ]
  }

  );
})(typeof window !== 'undefined' ? window : globalThis);
