import os
import ssl
import smtplib
import asyncio
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")

CATEGORY_LABELS = {
    "brand":              "เกี่ยวกับแบรนด์",
    "deposit_withdrawal": "ฝาก/ถอนเงิน",
    "promotion":          "โปรโมชั่น/โบนัส",
    "system":             "ระบบ/แอป",
    "game":               "เกม/ไพ่",
    "scam":               "โกง/ปัญหา",
    "general":            "ทั่วไป",
}

_CAT_COLORS = {
    "scam":               ("#fee2e2", "#dc2626"),
    "deposit_withdrawal": ("#fef3c7", "#d97706"),
    "brand":              ("#dbeafe", "#1d4ed8"),
    "promotion":          ("#d1fae5", "#059669"),
    "system":             ("#f3e8ff", "#7c3aed"),
    "game":               ("#fce7f3", "#be185d"),
    "general":            ("#f3f4f6", "#374151"),
}

_PRI_COLORS = {
    "critical": "#dc2626",
    "high":     "#ea580c",
    "medium":   "#d97706",
    "low":      "#059669",
}


def _build_html(mention, alert_name: str, matched_keywords: list) -> str:
    category  = mention.topic or "general"
    cat_label = CATEGORY_LABELS.get(category, category)
    cat_bg, cat_text = _CAT_COLORS.get(category, ("#f3f4f6", "#374151"))
    risk_color = _PRI_COLORS.get(mention.priority or "low", "#059669")

    image_block = ""
    if mention.image_url:
        image_block = f"""
        <div style="margin:16px 0;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
          <img src="{mention.image_url}" alt="post"
               style="width:100%;max-height:320px;object-fit:cover;display:block">
        </div>"""

    url_block = ""
    if mention.url:
        url_block = f"""
        <div style="margin-top:20px">
          <a href="{mention.url}"
             style="display:inline-block;background:#1a56db;color:white;font-weight:700;
                    padding:10px 22px;border-radius:8px;text-decoration:none;font-size:14px">
            🔗 ดูโพสต์ต้นฉบับ
          </a>
        </div>"""

    kw_block = ""
    if matched_keywords:
        badges = "".join(
            f'<span style="display:inline-block;background:#fee2e2;color:#dc2626;'
            f'padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;margin:2px">'
            f'⚠ {kw}</span>'
            for kw in matched_keywords
        )
        kw_block = f"""
        <div style="margin-top:14px">
          <p style="color:#6b7280;font-size:12px;margin:0 0 6px;font-weight:600">
            Keywords ที่ตรวจพบ
          </p>
          <div>{badges}</div>
        </div>"""

    content = mention.content or ""
    preview = content[:300] + "…" if len(content) > 300 else content
    preview_html = preview.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    pub_str = ""
    if mention.published_at:
        pub_str = f' · <span style="color:#9ca3af">{mention.published_at.strftime("%d/%m/%Y %H:%M")}</span>'

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:20px;background:#f9fafb;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);
                padding:24px;border-radius:12px 12px 0 0">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="font-size:28px">⚠️</div>
        <div>
          <h1 style="color:white;margin:0;font-size:20px;font-weight:800">SocialEye Alert</h1>
          <p style="color:#93c5fd;margin:3px 0 0;font-size:13px;font-weight:600">{alert_name}</p>
        </div>
      </div>
    </div>
    <!-- Body -->
    <div style="background:white;padding:24px;
                border:1px solid #e5e7eb;border-radius:0 0 12px 12px">
      <!-- Badges -->
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
        <span style="background:{cat_bg};color:{cat_text};padding:4px 12px;
                     border-radius:20px;font-size:12px;font-weight:700">
          📂 {cat_label}
        </span>
        <span style="background:{risk_color}22;color:{risk_color};padding:4px 12px;
                     border-radius:20px;font-size:12px;font-weight:700">
          🎯 Risk {int(mention.risk_score or 0)}/100 · {(mention.priority or "low").upper()}
        </span>
      </div>
      <!-- Author -->
      <p style="color:#374151;font-size:13px;margin:0 0 10px">
        <strong>👤 {mention.author or "Unknown"}</strong>{pub_str}
      </p>
      <!-- Content -->
      <div style="background:#f9fafb;border:1px solid #e5e7eb;
                  border-radius:8px;padding:14px;margin:0 0 4px">
        <p style="color:#374151;font-size:14px;line-height:1.7;margin:0;
                  white-space:pre-wrap">{preview_html}</p>
      </div>
      {image_block}
      {kw_block}
      {url_block}
      <!-- Footer -->
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:22px 0 16px">
      <p style="color:#9ca3af;font-size:11px;margin:0;text-align:center">
        SocialEye Monitor · แจ้งเตือนอัตโนมัติ ·
        <a href="https://social-monitoring-tool.vercel.app/mentions"
           style="color:#3b82f6;text-decoration:none">ดู Dashboard</a>
      </p>
    </div>
  </div>
</body>
</html>"""


def _send_batch_sync(messages: list) -> list:
    """Send every message over a single SMTP connection.

    messages: list of (recipients, subject, html)
    Returns a list of (ok: bool, error: str) — one entry per message.
    """
    if not SMTP_USER or not SMTP_PASS:
        print("[email] SMTP_USER/SMTP_PASS not set — skip")
        return [(False, "SMTP not configured")] * len(messages)

    results = []
    ctx = ssl.create_default_context()
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as srv:
            srv.ehlo()
            srv.starttls(context=ctx)
            srv.login(SMTP_USER, SMTP_PASS)
            for recipients, subject, html in messages:
                try:
                    msg = MIMEMultipart("alternative")
                    msg["Subject"] = subject
                    msg["From"]    = f"SocialEye Monitor <{SMTP_USER}>"
                    msg["To"]      = ", ".join(recipients)
                    msg.attach(MIMEText(html, "html", "utf-8"))
                    srv.sendmail(SMTP_USER, recipients, msg.as_string())
                    print(f"[email] ✓ sent to {recipients}")
                    results.append((True, ""))
                except Exception as exc:
                    print(f"[email] ✗ send to {recipients}: {exc}")
                    results.append((False, str(exc)))
    except Exception as exc:
        print(f"[email] ✗ SMTP connection failed: {exc}")
        return [(False, f"SMTP connection failed: {exc}")] * len(messages)
    return results


async def send_alert_emails(items: list) -> list:
    """Send many alert emails over one SMTP connection.

    items: list of dicts with keys mention, alert_name, recipients, matched_keywords
    Returns a list of (ok, error) matching the input order.
    """
    if not items:
        return []
    messages = [
        (
            it["recipients"],
            f"⚠️ [SocialEye] {it['alert_name']} — {it['mention'].author or 'Unknown'}",
            _build_html(it["mention"], it["alert_name"], it["matched_keywords"]),
        )
        for it in items
    ]
    loop = asyncio.get_event_loop()
    try:
        return await loop.run_in_executor(None, lambda: _send_batch_sync(messages))
    except Exception as exc:
        print(f"[email] ✗ {exc}")
        return [(False, str(exc))] * len(items)


async def send_alert_email(
    mention,
    alert_name: str,
    recipients: list,
    matched_keywords: list,
) -> bool:
    """Send a single alert email. Returns True on success."""
    if not recipients:
        return False
    results = await send_alert_emails([{
        "mention": mention,
        "alert_name": alert_name,
        "recipients": recipients,
        "matched_keywords": matched_keywords,
    }])
    return bool(results and results[0][0])
