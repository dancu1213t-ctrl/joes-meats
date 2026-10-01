"""Production WSGI application. Run one Gunicorn worker (see render.yaml)."""
import base64
import hmac
import os
import re
import secrets
import time
from pathlib import Path
from flask import Flask, jsonify, request, send_file
import server as cms


def create_app():
    password = os.environ.get('ADMIN_PASSWORD', '')
    if not 12 <= len(password) <= 200:
        raise RuntimeError('Set ADMIN_PASSWORD to a unique password of 12–200 characters.')
    origin = os.environ.get('PUBLIC_ORIGIN', '').rstrip('/')
    if not origin:
        hostname = os.environ.get('RENDER_EXTERNAL_HOSTNAME', '')
        if not hostname:
            raise RuntimeError('Set PUBLIC_ORIGIN or deploy with Render.')
        origin = 'https://' + hostname
    cms.DATA = Path(os.environ.get('DATA_DIR', str(cms.ROOT / 'private'))).resolve()
    (cms.DATA / 'uploads').mkdir(parents=True, exist_ok=True)
    salt = secrets.token_hex(16)
    digest = cms.password_hash(password, salt)
    sessions, attempts = {}, []
    app = Flask(__name__, static_folder=None)
    app.config['MAX_CONTENT_LENGTH'] = 9 * 1024 * 1024

    def authenticated():
        token = request.cookies.get('joes_admin', '')
        return token if sessions.get(token, 0) > time.time() else None

    def error(message, status):
        return jsonify(error=message), status

    @app.after_request
    def headers(response):
        response.headers['Cache-Control'] = 'no-store' if request.path.startswith('/api/') else 'no-cache'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Content-Security-Policy'] = "default-src 'self'; img-src 'self' https: data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
        return response

    @app.get('/api/site')
    def site():
        with cms.LOCK:
            return jsonify(cms.site())

    @app.get('/api/admin/status')
    def status():
        return jsonify(configured=True, authenticated=bool(authenticated()))

    @app.post('/api/admin/<action>')
    def admin(action):
        if request.headers.get('Origin') != origin or request.headers.get('X-Requested-With') != 'JoesAdmin':
            return error('Request origin not allowed.', 403)
        value = request.get_json(silent=True)
        if not isinstance(value, dict):
            return error('Invalid JSON request.', 400)
        with cms.LOCK:
            if action == 'setup':
                return error('Set the admin password in your hosting environment.', 403)
            if action == 'login':
                now = time.time()
                attempts[:] = [t for t in attempts if now - t < 300]
                if len(attempts) >= 8:
                    return error('Too many attempts. Try again in five minutes.', 429)
                candidate = value.get('password', '')
                if not isinstance(candidate, str) or not 12 <= len(candidate) <= 200:
                    attempts.append(now)
                    return error('Incorrect password.', 401)
                if not hmac.compare_digest(cms.password_hash(candidate, salt), digest):
                    attempts.append(now)
                    return error('Incorrect password.', 401)
                attempts.clear()
                for token, expiry in list(sessions.items()):
                    if expiry <= now:
                        sessions.pop(token, None)
                token = secrets.token_urlsafe(32)
                sessions[token] = now + 28800
                response = jsonify(ok=True)
                response.set_cookie('joes_admin', token, max_age=28800, httponly=True, secure=origin.startswith('https://'), samesite='Strict')
                return response
            token = authenticated()
            if not token:
                return error('Please sign in again. Your unsaved edits remain on this page.', 401)
            if action == 'logout':
                sessions.pop(token, None)
                response = jsonify(ok=True)
                response.delete_cookie('joes_admin')
                return response
            try:
                if action == 'site':
                    current = cms.site()
                    if value.get('revision') != current['revision']:
                        return error('Another admin saved changes. Export your draft, then reload before saving.', 409)
                    cleaned = cms.validate(value)
                    cleaned['revision'] = current['revision'] + 1
                    cms.atomic(cms.DATA / 'previous.json', current)
                    cms.atomic(cms.DATA / 'site.json', cleaned)
                    return jsonify(cleaned)
                if action == 'upload':
                    raw = base64.b64decode(value['data'], validate=True)
                    if not 1 <= len(raw) <= 6 * 1024 * 1024:
                        raise ValueError('Image must be under 6 MB.')
                    ext = 'png' if raw.startswith(b'\x89PNG\r\n\x1a\n') else 'jpg' if raw.startswith(b'\xff\xd8\xff') else 'webp' if raw.startswith(b'RIFF') and raw[8:12] == b'WEBP' else None
                    if not ext:
                        raise ValueError('Use a PNG, JPG or WebP image.')
                    name = 'upload-' + secrets.token_hex(12) + '.' + ext
                    (cms.DATA / 'uploads' / name).write_bytes(raw)
                    return jsonify(src='assets/' + name)
            except (ValueError, TypeError, KeyError, AttributeError) as exc:
                return error(str(exc) or 'Invalid request.', 400)
            return error('Not found.', 404)

    @app.errorhandler(413)
    def too_large(exc):
        return error('Request too large. Images must be under 6 MB.', 413)

    @app.get('/')
    @app.get('/<path:path>')
    def files(path='index.html'):
        if path in ('admin', 'admin/'):
            path = 'admin.html'
        allowed = {'index.html', 'admin.html', 'style.css', 'layout.css', 'polish.css', 'cms.css', 'admin.css', 'app.js', 'cart-utils.js', 'polish.js', 'bootstrap.js', 'sliders.js', 'admin.js', 'site-defaults.json'}
        asset = re.fullmatch(r'assets/[A-Za-z0-9_.-]+\.(png|jpe?g|webp|gif|woff2?|ttf)', path, re.I)
        if path not in allowed and not asset:
            return error('Not found.', 404)
        target = cms.ROOT / path
        if asset and (cms.DATA / 'uploads' / Path(path).name).is_file():
            target = cms.DATA / 'uploads' / Path(path).name
        if not target.is_file():
            return error('Not found.', 404)
        return send_file(target)

    return app


app = create_app()
