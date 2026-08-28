#!/usr/bin/env python3
"""Static server for benchmark clips with CORS+CORP headers (required by the app's COEP)."""
import http.server

class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cross-Origin-Resource-Policy", "cross-origin")
        # Chrome Private Network Access: public https page fetching localhost
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

http.server.ThreadingHTTPServer(("127.0.0.1", 8123), H).serve_forever()
