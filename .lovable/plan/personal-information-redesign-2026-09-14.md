# Personal Information Redesign

## Overview
Rebuild `/profile/settings` as an institutional account profile with a concise identity summary, account limits, structured personal details, and unified settings navigation. Existing profile, identity verification, security, notification, preference, and VIP workflows remain intact.

## What will change
- Add a high-density profile header with avatar, display name, copyable Account UID, account creation date, and a prominent verified identity badge.
- Add an Account Tier & Limits panel showing the current VIP state and 24-hour withdrawal capacity with clear usage context.
- Replace the current loose form and navigation tiles with structured detail rows for:
  - Display Name, retaining the existing 60-day cooldown and save behavior.
  - Masked verified email with a Change Email action that opens a secure account-email flow.
  - Phone number and two-factor authorization state, using verified account data when available and a clear Not Added state otherwise.
  - Country of Residence and Timezone, using identity and saved regional settings.
- Add responsive settings navigation for Personal Info, Security, Notifications, Preferences, and VIP Membership, with the current destination clearly highlighted.
- Use compact token-based dark surfaces, stronger border contrast, restrained semantic badges, and touch-friendly mobile rows.

## Technical details
- Extend the existing authenticated profile overview response only with safe account metadata already held by authentication/profile/KYC data; no sensitive identity documents will be exposed.
- Reuse existing profile update, KYC, preferences, VIP, and design-system controls rather than introducing duplicate state.
- Keep all current route destinations valid; VIP navigation will point to the existing membership upgrade/status page.
- Use semantic theme tokens so the page remains correct in both light and dark modes.
- Preserve unique route metadata and verify the result with type checks and desktop/mobile browser checks.
