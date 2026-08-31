# ultimateFPL

## Environments

| Environment | Firebase Hosting | Configuration |
| --- | --- | --- |
| Local | `http://localhost:5173` | `backend/env/local.env` (development Firebase data) |
| Development | `https://ultimatefpl-cffba.web.app` | `backend/env/dev.env` |
| Production | `https://ultimate-fpl.web.app` | `backend/env/prod.env` |

Run the frontend and backend locally from separate terminals:

```powershell
npm --prefix backend run dev
npm --prefix frontend run dev
```

Deploy the development frontend with:

```powershell
npm run deploy:frontend:development
```

Populate `backend/env/prod.env` with the separate production Firebase Web App
configuration and production Cloud Run API URL. Then deploy production with:

```powershell
npm install
npm --prefix frontend ci
npm exec firebase -- login
npm run deploy:frontend:production
```

The Firebase login is a one-time step on each deployment machine.
The deployment command works from either the repository root or the
`frontend` directory.

Each Firebase command runs the corresponding frontend build before deployment.
Both Hosting configurations publish `frontend/dist` and preserve the SPA
rewrite to `index.html`.

## Google sign-in

Before deploying Google sign-in, open Firebase Console for each target project,
go to **Authentication > Sign-in method**, and enable the Google provider. Add
any custom frontend hostname under **Authentication > Settings > Authorized
domains**. The Firebase Hosting domains configured above use the same Firebase
web-app credentials as their corresponding environments.

New Google users are sent to `/complete-profile` to choose their favorite team.
Returning Google users with an existing player profile go directly to the
dashboard.
