import math, random, string, itertools, functools, collections, copy, heapq, bisect, operator, statistics

print(math.floor(3.7), math.ceil(3.2), math.sqrt(16), round(math.pi, 5))
print(math.gcd(12, 18), math.lcm(4, 6), math.factorial(6), math.isqrt(99))
print(math.log(math.e), round(math.log(8, 2), 10), math.comb(5, 2), math.perm(5, 2))
print(math.hypot(3, 4), math.isclose(0.1 + 0.2, 0.3), math.trunc(-3.7))
print(math.inf > 10 ** 100, math.isnan(math.nan))

random.seed(42)
print(random.random())
print(random.randint(1, 100), random.randrange(0, 50, 5))
print(random.choice('ABCDEF'))
deck = list(range(10))
random.shuffle(deck)
print(deck)
random.seed(1337)
print([random.randint(0, 255) for _ in range(8)])
random.seed(1337)
print([random.randint(0, 255) for _ in range(8)])
random.seed(7)
print(random.getrandbits(16), random.getrandbits(64))
random.seed(99)
print(random.sample(range(20), 5))

print(string.ascii_lowercase[:6], string.digits, len(string.punctuation))

print(list(itertools.islice(itertools.count(10, 5), 4)))
print(list(itertools.islice(itertools.cycle('AB'), 5)))
print(list(itertools.repeat('x', 3)))
print(list(itertools.chain([1, 2], 'ab')))
print(list(itertools.product('AB', repeat=2)))
print(list(itertools.permutations('ABC', 2)))
print(list(itertools.combinations(range(4), 2)))
print([(k, list(g)) for k, g in itertools.groupby('aabbbc')])
print(list(itertools.accumulate([1, 2, 3, 4])))
print(list(itertools.zip_longest([1, 2, 3], 'ab', fillvalue='-')))
print(list(itertools.takewhile(lambda x: x < 3, [1, 2, 3, 1])))
print(list(itertools.dropwhile(lambda x: x < 3, [1, 2, 3, 1])))
print(list(itertools.starmap(pow, [(2, 3), (3, 2)])))

print(functools.reduce(lambda a, b: a * b, [1, 2, 3, 4]))
double = functools.partial(pow, 2)
print(double(8))

@functools.lru_cache(maxsize=None)
def slow_fib(n):
    return n if n < 2 else slow_fib(n - 1) + slow_fib(n - 2)
print(slow_fib(30))

c = collections.Counter('mississippi')
print(c.most_common(3), c['s'], c['z'], sum(c.values()))
dd = collections.defaultdict(list)
dd['a'].append(1)
dd['a'].append(2)
print(dict(dd))
dq = collections.deque([1, 2, 3])
dq.appendleft(0)
dq.append(4)
dq.rotate(1)
print(list(dq), len(dq), dq.popleft(), dq.pop())
Point = collections.namedtuple('Point', 'x y')
p = Point(3, 4)
print(p, p.x, p[1], p._asdict(), p._replace(y=9))

orig = {'a': [1, 2], 'b': {'c': 3}}
sh = copy.copy(orig)
dp = copy.deepcopy(orig)
orig['a'].append(99)
print(sh['a'], dp['a'])

h = [5, 1, 8, 3]
heapq.heapify(h)
heapq.heappush(h, 0)
print([heapq.heappop(h) for _ in range(len(h))])
print(heapq.nlargest(2, [4, 1, 9, 7]), heapq.nsmallest(2, [4, 1, 9, 7]))

arr = [1, 3, 5, 7]
print(bisect.bisect_left(arr, 5), bisect.bisect_right(arr, 5))
bisect.insort(arr, 4)
print(arr)

print(operator.add(2, 3), operator.mul(4, 5), operator.itemgetter(1)([9, 8, 7]))
people = [('bob', 30), ('amy', 25)]
print(sorted(people, key=operator.itemgetter(1)))

print(statistics.mean([1, 2, 3, 4]), statistics.median([3, 1, 2]), statistics.mode([1, 1, 2]))
print(round(statistics.stdev([2, 4, 4, 4, 5, 5, 7, 9]), 6))
