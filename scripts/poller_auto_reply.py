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
REPLY_SLA_SECONDS = 10 * 60
INTERNAL_LEAD_MAX_AGE_SECONDS = 20 * 60

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
                'pending_replies': dict(state.get('pending_replies', {})),
            }
        except Exception:
            continue

    return {'last_ts': 0.0, 'processed_message_ids': [], 'pending_replies': {}}


def save_state(last_ts, processed_message_ids, pending_replies):
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(
        json.dumps(
            {
                'last_ts': last_ts,
                'processed_message_ids': processed_message_ids[-STATE_KEEP_MESSAGE_IDS:],
                'pending_replies': pending_replies,
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


def parse_internal_lead_relay(subject, preview):
    """Parse the internal 'New inbound lead · Name' message sent from Minnie to Minnie.
    Returns dict with target_email/name/message or None.
    """
    if not (subject or '').lower().startswith('new inbound lead'):
        return None

    lines = (preview or '').splitlines()
    lead_name = None
    lead_email = None
    lead_message = ''
    capture_message = False

    for line in lines:
        l = line.strip()
        if l.lower().startswith('name:'):
            lead_name = l.split(':', 1)[1].strip()
            capture_message = False
        elif l.lower().startswith('email:'):
            lead_email = l.split(':', 1)[1].strip().lower()
            capture_message = False
        elif l.lower().startswith('message:'):
            capture_message = True
            lead_message = l.split(':', 1)[1].strip()
        elif capture_message and l:
            lead_message = (lead_message + '\n' + l).strip() if lead_message else l

    if lead_email and '@' in lead_email and lead_email != INBOX_ID:
        return {
            'name': lead_name or lead_email.split('@')[0],
            'email': lead_email,
            'message': lead_message or '',
        }
    return None


def pending_key(message_id, sender_email, ts):
    if message_id:
        return f"mid:{message_id}"
    return f"email:{sender_email}:{int(ts)}"


def first_name(name, email=''):
    raw = (name or '').strip()
    if not raw:
        raw = (email or '').split('@')[0]
    token = raw.split()[0] if raw else 'there'
    return token.strip(" ,.'\"()") or 'there'


def compose_lead_followup(name, lead_message):
    msg = (lead_message or '').lower()
    if any(k in msg for k in ['price', 'pricing', 'how much', 'cost', 'quote']):
        return (
            f"Hey {name},\n\n"
            "Great question. For a sales-agent setup, pricing depends on channels, lead volume, and whether booking is included.\n\n"
            "If you share those 3 details, I’ll send a fixed quote and rollout timeline in my next reply.\n\n"
            "– Minnie"
        )

    if any(k in msg for k in ['dealership', 'used car', 'car dealership', 'autotrader', 'whatsapp', 'facebook ads']):
        return (
            f"Hey {name},\n\n"
            "Perfect — I can run this as a dealership sales workflow.\n\n"
            "I’ll handle:\n"
            "• rapid first response\n"
            "• lead qualification\n"
            "• follow-up sequences\n"
            "• daily sales summary\n\n"
            "Reply with monthly lead volume + channels + whether you want appointment booking and I’ll send your scoped implementation + pricing.\n\n"
            "– Minnie"
        )

    return (
        f"Hey {name},\n\n"
        "Thanks — I can help scope this properly.\n\n"
        "To give you a concrete plan + price, reply with:\n"
        "• monthly lead volume\n"
        "• channels in use (website, ads, WhatsApp, etc.)\n"
        "• CRM today (or none)\n"
        "• whether you want appointment booking included\n\n"
        "Once I have that, I’ll send your exact implementation and quote.\n\n"
        "– Minnie"
    )


def send_reply(client, email, name, macro, context=None, subject_hint=None, reply_to_message_id=None):
    display_name = first_name(name, email)
    if macro:
        subject, template = REPLY_TEMPLATES[macro]
        cap = context.get('cap', '100') if context else '100'
        body = template.format(name=display_name, cap=cap)
    else:
        subject = normalize_reply_subject(subject_hint)
        lead_message = context.get('lead_message', '') if context else ''
        body = compose_lead_followup(display_name, lead_message)

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
    pending_replies = dict(state.get('pending_replies', {}))
    max_inbound_ts = last_ts
    out_summaries = []
    red_alerts = []

    now_ts = datetime.now(timezone.utc).timestamp()

    # Detect messages that already received a reply (e.g., webhook fast-path) to avoid duplicates.
    replied_to_ids = set()
    for m in messages:
        labels = {str(x).lower() for x in (m.labels or [])}
        if 'sent' not in labels:
            continue
        headers = m.headers or {}
        ref = (headers.get('In-Reply-To') or getattr(m, 'in_reply_to', None) or '').strip()
        if ref:
            replied_to_ids.add(ref)

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
        if message_id and message_id in replied_to_ids:
            processed_message_ids.add(message_id)
            if ts > max_inbound_ts:
                max_inbound_ts = ts
            continue
        if ts <= last_ts and not message_id:
            continue
        if (now_ts - ts) > MAX_REPLY_AGE_SECONDS:
            if message_id:
                processed_message_ids.add(message_id)
            if ts > max_inbound_ts:
                max_inbound_ts = ts
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

        preview = msg.preview or ''
        subject = msg.subject or '(no subject)'

        # Special-case internal lead relay generated by the site form
        internal_lead = parse_internal_lead_relay(subject, preview) if sender_email == INBOX_ID else None

        # only process true inbound mailbox messages, except internal lead relays
        if not internal_lead and not is_inbound_message(labels):
            continue

        if sender_email == 'unknown':
            continue

        if not internal_lead and sender_email == INBOX_ID:
            continue

        if not internal_lead and (is_system_sender(sender_email) or is_system_message(subject, preview)):
            if message_id:
                processed_message_ids.add(message_id)
            if ts > max_inbound_ts:
                max_inbound_ts = ts
            continue

        if internal_lead:
            # avoid blasting historical form leads if state was reset or logic changed
            if (now_ts - ts) > INTERNAL_LEAD_MAX_AGE_SECONDS:
                if message_id:
                    processed_message_ids.add(message_id)
                if ts > max_inbound_ts:
                    max_inbound_ts = ts
                continue
            sender_email = internal_lead['email']
            sender_name = internal_lead['name']

        upsert_lead(sender_email, sender_name, None, 'active', ts)
        log_event(sender_email, 'inbound', subject, preview, ts)

        macro = detect_macro(preview)
        cap_val = None
        if macro:
            for part in preview.split():
                if part.strip().replace('$', '').replace('€', '').isdigit():
                    cap_val = part.strip().strip('$€')
                    break

        # Use original lead message for new form leads, and live preview text for reply-chain messages.
        lead_message_context = internal_lead['message'] if internal_lead else preview

        pkey = pending_key(message_id, sender_email, ts)
        if pkey not in pending_replies:
            pending_replies[pkey] = {
                'first_seen_ts': ts,
                'last_seen_ts': ts,
                'attempts': 0,
                'sender_email': sender_email,
                'sender_name': sender_name,
                'subject': subject,
                'message_id': message_id,
            }
        else:
            pending_replies[pkey]['last_seen_ts'] = ts

        try:
            send_reply(
                client,
                sender_email,
                sender_name,
                macro,
                ({'cap': cap_val} if macro else {'lead_message': lead_message_context}),
                subject_hint=subject,
                reply_to_message_id=message_id if message_id else None,
            )

            if macro:
                out_summaries.append(f"Auto-replied to {sender_name}: {macro}")
            else:
                out_summaries.append(f"Auto-replied to {sender_name}: sales_dialogue_reply")

            pending_replies.pop(pkey, None)
            if message_id:
                processed_message_ids.add(message_id)
            if ts > max_inbound_ts:
                max_inbound_ts = ts
        except Exception as err:
            err_text = str(err)
            pending_replies[pkey]['attempts'] = int(pending_replies[pkey].get('attempts', 0)) + 1
            pending_replies[pkey]['last_error'] = err_text

            # Hard-bounce/complaint recipients should not keep retrying and blocking runs
            if 'MessageRejectedError' in err_text or 'bounced or complained' in err_text:
                pending_replies.pop(pkey, None)
                if message_id:
                    processed_message_ids.add(message_id)
                red_alerts.append(
                    f"RED ALERT: recipient rejected for {sender_name} <{sender_email}> on '{subject}' (marked do-not-retry)."
                )
            else:
                red_alerts.append(
                    f"RED ALERT: failed to auto-reply to {sender_name} <{sender_email}> on '{subject}' ({err})"
                )
            if ts > max_inbound_ts:
                max_inbound_ts = ts

    # SLA watchdog: if an inbound has remained unanswered for too long, force a fallback attempt.
    for pkey, item in list(pending_replies.items()):
        first_seen_ts = float(item.get('first_seen_ts', 0) or 0)
        if first_seen_ts <= 0:
            continue
        age = now_ts - first_seen_ts
        last_error = str(item.get('last_error', ''))
        if 'MessageRejectedError' in last_error or 'bounced or complained' in last_error:
            pending_replies.pop(pkey, None)
            continue
        if age < REPLY_SLA_SECONDS:
            continue

        sender_email = item.get('sender_email', 'unknown')
        sender_name = item.get('sender_name', 'there')
        subject = item.get('subject') or 'Follow-up from Minnie'
        reply_to_message_id = item.get('message_id') or None

        red_alerts.append(
            f"RED ALERT: reply SLA breached ({int(age)}s) for {sender_name} <{sender_email}> on '{subject}'. Forcing fallback send."
        )

        try:
            send_reply(
                client,
                sender_email,
                sender_name,
                macro=None,
                context=None,
                subject_hint=subject,
                reply_to_message_id=reply_to_message_id,
            )
            out_summaries.append(f"Forced fallback reply to {sender_name} after SLA breach")
            pending_replies.pop(pkey, None)
            if reply_to_message_id:
                processed_message_ids.add(reply_to_message_id)
        except Exception as err:
            item['attempts'] = int(item.get('attempts', 0)) + 1
            item['last_error'] = str(err)
            pending_replies[pkey] = item
            red_alerts.append(
                f"RED ALERT: forced fallback failed for {sender_name} <{sender_email}> on '{subject}' ({err})"
            )

    save_state(max_inbound_ts, list(processed_message_ids), pending_replies)

    if out_summaries:
        print('\n'.join(out_summaries))
    else:
        print('No new messages.')

    if red_alerts:
        print('\n'.join(red_alerts))


if __name__ == '__main__':
    main()
