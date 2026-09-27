# Live Agent Escalation Fix

## Goal
Make the support handoff private, idempotent, and realtime: customers see one clear queue banner, agents receive the bot context privately, and accepting a chat switches both sides into direct messaging.

## Changes

### Private handoff data
- Add dedicated chat-session fields for the bot transcript and transfer timestamps instead of inserting transcript text into the customer message stream.
- Store the transcript as structured metadata that is readable by support staff through the existing protected admin functions.
- Keep ordinary `chat_messages` limited to actual customer and agent messages.

### Customer chat state
- Restore queue/connected state from the saved chat session whenever the modal opens.
- Make escalation idempotent so repeated “agent”, “human”, or Connect actions do not add duplicate events.
- Show one system banner: “Live Support Requested • You have been placed in the support queue. Estimated wait time: ~2 mins.”
- Keep the composer active while queued; messages save directly to the live thread without triggering bot replies.
- Subscribe to session assignment changes in realtime. When an agent accepts, show one joined event, change the header to “Connected with Agent”, and keep bot replies disabled.

### Admin live chat
- Include the private bot transcript in the selected conversation’s staff-only context area, not as a customer-visible bubble.
- Add an explicit Accept Chat action that assigns the current staff member and records the connection time.
- Preserve realtime two-way messaging after acceptance.

### Verification
- Confirm the app compiles and the latest preview build is healthy.
- Exercise escalation repeatedly to confirm one queue banner, queued free-text messaging, agent acceptance, joined status, and realtime replies.

## Technical details
- Use a schema migration with authenticated/service-role grants and existing RLS boundaries.
- Use authenticated server functions for escalation and agent acceptance so ownership and staff permissions are checked server-side.
- Reuse the existing realtime-enabled `chat_sessions` and `chat_messages` tables; no new public route is needed.
