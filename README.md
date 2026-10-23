# NeuroSense — full-stack-ready wellness dashboard

A responsive React/Vite dashboard inspired by the screenshots. Includes a login-style demo entry, dashboard, health insights, editable wellness check-ins, sleep/mood/stress trends, reminders, device connection status UI, and a rule-based explainable wellness score.

## Run locally
1. Install Node.js 20+.
2. Extract this project and open the folder in a terminal.
3. Run `npm install`
4. Run `npm run dev` and open the local URL Vite prints.
5. Run `npm run build` to verify production build.

## Deploy to GitHub and Vercel
1. Create a GitHub repository.
2. Upload the contents of this folder (not the ZIP itself).
3. In Vercel choose **Add New → Project**, import the repository.
4. Framework preset: Vite. Build command: `npm run build`. Output directory: `dist`.
5. Deploy. `api/insights.js` is a Vercel serverless endpoint.

## What is genuinely measurable here?
- Manual check-ins: mood 1–10, stress 0–10, sleep hours and optional resting heart rate.
- Trends are calculated from the entries stored in this browser.
- Risk labels are a transparent wellness heuristic, NOT a clinical or validated prediction.
- The demo sign-in is only a front-end mock. Do not enter real passwords.
- Device buttons are UI placeholders. A website cannot silently read Apple Watch, Samsung Galaxy Watch, or Noise data. Real sync requires vendor APIs / HealthKit / Health Connect, permissions, OAuth, and backend credentials.
- Fingerprint authentication, Google/Apple sign-in, email delivery, real push notifications and multi-device sync need provider setup and HTTPS. The “reminder” is an in-app browser notification if permission is granted.
- Browser storage is local to this browser/device. For real accounts and durable private data, connect Supabase/Firebase and implement server-side authentication, row-level security, and privacy policy.

## API
`POST /api/insights` accepts `{stress, mood, sleepHours, restingHeartRate}` and returns an explainable demo summary. Input validation is included. This endpoint is not a medical model.

## Safety
NeuroSense is a wellness tracker, not a medical device. It cannot diagnose burnout, depression, anxiety or any condition. If you feel unsafe or need urgent help, contact local emergency services or a qualified professional.
