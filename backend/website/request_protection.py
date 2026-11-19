"""Protect browser mutations and throttle high-frequency API actions."""
from threading import Lock
from time import monotonic

from flask import jsonify, request


def register_request_protection(app, allowed_origins):
    limits = {
        'auth.login': 20,
        'auth.api_login': 20,
        'auth.sign_up': 8,
        'auth.api_signup': 8,
        'views.respond_to_application': 30,
    }
    lock = Lock()
    counts = {}
    window = -1

    @app.before_request
    def protect_mutations():
        nonlocal window
        if request.method not in ('POST', 'PUT', 'PATCH', 'DELETE'):
            return None
        origin = request.headers.get('Origin')
        if (origin and origin not in allowed_origins and origin != request.host_url.rstrip('/')) or (
            not origin and request.headers.get('Sec-Fetch-Site') == 'cross-site'
        ):
            return jsonify(error='Untrusted request origin'), 403

        limit = limits.get(request.endpoint)
        if limit is None:
            return None
        key = (request.endpoint, request.remote_addr)
        now = monotonic()
        current_window = int(now // 60)
        with lock:
            if window != current_window:
                counts.clear()
                window = current_window
            used = counts.get(key, 0)
            if used >= limit:
                return jsonify(error='Too many requests'), 429, {'Retry-After': str(60 - int(now % 60))}
            counts[key] = used + 1
        return None
