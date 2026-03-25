from http.server import BaseHTTPRequestHandler
import urllib.request
import json

VKEY = '1e69a4737bab484ead1a958578c0df91'

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        qs = self.path.split('?', 1)[1] if '?' in self.path else ''
        url = f'https://apis.vinmonopolet.no/products/v0/details-normal?{qs}'
        req = urllib.request.Request(url, headers={
            'Ocp-Apim-Subscription-Key': VKEY,
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json',
        })
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                data = r.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', errors='replace')
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': f'HTTP {e.code}: {body[:300]}'}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def log_message(self, fmt, *args): pass
