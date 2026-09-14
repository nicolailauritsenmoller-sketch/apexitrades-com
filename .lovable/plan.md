# Streamlined Trade Settlement Summary

## Goal
Replace the dense post-trade modal with a compact institutional summary, while keeping detailed execution data and exports available from a dedicated order-history page.

## Changes
- Redesign the Trade Closed Summary into one focused dialog:
  - prominent net realized P&L, ROI, and entry-to-exit price range
  - compact candlestick snapshot
  - one six-row settlement breakdown for pair, side/leverage, prices, settled amount, fees, and close reason
  - exactly three actions: **Trade Again**, **Share P&L**, and **View History**
- Keep Trade Again active where the originating trading flow supports it; otherwise return the user to the matching instrument terminal.
- Add `/history/orders/:orderId` as the dedicated authenticated order-details page.
  - resolve the user’s matching settled contract or closed position
  - show the complete technical report, timeline, execution information, and identifiers
  - provide PDF/print and CSV exports there
  - handle missing or inaccessible orders with a clear empty state
- Extend the shared trade-summary model with explicit settled amount, leverage, and total-fee values so both views use one source of truth.

## Technical details
- Keep protected data loading client-side through existing authenticated server functions.
- Preserve the existing generated candle path and full report sections for the history page.
- Use existing semantic colors, button components, and responsive patterns.
- Add route-specific title, description, Open Graph, and Twitter metadata.
- Validate with the TypeScript check and a desktop/mobile browser pass of the modal and history page.
