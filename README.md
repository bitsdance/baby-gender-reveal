# A Little Hello — Baby Reveal Quiz

A mobile-first welcome and family quiz. The static site is hosted on Netlify. Netlify Functions validate guest submissions and enforce organiser authentication. Google Apps Script writes to the private Google Sheet; the correct trivia answer key stays in Apps Script and scores are calculated there.

## Current architecture and handover review

The supplied `baby-reveal-google-integration.zip` contained `google-apps-script.gs`, `netlify/functions/submit.js`, `netlify/functions/admin.js`, `netlify.toml`, and a starter README. The later `baby-reveal-codex-project.zip` included an HTML prototype and handover note. That prototype used eight generic questions, made the name optional, revealed the gender in browser code, and had no persistence. The handover itself marked it as unfinished. The integration handler checked only that a name, prediction, and answer object existed; Apps Script accepted arbitrary answers and stored no score. This project keeps the original family celebration direction while implementing the requested welcome message, nine questions, private prediction flow, dashboard, strict validation in both server layers, server-side scoring, duplicate request protection, and backend tests.

## Deploy the Google Apps Script

1. Open the private spreadsheet: [Baby reveal responses](https://docs.google.com/spreadsheets/d/1l8wm4yNAhsP9KBRHHbJW-t-82HT0aEC34MmZhCRnxCs/edit). Keep its sharing restricted to the organisers.
2. Choose **Extensions → Apps Script**. Copy `google-apps-script.gs` into the script editor and save.
3. In **Project Settings → Script Properties**, set:
   - `SPREADSHEET_ID` = `1l8wm4yNAhsP9KBRHHbJW-t-82HT0aEC34MmZhCRnxCs`
   - `APP_SHARED_SECRET` = a newly generated random secret of at least 32 characters.
4. Choose **Deploy → New deployment → Web app**, set **Execute as: Me** and **Who has access: Anyone**, then deploy and authorize. Apps Script needs a publicly reachable endpoint because Netlify calls it; the script rejects every request without the shared secret.
5. Copy the deployed web app URL ending in `/exec`. Do not put it or the secret in website files.

## Deploy to Netlify

Use `baby-reveal` as the Netlify site base directory (or deploy this folder directly). The included `netlify.toml` publishes the static pages and enables `netlify/functions`.

Set these Netlify environment variables for the deployed site:

| Variable | Value |
| --- | --- |
| `GOOGLE_SCRIPT_URL` | Your Apps Script `/exec` URL |
| `APP_SHARED_SECRET` | The same random secret in Apps Script Script Properties |
| `ADMIN_PASSWORD` | A separate strong organiser password |
| `BABY_GENDER` | `BOY` or `GIRL`; set this in Netlify only when ready for the reveal |

Redeploy after adding the variables. Netlify’s UI, CLI, or linked Git deployment can all be used; no credentials or deployment URL are included in this package.

The guest URL opens `index.html`. The dashboard is at `/admin.html`; its password is checked in the `admin` Function before data is returned. It is not stored in browser storage or included in the site source. Use a strong, unique password and share the dashboard URL and password only with organisers.

## Local checks

Requires Node.js 18 or newer.

```sh
npm test
```

For a local Netlify preview with functions, install Netlify CLI and run `netlify dev` after configuring the four environment variables in your local environment. Do not commit a `.env` file.

## Data and behavior

Each accepted entry adds a row to the `Responses` sheet with the timestamp, guest name, Boy/Girl prediction, all nine answers, server-calculated score, and request ID. A score of at least 7/9 (two wrong answers allowed) unlocks a short answer review and a mobile-friendly tile game before the reveal. The reveal function returns the gender only after the tile game is completed with a signed, expiring token. The gender value is read from Netlify's `BABY_GENDER` environment variable and is never included in the public site files. Lower scores get a try-again message. The result animation brings pink down from the top and blue up from the bottom, followed by a confetti burst and shower. The request ID and Apps Script lock prevent repeated taps or retries with the same ID from adding multiple rows.

The dashboard shows prediction counts and percentages, scores, individual answers, popular answers, and a CSV export. CSV fields are quoted and formula-leading values are escaped. Netlify server-side validation and Apps Script validation both require the exact known question keys and answer choices.

## Before sharing the link

- Deploy the Apps Script and set `GOOGLE_SCRIPT_URL`, `APP_SHARED_SECRET`, and `ADMIN_PASSWORD` in Netlify. Add `BABY_GENDER` when you want to activate the reveal.
- Submit a test entry after deployment and confirm a new row appears in the private sheet.
- Visit `/admin.html` and confirm the dashboard and CSV export work with the organiser password.
- Print or share a QR code that points to the deployed guest URL. The baby’s gender is not present in the public site files or dashboard prediction statistics.
