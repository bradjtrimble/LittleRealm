#!/usr/bin/env python3
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse, os, threading, webbrowser

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description="Run Little Realm World Builder locally")
parser.add_argument("--port", type=int, default=8000)
args = parser.parse_args()
os.chdir(ROOT)
url = f"http://127.0.0.1:{args.port}/builder/"
server = ThreadingHTTPServer(("127.0.0.1", args.port), SimpleHTTPRequestHandler)
print(f"Little Realm World Builder: {url}")
print("Keep this window open while editing. Press Ctrl+C to stop.")
threading.Timer(0.6, lambda: webbrowser.open(url)).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    print("\nWorld Builder stopped.")
finally:
    server.server_close()
