import hashlib, hmac, base64, binascii, secrets, zlib

msg = b'attack at dawn'
print(hashlib.md5(msg).hexdigest())
print(hashlib.sha1(msg).hexdigest())
print(hashlib.sha224(msg).hexdigest())
print(hashlib.sha256(msg).hexdigest())
print(hashlib.sha384(msg).hexdigest())
print(hashlib.sha512(msg).hexdigest())
print(hashlib.sha256(b'').hexdigest())
print(hashlib.sha256(b'a' * 1000).hexdigest())

h = hashlib.sha256()
h.update(b'attack ')
h.update(b'at dawn')
print(h.hexdigest(), h.digest_size, h.block_size, h.name)
print(hashlib.new('sha1', b'abc').hexdigest())
print(hashlib.sha256('unicode: cafe'.encode()).hexdigest())
print(hashlib.sha256(msg).digest()[:8])

key = b'supersecretkey'
print(hmac.new(key, msg, hashlib.sha256).hexdigest())
print(hmac.new(key, msg, 'sha1').hexdigest())
print(hmac.new(b'k', b'', hashlib.sha256).hexdigest())
print(hmac.compare_digest('abc', 'abc'), hmac.compare_digest('abc', 'abd'))

print(hashlib.pbkdf2_hmac('sha256', b'password', b'salt', 1000).hex())
print(hashlib.pbkdf2_hmac('sha256', b'password', b'salt', 4096, dklen=16).hex())
print(hashlib.pbkdf2_hmac('sha1', b'password', b'salt', 2).hex())

print(base64.b64encode(msg))
print(base64.b64decode(base64.b64encode(msg)))
print(base64.b64encode(b'\x00\x01\x02\xff'))
print(base64.urlsafe_b64encode(b'\xfb\xff\xfe'))
print(base64.b64decode('SGVsbG8sIFdvcmxkIQ=='))
print(base64.b16encode(b'AB'), base64.b32encode(b'hello'))
print(base64.b32decode(base64.b32encode(b'hello')))

print(binascii.hexlify(b'ABC'), binascii.unhexlify('414243'))
print(binascii.crc32(b'hello world'))
print(zlib.crc32(b'The quick brown fox'), zlib.adler32(b'The quick brown fox'))

t = secrets.token_bytes(16)
print(len(t), len(secrets.token_hex(16)), 0 <= secrets.randbelow(10) < 10)
print(secrets.compare_digest('x', 'x'))
