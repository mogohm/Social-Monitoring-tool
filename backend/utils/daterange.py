"""Shared date-range resolution for analytics endpoints.

Endpoints originally accepted only `days=N`, which forces the UI into fixed
7/14/30/90 buttons. They now also accept explicit `date_from` / `date_to`
(YYYY-MM-DD), so the dashboard can offer a real calendar picker while every
existing `days=N` caller keeps working unchanged.
"""
from datetime import datetime, timedelta, date
from typing import Optional
from fastapi import HTTPException

MAX_RANGE_DAYS = 366


def _parse_day(value: str, field: str) -> date:
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=f"{field} must be formatted YYYY-MM-DD (got {value!r})",
        )


def resolve_range(
    days: int = 7,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> tuple[datetime, datetime]:
    """Return (since, until) as naive UTC datetimes.

    `date_from`/`date_to` win when supplied; otherwise falls back to the last
    `days` days. `date_to` is inclusive of the whole day.
    """
    now = datetime.utcnow()

    if not date_from and not date_to:
        return now - timedelta(days=days), now

    end_day = _parse_day(date_to, "date_to") if date_to else now.date()
    start_day = _parse_day(date_from, "date_from") if date_from else end_day - timedelta(days=days - 1)

    if start_day > end_day:
        raise HTTPException(422, "date_from must not be after date_to")
    if (end_day - start_day).days > MAX_RANGE_DAYS:
        raise HTTPException(422, f"range must not exceed {MAX_RANGE_DAYS} days")

    since = datetime.combine(start_day, datetime.min.time())
    # Inclusive end: cover through 23:59:59.999999 of date_to
    until = datetime.combine(end_day, datetime.max.time())
    return since, until
