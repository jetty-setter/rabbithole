"""Bounded HTTPS text extraction. No browser execution, credentials or private IPs."""

import hashlib
import http.client
import ipaddress
import re
import socket
import ssl
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

MAX_BYTES = 1_000_000
MAX_TEXT = 24_000


class UnsupportedSource(ValueError):
    pass


class UnavailableSource(ValueError):
    pass


class RetryableSource(Exception):
    pass


def public_target(url):
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username
            or parsed.password or parsed.port not in (None, 443)):
        raise UnsupportedSource("Only public HTTPS sources on port 443 are supported.")
    addresses = socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
        raise UnsupportedSource("Source does not resolve exclusively to public addresses.")
    return parsed, addresses[0][4][0]


def download(url):
    """Pin the validated address while retaining hostname TLS verification and SNI.

    Every redirect is validated again. Proxy environment variables are never used.
    Accept-Encoding identity and a byte cap prevent compressed response expansion.
    """
    for _ in range(4):
        parsed, address = public_target(url)
        connection = http.client.HTTPSConnection(
            parsed.hostname, timeout=8, context=ssl.create_default_context()
        )
        connection._create_connection = lambda *args, **kwargs: socket.create_connection(
            (address, 443), timeout=8
        )
        try:
            path = parsed.path or "/"
            if parsed.query:
                path += "?" + parsed.query
            connection.request("GET", path, headers={
                "User-Agent": "RabbitHole-Evidence/1.0",
                "Accept": "text/html, text/plain",
                "Accept-Encoding": "identity",
            })
            response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                location = response.getheader("Location")
                if not location:
                    raise UnavailableSource("Source returned an empty redirect.")
                url = urljoin(url, location)
                continue
            if response.status == 429 or response.status >= 500:
                raise RetryableSource(f"Source returned HTTP {response.status}.")
            if response.status != 200:
                raise UnavailableSource(f"Source returned HTTP {response.status}.")
            content_type = response.getheader("Content-Type", "").split(";")[0].lower().strip()
            if content_type not in ("text/html", "text/plain", "application/xhtml+xml"):
                raise UnsupportedSource("This source format is not supported yet (HTML and text only).")
            if response.getheader("Content-Encoding", "identity").lower() != "identity":
                raise UnsupportedSource("Source requires an unsupported content encoding.")
            raw = response.read(MAX_BYTES + 1)
            if len(raw) > MAX_BYTES:
                raise UnsupportedSource("Source exceeds the 1 MB processing limit.")
            encoding = response.headers.get_content_charset() or "utf-8"
            try:
                text = raw.decode(encoding, errors="replace")
            except LookupError:
                text = raw.decode("utf-8", errors="replace")
            return text, content_type, url
        finally:
            connection.close()
    raise UnavailableSource("Source redirected too many times.")


class ArticleText(HTMLParser):
    HIDDEN = {"script", "style", "nav", "header", "footer", "noscript", "svg", "template"}
    BLOCKS = {"p", "div", "section", "article", "li", "br", "h1", "h2", "h3", "tr"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hidden = []
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in self.HIDDEN:
            self.hidden.append(tag)
        if not self.hidden and tag in self.BLOCKS:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if self.hidden and tag == self.hidden[-1]:
            self.hidden.pop()
        if not self.hidden and tag in self.BLOCKS:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def extract(text, content_type):
    if content_type != "text/plain":
        parser = ArticleText()
        parser.feed(text)
        text = "".join(parser.parts)
    normalized = "\n".join(
        line for line in (re.sub(r"\s+", " ", p).strip() for p in text.splitlines()) if line
    )
    digest = hashlib.sha256(normalized.encode()).hexdigest()
    bounded = normalized[:MAX_TEXT]
    # Preserve paragraph boundaries where possible, then split long paragraphs at words.
    passages = []
    for paragraph in bounded.splitlines():
        while paragraph:
            end = min(600, len(paragraph))
            if end < len(paragraph):
                end = paragraph.rfind(" ", 0, end) or end
                if end < 1:
                    end = 600
            passages.append(paragraph[:end])
            paragraph = paragraph[end:].strip()
    return passages, digest, len(normalized) > MAX_TEXT
