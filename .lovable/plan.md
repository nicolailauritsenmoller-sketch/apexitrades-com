# Institutional Typography Overhaul

## Goal
Standardize Velocity Trade on Plus Jakarta Sans for interface text and JetBrains Mono for live financial data, ensuring numbers remain aligned during market updates.

## Changes
- Replace the current primary interface font with Plus Jakarta Sans while retaining system fallbacks.
- Keep JetBrains Mono as the financial-data font and load all required weights through the document head.
- Apply the sans family consistently to page text, navigation, controls, inputs, menus, dialogs, and drawers through the global type system.
- Strengthen the shared numeric utility so financial values always use JetBrains Mono, tabular figures, stable numeric spacing, and tight tracking.
- Audit and update high-priority numeric displays across:
  - Live prices, ticker metrics, charts, order books, and trade tickets
  - Scalping P/L, countdowns, payouts, and settlement summaries
  - Portfolio balances, wallets, transaction history, and deposits/withdrawals
  - Dashboard metrics, withdrawal limits, verification statistics, and admin metrics
- Preserve labels, badges, and descriptive text in Plus Jakarta Sans rather than making entire rows monospaced.

## Verification
- Check the generated font links and computed typography in the browser.
- Verify representative desktop and mobile trading screens for stable number widths and no clipping.
- Confirm the latest preview build has no errors.

## Technical details
- Tailwind v4 font tokens remain in `src/styles.css`; no legacy Tailwind configuration file will be added.
- Google Fonts remain loaded by document-head `<link>` elements.
- The existing `num` utility becomes the canonical financial-number style, minimizing one-off class drift.
