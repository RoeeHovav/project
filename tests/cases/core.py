# --- literals, numbers, operators -------------------------------------------
print(1 + 2, 7 // 2, -7 // 2, 7 % 3, -7 % 3, 2 ** 10, 7 / 2)
print(0x1f, 0b1010, 0o17, 1_000_000, 1e3, 2.5e-3)
print(divmod(17, 5), divmod(-17, 5), abs(-4.5), round(2.675, 2))
print(round(0.5), round(1.5), round(2.5), round(-0.5))
print(10 ** 30 + 1)
print(5 & 3, 5 | 3, 5 ^ 3, ~5, 1 << 10, 1024 >> 3)
print(True + True, int(True), float(3), bool(0), bool(''), bool([]))
ref = [1]
print(3 < 4 < 5, 3 < 4 > 10, 1 == 1.0, ref is ref, ref is [1])

# --- strings -----------------------------------------------------------------
s = "Hello, Cyber World"
print(s.upper(), s.lower(), s.title(), s.swapcase())
print(s.split(), s.split(','), s.replace('o', '0'), s[::-1], s[7:12])
print(len(s), s.find('Cyber'), s.rfind('o'), s.count('o'), s.index('World'))
print(s.startswith('Hello'), s.endswith(('x', 'World')))
print('  pad  '.strip(), '|' + 'x'.center(9, '-') + '|', 'x'.ljust(5, '.') + '|')
print('-'.join(['a', 'b', 'c']), 'a,b,,c'.split(','), 'abc'.zfill(6))
print('%s has %d items at %.2f%%' % ('cart', 3, 99.5))
print('{0} {1} {0} {name:>8}'.format('a', 'b', name='zed'))
print(f"{7:04d} {3.14159:.3f} {255:#x} {255:b} {1234567:,} {0.25:.1%}")
print(f"{'left':<10}|{'mid':^10}|{'right':>10}|")
name = 'agent'
print(f"{name=} {len(name)=}")
print('CafE'.encode('utf-8'), 'ok'.encode().hex())
print('a1b2'.isalnum(), 'abc'.isalpha(), '123'.isdigit(), '  '.isspace())
print('one two  three'.split(None, 1))
print('x.y.z'.partition('.'), 'x.y.z'.rpartition('.'))
print('Hello'.removeprefix('He'), 'Hello'.removesuffix('lo'))
print(repr('tab\there'), repr("quo'te"))

# --- lists -------------------------------------------------------------------
xs = [3, 1, 4, 1, 5, 9, 2, 6]
print(xs[2:5], xs[::2], xs[::-1], xs[-3:])
ys = xs.copy(); ys.sort(); print(ys)
ys.sort(reverse=True); print(ys)
print(sorted(xs, key=lambda v: -v), max(xs), min(xs), sum(xs))
xs.append(7); xs.insert(0, 0); xs.remove(1); print(xs, xs.pop(), xs.index(4), xs.count(1))
print([i * i for i in range(6)], [c for c in 'abc' if c != 'b'])
print([[r, c] for r in range(2) for c in range(2)])
print(list(range(10, 0, -3)), list(enumerate('ab', start=1)))
print(list(zip([1, 2, 3], 'xyz')), list(map(str, [1, 2])), list(filter(None, [0, 1, '', 'a'])))
a, *rest = [1, 2, 3, 4]
print(a, rest)
first, *mid, last = 'abcde'
print(first, mid, last)
m = [[1, 2], [3, 4]]
print([x for row in m for x in row])

# --- tuples / sets / dicts ---------------------------------------------------
t = (1, 'two', 3.0)
print(t, t[1], len(t), (1,), t + (4,), t * 2)
st = {3, 1, 2, 3}
print(sorted(st), len(st), 3 in st)
print(sorted({1, 2, 3} | {3, 4}), sorted({1, 2, 3} & {2, 3}), sorted({1, 2, 3} - {2}), sorted({1, 2} ^ {2, 3}))
print({1, 2}.issubset({1, 2, 3}), {1, 2}.isdisjoint({5}))
d = {'a': 1, 'b': 2}
d['c'] = 3
print(d, list(d.keys()), list(d.values()), list(d.items()))
print(d.get('z', 'none'), d.pop('a'), d, 'b' in d, len(d))
d.update({'x': 9}, y=10)
print(sorted(d.items()))
print({k: v * 2 for k, v in d.items()})
print({v: k for k, v in [('a', 1), ('b', 2)]})
print(dict(zip('abc', [1, 2, 3])))

# --- control flow ------------------------------------------------------------
for i in range(3):
    if i == 1:
        continue
    print('i', i)
else:
    print('loop done')
n = 0
while n < 3:
    n += 1
    if n == 2:
        break
else:
    print('never')
print('n', n)

# --- functions ---------------------------------------------------------------
def greet(name, greeting='Hello', *args, punct='!', **kwargs):
    return f"{greeting}, {name}{punct} {args} {sorted(kwargs.items())}"

print(greet('Ada'))
print(greet('Ada', 'Hi', 1, 2, punct='?', extra=True))

def fib(n, memo={}):
    if n in memo:
        return memo[n]
    memo[n] = n if n < 2 else fib(n - 1) + fib(n - 2)
    return memo[n]
print([fib(i) for i in range(12)])

adder = lambda x, y=10: x + y
print(adder(1), adder(1, 2))

def counter():
    c = 0
    def inc():
        nonlocal c
        c += 1
        return c
    return inc
c1 = counter()
print(c1(), c1(), c1())

# --- generators --------------------------------------------------------------
def gen(n):
    for i in range(n):
        yield i * i
print(list(gen(5)), sum(gen(4)))

def counter_gen():
    total = 0
    while True:
        x = yield total
        if x is None:
            break
        total += x
g = counter_gen()
print(next(g), g.send(5), g.send(7))

def chained():
    yield from [1, 2]
    yield from 'ab'
print(list(chained()))
print(list(x * 2 for x in range(4)))

# --- classes -----------------------------------------------------------------
class Animal:
    kind = 'generic'

    def __init__(self, name):
        self.name = name

    def speak(self):
        return f'{self.name} makes a sound'

    def __repr__(self):
        return f'Animal({self.name!r})'

    def __eq__(self, other):
        return isinstance(other, Animal) and self.name == other.name

class Dog(Animal):
    kind = 'dog'

    def __init__(self, name, breed):
        super().__init__(name)
        self.breed = breed

    def speak(self):
        return super().speak() + ' (woof)'

d1 = Dog('Rex', 'lab')
print(d1.speak(), d1.kind, Dog.kind, isinstance(d1, Animal), issubclass(Dog, Animal))
print(repr(Animal('x')), Animal('x') == Animal('x'))

class Vec:
    def __init__(self, x, y):
        self.x, self.y = x, y
    def __add__(self, o):
        return Vec(self.x + o.x, self.y + o.y)
    def __mul__(self, k):
        return Vec(self.x * k, self.y * k)
    def __len__(self):
        return 2
    def __getitem__(self, i):
        return (self.x, self.y)[i]
    def __str__(self):
        return f'<{self.x}, {self.y}>'
v = Vec(1, 2) + Vec(3, 4)
print(v, v * 3, len(v), v[0], list(v))

class Temp:
    def __init__(self, c):
        self._c = c
    @property
    def f(self):
        return self._c * 9 / 5 + 32
    @f.setter
    def f(self, value):
        self._c = (value - 32) * 5 / 9
    @staticmethod
    def zero():
        return Temp(0)
    @classmethod
    def from_f(cls, f):
        return cls((f - 32) * 5 / 9)
tp = Temp(100)
print(tp.f)
tp.f = 32
print(tp._c, Temp.zero()._c, round(Temp.from_f(212)._c))

# --- exceptions ---------------------------------------------------------------
class MyError(Exception):
    pass

def risky(x):
    if x < 0:
        raise MyError('negative!')
    if x == 0:
        raise ZeroDivisionError('zero')
    return 10 / x

for val in (-1, 0, 5):
    try:
        print('result', risky(val))
    except MyError as e:
        print('MyError:', e)
    except (ZeroDivisionError, ValueError) as e:
        print('math problem:', e)
    else:
        print('no error')
    finally:
        print('cleanup', val)

try:
    {}['missing']
except KeyError as e:
    print('KeyError', e)
try:
    [][3]
except IndexError as e:
    print('IndexError', e)
try:
    int('abc')
except ValueError as e:
    print('ValueError', e)
try:
    'a' + 1
except TypeError as e:
    print('TypeError caught')

# --- decorators / closures -----------------------------------------------------
def shout(fn):
    def wrapper(*args, **kwargs):
        return fn(*args, **kwargs).upper()
    return wrapper

def repeat(times):
    def deco(fn):
        def wrapper(*a, **k):
            return [fn(*a, **k) for _ in range(times)]
        return wrapper
    return deco

@shout
def hi(x):
    return f'hi {x}'
print(hi('there'))

@repeat(3)
def num():
    return 7
print(num())

# --- context managers -----------------------------------------------------------
class Managed:
    def __enter__(self):
        print('enter')
        return self
    def __exit__(self, exc_type, exc, tb):
        print('exit', exc_type is not None)
        return True
with Managed() as m:
    print('inside')
with Managed():
    raise ValueError('swallowed')
print('after')

# --- misc ------------------------------------------------------------------------
print(any([0, 1]), all([1, 1]), any([]), all([]))
print(sorted(['bb', 'a', 'ccc'], key=len), sorted([(2, 'b'), (1, 'a')]))
print(list(reversed([1, 2, 3])), tuple('abc'), set('hello') == {'h', 'e', 'l', 'o'})
print(hex(255), oct(8), bin(5), chr(65), ord('A'))
print(isinstance(1, int), isinstance(1.0, float), isinstance('s', str), type(1) is int)
print(pow(2, 10), pow(3, 100, 7))
walrus = [y for x in range(5) if (y := x * 2) > 4]
print(walrus)
print(f"{'nested ' + 'fstring'!r:>20}")
matrix = [[1, 2, 3], [4, 5, 6]]
print([list(r) for r in zip(*matrix)])
