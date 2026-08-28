# Environment configuration

Create the ignored runtime files from the committed examples:

```powershell
Copy-Item env/dev.env.example env/dev.env
Copy-Item env/prod.env.example env/prod.env
```

`dev.env` and `prod.env` are intentionally ignored by Git and excluded from
the Docker build context because they may contain credentials.

The backend checks `APP_ENV`, then `NODE_ENV`. `prod` and `production` select
`prod.env`; every other value selects `dev.env`. Variables supplied by the
shell, CI, or Cloud Run take precedence over file values.

Vite uses `dev.env` in development mode and `prod.env` for production builds.
Only the explicitly mapped Firebase web values and `FRONTEND_API_BASE_URL` are
embedded in the browser bundle.

Common commands:

```powershell
# Development server and development scoring job
npm run dev
npm run job:sync-score

# Locally run the compiled server with production configuration
npm run build
npm start
```

Cloud Run should inject production configuration and secrets directly. The
container does not copy either environment file into its image.
