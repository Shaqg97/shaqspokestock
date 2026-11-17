# Private Whatnot dashboard setup

The Whatnot dashboard is a separate page at `whatnot.html`. It is not linked from the public navigation. The page requires a Supabase-authenticated session and then checks the server-side `public.is_whatnot_admin()` function before showing any data.

## Important status

Committing the page and SQL does not configure the Supabase project by itself. The database migration must be run in the Supabase SQL Editor, and the owner account must be created and allowlisted before access is enabled.

## One-time setup

1. In Supabase Authentication settings, enable Email provider.
2. Create the owner's account at the deployed site's `account.html` page, confirm the email, and sign in once.
3. Open Supabase SQL Editor.
4. Open `supabase/whatnot_private.sql` in GitHub and copy its full contents.
5. Replace both occurrences of `OWNER_EMAIL_REPLACE_ME` with the exact email address of the confirmed owner account.
6. Run the SQL. It creates the private admin allowlist, the Whatnot dashboard tables, and RLS policies. The SQL intentionally fails if the owner email is not already present in Supabase Auth.
7. Test the deployed `whatnot.html` page by signing in as the owner. A different signed-in account must be denied.
8. After the owner account is confirmed and allowlisted, disable public signups in Supabase Authentication settings if no other people should be able to create accounts. Existing authorised owner login remains available.

## Security model

- The browser uses only the Supabase project URL and publishable key.
- The Whatnot personal access token must remain in GitHub Actions Secrets or a server-side secret store. Never put it in `supabase-config.js`, HTML, JavaScript, or database rows.
- Whatnot tables have RLS enabled and only users in `private.whatnot_admins` can access them.
- The admin allowlist table is not readable or writable by browser roles.
- The dashboard is not linked from public navigation, but its URL is not a security boundary; authentication and RLS are the actual protections.
- The initial dashboard is a read-only display shell. It does not yet sync live Whatnot data, create listings, change stock, or fulfil orders.
- Before implementing sync, configure a server-side integration with least-privilege Whatnot scopes and a Supabase server credential stored only as a protected secret. Do not expose service-role credentials to the browser.

## Supabase redirect configuration

In Supabase Authentication URL Configuration, set the production GitHub Pages URL as the Site URL and add the exact deployed `account.html`, `collection.html`, and `whatnot.html` URLs to allowed redirect URLs as needed. Use the actual deployed site origin, not a guessed domain.
