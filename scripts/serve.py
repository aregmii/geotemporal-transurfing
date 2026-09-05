#!/usr/bin/env python3
"""Serve the static site locally, including byte ranges needed for video seeking."""
import argparse
import functools
import os
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class RangeRequestHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        self.byte_range = None
        path = self.translate_path(self.path)
        requested = self.headers.get('Range')
        # Conditional ranges without a validated entity tag fall back to a complete response.
        if not requested or self.headers.get('If-Range') or not os.path.isfile(path):
            return super().send_head()
        match = re.fullmatch(r'bytes=(\d*)-(\d*)', requested.strip())
        try:
            file = open(path, 'rb')
        except OSError:
            self.send_error(404, 'File not found')
            return None
        stat = os.fstat(file.fileno())
        size = stat.st_size
        start, end = 0, size - 1
        valid = bool(match and any(match.groups()) and size)
        if valid:
            first, last = match.groups()
            if first:
                start = int(first)
                if last:
                    end = min(int(last), end)
            else:
                length = int(last)
                valid = length > 0
                start = max(0, size - length)
            valid = valid and start < size and end >= start
        if not valid:
            file.close()
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None
        self.byte_range = (start, end)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.send_header('Last-Modified', self.date_time_string(stat.st_mtime))
        self.end_headers()
        file.seek(start)
        return file

    def end_headers(self):
        self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()

    def copyfile(self, source, outputfile):
        if self.byte_range is None:
            return super().copyfile(source, outputfile)
        remaining = self.byte_range[1] - self.byte_range[0] + 1
        while remaining:
            chunk = source.read(min(64 * 1024, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('port', nargs='?', type=int, default=8000)
    parser.add_argument('--directory', default='site')
    parser.add_argument('--bind', default='127.0.0.1')
    args = parser.parse_args()
    handler = functools.partial(RangeRequestHandler, directory=args.directory)
    with ThreadingHTTPServer((args.bind, args.port), handler) as server:
        print(f'Serving {args.directory} at http://{args.bind}:{args.port}', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
