# Community Hub & Management Desk

## Overview
Add a live public community section to the homepage and a dedicated, access-controlled Community Desk at `/admin/community`. Official channel settings, member metrics, community announcements, and VIP lounge requests will be stored in the backend and update connected screens in real time.

## Landing community hub
- Add “Join the Global Trading Desk Community” after the global membership section, using the requested subtitle and institutional visual hierarchy.
- Show verified Telegram, Discord, X, and VIP Lounge cards with live/maintenance state, member counts, descriptions, and channel-specific actions.
- Restrict the VIP Lounge action to signed-in, verified VIP accounts; eligible members can request access when no approved link is available.
- Add the four community value highlights and the anti-phishing verification notice.
- Add a public bulletin board showing currently published Signal, Event, Security Alert, and Maintenance announcements.
- Subscribe to channel and bulletin changes so edits publish without a redeployment or page refresh.

## Control Center Community Desk
- Add Community Desk under Engagement with a Globe/Users icon, linking directly to `/admin/community`.
- Build a secure Community Desk with three views:
  - Channels: edit official URLs, member counts, and Active/Maintenance visibility.
  - Bulletin: compose formatted announcements, choose category and Published/Draft status, and review past posts.
  - VIP Access: review pending lounge requests and approve or reject them with an optional reason.
- Keep the same dark enterprise surfaces, semantic status colors, compact tables, and responsive controls used across the Control Center.

## Backend and security
- Add dedicated tables for channel settings, community announcements, and VIP access requests with explicit grants and row-level access policies.
- Seed the four official channel records with safe inactive/maintenance placeholders until genuine official URLs are entered by an administrator.
- Public visitors can read active channel metadata and published bulletins only; no public writes are permitted.
- Signed-in VIP members can create and read only their own access requests; approval is verified server-side by current VIP status.
- Community management functions require an administrator role, record sensitive actions in the audit trail, and notify members after request approval or rejection.
- Add all three tables to the existing real-time Control Center synchronization map.

## Verification
- Refresh generated backend types through the migration workflow.
- Run TypeScript checks.
- Verify homepage, Community Desk, channel editing, bulletin publishing, VIP request review, and mobile layouts in the browser.
