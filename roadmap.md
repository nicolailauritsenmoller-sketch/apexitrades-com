# Velocity Trade Roadmap

## In Progress

- [x] Add audited Scalping Management CRUD, live tier synchronization, server-side minimum/return validation and preserve existing open-contract terms. Fifteen tests pass; signed-in create/edit/reload/deactivate/reactivate/remove and live trader minimum/ROI updates verified, mobile has no page overflow. Temporary tiers removed; no financial trades executed during testing.

- [x] Generate durable admin-only high-priority alerts on new Lv.2 pending transitions; console realtime pop-ups open the exact Lv.2 review and reconcile reconnect gaps. Publication, trigger and admin-only policy verified; thirteen tests pass and signed-in live SYSTEM TEST alert-to-review flow passes without errors. Temporary alerts removed; no customer's verification status changed to test the trigger.

- [x] Add the user-approved free Lv.2 head-turn movement check with automatic selfie capture and final officer review; no paid provider or certified anti-spoofing/depth claim. Eleven tests pass; browser model/camera startup, missing-face blocking and cancel verified. Actual human movement and signed-in Lv.2 submission remain unverified because the available account lacks approved Lv.1.

- [x] Simplify Lv.2 submission, review and database validation to live biometric selfie only; retain camera metadata and staff approval. Schema checked and 13 focused tests pass; signed-in page omits PoA. Live submission remains unverified because the available account has not passed Lv.1.

- [x] Update Lv.2 with optional recent Proof of Address, required live selfie, private paired admin previews and submission/approval guards. Twelve tests pass; signed-in image upload preview, fake-device camera capture and mobile layout verified. Admin paired inspection renders; legacy evidence files did not render, and no live customer submission or approval was performed. Automated biometric matching is not claimed.

- [x] Make Unverify user silently reset both KYC tiers to UNSUBMITTED, clear submission/review references, reopen fresh Basic submission and preserve internal audit reasons. Four handler regression tests pass; enum and trigger compatibility checked, signed-in compliance desk renders without errors. No live customer's verification was revoked for testing.

- [x] Audit catalog logo/CAD coverage and independent discovery branding; official futures marks and dollar-only CAD tests pass, live Alpha and USDC card verified without page errors.
- [ ] Activate USDC receiving networks - blocked on operator-provided Ethereum ERC-20, Solana and Base receiving addresses; admin network selection and validation are ready, no addresses fabricated.
- [x] Add persistent listings/Alpha/news moderation, institutional news publishing and real desk-performance snapshots with audited admin controls; signed-in draft save/reload/update and mobile checked, test drafts withdrawn. Preserve the existing deposit ledger and five-minute client rotation; snapshots update on real trade changes rather than idle polling. Nineteen focused tests pass.

- [x] Match News to the supplied publisher feed with article images above bordered headline/excerpt panels, compact live asset tags and action rows; one-minute refresh rejects future, undated and older-than-48-hour articles. Three freshness tests pass; signed-in desktop/mobile cards and filters verified without errors or overflow.
- [x] Replace New and Alpha provider-branded subheaders with the requested independent platform labels.

- [x] Populate Alpha from official live token feed with Trending/Early-stage/Liquidity/Momentum filters, real metrics, 376 published official logos and token-ID charts; 30-second refresh, catalog identity safeguards, signed-in desktop/mobile charts and filters verified without overflow or page errors.
- [x] Add CAD with Canadian flag to Display Currency and separate live display FX adapter; signed-in Home/Portfolio balances and P&L conversion, selection persistence after reload and mobile picker verified. Twenty-four tests pass; build OK. Saved preference follows existing functional-consent rules.

- [x] Audit project-wide asset icons; publish 87 missing crypto marks and 83 company/fund marks, add logos to leaderboard/admin/alerts, remove asset/network letter fallbacks, and share listing fallback. Twelve tests pass; signed-in Home, Markets, Portfolio, AAPL terminal, Wallet, Add Funds and 12 leaderboard cards verified, mobile has no overflow; 104 simulated image failures render non-text glyphs without page errors.

- [x] Refresh Leaderboard rankings, summaries, charts and engagement every five minutes; rotate stable-key cards retaining source ranks and focused controls, preserve filters/follows and stale data on refresh failure. Five tests pass; signed-in accelerated-clock check confirms ETH rotation and filter retention without page errors. Sample metrics remain illustrative, not market-driven returns.

- [x] Keep all New asset actions internal; signed-in New Trade opens an internal preview without external links or new tabs, catalog-only execution preserved. Live chart provider currently rate-limited, with an explicit unavailable state.
- [x] Populate Leaderboard summary metrics from live rankings or clearly labeled sample data matching displayed cards; verified All and ETH totals on desktop/mobile, nine tests pass, no page errors or horizontal overflow.

- [x] Add News beside Leaderboard with cached real financial articles, publisher-domain badges, article images/live market context, asset links, category filters and personal likes/sharing; signed-in desktop/mobile cards and filters verified without errors or overflow. Publisher social totals are unavailable and shown as unreported, not invented.

- [x] Replace all New listing letter badges with official token logos; all four CDN-hosted icons load in signed-in desktop/mobile checks, future listings use verified exchange logo metadata; no page errors or overflow.

- [x] Populate New from official recent spot-token announcements and the official spot product feed; live price/change/USDT volume, verified market caps where reported, announcement details and external chart/trade actions; 15 tests pass and signed-in desktop/mobile rows verified without page errors or overflow.

- [x] Restore full live Losers coverage without invalid catalog symbols blocking valid quotes; 13 tests pass, signed-in desktop/mobile show current negative assets worst-first and refresh automatically without page errors.

- [ ] Finish Account Info security audit with live 2FA status, actual sign-in time in UTC and protected IP metadata; verify signed-in modal.

- [ ] Update support greeting and add thirteen-language header selector with localized prompts and controls; verify signed-in switching and persistence.

- [x] Expand Assets inventory with BTC, ETH, SOL, XRP and BNB, opt-in illustrative balances separate from spendable funds, shared asset selection across deposit/withdraw/swap and dynamic zero-balance filtering; three tests and signed-in desktop/mobile selection/filtering passed, with no overflow or page errors. Unconfigured deposits show unavailable rather than another asset's address.

- [x] Add Notifications category filter chips (All, Trades, Financial, Security, System) with per-category unread counts, gear and Mark all read aligned above the chip bar, and coloured status tags; signed-in desktop/mobile, light/dark verified (All 5 = Trades 1 + Financial 4; Security/System empty states); seven filter tests pass.

- [x] Audit and finish homepage interactions: mobile favorites now save and remove, balance currency selector opens and persists after refresh, market tabs hide scrollbars; signed-in desktop/mobile search, deposits and Following verified without page errors or overflow; ten tests pass.

- [x] Build Copy Trading leader browsing, verified historical performance, consent-based applications, leverage selection and non-binding allocation requests; signed-in modal verified, currently no approved leaders.
- [ ] Enable real-money copy execution and fund allocation - blocked on an approved execution model/service; protection additionally requires funded offer terms.
- [x] Expand the homepage carousel to four slides: Copy Trading, VIP fees, Global Trading Tournament, Institutional Liquidity Program; swipe, scroll-snap, dynamic pagination and per-slide dialogs verified; tournament and liquidity marked as proposed until terms are approved.

- [x] Resolve stale dynamic route imports with bounded refresh recovery and prevent service-worker HTML/module caching; exact reported error recovery, repeat-reload guard and signed-in Home/Markets navigation verified; nine tests pass.

- [x] Refine homepage orange search flame, balance typography and compact quick-card/market spacing; signed-in mobile/desktop order, search, deposit action and light/dark rendering verified; seven market tests pass.

- [x] Replace the homepage Apple Pay row with external crypto transfer details; verified signed-in desktop/mobile USDT and ETH address/QR flow, configured network selector and BTC unavailable state (no configured BTC receiving address).
- [x] Switch the homepage quick chart card from BNB to BTC with live price, 24h change and sparkline; verified signed-in on phone and desktop.
- [x] Remove the Exchange/Wallet toggle pill from the homepage so the balance and PNL block sits directly under the header; verified signed-in on phone and desktop.
- [x] Match homepage font sizes and compact section proportions to the two supplied screenshots; verify signed-in mobile and desktop.

- [x] Finalize homepage promo carousel, USD quick card, volume-based flames and Stocks discovery tab; signed-in mobile Claim availability, pagination, Stocks rows and deposit dialog verified; seven market tests pass.
- [ ] Activate copy-trading claims - blocked on an actual copy-trading service and funded offer terms; Apple Pay is no longer part of the homepage deposit card.

- [x] Complete the exchange-reference homepage: avatar-left mobile header, search above USD balance, compact market panel, discovery tabs and the shared Home/Portfolio/Trade/Markets/Assets bottom navigation; signed-in desktop and mobile checked with no page errors or horizontal overflow.

- [x] Keep the router and React in one pre-bundled module pass so an open tab can't load two React copies and blank the screen; all trader screens verified error-free in a fresh signed-in browser.
- [x] Rotate Analytics commentary every two minutes and prioritize sourced BTC, ETH, XRP, SOL and BNB forecasts; verified real signed-in articles change order, with admin intelligence pinned.

- [x] Redesign the header communications drawer with Notifications, Chat and live Analytics; verified real account alerts, specific-thread launch, live quotes and dark/light/mobile layouts.

- [x] Keep the Operations Console at /admin on the primary domain with staff-only access; a separate admin hostname is no longer required by the current architecture.

- [x] Standardize shared action hierarchy and Users/KYC/financial queue toolbars with selected-row controls; transaction ledger remains export-only.
- [x] Add audited confirmations for balance overrides, freezes, liquidations, financial reviews, treasury transfers and trade corrections; improve KYC/VIP/settings submit feedback.

- [x] Create the 60-second public Platform Tour with five chapters, quality switching, autoplay and registration CTA; verify playback.
- [x] Fix Operations Console browser titles across admin pages and confirm the official shield favicon.

- [x] Refactor user profile terminology around data-backed account health, trading tier, margin, and KYC status.
- [x] Redesign the Assets deposit panel with local QR, network guidance, clearing submission, and live status history.
- [x] Streamline the Trade Closed Summary and add dedicated order-detail exports.

## Completed

- [x] Recheck remaining homepage work: signed-in copy directory and saved request readback, all campaign dialogs, configured crypto deposit instructions and desktop/mobile layout verified without page errors or overflow; twelve market, campaign-validation and chunk-recovery tests pass. Outstanding financial execution and program approvals remain blocked, not represented as active benefits.

- [x] Make live-agent escalation private, idempotent, realtime, and explicitly accepted by support staff.

- [x] Measure order execution latency and fill rate, fold them into Account Health, and populate monthly volume and tier progress from real trade records.

- [x] Repair role-check permissions across community and monitoring policies, and restore signed loss values on the home screen.
- [x] Replace platform branding, headers, footer, auth mark, favicon, and app icons with the official institutional shield logo.

- [x] Add the public Community Hub and secure Community Desk with live channels, bulletins, and VIP access review.
- [x] Redesign Notification Settings with an institutional channel matrix, mandatory security alerts, global controls, browser testing, and quiet hours.
- [x] Redesign Personal Information with institutional identity summary, account limits, structured details, and unified settings navigation.
- [x] Redesign Security Settings with live protection scoring, modal controls, anti-phishing, withdrawal whitelisting, and paginated device sessions.
- [x] Redesign the Help Center with institutional search, category filters, topic cards, direct support actions, VIP access, and policy links.
- [x] Redesign Contact Support as an institutional support desk with search, status, categorized help, tickets, live chat, and VIP concierge.
- [x] Refine dashboard funding and trade actions, ticker and stablecoin formatting, safe news links, and active navigation styling.
- [x] Make Dark the pre-rendered default theme while preserving saved Light, Dark, and System preferences without a hydration flash.
- [x] Remove user-facing “Admin” terminology, restrict Control Center links to true administrators, and institutionalize system messaging.
- [x] Consolidate Portfolio and Assets balance privacy into one persisted top-level eye control per page and mask all balance, valuation, and P&L displays.
- [x] Stabilize all trading chart view modes and centralize Light, Dark, and System selection in Profile Preferences with Dark as the default.
- [x] Implement institutional-grade TradingView Lightweight Charts on the Trade page with candlestick/OHLC/area/line/heikin-ashi styles, timeframe pills, real-time datafeed, indicators (SMA/EMA/RSI/MACD/Bollinger/VWAP/Stochastic/ATR/Volume), drawing tools, ticker header, and theme integration.
- [x] Replace Preferences language grid with a compact dropdown select that shows the active language and opens a flyout list for instant platform-wide sync.
- [x] Make the Assets "Account balances" header an accordion toggle with a rotating chevron, expanded by default, folding the asset table smoothly.
