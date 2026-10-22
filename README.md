# NeuroSense

Wellness app: login, dashboard (stress, mood, heart rate, sleep, AI insights), health insights (burnout risk, 24h predictions, weekly trends, suggestions) and device connection.

## Deploy on Vercel
1. Push this folder to a GitHub repo (the folder containing `package.json` and `vercel.json` must be the repo root).
2. Vercel > Add New > Project > import the repo. Framework preset: Other. Leave build settings empty.
3. Project > Storage > Marketplace > Upstash Redis (free) > create and connect it to the project. This adds the KV_REST_API_URL / KV_REST_API_TOKEN variables.
4. Project > Settings > Environment Variables: add SECRET = a long random string.
5. Deploy (or Redeploy after adding the variables).

CLI alternative: `npm i -g vercel`, then `vercel`, then `vercel --prod`.

## Run locally
    node server/server.js        # file storage, needs Node 18+, no npm install required
    open http://localhost:3000   # set SECRET=... and PORT=... env vars in production

## Structure
    api/[...path].js     Vercel serverless entry
    server/store.js      Storage: Upstash Redis on Vercel, JSON file locally
    vercel.json          Vercel config
    server/server.js     REST API, auth (scrypt + signed tokens), JSON storage, static hosting
    server/analytics.js  Algorithms: stress score, burnout risk, predictions, trends, suggestions, demo data
    public/index.html    App shell
    public/css/styles.css
    public/js/api.js     API client
    public/js/charts.js  SVG ring / area / bar charts
    public/js/devices.js Device connection, live data push, Web Bluetooth heart-rate
    public/js/app.js     Screens and actions (auth, dashboard, insights, devices, profile, breathing, reminders)

## What is real and what is demo
- Real: email/password accounts, hashing, tokens, data storage, all analytics, mood/sleep logging, reminders (browser notifications), breathing exercise, fingerprint unlock (WebAuthn, device-level gate), BLE heart-rate sensors (Web Bluetooth).
- Simulated: Fitbit / Samsung / Noise / Apple Watch connections generate demo data. Their real data needs vendor APIs (Fitbit Web API OAuth, Samsung Health, Apple HealthKit via a native iOS app).
- Demo only: Google/Apple buttons create a demo account. Real sign-in needs OAuth client IDs. "Forgot password" needs an email service.
- Storage: Upstash Redis on Vercel (one JSON document per user). For many users, move to PostgreSQL/MongoDB. Vercel serves over HTTPS.
- The login rate limiter is per serverless instance, so it is only a light safeguard.
