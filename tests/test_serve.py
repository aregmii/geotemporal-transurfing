"""Exercise real HTTP parsing and static-file responses without opening a network socket."""
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from email.parser import BytesHeaderParser

spec = importlib.util.spec_from_file_location('serve', Path(__file__).resolve().parents[1] / 'scripts/serve.py')
serve = importlib.util.module_from_spec(spec)
spec.loader.exec_module(serve)


class Socket:
    def __init__(self, data):
        self.input = io.BytesIO(data)
        self.output = io.BytesIO()

    def makefile(self, *args):
        return self.input

    def sendall(self, data):
        self.output.write(data)


class QuietHandler(serve.RangeRequestHandler):
    def log_message(self, *args):
        pass


class RangeTests(unittest.TestCase):
    def request(self, method='GET', headers=''):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, 'clip.mp4').write_bytes(b'0123456789')
            connection = Socket(f'{method} /clip.mp4 HTTP/1.1\r\nHost: localhost\r\n{headers}Connection: close\r\n\r\n'.encode())
            QuietHandler(connection, ('127.0.0.1', 1), None, directory=directory)
            head, body = connection.output.getvalue().split(b'\r\n\r\n', 1)
            status, fields = head.split(b'\r\n', 1)
            return int(status.split()[1]), BytesHeaderParser().parsebytes(fields), body

    def test_full_get_and_head(self):
        status, headers, body = self.request()
        self.assertEqual((status, body), (200, b'0123456789'))
        self.assertEqual(headers['Accept-Ranges'], 'bytes')
        status, headers, body = self.request('HEAD')
        self.assertEqual((status, headers['Content-Length'], body), (200, '10', b''))

    def test_initial_open_ended_suffix_and_oversized_ranges(self):
        for value, expected, span in [('0-1', b'01', '0-1'), ('4-', b'456789', '4-9'), ('-3', b'789', '7-9'), ('8-999', b'89', '8-9')]:
            with self.subTest(value=value):
                status, headers, body = self.request(headers=f'Range: bytes={value}\r\n')
                self.assertEqual((status, body), (206, expected))
                self.assertEqual(headers['Content-Range'], f'bytes {span}/10')
                self.assertEqual(int(headers['Content-Length']), len(expected))

    def test_head_range_does_not_send_media_bytes(self):
        status, headers, body = self.request('HEAD', 'Range: bytes=2-4\r\n')
        self.assertEqual((status, headers['Content-Range'], headers['Content-Length'], body), (206, 'bytes 2-4/10', '3', b''))

    def test_unsatisfiable_and_malformed_ranges(self):
        for value in ['10-', '4-2', '-0', '-', '1-2,4-5']:
            status, headers, body = self.request(headers=f'Range: bytes={value}\r\n')
            self.assertEqual((status, headers['Content-Range'], body), (416, 'bytes */10', b''))

    def test_unvalidated_conditional_range_returns_complete_file(self):
        status, headers, body = self.request(headers='Range: bytes=0-1\r\nIf-Range: "different-file"\r\n')
        self.assertEqual((status, body), (200, b'0123456789'))


if __name__ == '__main__':
    unittest.main()
