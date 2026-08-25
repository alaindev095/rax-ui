#!/usr/bin/env python3
"""
SPA-aware static file server for the Umunara frontend.

Plain `python3 -m http.server` 404s on any client-side route
(e.g. /students/home) because that path doesn't exist as a real file.
This server serves real files/assets normally, and falls back to
index.html for any other path so the SPA router can take over.

Usage:
    python3 serve.py [port]      # defaults to 8080
"""
import http.server
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class SPARequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        # Strip query string when checking for a real file on disk.
        path_only = self.path.split("?", 1)[0]
        fs_path = ROOT / path_only.lstrip("/")

        # Serve real files/directories as-is (assets, components, pages, etc).
        if fs_path.exists() and not fs_path.is_dir():
            return super().do_GET()

        # Root always serves index.html normally.
        if path_only == "/" or path_only == "":
            return super().do_GET()

        # Anything else (e.g. /students/home, /teachers/notes) is a
        # client-side route: serve index.html and let router.js handle it.
        self.path = "/index.html"
        return super().do_GET()


if __name__ == "__main__":
    with http.server.ThreadingHTTPServer(("", PORT), SPARequestHandler) as httpd:
        print(f"Serving Umunara frontend (with SPA fallback) at http://localhost:{PORT}")
        httpd.serve_forever()
