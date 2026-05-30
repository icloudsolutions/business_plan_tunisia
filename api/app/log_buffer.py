"""In-memory ring buffer for recent API log lines (admin diagnostics)."""

from collections import deque
from datetime import datetime, timezone
import logging

_MAX = 200
_buffer: deque[str] = deque(maxlen=_MAX)


class RingBufferHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            ts = datetime.fromtimestamp(record.created, tz=timezone.utc).strftime(
                "%Y-%m-%d %H:%M:%S"
            )
            msg = self.format(record)
            line = f"{ts} [{record.levelname}] {record.name}: {msg}"
            _buffer.append(line)
        except Exception:
            pass


def install_log_buffer() -> None:
    root = logging.getLogger()
    if any(isinstance(h, RingBufferHandler) for h in root.handlers):
        return
    handler = RingBufferHandler()
    handler.setLevel(logging.WARNING)
    handler.setFormatter(logging.Formatter("%(message)s"))
    root.addHandler(handler)
    logging.getLogger("bp.api").addHandler(handler)


def recent_logs(limit: int = 20) -> list[str]:
    lines = list(_buffer)
    return lines[-limit:] if len(lines) > limit else lines
