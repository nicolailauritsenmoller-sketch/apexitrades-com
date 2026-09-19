# Institutional Profile Terminology Refactor

## Overview
Refactor the signed-in profile and personal-information views to remove consumer credit-score language and present only data-backed trading, risk, tier, and KYC information.

## What will change
- Remove the Credit Score gauge, score, fallback value, and consumer rating language from the user profile.
- Add a restrained Account Health panel with an information tooltip. Because no dedicated account-health model currently exists, it will show a neutral “Not assessed” state rather than a fabricated percentage or health rating.
- Show margin details only when they can be calculated from actual open leveraged positions and wallet balances. Omit exposure-risk classifications and maximum-leverage claims because those account-level metrics are not currently stored.
- Add a Trading Tier & Volume section using the account’s stored tier. Show VIP only when the stored tier grants it, VIP (PENDING) only when the stored tier is pending, and a neutral standard-tier label otherwise.
- Omit monthly-volume progress until the backend has a defined monthly volume and threshold model.
- Replace generic verification labels on the profile surfaces with KYC terminology: KYC Verified for approved identity checks, Identity & Address Verified only when enhanced address verification is approved, and neutral review/not-verified labels otherwise.
- Remove hardcoded withdrawal capacity and unsupported capability claims from Personal Information and verification cards.

## Technical details
- Extend the existing profile overview response with calculated margin used and available collateral derived from live wallet and open-position records; do not add schema or synthetic defaults.
- Keep KYB absent because the current account and verification model contains no business/entity account type.
- Preserve existing profile actions, navigation, dark/light theme tokens, and mobile behavior.
- Verify type safety and inspect the signed-in profile on desktop and mobile.
