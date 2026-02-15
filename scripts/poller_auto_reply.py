#!/usr/bin/env python3
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from agentmail import AgentMail

SYSTEM_SENDER_PATTERNS = [
    'no-reply@',
    'noreply@',
    'do-not-reply@',
    'donotreply@',
    'notifications@',
    'mailer-daemon@',
    'postmaster@',
    '@vercel.com',
    '@railway.com',
    '@railwayapp.com',
    '@apify.com',
    '@youtube.com',
]

SYSTEM_SUBJECT_PATTERNS = [
    'failed deployment',
    'new sign-in detected',
    'verification',
    'reset your password',
    'security alert',
    'invoice',
    'receipt',
    'newsletter',
]

SYSTEM_PREVIEW_PATTERNS = [
    'unsubscribe',
    'view in browser',
    'manage preferences',
    'automated message',
    'do not reply',
]

STATE_PATH = Path('data/agentmail_reply_state.json')
DB_PATH = Path('leads/leads.db')
INBOX_ID = 'minnie@agentmail.to'
MAX_MESSAGES = 150
STATE_KEEP_MESSAGE_IDS = 1500
MAX_REPLY_AGE_SECONDS = 72 * 3600

REPLY_TEMPLATES = {
    'budget_cap': (
        'Re: Model usage + ongoing cost breakdown',
        """Hey {name},\n\nAbsolutely. I meter usage in real time and enforce whatever ceiling you set. Once we approach ${cap}/mo, I flag you and automatically shift non-critical work to cheaper models while mission-critical tasks still get the premium model.\n\nYou’ll also get a weekly usage snapshot. Ready for the kickoff checklist?\n\n– Minnie""",
    ),
}

MACRO_KEYWORDS = {
    'budget_cap': ['don\'t want to spend more', 'spend more than', 'cap at $', 'cap at £', 'cap at €', 'budget cap'],
}

FALLBACK_REPLY = (
    "Hey {name},\n\n"
    "Thanks for your email — got it. I’ve logged your question and I’m preparing a direct answer.\n\n"
    "To move faster, feel free to include:\n"
    "• target budget\n"
    "• timeline\n"
    "• your top priority (cost, speed, or quality)\n\n"
    "You’ll get a specific follow-up from me shortly.\n\n"
    "– Minnie"
)

def load_state():
    candidates = [
        STATE_PATH,
        Path('data/agentmail_state.json'),  # legacy path
    ]

    for path in candidates:
        if not path.exists():
            continue
        try:
            state = json.loads(path.read_text())
            return {
                'last_ts': float(state.get('last_ts', 0)),
                'processed_message_ids': list(state.get('processed_message_ids', [])),
            }
        except Exception:
            continue

    return {'last_ts': 0.0, 'processed_message_ids': []}


def save_state(last_ts, processed_message_ids):
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(
        json.dumps(
            {
                'last_ts': last_ts,
                'processed_message_ids': processed_message_ids[-STATE_KEEP_MESSAGE_IDS:],
            }
        )
    )


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        '''CREATE TABLE IF NOT EXISTS leads (
            email TEXT PRIMARY KEY,
            name TEXT,
            company TEXT,
            stage TEXT,
            last_contact_ts REAL,
            next_action TEXT,
            notes TEXT
        )'''
    )
    cur.execute(
        '''CREATE TABLE IF NOT EXISTS lead_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_email TEXT,
            ts REAL,
            direction TEXT,
            subject TEXT,
            preview TEXT
        )'''
    )
    conn.commit()
    conn.close()


def upsert_lead(email, name, company, stage, ts, notes=''):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        '''INSERT INTO leads (email, name, company, stage, last_contact_ts, next_action, notes)
           VALUES (?, ?, ?, ?, ?, '', ?)
           ON CONFLICT(email) DO UPDATE SET
             name=excluded.name,
             company=COALESCE(excluded.company, leads.company),
             stage=excluded.stage,
             last_contact_ts=excluded.last_contact_ts,
             notes=COALESCE(leads.notes, excluded.notes)
        ''',
        (email, name, company, stage, ts, notes),
    )
    conn.commit()
    conn.close()


def log_event(email, direction, subject, preview, ts):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        'INSERT INTO lead_events (lead_email, ts, direction, subject, preview) VALUES (?, ?, ?, ?, ?)',
        (email, ts, direction, subject, preview[:200]),
    )
    conn.commit()
    conn.close()


def detect_macro(text):
    lower = text.lower()
    for macro, keywords in MACRO_KEYWORDS.items():
        if any(phrase in lower for phrase in keywords):
            return macro
    return None


def normalize_reply_subject(subject):
    if not subject:
        return 'Re: Follow-up from Minnie'
    return subject if subject.lower().startswith('re:') else f'Re: {subject}'


def is_inbound_message(labels):
    normalized = {str(l).strip().lower() for l in (labels or [])}
    if 'sent' in normalized:
        return False
    return bool({'received', 'inbox', 'unread'} & normalized)


def is_system_sender(sender_email):
    email = (sender_email or '').lower()
    return any(pattern in email for pattern in SYSTEM_SENDER_PATTERNS)


def is_system_message(subject, preview):
    s = (subject or '').lower()
    p = (preview or '').lower()
    if any(pattern in s for pattern in SYSTEM_SUBJECT_PATTERNS):
        return True
    if any(pattern in p for pattern in SYSTEM_PREVIEW_PATTERNS):
        return True
    return False


def send_reply(client, email, name, macro, context=None, subject_hint=None, reply_to_message_id=None):
    if macro:
        subject, template = REPLY_TEMPLATES[macro]
        cap = context.get('cap', '100') if context else '100'
        body = template.format(name=name or 'there', cap=cap)
    else:
        subject = normalize_reply_subject(subject_hint)
        body = FALLBACK_REPLY.format(name=name or 'there')

    headers = None
    if reply_to_message_id:
        headers = {
            'In-Reply-To': reply_to_message_id,
            'References': reply_to_message_id,
        }

    client.inboxes.messages.send(
        inbox_id=INBOX_ID,
        to=email,
        subject=subject,
        text=body,
        headers=headers,
    )
    ts = datetime.now(timezone.utc).timestamp()
    log_event(email, 'outbound', subject, body[:200], ts)
    return ts


def main():
    init_db()
    api_key = os.environ.get('AGENTMAIL_API_KEY')
    if not api_key:
        raise SystemExit('AGENTMAIL_API_KEY missing')

    client = AgentMail(api_key=api_key)
    resp = client.inboxes.messages.list(inbox_id=INBOX_ID, limit=MAX_MESSAGES)
    messages = resp.messages or []

    state = load_state()
    last_ts = state['last_ts']
    processed_message_ids = set(state['processed_message_ids'])
    max_inbound_ts = last_ts
    out_summaries = []
    red_alerts = []

    now_ts = datetime.now(timezone.utc).timestamp()

    for msg in sorted(messages, key=lambda m: m.created_at or '', reverse=False):
        created = msg.created_at
        if isinstance(created, datetime):
            ts = created.timestamp()
        else:
            ts = datetime.fromisoformat(created.replace('Z', '+00:00')).timestamp()

        message_id = msg.message_id or ''
        labels = msg.labels or []

        if message_id and message_id in processed_message_ids:
            continue
        if ts <= last_ts and not message_id:
            continue
        if (now_ts - ts) > MAX_REPLY_AGE_SECONDS:
            if message_id:
                processed_message_ids.add(message_id)
            if ts > max_inbound_ts:
                max_inbound_ts = ts
            continue

        # only process true inbound mailbox messages, not Sent items
        if not is_inbound_message(labels):
            continue

        sender_email = 'unknown'
        sender_name = 'unknown'
        if msg.from_:
            if isinstance(msg.from_, str):
                sender_email = msg.from_.split('<')[-1].rstrip('> ').strip().lower()
                sender_name = msg.from_.split('<')[0].strip() or sender_email.split('@')[0]
            else:
                first = msg.from_[0]
                sender_email = getattr(first, 'email', 'unknown').strip().lower()
                sender_name = getattr(first, 'name', sender_email.split('@')[0])

        if sender_email == INBOX_ID or sender_email == 'unknown':
            continue

        preview = msg.preview or ''
        subject = msg.subject or '(no subject)'

        if is_system_sender(sender_email) or is_system_message(subject, preview):
            if message_id:
                processed_message_ids.add(message_id)
            if ts > max_inbound_ts:
                max_inbound_ts = ts
            continue

        upsert_lead(sender_email, sender_name, None, 'active', ts)
        log_event(sender_email, 'inbound', subject, preview, ts)

        macro = detect_macro(preview)
        cap_val = None
        if macro:
            for part in preview.split():
                if part.strip().replace('$', '').replace('€', '').isdigit():
                    cap_val = part.strip().strip('$€')
                    break

        try:
            send_reply(
                client,
                sender_email,
                sender_name,
                macro,
                {'cap': cap_val} if macro else None,
                subject_hint=subject,
                reply_to_message_id=message_id if message_id else None,
            )

            if macro:
                out_summaries.append(f"Auto-replied to {sender_name}: {macro}")
            else:
                out_summaries.append(f"Auto-replied to {sender_name}: fallback_follow_up")

            if message_id:
                processed_message_ids.add(message_id)
            if ts > max_inbound_ts:
                max_inbound_ts = ts
        except Exception as err:
            red_alerts.append(
                f"RED ALERT: failed to auto-reply to {sender_name} <{sender_email}> on '{subject}' ({err})"
            )
            if ts > max_inbound_ts:
                max_inbound_ts = ts

    save_state(max_inbound_ts, list(processed_message_ids))

    if out_summaries:
        print('\n'.join(out_summaries))
    else:
        print('No new messages.')

    if red_alerts:
        print('\n'.join(red_alerts))
        raise SystemExit(2)


if __name__ == '__main__':
    main()
