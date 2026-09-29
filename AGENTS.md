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
