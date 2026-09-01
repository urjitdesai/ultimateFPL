# Cloud Run scoring job

The same container runs the API and the private `sync-score` job. Development
and production use separate Google Cloud projects, service accounts, secrets,
jobs, and Scheduler triggers.

Local development execution reads `backend/env/local.env` and therefore uses
the development Firebase data with localhost URLs:

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

## Production setup for `predictionspremierleague-93b85` (PowerShell)

Scheduled scoring uses two Cloud Run resources built from the same backend
image. The API service continues to handle HTTP traffic, while a Cloud Run Job
overrides the image command with `node dist/jobs/sync-score.js`, synchronizes
fixtures, scores completed matches, materializes league snapshots, and exits.
Cloud Scheduler starts that job every five minutes.

| Resource | `SCORING_MODE` | `SCORING_JOB_ENABLED` |
| --- | --- | --- |
| `predictions-api` service | `scheduled` | `false` |
| `predictions-scoring` job | `scheduled` | `true` |

The following commands create cloud resources and the manual execution can
write production Firestore data. Run them from PowerShell with an account that
can manage Cloud Run, Cloud Scheduler, service accounts, project IAM, and Secret
Manager IAM.

### 1. Set production variables

```powershell
$PROJECT_ID = "predictionspremierleague-93b85"
$REGION = "us-east4"
$JOB = "predictions-scoring"
$TRIGGER = "$JOB-trigger"

$SCORING_SA = "predictions-scoring@${PROJECT_ID}.iam.gserviceaccount.com"
$SCHEDULER_SA = "predictions-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"

$IMAGE = (gcloud run services describe predictions-api `
  --project=$PROJECT_ID `
  --region=$REGION `
  --format="value(spec.template.spec.containers[0].image)").Trim()
```

This deliberately reuses the exact image currently deployed to the API
service. Future backend deployments update both resources through
`deployment/deploy-backend.sh` after the job exists.

### 2. Enable APIs and create the scoring identity

```powershell
gcloud services enable `
  run.googleapis.com `
  cloudscheduler.googleapis.com `
  secretmanager.googleapis.com `
  --project=$PROJECT_ID

gcloud iam service-accounts create predictions-scoring `
  --project=$PROJECT_ID `
  --display-name="Predictions Premier League scoring job"

gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:$SCORING_SA" `
  --role="roles/datastore.user"

gcloud secrets add-iam-policy-binding football-data-token `
  --project=$PROJECT_ID `
  --member="serviceAccount:$SCORING_SA" `
  --role="roles/secretmanager.secretAccessor"
```

### 3. Create the scoring job

The verified production Firestore database ID is `(default)`.

```powershell
$JOB_ENV = "NODE_ENV=production,FIREBASE_PROJECT_ID=predictionspremierleague-93b85,FIREBASE_DATABASE_ID=(default),BACKEND_API=https://footballdata.io/api/v1,FOOTBALLDATA_IO_LEAGUE_ID=15,FOOTBALLDATA_IO_SEASON_YEAR=20262027,SCORING_MODE=scheduled,SCORING_JOB_ENABLED=true,SCORING_EXPECTED_PROJECT_ID=predictionspremierleague-93b85,SCORING_BATCH_SIZE=200,SCORING_LEASE_MS=1200000,SCORING_RUN_RETENTION_DAYS=30,SYNC_LIVE_INTERVAL_MS=300000,SYNC_RECENT_INTERVAL_MS=1800000,SYNC_IDLE_INTERVAL_MS=86400000,FRONTEND_URL=https://predictions-premierleague.web.app,TRUST_PROXY_HOPS=1"

gcloud run jobs create $JOB `
  --project=$PROJECT_ID `
  --region=$REGION `
  --image=$IMAGE `
  --service-account=$SCORING_SA `
  --command=node `
  --args=dist/jobs/sync-score.js `
  --tasks=1 `
  --max-retries=2 `
  --task-timeout=15m `
  --set-secrets="BACKEND_API_TOKEN=football-data-token:latest" `
  --set-env-vars=$JOB_ENV
```

### 4. Test the job before scheduling it

The following execution synchronizes fixtures and may score or finalize
production gameweeks:

```powershell
gcloud run jobs execute $JOB `
  --project=$PROJECT_ID `
  --region=$REGION `
  --wait

gcloud run jobs executions list `
  --project=$PROJECT_ID `
  --region=$REGION `
  --job=$JOB
```

Do not switch the API to scheduled mode until this execution completes with a
`SUCCEEDED` status. The job also records its result in the `syncRuns`
collection and writes execution output to Cloud Logging.

### 5. Create the Scheduler trigger

```powershell
gcloud iam service-accounts create predictions-scheduler `
  --project=$PROJECT_ID `
  --display-name="Predictions Premier League scheduler"

gcloud run jobs add-iam-policy-binding $JOB `
  --project=$PROJECT_ID `
  --region=$REGION `
  --member="serviceAccount:$SCHEDULER_SA" `
  --role="roles/run.invoker"

$RUN_URI = "https://run.googleapis.com/v2/projects/$PROJECT_ID/locations/$REGION/jobs/${JOB}:run"

gcloud scheduler jobs create http $TRIGGER `
  --project=$PROJECT_ID `
  --location=$REGION `
  --schedule="*/5 * * * *" `
  --time-zone="UTC" `
  --uri=$RUN_URI `
  --http-method=POST `
  --message-body="{}" `
  --oauth-service-account-email=$SCHEDULER_SA `
  --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform"
```

The trigger starts the container every five minutes. The adaptive sync policy
still limits provider calls to every five minutes around live fixtures, every
30 minutes for recent result verification, and daily while idle.

### 6. Switch the API service to scheduled mode

Keep the job flag disabled on the API service; only the Cloud Run Job should
have `SCORING_JOB_ENABLED=true`.

```powershell
gcloud run services update predictions-api `
  --project=$PROJECT_ID `
  --region=$REGION `
  --update-env-vars="SCORING_MODE=scheduled,SCORING_JOB_ENABLED=false"
```

Force one Scheduler invocation and confirm that it creates a successful Cloud
Run execution:

```powershell
gcloud scheduler jobs run $TRIGGER `
  --project=$PROJECT_ID `
  --location=$REGION

gcloud run jobs executions list `
  --project=$PROJECT_ID `
  --region=$REGION `
  --job=$JOB
```

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
development project. Use `JOB_NAME=predictions-scoring` with
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
  --set-env-vars=NODE_ENV=ENVIRONMENT,FIREBASE_PROJECT_ID=PROJECT_ID,FIREBASE_DATABASE_ID=DATABASE_ID,BACKEND_API=https://footballdata.io/api/v1,FOOTBALLDATA_IO_LEAGUE_ID=15,FOOTBALLDATA_IO_SEASON_YEAR=SEASON_YEAR,SCORING_MODE=scheduled,SCORING_JOB_ENABLED=true,SCORING_EXPECTED_PROJECT_ID=PROJECT_ID,SCORING_BATCH_SIZE=200,SCORING_LEASE_MS=1200000,SCORING_RUN_RETENTION_DAYS=30,SYNC_LIVE_INTERVAL_MS=300000,SYNC_RECENT_INTERVAL_MS=1800000,SYNC_IDLE_INTERVAL_MS=86400000,FRONTEND_URL=FRONTEND_ORIGIN,TRUST_PROXY_HOPS=1
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
