"""
In-memory per-IP rate limiter for the compute endpoint.

Deliberately lightweight: a single process, a plain dict, no Redis and no
external dependency. That matches the threat model -- protecting one demo
process from rapid-fire malfunction -- rather than a distributed deployment.

Known limits, stated rather than hidden: state is per-process (it resets on
restart and is not shared across workers), and client_id comes from the socket
peer, so every client behind one NAT shares a bucket. Both are acceptable for
a single-process hackathon demo and would not be for production.
"""

import time
from collections import defaultdict

request_log = defaultdict(list)

# 10 req/sec is deliberately generous. The frontend debounces slider input by
# 120 ms, which mathematically caps a continuous drag at ~8.3 requests/sec, so
# normal intended use can never reach this ceiling. It exists to catch genuine
# malfunction -- a stuck input, a runaway retry loop, a rapid-fire script --
# not to throttle a judge dragging a slider as fast as they like.
RATE_LIMIT_PER_SECOND = 10
WINDOW_SECONDS = 1.0

# The AI suggestion endpoint spends money on every miss, so it gets a much
# tighter budget than the local compute endpoint. It also uses a separate
# bucket key, so the two allowances are independent.
AI_RATE_LIMIT_PER_SECOND = 2


def check_rate_limit(client_id, limit=RATE_LIMIT_PER_SECOND):
    """
    Record a request and report whether it is allowed.

    Returns True if the caller is within budget (and counts the request),
    False if it has already used its full allowance in the current window.

    `limit` defaults to the compute endpoint's allowance, so every existing
    call site behaves exactly as before.
    """
    now = time.time()

    # Drop timestamps that have aged out, so the log cannot grow without bound
    # for a client that keeps making requests.
    recent = [t for t in request_log[client_id] if now - t < WINDOW_SECONDS]
    request_log[client_id] = recent

    if len(recent) >= limit:
        return False

    request_log[client_id].append(now)
    return True
