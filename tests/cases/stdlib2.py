import re, json, csv, io, textwrap, struct, datetime

log = '2026-01-05 12:44:01 WARN  Failed login for user=admin from 203.0.113.7 attempts=5'
m = re.search(r'(?P<ip>\d{1,3}(?:\.\d{1,3}){3})', log)
print(m.group(), m.group('ip'), m.start(), m.end(), m.span())
print(re.findall(r'\d+', log))
print(re.findall(r'(\w+)=(\S+)', log))
print(re.sub(r'\d{1,3}(?:\.\d{1,3}){3}', '[REDACTED]', log))
print(re.split(r'\s+', 'a b   c', maxsplit=1))
print(bool(re.match(r'^\d{4}-\d{2}-\d{2}', log)), bool(re.fullmatch(r'\w+', 'abc')))
pat = re.compile(r'user=(\w+)', re.IGNORECASE)
print(pat.pattern, pat.search(log).group(1))
print([mo.group(0) for mo in re.finditer(r'[A-Z]{2,}', log)])
print(re.escape('a.b*c'))
print(re.sub(r'(\w+)@(\w+)', r'\2 at \1', 'alice@corp bob@corp'))
print(re.sub(r'\d', lambda mo: '#' * len(mo.group()), 'a1b22'))
email_re = re.compile(r'^[\w.+-]+@[\w-]+\.[\w.]+$')
for addr in ['ok@example.com', 'bad@@x', 'a.b+c@sub.domain.org']:
    print(addr, bool(email_re.match(addr)))
print(re.findall(r'^\w+', 'one\ntwo', re.MULTILINE))
print(re.search(r'a.c', 'a\nc', re.DOTALL).group())
verbose = re.compile(r"""
    \d{3}   # area
    -
    \d{4}   # number
""", re.VERBOSE)
print(verbose.search('call 555-1234').group())

data = {'user': 'admin', 'roles': ['a', 'b'], 'active': True, 'score': 9.5, 'meta': None, 'n': 42}
s = json.dumps(data)
print(s)
print(json.dumps(data, sort_keys=True))
print(json.dumps({'x': [1, 2]}, indent=2))
back = json.loads(s)
print(back['user'], back['roles'], back['n'], type(back['n']).__name__, back['meta'])
print(json.loads('[1, 2.5, "x", null, true]'))

print(textwrap.fill('the quick brown fox jumps over the lazy dog', width=20))
print(textwrap.shorten('the quick brown fox jumps', width=15))
print(repr(textwrap.dedent('    a\n    b')))

packed = struct.pack('>IH4s', 1234567, 80, b'HTTP')
print(packed, packed.hex())
print(struct.unpack('>IH4s', packed))
print(struct.calcsize('<QQ'), struct.pack('<h', -2).hex())

d = datetime.datetime(2026, 3, 14, 15, 9, 26)
print(d.isoformat(), d.year, d.month, d.day, d.hour)
print(d.strftime('%Y/%m/%d %H:%M:%S %A'))
delta = datetime.timedelta(days=3, hours=6)
print((d + delta).isoformat(), delta.total_seconds())
print(datetime.date(2026, 1, 1).isoformat(), (datetime.date(2026, 3, 1) - datetime.date(2026, 1, 1)).days)
print(datetime.datetime.strptime('2026-05-06 07:08:09', '%Y-%m-%d %H:%M:%S').isoformat())
