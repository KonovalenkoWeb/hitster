# Deploy To Render + one.com Subdomain

## 1) Create web service on Render
- Push this repo to GitHub.
- In Render: `New +` -> `Web Service` -> connect the repo.
- Render can read `render.yaml` automatically.

## 2) Set environment variables in Render
- `DATABASE_URL`: your Neon/Postgres connection string.
- `SESSION_SECRET`: long random string.
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI`: set temporarily to your Render URL callback:
  - `https://<render-service>.onrender.com/auth/spotify/callback`

## 3) Run DB schema push (one-time after first deploy)
- In Render shell for the service, run:
```bash
npm run db:push
```

## 4) Optional: seed songs on Render
```bash
npm run seed:songs:playlist -- --playlist='https://open.spotify.com/playlist/<ID>' --catalog='most_well_known_songs_ever'
```

## 5) Point one.com subdomain to Render
- In one.com DNS:
  - Create subdomain, e.g. `game.yourdomain.com`.
  - Add `CNAME`:
    - Host: `game`
    - Points to: `<render-service>.onrender.com`
- Wait for DNS propagation.

## 6) Add custom domain in Render
- Render service -> `Settings` -> `Custom Domains`.
- Add `game.yourdomain.com`.
- Wait until SSL is active.

## 7) Final Spotify callback
- Update `SPOTIFY_REDIRECT_URI` in Render:
  - `https://game.yourdomain.com/auth/spotify/callback`
- In Spotify Developer Dashboard, add same callback URI.

## 8) Redeploy and verify
- Trigger deploy.
- Check:
  - `/api/spotify/status`
  - Connect Spotify flow
  - Online game start/join
