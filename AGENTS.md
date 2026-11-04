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
- Official third-party brand marks (Google, Apple) render as inline SVG components in src/components rather than externalized image assets, so they stay crisp, theme-safe and free of extra network requests.
- Header communications use a shared three-tab drawer with user-scoped notification/thread queries and the existing live-chat launcher; market pulses derive only from real quotes - why: all trader screens share private communications without duplicating chat transcripts or financial logic.
- Analytics external commentary uses a narrow news server function with publisher-domain validation and an asset-balanced client rotation; admin intelligence stays pinned - why: frequent refreshes avoid broad news fan-out and never manufacture expert predictions.
- The trader homepage uses focused exchange search, market, widget and discovery modules; its AppShell variant changes only the homepage mobile header (the bottom navigation stays the shared Home/Portfolio/Trade/Markets/Assets bar), and USD display overrides do not overwrite account currency preferences - why: match the exchange layout without changing other trader screens or saved preferences.
- Homepage promotional pagination is local presentation state; campaign actions use TradingProgramDialog and authenticated non-executing enrollment requests, while the deposit widget opens the existing crypto flow - why: requests must not fabricate reward credits, fee benefits or move money before an atomic copy-execution engine exists.
- Copy leader discovery publishes only consenting approved applications and 30-day closed-position return on committed margin net of recorded fees, excludes contracts, and never authorizes execution - why: enrollment and historical statistics are separate from real-money allocation.
- `@tanstack/react-router` and `@tanstack/router-core` stay in `optimizeDeps.include` and `resolve.dedupe` in vite.config.ts - why: served as raw source the router re-imports React at whatever hash the newest optimizer pass used, so a tab opened before a mid-session re-optimization loads two React copies and dies on a null hook dispatcher.
- Service workers cache only install metadata/icons, never HTML or route modules; shared chunk recovery refreshes the current URL once per minute on stale imports - why: old deployment hashes must not blank the app or cause reload loops.
- Wallet inventory merges standard asset placeholders with real holdings; illustrative balances stay in a separate opt-in view and never feed transaction forms, while selected assets are shared across wallet actions - why: inventory previews must not fabricate spendable funds or silently select another deposit asset.

- Support language selection is presentation-only: render canonical assistant prompts through support translations and preserve genuine transcript messages unchanged - why: instant switching must not rewrite customer/agent history or private handoff context.
- Account Info reads the existing 2FA state and the authenticated user's last sign-in time on open; device activity timestamps are not login timestamps and IP values remain masked - why: security metadata must be real without exposing network identifiers.
- Binance quote reads select requested catalog pairs from the full live 24-hour snapshot and reject outdated tickers - why: unsupported pairs must not reject the whole market batch or make inactive listings look live.
- New listings use official recent spot-token announcements and active exchange status; catalog markets open the internal terminal and non-catalog or announced markets open an internal read-only preview, never bypassing the trading catalog - why: internal discovery must not authorize unsupported execution or fabricate launch dates or metrics.
- New-listing logos use CDN asset pointers for known tokens and allowlisted official exchange metadata for future tokens - why: evolving listings retain authentic marks without ticker collisions or invented branding.
- Discovery News uses a cached six-publisher feed refreshed each minute, rejects future/undated/articles older than 48 hours and expires cached failure fallback after five minutes; article media and live-market context stay distinct, personal likes persist locally and unavailable publisher engagement stays unreported - why: current editorial attribution and social counts must not be fabricated.
- Leaderboard uses one client five-minute refresh cycle for rankings, charts and engagement; card rotation carries source ranks and stable keys, deferring while a control is focused - why: presentation updates must preserve filters, follows and authoritative closed-trade results.
- Asset identities use the shared AssetIcon and static CDN-pointer registries for catalog token/company marks and futures exchange/index marks (src/lib/futures-logo-registry.ts); exhausted image chains render a neutral non-text glyph, never initials - why: uniform logo coverage without runtime third-party logo lookup or invented branding.
- Alpha intelligence uses the official Alpha token feed and token-ID-resolved native charts, with CEX listing plus exact catalog name matching for execution; filters derive only from observed volume, listing time, liquidity and price change - why: discovery must not invent yield signals or authorize ticker collisions.
- Display-only FX reads have a separate live-rate adapter with recent provider fallback and unavailable formatting, independent of wallet execution rates - why: adding a display currency must not change swap eligibility or financial execution.
