"""Serialise datetimes so clients can't misread them as local time.

Every datetime in this project is stored as naive UTC (models default to
`datetime.utcnow()`). Calling `.isoformat()` on those produces
"2026-07-31T11:52:21.559497" with no timezone designator, and per the
ECMAScript spec a date-time string without an offset is interpreted as
*local* time. In Bangkok (UTC+7) that made every timestamp in the UI read
exactly 7 hours stale — the Live Monitor showed "7 ชั่วโมงที่แล้ว" for a
scrape that had run 11 minutes earlier.

Appending the "Z" designator makes the value unambiguous, and browsers then
render it in the viewer's own timezone correctly.
"""
from datetime import datetime, timezone
from typing import Optional


def utc_iso(dt: Optional[datetime]) -> Optional[str]:
    """Return an ISO-8601 string that explicitly marks UTC, or None."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    # isoformat() renders +00:00; normalise to the shorter, equivalent "Z"
    return dt.isoformat().replace("+00:00", "Z")
