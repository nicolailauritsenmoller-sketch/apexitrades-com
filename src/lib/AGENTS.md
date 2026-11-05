# Financial execution rules

- Scalping entry serializes on the tier row, reserves full win payouts across all users by UTC expiry day, and debits stake plus existing account and protocol fees in the contract-insert transaction; accepted terms and payouts never shrink - why: concurrent orders cannot exceed budgets or strand debits after rejection.