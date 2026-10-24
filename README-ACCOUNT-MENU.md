# Flicks & Licks HRMS — Global Account Menu

Copy these paths into your existing Phase 3 GitHub repository, preserving their folders:

- `app/layout.tsx` (replaces existing root layout)
- `app/account-menu.css` (new)
- `app/components/AccountMenu.tsx` (new)
- `app/settings/page.tsx` (new)
- `app/api/account/password/route.ts` (new)

The shared account menu is visible on every signed-in page (except `/login`), with the user's initials, name, profile, account settings, and sign out. The existing static dashboard account card is hidden to avoid duplication.

Settings provides read-only profile information and a self-service password change requiring the current password. No Prisma migration required. It uses the existing `/api/me` and `/api/auth/logout` endpoints.

After copying files, run `npm run build` locally, commit to GitHub, and redeploy Railway. Test as Employee, HR Manager and Administrator. This patch has not been validated against a live Railway instance.
