---
name: remind
description: Set a one-time reminder. Usage — "/remind pick up kids at 3pm" or "/remind dentist appointment on Tuesday at 10am". Only triggered by explicit user command, never by the model on its own.
disable-model-invocation: true
---

# Remind

Set a one-time reminder for the user. This skill is user-invoked only — Pip should never trigger it automatically.

## How it works

The user provides a reminder in natural language via `$ARGUMENTS`. Parse the message to extract:
1. **What** to remind about
2. **When** to send the reminder

## Steps

1. Parse `$ARGUMENTS` to extract the reminder text and time
2. If the time is ambiguous, make a reasonable assumption (e.g., "3pm" means today if it's still before 3pm, otherwise tomorrow)
3. Schedule a one-time task using the IPC schedule mechanism:
   ```bash
   echo '{"type": "schedule_task", "prompt": "Send this reminder: [reminder text]", "schedule_type": "once", "schedule_value": "[ISO timestamp]", "targetJid": "[current chat JID]"}' > /workspace/ipc/tasks/remind_$(date +%s).json
   ```
4. Confirm to the user what was scheduled and when

## Examples

- `/remind pick up kids at 3pm` → schedules for today 3pm (or tomorrow if past 3pm)
- `/remind dentist appointment on Tuesday at 10am` → schedules for next Tuesday 10am
- `/remind call mum tomorrow morning` → schedules for tomorrow 9am

## Tone

Brief confirmation. e.g., "Got it — I'll remind you to pick up the kids at 3:00pm today."
