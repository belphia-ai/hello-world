# Leads Tracker

SQLite database (`leads/leads.db`) storing inbound AgentMail leads, contact info, stage, last touch, next action, and notes.

Planned components:
- `scripts/log_lead_event.py` — CLI/automation to upsert leads + append events from AgentMail polls.
- `scripts/lead_dashboard_server.py` — lightweight API exposing summaries/stage counts.
- Front-end dashboard (React route) for Kanban/timeline view.
