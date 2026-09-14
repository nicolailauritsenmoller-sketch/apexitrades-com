# Security Settings Redesign

## Goal
Rebuild the Security Settings page as a compact institutional security center while preserving the platform’s existing withdrawal-password cooldown, authenticator setup, recovery phrase, and session protections.

## Interface
- Add an Account Security Score banner based on four protections: login password, withdrawal password, authenticator 2FA, and anti-phishing code.
- Show concise protected/missing status pills and calculate High, Medium, or Low from the live account state.
- Replace exposed forms with five clean setting rows: Login Password, Withdrawal Password / PIN, Two-Factor Authentication, Anti-Phishing Code, and Withdrawal Address Whitelisting.
- Open password, withdrawal password, 2FA, and anti-phishing management in focused dialogs; keep destructive or sensitive actions explicit.
- Add an active-device action bar, five-row pagination, responsive mobile rows, a green outlined “THIS DEVICE” badge, per-device revoke, and “Sign Out All Other Devices.”

## Security behavior
- Preserve current-password reauthentication and authenticator step-up for login password changes.
- Preserve withdrawal-password reauthentication, authenticator verification, and the existing seven-working-day change rule.
- Keep TOTP through Google Authenticator, Authy, and compatible apps, with the existing 12-word recovery phrase as backup.
- Store the anti-phishing code and address-whitelist state as account-scoped security settings protected by row-level access rules; never expose secrets to other users.
- Record password-update time so the setting row can show an accurate last-updated timestamp.
- Make “Sign Out All Other Devices” revoke every recorded device except the current session; keep the existing global sign-out behavior available only where intended.

## Technical details
- Add a narrowly scoped account-security table/migration with authenticated-only grants, owner-only policies, validation constraints, and update timestamp handling.
- Add authenticated server functions for reading/updating security state, hashing the anti-phishing code, toggling address whitelisting, and recording password updates.
- Refactor existing forms to support dialog presentation and successful-close callbacks rather than duplicating security logic.
- Update session utilities so current-device preservation is enforced by the authenticated user filter.
- Keep all styling on existing semantic design tokens and shared Button/Dialog/Switch controls.

## Verification
- Verify score and statuses update immediately after each protection changes.
- Verify each dialog’s validation and close/reset behavior.
- Verify device pagination and current-session protection on desktop and mobile.
- Run focused type checks and browser tests for the complete security workflow.
