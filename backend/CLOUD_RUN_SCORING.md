# Cloud Run scoring job

The same container runs the API and the private `sync-score` job. Development
and production use separate Google Cloud projects, service accounts, secrets,
jobs, and Scheduler triggers.

Local development execution reads `backend/env/dev.env`:

```powershell
npm run job:sync-score
```

Local production-mode recovery reads `backend/env/prod.env` after a build:

```powershell
npm run build
npm run job:sync-score:prod
```

The deployed job continues to use variables and Secret Manager values injected
by Cloud Run; it does not require an environment file in the image.

`SCORING_JOB_ENABLED=false` exits before Firebase or the provider is loaded.
Set `SCORING_EXPECTED_PROJECT_ID` to the exact `FIREBASE_PROJECT_ID`; the job
refuses to start if they differ.

## Build and publish

Run these commands once for each environment, replacing uppercase values.

```bash
gcloud config set project PROJECT_ID
gcloud services enable artifactregistry.googleapis.com run.googleapis.com cloudscheduler.googleapis.com secretmanager.googleapis.com firestore.googleapis.com cloudbuild.googleapis.com
gcloud artifacts repositories create ultimatefpl --repository-format=docker --location=REGION
gcloud builds submit backend --tag REGION-docker.pkg.dev/PROJECT_ID/ultimatefpl/backend:IMAGE_TAG
```

Create the provider secret and job identity:

```bash
printf '%s' 'FOOTBALLDATA_TOKEN' | gcloud secrets create football-data-token --data-file=-
gcloud iam service-accounts create ultimatefpl-scoring
gcloud projects add-iam-policy-binding PROJECT_ID --member=serviceAccount:ultimatefpl-scoring@PROJECT_ID.iam.gserviceaccount.com --role=roles/datastore.user
gcloud secrets add-iam-policy-binding football-data-token --member=serviceAccount:ultimatefpl-scoring@PROJECT_ID.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor
```

## Create the job

Use `JOB_NAME=ultimatefpl-score-development` with `NODE_ENV=development` in the
development project. Use `JOB_NAME=ultimatefpl-score-production` with
`NODE_ENV=production` in production.

```bash
gcloud run jobs create JOB_NAME \
  --image=REGION-docker.pkg.dev/PROJECT_ID/ultimatefpl/backend:IMAGE_TAG \
  --region=REGION \
  --service-account=ultimatefpl-scoring@PROJECT_ID.iam.gserviceaccount.com \
  --command=node \
  --args=dist/jobs/sync-score.js \
  --tasks=1 \
  --max-retries=2 \
  --task-timeout=15m \
  --set-secrets=BACKEND_API_TOKEN=football-data-token:latest \
  --set-env-vars=NODE_ENV=ENVIRONMENT,FIREBASE_PROJECT_ID=PROJECT_ID,FIREBASE_DATABASE_ID='(default)',BACKEND_API=https://footballdata.io/api/v1,FOOTBALLDATA_IO_LEAGUE_ID=15,FOOTBALLDATA_IO_SEASON_YEAR=SEASON_YEAR,SCORING_MODE=scheduled,SCORING_JOB_ENABLED=true,SCORING_EXPECTED_PROJECT_ID=PROJECT_ID,SCORING_BATCH_SIZE=200,SCORING_LEASE_MS=1200000,SCORING_RUN_RETENTION_DAYS=30,SYNC_LIVE_INTERVAL_MS=300000,SYNC_RECENT_INTERVAL_MS=1800000,SYNC_IDLE_INTERVAL_MS=86400000,FRONTEND_URL=FRONTEND_ORIGIN,TRUST_PROXY_HOPS=1
```

Cloud Run uses Application Default Credentials from `ultimatefpl-scoring`; do
not deploy a Firebase private key.

## Schedule the job

```bash
gcloud iam service-accounts create ultimatefpl-scheduler
gcloud run jobs add-iam-policy-binding JOB_NAME --region=REGION --member=serviceAccount:ultimatefpl-scheduler@PROJECT_ID.iam.gserviceaccount.com --role=roles/run.invoker
gcloud scheduler jobs create http JOB_NAME-trigger \
  --location=REGION \
  --schedule='*/5 * * * *' \
  --time-zone=UTC \
  --uri=https://run.googleapis.com/v2/projects/PROJECT_ID/locations/REGION/jobs/JOB_NAME:run \
  --http-method=POST \
  --oauth-service-account-email=ultimatefpl-scheduler@PROJECT_ID.iam.gserviceaccount.com
```

The container starts every five minutes, but its adaptive policy contacts the
provider only every five minutes around live fixtures, every 30 minutes for
recent result verification, and daily otherwise.

## Backfill and rollout

1. Execute the development job manually with `gcloud run jobs execute
   ultimatefpl-score-development --region=REGION --wait`.
2. Verify `syncRuns`, `scoringRuns`, gameweek settlement fields, user
   aggregates, wallets, and league snapshots in Firestore.
3. Set the development API to `SCORING_MODE=scheduled` and complete an
   end-to-end gameweek test.
4. Repeat in production before switching the production API to scheduled mode.

Disable scoring without deleting the Scheduler trigger:

```bash
gcloud run jobs update JOB_NAME --region=REGION --update-env-vars=SCORING_JOB_ENABLED=false
```

Configure Firestore TTL on `syncRuns.expiresAt` and `scoringRuns.expiresAt` in
the Firebase or Google Cloud console. Create Cloud Monitoring alerts for failed
job executions and for missing successful sync runs during a match window.
