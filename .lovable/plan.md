# Institutionalize Control Center Language

## Changes
- Restrict customer-app Control Center links to accounts whose verified backend access reports `isAdmin: true`; keep the protected operations route’s existing role-based controls intact for authorized specialist workflows.
- Rename visible “Admin” navigation, headings, buttons, accessibility labels, and management copy to institutional terms such as Control Center, Security Operations, Operations Team, and Risk Control.
- Audit deposit, withdrawal, KYC, credit, support, notification, toast, status, and email messaging; replace administrative approval language with review, compliance, verification, clearing, and settlement terminology.
- Preserve internal role names, function names, database fields, audit event identifiers, and developer-only comments where changing them could affect authorization or integrations.

## Validation
- Search all user-facing source strings to confirm no visible “Admin” wording remains.
- Verify regular staff and customers do not receive customer-facing Control Center links, while true administrators do.
- Check the header, Profile, authentication/public pages, transaction statuses, KYC, support, and operations console in the running preview.
