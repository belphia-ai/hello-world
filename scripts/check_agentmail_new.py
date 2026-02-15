#!/usr/bin/env python3
"""
Check AgentMail inbox for new messages and output a summary of unseen leads.
Stores the timestamp of the most recent message in data/agentmail_state.json.
"""

import json
import os
from pathlib import Path
from datetime import datetime, timezone

from agentmail import AgentMail

STATE_PATH = Path('data/agentmail_state.json')
INBOX_ID = 'minnie@agentmail.to'
MAX_MESSAGES = 10

def load_last_timestamp():
    if STATE_PATH.exists():
        try:
            data = json.loads(STATE_PATH.read_text())
            return float(data.get('last_ts', 0))
        except Exception:
            pass
    return 0.0

def save_last_timestamp(ts: float):
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps({'last_ts': ts}))

def main():
    api_key = os.environ.get('AGENTMAIL_API_KEY')
    if not api_key:
        raise SystemExit('AGENTMAIL_API_KEY not set')

    client = AgentMail(api_key=api_key)
    messages = client.inboxes.messages.list(inbox_id=INBOX_ID, limit=MAX_MESSAGES).messages or []

    last_ts = load_last_timestamp()
    new_msgs = []
    max_ts = last_ts

    for msg in messages:
        created = msg.created_at
        if isinstance(created, datetime):
            ts = created.timestamp()
        else:
            ts = datetime.fromisoformat(created.replace('Z', '+00:00')).timestamp()

        if ts > last_ts:
            new_msgs.append((ts, msg))
            if ts > max_ts:
                max_ts = ts

    if not new_msgs:
        return

    new_msgs.sort(key=lambda item: item[0])
    lines = []
    for _, msg in new_msgs:
        sender = msg.from_ if isinstance(msg.from_, str) else ', '.join([getattr(p, 'email', str(p)) for p in (msg.from_ or [])])
        subject = msg.subject or '(no subject)'
        preview = (msg.preview or '').strip()
        lines.append(
            f"• {sender} — {subject}\n  {preview[:160]}"
        )

    save_last_timestamp(max_ts)
    print('\n'.join(lines))

if __name__ == '__main__':
    main()
