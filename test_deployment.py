"""Integration checks using temporary storage; does not send orders."""
import base64
import copy
import os
import secrets
import tempfile
from pathlib import Path


def run():
    with tempfile.TemporaryDirectory() as directory:
        password = secrets.token_urlsafe(24)
        os.environ.update(ADMIN_PASSWORD=password, PUBLIC_ORIGIN='https://test.example', DATA_DIR=directory)
        import app
        client = app.app.test_client()
        headers = {'Origin': 'https://test.example', 'X-Requested-With': 'JoesAdmin'}
        def post(action, value, **kwargs):
            return client.post('/api/admin/' + action, json=value, headers=headers, base_url='https://test.example', **kwargs)
        assert client.get('/').status_code == 200
        assert client.get('/admin').status_code == 200
        for path in ('/private/site.json', '/app.py', '/server.py', '/render.yaml', '/assets/../app.py'):
            assert client.get(path).status_code == 404, path
        data = client.get('/api/site').json
        assert post('site', data).status_code == 401
        assert client.post('/api/admin/login', json={'password': password}).status_code == 403
        assert post('setup', {'password': password}).status_code == 403
        assert post('login', {'password': 'wrong-password'}).status_code == 401
        response = post('login', {'password': password})
        assert response.status_code == 200
        cookie = response.headers['Set-Cookie']
        assert all(s in cookie for s in ('HttpOnly', 'Secure', 'SameSite=Strict'))
        changed = copy.deepcopy(data)
        changed['products'][0]['price'] = 12.34
        assert post('site', changed).status_code == 200
        assert post('site', changed).status_code == 409
        bad = client.get('/api/site').json
        bad['products'][0]['price'] = -1
        assert post('site', bad).status_code == 400
        assert post('upload', {'data': base64.b64encode(b'not an image').decode()}).status_code == 400
        png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4N8AAAAASUVORK5CYII=')
        response = post('upload', {'data': base64.b64encode(png).decode()})
        assert response.status_code == 200
        image = response.json['src']
        assert client.get('/' + image).data == png
        current = client.get('/api/site').json
        current['homeSlides'][0]['src'] = image
        assert post('site', current).status_code == 200
        restarted = app.create_app().test_client()
        assert restarted.get('/api/site').json['products'][0]['price'] == 12.34
        assert restarted.get('/api/site').json['homeSlides'][0]['src'] == image
        assert restarted.get('/' + image).data == png
        assert (Path(directory) / 'site.json').exists()
        assert post('logout', {}).status_code == 200
        assert post('site', current).status_code == 401
        print('PASS: static assets, private routes, login, origin checks, cookies, price saves, conflicts, uploads, persistence and logout.')


if __name__ == '__main__':
    run()
