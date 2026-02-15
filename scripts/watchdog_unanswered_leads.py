#!/usr/bin/env python3
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from agentmail import AgentMail

INBOX_ID = 'minnie@agentmail.to'
STATE_PATH = Path('data/agentmail_watchdog_state.json')
MAX_MESSAGES = 250
SLA_SECONDS = 15 * 60
STATE_KEEP_IDS = 2000

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
    if not STATE_PATH.exists():
        return {'recovered_lead_ids': []}
    try:
        data = json.loads(STATE_PATH.read_text())
        return {'recovered_lead_ids': list(data.get('recovered_lead_ids', []))}
    except Exception:
        return {'recovered_lead_ids': []}


def save_state(recovered_ids):
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps({'recovered_lead_ids': recovered_ids[-STATE_KEEP_IDS:]}))


def parse_internal_lead(msg):
    subject = msg.subject or ''
    if not subject.lower().startswith('new inbound lead'):
        return None
    if 'sent' not in [str(x).lower() for x in (msg.labels or [])]:
        return None
    if not msg.to or INBOX_ID not in [t.lower() for t in msg.to]:
        return None

    name = None
    email = None
    for line in (msg.preview or '').splitlines():
        line = line.strip()
        if line.lower().startswith('name:'):
            name = line.split(':', 1)[1].strip()
        elif line.lower().startswith('email:'):
            email = line.split(':', 1)[1].strip().lower()

    if not email or '@' not in email or email == INBOX_ID:
        return None

    return {
        'lead_message_id': msg.message_id,
        'lead_ts': msg.created_at,
        'lead_subject': subject,
        'name': name or email.split('@')[0],
        'email': email,
    }


def replied_after(messages, lead):
    lead_ts = lead['lead_ts']
    lead_mid = lead['lead_message_id']
    target = lead['email'].lower()

    for msg in messages:
        labels = [str(x).lower() for x in (msg.labels or [])]
        if 'sent' not in labels:
            continue
        if msg.created_at and msg.created_at <= lead_ts:
            continue
        to_list = [t.lower() for t in (msg.to or [])]
        if target not in to_list:
            continue

        headers = msg.headers or {}
        in_reply_to = (headers.get('In-Reply-To') or msg.in_reply_to or '').strip()
        if lead_mid and in_reply_to == lead_mid:
            return True

        subj = (msg.subject or '').lower()
        if subj.startswith('re: new inbound lead'):
            return True

    return False


def send_fallback(client, lead):
    body = FALLBACK_REPLY.format(name=lead['name'])
    headers = None
    if lead['lead_message_id']:
        headers = {
            'In-Reply-To': lead['lead_message_id'],
            'References': lead['lead_message_id'],
        }

    client.inboxes.messages.send(
        inbox_id=INBOX_ID,
        to=lead['email'],
        subject=f"Re: {lead['lead_subject']}",
        text=body,
        headers=headers,
    )


def main():
    api_key = os.environ.get('AGENTMAIL_API_KEY')
    if not api_key:
        raise SystemExit('AGENTMAIL_API_KEY missing')

    state = load_state()
    recovered = set(state['recovered_lead_ids'])

    client = AgentMail(api_key=api_key)
    messages = client.inboxes.messages.list(inbox_id=INBOX_ID, limit=MAX_MESSAGES).messages or []

    now_ts = datetime.now(timezone.utc)
    leads = []
    for msg in messages:
        parsed = parse_internal_lead(msg)
        if parsed:
            leads.append(parsed)

    leads.sort(key=lambda x: x['lead_ts'])

    out = []
    alerts = []

    for lead in leads:
        lead_id = lead['lead_message_id'] or f"{lead['email']}:{int(lead['lead_ts'].timestamp())}"
        age = (now_ts - lead['lead_ts']).total_seconds()

        if age < SLA_SECONDS:
            continue
        if lead_id in recovered:
            continue
        if replied_after(messages, lead):
            continue

        alerts.append(
            f"RED ALERT: lead follow-up SLA breached for {lead['name']} <{lead['email']}> ({int(age)}s). Sending recovery reply."
        )
        try:
            send_fallback(client, lead)
            out.append(f"Recovered missed follow-up for {lead['name']} <{lead['email']}>")
            recovered.add(lead_id)
        except Exception as err:
            err_text = str(err)
            if 'MessageRejectedError' in err_text or 'bounced or complained' in err_text:
                recovered.add(lead_id)
                alerts.append(f"RED ALERT: watchdog skipped hard-bounced recipient {lead['email']} (marked do-not-retry).")
            else:
                alerts.append(f"RED ALERT: watchdog recovery failed for {lead['email']} ({err})")

    save_state(list(recovered))

    if out:
        print('\n'.join(out))
    else:
        print('No watchdog actions.')

    if alerts:
        print('\n'.join(alerts))


if __name__ == '__main__':
    main()
