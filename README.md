# Resume Sender

Sign in with Google, paste up to 50 recruiter emails, write one subject and message, attach your PDF resume.
The app sends **one separate email per recipient** from your own Gmail, with a delay between sends.

- Frontend: React + Vite (`client/`)
- Backend: Node.js + Express + MongoDB (`server/`)
- Login: Google OAuth. The same sign-in connects Gmail sending (scope `gmail.send` only).
- Only emails listed in `ALLOWED_EMAILS` can sign in.
- Logs: `logs/app-DATE.log` and `logs/error-DATE.log` (JSON, rotated, tokens and message text never logged).

## 1. Google Cloud setup (once)

1. console.cloud.google.com: create a project, then enable **Gmail API**.
2. **OAuth consent screen**: External. Add the scope `.../auth/gmail.send`. Add your Gmail as a **test user**.
3. **Credentials**: Create **OAuth client ID**, type **Web application**.
   - Authorized redirect URIs:
     - `http://localhost:5173/api/auth/google/callback` (local)
     - `https://YOUR-DOMAIN/api/auth/google/callback` (production)
4. Copy the client ID and secret into `server/.env`.

Note: while the consent screen is in **Testing**, Google expires refresh tokens after 7 days.
When that happens the app shows "Sign in with Google again". Moving the consent screen to
**In production** removes the 7-day limit (you will see an "unverified app" warning that you can click through as the owner).

## 2. Run locally

```bash
cp server/.env.example server/.env      # then fill in the values
# generate JWT_SECRET, COOKIE_SECRET, ENCRYPTION_KEY (run 3 times):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

cd server && npm install && npm run dev      # terminal 1 (port 5000)
cd client && npm install && npm run dev      # terminal 2 (port 5173)
```

Open http://localhost:5173

## 3. Deploy (one service: Render, Railway, or any Node host)

The Express server also serves the built React app, so there is one URL and no CORS.

- Build command: `npm run build`
- Start command: `npm start`
- Environment variables: everything in `server/.env.example`, with:
  - `NODE_ENV=production`
  - `APP_URL=https://YOUR-DOMAIN`
  - `GOOGLE_REDIRECT_URI=https://YOUR-DOMAIN/api/auth/google/callback`
  - `MONGODB_URI` from MongoDB Atlas
- Use a host that keeps the process running (Render/Railway/VPS). Do not use serverless (Vercel functions),
  because sending runs in the background for a few minutes.
- Persistent disk is optional. Without it, log files reset on redeploy (console logs still appear in the host dashboard).

## Safety rules built in

- Max 50 recipients per send, 100 emails per rolling 24 hours (change in `.env`).
- One send at a time. 2.5 to 3.5 second random delay between emails.
- Each recipient is sent once: retry only touches failed or pending ones.
- If the server restarts mid-send, the in-flight email is marked failed ("check your Sent folder") instead of being silently resent.
- Refresh tokens are AES-256-GCM encrypted in MongoDB. The PDF is stored in MongoDB until you delete the send.
