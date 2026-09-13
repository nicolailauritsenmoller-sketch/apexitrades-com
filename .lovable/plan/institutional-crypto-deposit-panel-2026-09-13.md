# Institutional Crypto Deposit Panel

## Changes
- Reorganize the Deposit tab into a compact asset/network selector and one dedicated address card, optimized for desktop and mobile.
- Add a clear network warning stating the selected asset and network, required confirmations, and wrong-network risk.
- Generate the QR code locally from the configured deposit address for a crisp, privacy-safe result without an external image service.
- Present the full address in a high-contrast field with a prominent Copy Address action, copied feedback, and memo/tag details when required.
- Add minimum-deposit and expected-arrival guidance based on the selected blockchain network.
- Keep the existing clearing submission flow for amount, optional transaction hash, and proof upload, but visually separate it below the address instructions.
- Preserve real-time transaction history updates so submitted deposits appear as Pending and automatically change to Completed when cleared.
- Refine deposit history rows with clear asset, network, timestamp, and high-contrast status pills while leaving withdrawals and swaps unchanged.

## Technical Details
- Use the existing local `qrcode` package instead of the current third-party QR image URL.
- Continue using the existing authenticated deposit function, private proof storage, and live database subscription; no new provider or database changes are required.
- Derive confirmation counts, arrival estimates, and minimum labels from a centralized network metadata map.

## Validation
- Verify address/network switching, QR regeneration, address copying, memo display, and clearing submission.
- Confirm a submitted deposit immediately appears in Transaction History as Pending and a status update refreshes it to Completed.
- Check the panel at desktop and mobile widths in both light and dark themes.
