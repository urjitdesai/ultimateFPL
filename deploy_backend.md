# Backend deployment

The Express backend is deployed independently from Firebase Hosting as a
public Google Cloud Run service using `backend/Dockerfile`.

```text
Firebase Hosting   React/Vite frontend
Cloud Run Service  Express backend API
Cloud Run Job      Fixture synchronization and scoring
Firestore/Auth     Shared Firebase data and authentication
```

The browser must be able to invoke the Cloud Run service publicly. Protected
application endpoints continue to require and verify Firebase ID tokens.

## 1. Configure Google Cloud

Run the commands from the repository root. Google Cloud Shell can be used if
the `gcloud` CLI is not installed locally.

The verified production Firestore database is `(default)` in `us-east4`.
Firestore locations cannot be changed after creation, so the examples also use
`us-east4` for Cloud Run and Artifact Registry to minimize application latency.

```powershell
$PROJECT_ID = "predictionspremierleague-93b85"
$FIRESTORE_DATABASE_ID = "(default)"
$FIRESTORE_LOCATION = "us-east4"
$REGION = "us-east4"
$SERVICE = "predictions-api"
$REPOSITORY = "predictions-premier-league"
$IMAGE_TAG = git rev-parse --short HEAD
$IMAGE = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/backend:$IMAGE_TAG"

gcloud auth login
gcloud config set project $PROJECT_ID
```

Confirm that `gcloud` is using the production project before creating anything:

```powershell
if ((gcloud config get-value project).Trim() -ne $PROJECT_ID) {
  throw "gcloud is not targeting $PROJECT_ID"
}
```

Confirm that the production Firestore database is in the expected location:

```powershell
$ACTUAL_FIRESTORE_LOCATION = gcloud firestore databases describe `
  --database=$FIRESTORE_DATABASE_ID `
  --format="value(locationId)"

if ($ACTUAL_FIRESTORE_LOCATION -ne $FIRESTORE_LOCATION) {
  throw "Expected Firestore in $FIRESTORE_LOCATION but found $ACTUAL_FIRESTORE_LOCATION"
}

$ACTUAL_FIRESTORE_LOCATION
```

Cloud Run requires the Firebase project to be linked to an active Cloud Billing
account, which upgrades it to the Blaze plan. Choose the intended billing
account, set a budget alert, and then link it once:

```powershell
gcloud billing accounts list
gcloud billing projects link $PROJECT_ID `
  --billing-account=YOUR_BILLING_ACCOUNT_ID

gcloud billing projects describe $PROJECT_ID
```

Do not continue until `billingEnabled` is `true`.

In the Firebase console for `predictionspremierleague-93b85`, complete these
production-only checks before accepting users:

1. Enable Email/Password and Google under Authentication > Sign-in method.
2. Confirm `predictions-premierleague.web.app` is an authorized domain.
3. Keep `localhost` out of the production authorized-domain list.
4. Keep Firestore client rules deny-by-default. This app reads and writes
   Firestore through the authenticated Cloud Run service, whose Admin SDK uses
   IAM rather than browser security rules.
5. Configure production email templates and a production support email.

## 2. Enable the required services

```powershell
gcloud services enable `
  run.googleapis.com `
  cloudbuild.googleapis.com `
  artifactregistry.googleapis.com `
  secretmanager.googleapis.com `
  firestore.googleapis.com
```

## 3. Create the container repository

Create the Artifact Registry repository once:

```powershell
gcloud artifacts repositories create $REPOSITORY `
  --repository-format=docker `
  --location=$REGION
```

If the repository already exists, skip this step.

## 4. Create the production provider secret

In Google Cloud Console:

1. Open Secret Manager.
2. Create a secret named `football-data-token`.
3. Add the production Footballdata.io token as its value.

Never put this token in Git, frontend variables, the container image, or a
saved deployment command.

## 5. Create the API service account

```powershell
$API_SERVICE_ACCOUNT = "predictions-api@$PROJECT_ID.iam.gserviceaccount.com"

gcloud iam service-accounts create predictions-api `
  --display-name="Predictions Premier League API"

gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:$API_SERVICE_ACCOUNT" `
  --role="roles/datastore.user"

gcloud secrets add-iam-policy-binding football-data-token `
  --member="serviceAccount:$API_SERVICE_ACCOUNT" `
  --role="roles/secretmanager.secretAccessor"
```

Cloud Run uses this identity to access Firestore through Application Default
Credentials. Do not upload or configure `firebase-service-account-key.json`.

If the service account already exists, skip its creation and verify that the
two required role bindings are present.

## 6. Build and publish the backend image

From the repository root:

```powershell
gcloud builds submit backend `
  --tag=$IMAGE `
  --region=$REGION
```

Cloud Build uses `backend/Dockerfile` and publishes the image to Artifact
Registry. Record the immutable image digest after the build completes.

## 7. Deploy the API

For the initial rollout, use request-driven scoring until the scheduled Cloud
Run Job has been deployed and initialized successfully:

```powershell
$ENVIRONMENT_VARIABLES = "NODE_ENV=production,FRONTEND_URL=https://predictions-premierleague.web.app,TRUST_PROXY_HOPS=1,FIREBASE_PROJECT_ID=$PROJECT_ID,FIREBASE_DATABASE_ID=$FIRESTORE_DATABASE_ID,BACKEND_API=https://footballdata.io/api/v1,FOOTBALLDATA_IO_LEAGUE_ID=15,FOOTBALLDATA_IO_SEASON_YEAR=20262027,SCORING_MODE=request_driven,SCORING_JOB_ENABLED=false"

gcloud run deploy $SERVICE `
  --image=$IMAGE `
  --region=$REGION `
  --port=4000 `
  --service-account=$API_SERVICE_ACCOUNT `
  --allow-unauthenticated `
  --set-env-vars=$ENVIRONMENT_VARIABLES `
  --set-secrets="BACKEND_API_TOKEN=football-data-token:latest" `
  --max-instances=10
```

The frontend origin is intentionally restricted to
`https://predictions-premierleague.web.app` by the production CORS configuration.

## 8. Verify the deployed API

Capture the Cloud Run service URL:

```powershell
$API_URL = gcloud run services describe $SERVICE `
  --region=$REGION `
  --format="value(status.url)"

$API_URL
```

Verify the public endpoints:

```powershell
Invoke-RestMethod "$API_URL/health"
Invoke-RestMethod "$API_URL/ready"
Invoke-RestMethod "$API_URL/api/v1/teams"
```

If the service fails to start or a request fails, inspect its logs:

```powershell
gcloud run services logs read $SERVICE `
  --region=$REGION `
  --limit=50
```

Do not proceed until the health, readiness, and team catalog requests succeed.

## 9. Connect and redeploy the frontend

Update the ignored `backend/env/prod.env` file with the actual service URL:

```dotenv
FRONTEND_API_BASE_URL=https://ACTUAL_CLOUD_RUN_SERVICE_URL/api/v1
```

Confirm that the value does not contain `localhost` or the placeholder domain,
then rebuild and deploy Firebase Hosting:

```powershell
npm run deploy:frontend:production
```

Test registration, login, password reset, teams, predictions, wagers, and
league pages from `https://predictions-premierleague.web.app`.

## 10. Deploy scheduled scoring

The API service does not execute scheduled scoring by itself. After the API is
healthy:

1. Reuse the same image to deploy the private
   `predictions-scoring` Cloud Run Job.
2. Execute the job manually once.
3. Verify its sync run, released lease, finalized gameweek, user aggregates,
   wallets, and league snapshots in Firestore.
4. Create the authenticated five-minute Cloud Scheduler trigger.
5. Change the API service to `SCORING_MODE=scheduled`.

The job and Scheduler commands are documented in
`backend/CLOUD_RUN_SCORING.md`.

Use this rollout order:

```text
Deploy API in request-driven mode
→ Verify API health and core operations
→ Deploy and manually initialize the scoring job
→ Enable its Cloud Scheduler trigger
→ Switch the API to scheduled scoring
→ Put the real Cloud Run URL in prod.env
→ Redeploy the frontend
→ Complete production-domain smoke tests
```

## 11. Release record and rollback

Record the following for every backend release:

- Git commit.
- Artifact Registry image URL and digest.
- Cloud Run service revision.
- Cloud Run Job revision.
- Scheduler job name.
- Firebase Hosting release.
- Release timestamp and operator.

To roll back the API, route traffic to the previously verified Cloud Run
revision. To roll back the frontend, restore the previous Firebase Hosting
release. Test both rollback procedures before the public launch.
