"""Joe's Meats local CMS. Run: python server.py --port 8765"""
import argparse, base64, hashlib, hmac, json, math, mimetypes, os, re, secrets, threading, time
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
LOCK = threading.RLock()
SESSIONS, ATTEMPTS = {}, {}
DATA = ROOT / 'private'

def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))

def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    os.replace(temp, path)

def site():
    return read_json(DATA / 'site.json') if (DATA / 'site.json').exists() else read_json(ROOT / 'site-defaults.json')

def text(value, limit=1000):
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValueError('Please fill every required field and keep text within its length limit.')
    return value.strip()

def link(value, image=False):
    value = text(value, 2000)
    if image and re.fullmatch(r'assets/[A-Za-z0-9_.-]+\.(png|jpg|jpeg|webp|gif)', value, re.I):
        if not (ROOT / value).is_file() and not (DATA / 'uploads' / Path(value).name).is_file():
            raise ValueError('Image file is missing.')
        return value
    parts = urlsplit(value)
    if parts.scheme != 'https' or not parts.hostname or parts.username or parts.password:
        raise ValueError('Use an HTTPS link, or a local uploaded image.')
    return value

def slides(value):
    if not isinstance(value, list) or not 1 <= len(value) <= 12:
        raise ValueError('Each slider needs between 1 and 12 images.')
    return [dict(src=link(v['src'], True), alt=text(v['alt'], 200)) for v in value]

def validate(value):
    default = read_json(ROOT / 'site-defaults.json')
    names = [c['name'] for c in default['categories']]
    if [c['name'] for c in value['categories']] != names:
        raise ValueError('Keep the existing category names and order.')
    cats = [dict(name=c['name'], title=text(c['title'], 150), slides=slides(c['slides'])) for c in value['categories']]
    if not isinstance(value['products'], list) or len(value['products']) > 500:
        raise ValueError('Up to 500 products are supported.')
    products, ids = [], set()
    for p in value['products']:
        identifier = text(p['id'], 100)
        if not re.fullmatch(r'[a-z0-9-]+', identifier) or identifier in ids:
            raise ValueError('Product IDs must be unique.')
        ids.add(identifier)
        price = p['price']
        if isinstance(price, bool) or not isinstance(price, (float, int)) or not math.isfinite(price) or not 0 < price <= 10000 or abs(price * 100 - round(price * 100)) > .0001:
            raise ValueError('Prices must be from 0.01 to 10,000 BZD, with at most two decimals.')
        if p['category'] not in names:
            raise ValueError('Choose an existing category.')
        products.append(dict(id=identifier, name=text(p['name'], 100), price=price, category=p['category']))
    copy = {}
    for key in default['copy']:
        v = value['copy'][key]
        copy[key] = link(v, True) if key in ('storyImage', 'logo') else link(v) if key in ('facebook', 'instagram', 'privacy') else text(v, 3000)
    if len(value['stores']) != 2:
        raise ValueError('Both stores are required.')
    stores = []
    for branch, original in zip(value['stores'], default['stores']):
        if branch['id'] != original['id']:
            raise ValueError('Store IDs cannot change.')
        b = {key: text(branch[key], 500) for key in ('id', 'name', 'address', 'phone', 'whatsapp', 'email')}
        if not all(re.fullmatch(r'[0-9]{8,15}', b[key]) for key in ('phone', 'whatsapp')):
            raise ValueError('Phone and WhatsApp numbers need country code and digits only.')
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', b['email']):
            raise ValueError('Enter a valid store email.')
        b.update(directions=link(branch['directions']), image=link(branch['image'], True))
        stores.append(b)
    if stores[0]['whatsapp'] == stores[1]['whatsapp']:
        raise ValueError('Use a different WhatsApp number for each store.')
    return dict(products=products, categories=cats, homeSlides=slides(value['homeSlides']), copy=copy, stores=stores)

def password_hash(password, salt):
    return hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def reply(self, status, value, cookie=None):
        payload = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def session(self):
        try:
            cookie = SimpleCookie(self.headers.get('Cookie', ''))
            token = cookie['joes_admin'].value
            expires = SESSIONS.get(token, 0)
            if expires > time.time():
                return token
            SESSIONS.pop(token, None)
        except (KeyError, ValueError):
            pass
        return None

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/api/site':
            with LOCK:
                return self.reply(200, site())
        if path == '/api/admin/status':
            return self.reply(200, dict(configured=(DATA / 'auth.json').exists(), authenticated=bool(self.session())))
        if path.startswith('/api/'):
            return self.reply(404, {'error': 'Not found'})
        path = '/admin.html' if path in ('/admin', '/admin/') else '/index.html' if path == '/' else path
        allowed = {'index.html', 'admin.html', 'style.css', 'layout.css', 'polish.css', 'cms.css', 'admin.css', 'app.js', 'cart-utils.js', 'polish.js', 'bootstrap.js', 'sliders.js', 'admin.js', 'site-defaults.json'}
        relative = path.lstrip('/')
        if relative not in allowed and not re.fullmatch(r'assets/[A-Za-z0-9_.-]+\.(png|jpe?g|webp|gif|woff2?|ttf)', relative, re.I):
            return self.reply(404, {'error': 'Not found'})
        target = ROOT / relative
        if not target.is_file():
            return self.reply(404, {'error': 'Not found'})
        payload = target.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', mimetypes.guess_type(str(target))[0] or 'application/octet-stream')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        self.send_header('Content-Security-Policy', "default-src 'self'; img-src 'self' https: data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'")
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        port = self.server.server_port
        origins = {f'http://127.0.0.1:{port}', f'http://localhost:{port}'}
        if self.headers.get('Origin') not in origins or self.headers.get('X-Requested-With') != 'JoesAdmin':
            return self.reply(403, {'error': 'Request origin not allowed.'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 9 * 1024 * 1024:
                return self.reply(413, {'error': 'Request too large.'})
            value = json.loads(self.rfile.read(size))
            path = urlsplit(self.path).path
            with LOCK:
                if path in ('/api/admin/setup', '/api/admin/login'):
                    return self.login(value, path.endswith('/setup'))
                token = self.session()
                if not token:
                    return self.reply(401, {'error': 'Please sign in again. Your unsaved edits remain on this page.'})
                if path == '/api/admin/logout':
                    SESSIONS.pop(token, None)
                    return self.reply(200, {'ok': True}, 'joes_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0')
                if path == '/api/admin/site':
                    current = site()
                    if value.get('revision') != current['revision']:
                        return self.reply(409, {'error': 'Another admin saved changes. Export your draft, then reload before saving.'})
                    cleaned = validate(value)
                    cleaned['revision'] = current['revision'] + 1
                    atomic(DATA / 'previous.json', current)
                    atomic(DATA / 'site.json', cleaned)
                    return self.reply(200, cleaned)
                if path == '/api/admin/upload':
                    raw = base64.b64decode(value['data'], validate=True)
                    if not 1 <= len(raw) <= 6 * 1024 * 1024:
                        raise ValueError('Image must be under 6 MB.')
                    ext = 'png' if raw.startswith(b'\x89PNG\r\n\x1a\n') else 'jpg' if raw.startswith(b'\xff\xd8\xff') else 'webp' if raw.startswith(b'RIFF') and raw[8:12] == b'WEBP' else None
                    if not ext:
                        raise ValueError('Use a PNG, JPG or WebP image.')
                    name = 'upload-' + secrets.token_hex(12) + '.' + ext
                    (ROOT / 'assets' / name).write_bytes(raw)
                    return self.reply(200, {'src': 'assets/' + name})
                return self.reply(404, {'error': 'Not found'})
        except (ValueError, TypeError, KeyError, AttributeError) as error:
            return self.reply(400, {'error': str(error) or 'Invalid request.'})

    def login(self, value, setup):
        password = value.get('password', '')
        auth_file = DATA / 'auth.json'
        if not isinstance(password, str) or not 12 <= len(password) <= 200:
            return self.reply(400, {'error': 'Use a password with 12–200 characters.'})
        if setup:
            if auth_file.exists():
                return self.reply(409, {'error': 'Admin is already configured. Sign in instead.'})
            salt = secrets.token_hex(16)
            atomic(auth_file, dict(salt=salt, hash=password_hash(password, salt)))
        else:
            now = time.time()
            ip = self.client_address[0]
            attempts = [t for t in ATTEMPTS.get(ip, []) if now - t < 300]
            ATTEMPTS[ip] = attempts
            if len(attempts) >= 8:
                return self.reply(429, {'error': 'Too many attempts. Try again in five minutes.'})
            if not auth_file.exists():
                return self.reply(409, {'error': 'Set up the admin password first.'})
            auth = read_json(auth_file)
            if not hmac.compare_digest(auth['hash'], password_hash(password, auth['salt'])):
                attempts.append(now)
                return self.reply(401, {'error': 'Incorrect password.'})
            ATTEMPTS.pop(ip, None)
        token = secrets.token_urlsafe(32)
        SESSIONS[token] = time.time() + 8 * 3600
        return self.reply(200, {'ok': True}, f'joes_admin={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--data-dir', type=Path, default=DATA)
    args = parser.parse_args()
    DATA = args.data_dir.resolve()
    print(f"Joe's Meats: http://127.0.0.1:{args.port} | Admin: /admin", flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
