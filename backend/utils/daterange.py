"""Shared date-range resolution for analytics endpoints.

Endpoints originally accepted only `days=N`, which forces the UI into fixed
7/14/30/90 buttons. They now also accept explicit `date_from` / `date_to`
(YYYY-MM-DD), so the dashboard can offer a real calendar picker while every
existing `days=N` caller keeps working.

Timestamps are stored as naive UTC, but a calendar date only means anything in
a timezone. Picking "29 July" in Bangkok (UTC+7) previously filtered
29 July 00:00–23:59 *UTC*, i.e. 29 July 07:00 through 30 July 06:59 local —
so a day's worth of early-morning posts showed up under the wrong date, and
selecting 29 July returned exclusively 30 July posts. Callers therefore pass
`tz_offset`, the client's minutes east of UTC, and the local calendar day is
converted to the matching UTC window here.
"""
from datetime import datetime, timedelta, date
from typing import Optional
from fastapi import HTTPException

MAX_RANGE_DAYS = 366
# Guard against nonsense values; real offsets run -12:00 to +14:00.
MAX_TZ_OFFSET_MIN = 14 * 60


def _parse_day(value: str, field: str) -> date:
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=f"{field} must be formatted YYYY-MM-DD (got {value!r})",
        )


def normalise_offset(tz_offset: Optional[int]) -> int:
    """Clamp/validate the client offset, defaulting to UTC."""
    if tz_offset is None:
        return 0
    if abs(tz_offset) > MAX_TZ_OFFSET_MIN:
        raise HTTPException(422, f"tz_offset out of range: {tz_offset}")
    return int(tz_offset)


def resolve_range(
    days: int = 7,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    tz_offset: Optional[int] = None,
) -> tuple[datetime, datetime]:
    """Return (since, until) as naive UTC datetimes.

    `date_from`/`date_to` win when supplied and are read as calendar dates in
    the client's timezone; otherwise falls back to a rolling `days` window,
    for which the timezone is irrelevant. `date_to` covers its whole local day.
    """
    now = datetime.utcnow()

    if not date_from and not date_to:
        return now - timedelta(days=days), now

    off = normalise_offset(tz_offset)
    local_now = now + timedelta(minutes=off)

    end_day = _parse_day(date_to, "date_to") if date_to else local_now.date()
    start_day = _parse_day(date_from, "date_from") if date_from else end_day - timedelta(days=days - 1)

    if start_day > end_day:
        raise HTTPException(422, "date_from must not be after date_to")
    if (end_day - start_day).days > MAX_RANGE_DAYS:
        raise HTTPException(422, f"range must not exceed {MAX_RANGE_DAYS} days")

    # Local midnight → UTC, and local end-of-day → UTC.
    since = datetime.combine(start_day, datetime.min.time()) - timedelta(minutes=off)
    until = datetime.combine(end_day, datetime.max.time()) - timedelta(minutes=off)
    return since, until
