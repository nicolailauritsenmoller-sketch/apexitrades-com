# Financial execution rules

- Scalping entry serializes on the tier row, reserves full win payouts across all users by UTC expiry day, and debits stake plus existing account and protocol fees in the contract-insert transaction; accepted terms and payouts never shrink - why: concurrent orders cannot exceed budgets or strand debits after rejection.
- Operations health uses protected aggregates and durable rate-limited provider samples with expiry - why: monitoring never fabricates continuous availability.
- Financial confirmations, corrections and withdrawal holds commit atomically; credited transfer identities are deduplicated and enabled high-value reviews require distinct operators - why: prevent duplicate credits and stranded funds.
- Configuration revisions are immutable and trigger-captured; restoration uses recent operator 2FA, audit reasons and an unchanged-value guard - why: never overwrite a newer configuration.
- Staff authorization uses caller-readable user_roles and fails closed; high-risk operator actions check recent verified app TOTP sessions - why: privileged reads must not establish authorization.
- Prime membership uses cleared wallet collateral and a safe fee-schedule projection; service-only atomic allocation requests record recommendations, never active fee levels - why: pending funds and client-selected levels cannot grant financial privileges.