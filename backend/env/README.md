# Environment configuration

Create the ignored runtime files from the committed examples:

```powershell
Copy-Item env/dev.env.example env/dev.env
Copy-Item env/prod.env.example env/prod.env
Copy-Item env/local.env.example env/local.env
```

`local.env`, `dev.env`, and `prod.env` are intentionally ignored by Git and
excluded from the Docker build context because they may contain credentials.

`local.env` connects to the development Firebase project but uses
`http://localhost:5173` and `http://localhost:4000`. `dev.env` configures the
deployed development site at `https://ultimatefpl-cffba.web.app`.
`prod.env` configures the separate production site at
`https://ultimate-fpl.web.app` and must use separate production Firebase
credentials.

The backend checks `APP_ENV` first. `local`, `dev`/`development`, and
`prod`/`production` select their corresponding files. With no selector, local
commands use `local.env`; a host-provided `NODE_ENV=production` selects
`prod.env`. Variables supplied by the shell, CI, or Cloud Run take precedence.

Vite uses `local.env` for `npm run dev`, `dev.env` for development builds, and
`prod.env` for production builds. Only the explicitly mapped Firebase web
values and `FRONTEND_API_BASE_URL` are embedded in the browser bundle.

Common commands:

```powershell
# Local server and scoring job (development Firebase data)
npm run dev
npm run job:sync-score

# Build the frontend for each deployed environment
npm --prefix ../frontend run build:development
npm --prefix ../frontend run build:production

# Locally run the compiled server with production configuration
npm run build
npm start
```

Cloud Run should inject production configuration and secrets directly. The
container does not copy either environment file into its image.
