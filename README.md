# Goals FC Trial Portal

A free-to-host trial registration site with an admin dashboard.

## What's inside
- `public/index.html` — public site (trial info + registration form)
- `public/admin.html` — admin dashboard (login, review players, export CSV)
- `server.js` — Express backend serving the site + a small JSON-file API
- `data/players.json` — created automatically; stores registrations

## Run locally
```
npm install
npm start
```
Then open http://localhost:3000

## Admin password
Default password is `goalsfc2026`. Change it by setting the
`ADMIN_PASSWORD` environment variable before starting the server, e.g.:
```
ADMIN_PASSWORD=your-new-password npm start
```

## Deploying for free (Render)
1. Push this folder to a GitHub repository.
2. Go to https://render.com, sign up free, click **New +** → **Web Service**.
3. Connect your GitHub repo.
4. Settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Under **Environment**, add a variable `ADMIN_PASSWORD` set to your own password.
6. Click **Create Web Service**. Render gives you a free URL like
   `https://your-app.onrender.com` — that's your live site.

Note: Render's free tier "spins down" after 15 minutes of no traffic and
takes ~30-60 seconds to wake back up on the next visit — normal for free
hosting, no action needed.
