# Dashboard redesign (October 2026)

This version updates `app/page.tsx` and `app/styles.css` to match the supplied dashboard reference: five KPI cards, employee distribution donut, attendance chart, upcoming events, activity feed, pending approvals and training progress.

The supplied Flicks & Licks logo is retained at `public/logo.png`. Accent colors are the brand's red, black and white, with neutral chart colors.

**Important:** All dashboard figures and people shown are **illustrative demo content**. The branch and period selectors currently update their selection state only; they do not filter database records. Approve/reject buttons demonstrate local UI state only and **do not save** to PostgreSQL. Other module pages are placeholders until backend features and authentication are implemented. Do not use this build for actual employee records.

## Deployment

Replace the files in your existing GitHub repository with this project's contents, commit and push. Railway will rebuild the Next.js service from the connected branch. Keep the Railway `DATABASE_URL` variable and PostgreSQL service configured as before.

Run locally with `npm install && npm run dev`. Build with `npm run build`.
