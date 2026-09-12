# Consolidate Balance Visibility

## Changes
- Keep one persisted balance-visibility state shared across Portfolio and Assets.
- Remove the duplicate Portfolio “Assets overview” eye control and inherit the page-level state.
- Mask Portfolio totals, asset rows, allocation/performance values, open-position values and P&L, and trade-history monetary values.
- Keep one eye control beside the Assets total balance and apply it to every displayed asset balance/value.
- Remove the secondary visibility control from the standalone Assets directory and place its only control beside a new total-balance summary.

## Validation
- Verify each page has exactly one balance eye control.
- Toggle visibility and confirm all relevant monetary values mask and restore together.
- Check Portfolio and Assets at desktop and mobile widths.
