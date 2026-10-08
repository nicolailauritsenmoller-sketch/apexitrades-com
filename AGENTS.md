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
