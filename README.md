# StabileSearch.com

Business site for Stabile Search — New York City's top Quantitative Finance, AI & Data Science recruitment firm.

Static HTML/CSS/JS plus one Vercel serverless function (`/api/jobs`) that powers the live job board.

## Pages

| Page | File |
|---|---|
| Home | `index.html` |
| About | `about.html` |
| For Employers | `employers.html` |
| For Candidates | `candidates.html` |
| Open Roles (job board) | `jobs.html` |
| Contact | `contact.html` |

## Deploying to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import this GitHub repo (`stabilesearch.com`).
2. Framework preset: **Other**. No build command, no output directory — just deploy.
3. Vercel automatically detects `api/jobs.js` as a serverless function.
4. When ready to go live, add `stabilesearch.com` + `www.stabilesearch.com` under **Project → Settings → Domains** and update DNS as Vercel instructs (this replaces Webflow's DNS records).

The repo is private; Vercel deploys private repos fine.

## Job board (Crelate sync)

`api/jobs.js` calls Crelate's public candidate-portal API for the Stabile Search portal and returns clean JSON. The job board (`js/jobs.js`) renders it with search + location filters.

- **Sync schedule:** results are cached at Vercel's edge for **24 hours**, so the board refreshes from Crelate about once a day automatically.
- **Force an immediate sync:** in Vercel, open the project → Deployments → ⋯ on the latest deployment → **Redeploy**. (Or push any commit.)
- **Apply flow:** "View & Apply" opens the job's page on the Crelate portal, so applications and resumes land directly in Crelate, attached to the right job.

Jobs are managed entirely in Crelate — post/close jobs there and the site follows.

## Contact form (one-time setup required)

The form on `contact.html` uses Formspree:

1. Create a free account at [formspree.io](https://formspree.io) with **matt@stabilesearch.com**.
2. Click **New form** → name it "StabileSearch.com Contact" → Formspree shows a form endpoint like `https://formspree.io/f/mabcdxyz`.
3. In `contact.html`, replace `YOUR_FORM_ID` in the form's `action` attribute with your ID.
4. Submit the form once and click the confirmation email Formspree sends.

Until this is done the form will show a Formspree error when submitted; the direct email/phone links on the page work regardless.

## Going live checklist

- [ ] Formspree form ID added to `contact.html`
- [ ] Content reviewed (copy, quotes, stats)
- [ ] Domain moved from Webflow to Vercel
- [ ] Test the job board and contact form on the live domain
