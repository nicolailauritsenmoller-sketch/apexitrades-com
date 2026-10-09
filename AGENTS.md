<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Live-support bot transcripts belong in private `chat_sessions.bot_context`; only genuine customer/agent messages belong in `chat_messages`, so internal handoff context cannot leak into the customer transcript.

- Compliance overrides (risk category, forced 2FA re-auth, daily withdrawal limits in `user_withdrawal_limits`) live in src/lib/compliance.functions.ts; `admin_audit_logs` is append-only via DB trigger - why: immutable audit trail enforced at the database, not just RLS.
- VIP tier engine: fee resolution + 30-day evaluation in src/lib/vip-fees.server.ts, admin fns in src/lib/vip-tiers.functions.ts; daily cron hits /api/public/hooks/vip-evaluate authenticated by a token in private.cron_tokens - why: no secret literal in SQL, one code path for cron and "Run now".
- Every money movement is mirrored into `public.transactions` by DB triggers on deposits/withdrawals/swaps/contracts/positions (admin corrections insert directly) - why: one ledger with COMPLETED/PENDING/FAILED status that app code cannot skip.
- KYC selfies must carry in-app camera capture metadata, validated by the `validate_kyc_submission` trigger; display-name 60-day cooldown is enforced by a profiles trigger - why: rules hold even if a client bypasses the UI.
- IP/device bans live in `public.access_bans` (admin-read only); enforcement runs server-side in checkAccessBan using the request IP header, called after every session register/heartbeat - why: client-reported IPs are spoofable.
- Platform treasury: balances in `treasury_wallets`, append-only `treasury_ledger`; all movements go through the service-role-only `treasury_transfer` DB function (also mirrors customer legs into `transactions`) - why: treasury and customer balances change in one atomic step.
- Mount the shared Platform Tour only on the public landing route after its hero, not on the authenticated dashboard - why: visitors can watch without signing in.
- Keep tour playback and chapter seeking in a shared native-video player, with separate CDN quality sources and time-preserving quality changes - why: public playback stays independent of account access.
- Operations Console section selection lives in validated URL search parameters with metadata derived from loader dependencies - why: tab titles, direct links and browser history remain synchronized without document-title effects.
- Reuse AdminActionConfirm for high-impact console mutations and AdminTableToolbar for searchable/exportable queues; reason fields travel into existing audit records - why: consistent operator safeguards must not alter financial execution semantics.

- The Operations Console lives only at /admin on the primary domain; signed-out visitors go to /auth and return to their original path after login, and server role checks remain authoritative - why: one origin keeps sessions shared and avoids DNS-dependent access.
- Global risk controls (trading pause, leverage cap, large-withdrawal review) live in platform_settings key "risk_controls", read via src/lib/risk-controls.server.ts and enforced inside position/contract open handlers - why: circuit breakers must hold server-side, not just in the UI.
