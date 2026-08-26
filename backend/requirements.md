# Ultimate Fantasy League — Product and Engineering Requirements

**Document status:** MVP specification  
**Last updated:** August 6, 2026  
**Target implementation:** React frontend + Node.js/Express backend  
**Primary competition:** English Premier League only

---

## 1. Product Summary

Ultimate Fantasy League is an independent Premier League score-prediction game.

Users will:

1. Create an account.
2. Select their favorite Premier League team.
3. Create or join private leagues with friends.
4. Predict the score of every Premier League fixture before kickoff.
5. Earn points after each fixture is completed.
6. Compete on gameweek and season-long leaderboards.

The application will use Footballdata.io as the external football-data provider. Footballdata.io will provide Premier League metadata, seasons, teams, matches, gameweek information, kickoff times, match statuses, and final scores. Ultimate Fantasy League will own all users, leagues, predictions, scoring rules, and leaderboard data.

---

## 2. MVP Goals

The MVP must support:

- Firebase Authentication email/password account creation and login.
- Selection of one favorite Premier League team.
- Automatic Overall, team supporter, and gameweek cohort leagues, plus private leagues using one uniform league model.
- Joining a league using an invite code.
- Display of Premier League fixtures grouped by gameweek.
- Score predictions for every fixture.
- A 100-point starting total with one outcome wager per gameweek funded from that total.
- Per-fixture prediction locking at kickoff.
- Automatic scoring after final results are available.
- Gameweek and season leaderboards for private leagues.
- Responsive desktop and mobile interfaces.
- Server-side integration with Footballdata.io.
- Scheduled synchronization of fixtures and results.

The MVP must not require player-level statistics, lineups, goal scorers, or live commentary.

---

## 3. Recommended Technology Stack

These are recommended defaults and may be changed before implementation.

### Frontend

- React 19+
- TypeScript
- Vite
- React Router
- TanStack Query for server-state fetching and caching
- Tailwind CSS for styling
- React Hook Form
- Zod for form validation
- Firebase Web SDK for authentication only
- Vitest and React Testing Library

### Backend

- Node.js 20+
- Express
- TypeScript
- Firebase Admin SDK
- Cloud Firestore as the primary database
- Firebase Authentication for user identity
- Zod for request and environment validation
- Google Cloud Scheduler for recurring synchronization
- Google Cloud Tasks for durable background work when required
- Jest or Vitest + Supertest for API tests

### Firebase responsibilities

Use Firebase for:

- **Cloud Firestore:** application data
- **Firebase Authentication:** email/password authentication and ID tokens
- **Firebase Emulator Suite:** local development and automated tests
- **Firebase Hosting:** optional frontend deployment
- **Cloud Functions or Cloud Run:** optional Express API deployment
- **Cloud Scheduler:** football-data synchronization schedules
- **Cloud Tasks:** retryable fixture-scoring and synchronization jobs

The React client may communicate directly with Firebase Authentication. All Cloud Firestore business data must be read and written through the Express backend for the MVP. This keeps prediction locking, scoring, league permissions, and Footballdata.io synchronization authoritative on the server.

### Infrastructure

Recommended MVP deployment:

- Frontend: Firebase Hosting, Vercel, or Cloudflare Pages
- Backend: Google Cloud Run or Firebase Functions
- Database: Cloud Firestore
- Authentication: Firebase Authentication
- Scheduled jobs: Google Cloud Scheduler
- Durable asynchronous jobs: Google Cloud Tasks when needed
- Error monitoring: Sentry or Google Cloud Error Reporting
- Application logs: structured JSON logs in Google Cloud Logging
- CI: GitHub Actions

Use Application Default Credentials in deployed Google Cloud environments. Use a dedicated service account only for local development or non-Google hosting, and never commit its credentials.

---


## 4. External Football Data Provider

### Provider

Use the Footballdata.io v1 API through the Express backend only.

Base URL:

```text
https://footballdata.io/api/v1
```

Authentication header:

```text
Authorization: Bearer <FOOTBALLDATA_IO_API_KEY>
```

Never expose the API key in frontend code, browser network calls, public repositories, or client-side environment variables.

### Competition and season discovery

Do not hard-code a Premier League ID or season ID based only on documentation examples. Footballdata.io uses public numeric `league_id` and `season_id` values, and the backend must discover and validate them before production use.

Recommended discovery sequence:

```http
GET /leagues?country=England&q=Premier%20League&limit=25
GET /leagues/{league_id}/seasons
GET /account/usage
GET /meta/status
GET /meta/coverage
```

After the product owner verifies the matching Premier League and active season, store their IDs in server-side configuration:

```env
FOOTBALLDATA_IO_BASE_URL=https://footballdata.io/api/v1
FOOTBALLDATA_IO_API_KEY=
FOOTBALLDATA_IO_LEAGUE_ID=
FOOTBALLDATA_IO_SEASON_ID=
```

The provider's public `season_id` is not necessarily the same as the season's starting year. Store both the provider season ID and the display year/name in the internal season document.

### Required Footballdata.io data

The application needs:

- Premier League identity and metadata
- Current Premier League season
- Premier League teams for that season
- Matches for the full season
- Provider match IDs
- Home and away teams
- Round and/or gameweek values
- Kickoff timestamps
- Match status
- Full-time home and away scores
- Postponement and rescheduling updates

Recommended provider calls:

```http
GET /leagues?country=England&q=Premier%20League&limit=25
GET /leagues/{league_id}/seasons
GET /leagues/{league_id}/teams?season_id={season_id}&page=1&limit=100
GET /leagues/{league_id}/matches?season_id={season_id}&page=1&limit=100
GET /matches?league_id={league_id}&season_id={season_id}&page=1&limit=100
GET /matches/{match_id}
GET /fixtures/upcoming?league_id={league_id}&season_id={season_id}&limit=100
GET /fixtures/results?league_id={league_id}&season_id={season_id}&limit=100
GET /account/usage
```

Use the league- or season-level match endpoint for the initial season import. Use filtered match and fixture endpoints for incremental synchronization.

List endpoints are paginated and their maximum page size is usually 100. The implementation must follow pagination metadata until every page has been processed; it must not assume the first response contains all 380 Premier League matches.

Footballdata.io does not expose a dedicated rounds endpoint in the documented public endpoint list. Build internal gameweek documents from each match's `game_week` and/or `round` fields. Prefer a numeric `game_week` when populated. Preserve the original provider round string for debugging and display fallback.

The implementation must tolerate missing, null, delayed, corrected, or plan-dependent fields. It must also tolerate a successful response containing an empty `data` array.

### Response and status normalization

Successful responses generally contain:

```ts
{
  success: true,
  data: unknown,
  meta?: {
    plan?: string;
    requests_used?: number;
    requests_limit?: number;
    coverage_note?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
    };
  };
}
```

Create an adapter that maps provider-specific status strings into internal states:

```ts
type NormalizedMatchStatus =
  | "SCHEDULED"
  | "LIVE"
  | "HALFTIME"
  | "COMPLETED"
  | "POSTPONED"
  | "CANCELLED"
  | "SUSPENDED"
  | "ABANDONED"
  | "UNKNOWN";
```

Preserve the raw provider status alongside the normalized status. Only settle predictions when the normalized status is `COMPLETED` and both final scores are present.

### Provider abstraction

Footballdata.io must be accessed through an interface so the external provider can be replaced later.

```ts
export type MatchPageRequest = {
  leagueId: number;
  seasonId: number;
  page: number;
  limit: number;
  from?: string;
  to?: string;
  status?: string;
};

export interface FootballDataProvider {
  findPremierLeague(): Promise<ExternalLeague | null>;
  getLeagueSeasons(leagueId: number): Promise<ExternalSeason[]>;
  getTeams(leagueId: number, seasonId: number): Promise<ExternalTeam[]>;
  getMatches(request: MatchPageRequest): Promise<ExternalMatchPage>;
  getMatch(matchId: number): Promise<ExternalMatch | null>;
  getAccountUsage(): Promise<ExternalUsage>;
}
```

Implement:

```ts
export class FootballDataIoProvider implements FootballDataProvider {
  // Footballdata.io-specific HTTP, pagination, validation, and mapping logic
}
```

Provider response objects must be validated and mapped into internal domain models. Do not expose raw provider payloads directly to the frontend.

### Official implementation references

- `https://footballdata.io/documentation/`
- `https://footballdata.io/documentation/leagues/`
- `https://footballdata.io/documentation/seasons/`
- `https://footballdata.io/documentation/matches/`
- `https://footballdata.io/documentation/fixtures/`
- `https://footballdata.io/documentation/rate-limits/`
- `https://footballdata.io/terms/`

---

## 5. Core Domain Concepts

### Season

Represents one Premier League season.

Example:

```text
2026–27
```

Fields should include:

- Internal ID
- Name
- Provider league ID
- Provider season ID
- Provider season year/name
- Start date
- End date
- Active flag

Only one season is active in the MVP.

### Gameweek

Represents a provider gameweek or round derived from match data, such as:

```text
Game Week 1
```

Fields should include:

- Internal ID
- Season ID
- Round number
- Provider gameweek value when available
- Provider round name when available
- Start time, derived from the earliest fixture
- End time, derived from the latest fixture
- Status: upcoming, active, complete

Do not assume that every gameweek contains exactly ten fixtures.

### Team

Represents a Premier League club.

Fields should include:

- Internal ID
- Provider team ID
- Name
- Short name or code when available
- Optional logo URL
- Active flag
- Season relationship

Club logos must be feature-flagged or replaceable with text/initials because API access does not necessarily grant the right to publish club trademarks.

### Fixture

Represents one Premier League match.

Fields should include:

- Internal ID
- Provider match ID, unique
- Season ID
- Gameweek ID
- Home team ID
- Away team ID
- Kickoff timestamp stored in UTC
- Provider status code
- Home score
- Away score
- Finalized timestamp
- Last synchronized timestamp

Provider match ID is the stable external identity. Do not derive fixture identity from the two teams and date.

### User

Firebase Authentication owns credentials and password handling. Cloud Firestore stores only the application profile.

Fields should include:

- Firebase Authentication UID, used as the Firestore document ID
- Email copy for display and administration
- Display name
- Favorite team ID
- Role: user or admin
- Active season ID
- Joined gameweek and eligibility timestamp
- Created and updated timestamps

Do not store password hashes in Cloud Firestore.

### League

The MVP has one league model with no league type or scoring-format discriminator. On backend startup, the app idempotently creates an Overall league, one supporter league for every active team, and one cohort league for every gameweek in the active season. New users automatically join Overall, the supporter league for their favorite team, and the gameweek league matching their first scoring-eligible gameweek. Private invite-code leagues use the same model. Wagers draw from the user's total points and are not a league format. There are no head-to-head leagues.

Fields should include:

- Internal ID
- Season ID
- Name
- Slug
- Owner user ID
- Invite code
- Created and updated timestamps

Every league uses the same score-prediction and leaderboard rules.

### League Membership

Fields should include:

- League ID
- User ID
- Role: owner, admin, member
- Joined timestamp

The combination of league ID and user ID must be unique.

### Prediction

Fields should include:

- Internal ID
- User ID
- Fixture ID
- Predicted home score
- Predicted away score
- Submitted timestamp
- Updated timestamp
- Locked timestamp
- Awarded points
- Scoring reason
- Scored timestamp
- Scoring-rule version

The combination of user ID and fixture ID must be unique.

A user makes only one prediction per fixture. Saving again before kickoff updates the existing prediction.

---

## 6. Authentication and Account Requirements

Use Firebase Authentication for identity and Cloud Firestore for the application profile.

The Firebase Authentication user ID (`uid`) is the canonical application user ID. Use the same value as the document ID for `users/{uid}`.

### Registration

A new user must provide:

- Display name
- Email
- Password
- Favorite Premier League team

Recommended registration flow:

1. The React client validates the form.
2. The client creates the account with Firebase Authentication.
3. Firebase Authentication returns an ID token.
4. The client calls `POST /api/v1/auth/register-profile` with the ID token and profile data.
5. The Express backend verifies the ID token with Firebase Admin SDK.
6. The backend runs a Firestore transaction that:
   - creates `users/{uid}`;
   - initializes season statistics when necessary.
7. The backend returns the completed application profile.

The profile-creation endpoint must be idempotent.

If profile creation fails after the Firebase Authentication account is created, the UI must allow the user to retry profile completion.

Recommended password policy:

- At least 8 characters
- At least one letter
- At least one number

Firebase Authentication password policies may be configured more strictly in the Firebase console.

### Login

Use the Firebase Web SDK:

```ts
signInWithEmailAndPassword(auth, email, password)
```

After login:

- The client retrieves the current Firebase ID token.
- Authenticated backend requests include:

```http
Authorization: Bearer <firebase-id-token>
```

- Express middleware verifies the token using:

```ts
admin.auth().verifyIdToken(idToken)
```

The backend must derive `userId` from the verified token. It must never trust a user ID sent in the request body.

Do not store Firebase ID tokens in browser local storage. Let the Firebase SDK manage authentication persistence.

### Token refresh

The Firebase Web SDK refreshes ID tokens. The API client must obtain a fresh token when required and retry once after an authentication-expired response.

The application does not need custom JWT access tokens, custom refresh tokens, or a `refresh_tokens` Firestore collection for the MVP.

### Logout

Use Firebase Authentication client-side sign-out:

```ts
signOut(auth)
```

For security-sensitive administrative cases, the backend may revoke a user's Firebase refresh tokens through the Admin SDK.

### Email verification and password reset

These are optional for the initial MVP and can use native Firebase Authentication capabilities later:

- `sendEmailVerification`
- `sendPasswordResetEmail`

### Roles and authorization

- Store the display role in `users/{uid}.role`.
- Use Firebase custom claims for trusted administrative authorization.
- Admin middleware must verify the custom claim from the decoded ID token.
- Do not authorize admin operations based only on a client-provided value or a Firestore field that the client can edit.

### Profile

Users can view:

- Display name
- Favorite team
- Leagues
- Total points
- Current season rank
- Gameweek points
- Prediction accuracy

---

## 7. Leagues

Authenticated users can create private leagues.

### Create league

Required fields:

- League name

Generated fields:

- Unique invite code
- Owner membership
- Active season

Recommended invite-code format:

```text
UFL-8K2P7M
```

### Join league

A user can join a league using its invite code.

Validation must cover:

- Code does not exist
- League belongs to an inactive season
- User is already a member
- League has reached a configured member limit, if a limit is introduced

### Manage league

For the MVP:

- Owners can rename their league.
- Owners can regenerate the invite code.
- Owners can remove members.
- Owners can delete the league after confirmation.
- Members can leave a league.
- The owner cannot leave without transferring ownership or deleting the league.

The initial implementation may restrict each user to a configurable number of created leagues, such as five.

---

## 8. Fixture and Gameweek Requirements

### Fixture display

Display fixtures grouped by gameweek.

Each fixture card must show:

- Home team
- Away team
- Kickoff date and time in the user's local timezone
- Fixture status
- Prediction inputs before kickoff
- The user's submitted prediction
- Final score after completion
- Points awarded after scoring

### Gameweek navigation

Users must be able to navigate:

- Previous gameweek
- Current gameweek
- Next gameweek

The application should default to:

1. The provider's current round, when available.
2. Otherwise the nearest gameweek containing an upcoming fixture.
3. Otherwise the most recently completed gameweek.

### Prediction deadline

Predictions lock independently for each fixture at its kickoff time.

Server time is authoritative.

Frontend disabling is for usability only. The backend must reject prediction creation or updates when:

```text
current server time >= fixture kickoff time
```

Do not lock an entire gameweek when its first fixture starts.

### Prediction visibility

Recommended fairness rule:

- Before kickoff, a user can see only their own prediction.
- Other users' predictions remain hidden.
- At kickoff, predictions for that fixture become visible within league views.

This behavior should be controlled by backend authorization, not only hidden in the frontend.

### Missing prediction

A missing prediction earns zero points.

The UI should clearly indicate fixtures for which the user has not submitted a prediction.

### Prediction draft defaults

- Every editable fixture without a saved prediction is initialized to `0–0` in the UI draft.
- Focusing a score input whose value is `0` clears it for immediate entry; leaving it empty on blur restores `0`.
- Existing saved predictions always take precedence over the draft default.
- When no captain has been saved for the gameweek, the editable fixture containing the user's favorite team is selected as Captain by default.
- These defaults remain client-side until the user presses Save Predictions; loading the fixture list alone must not create prediction records.

### New-user scoring eligibility

- A user's scoring begins with the first gameweek whose prediction deadline occurs after profile creation.
- Fixtures from earlier gameweeks must not create default predictions, award points, or contribute to season statistics.
- If registration occurs after the current gameweek deadline, scoring begins in the next gameweek.
- League scoring begins no earlier than both the user's eligible gameweek and the membership's eligible gameweek.
- Earlier gameweeks may remain visible for reference, but the UI must label them as not eligible rather than showing zero points.

### Outcome wagers

- Every user begins with 100 total points when their profile is created. Prediction awards and settled wager gains or losses all modify this same total.
- A user may place at most one wager in each scoring-eligible gameweek by explicitly opting in beside a fixture after entering its score prediction. The wager outcome (`HOME_WIN`, `DRAW`, or `AWAY_WIN`) is derived from that prediction.
- The stake must be an integer from 1 through 20 and cannot exceed the user's available total points.
- The stake is deducted from the displayed available total immediately. A correct outcome returns twice the stake; an incorrect outcome returns zero.
- Once a user wagers on a fixture, both participating teams are unavailable to that user for the next three gameweeks.
- Open wagers may be updated before kickoff. Changing the fixture requires removing the open wager first.
- The fixture-list UI must expose a compact wager toggle beside Captain. A selected wager is shown only by a green Wager control and its point amount; clicking the green control again removes it and immediately allows another fixture to be selected in the same draft. Wager changes submit through the same Save Predictions action.
- Wagering is optional: every fixture's wager control is off by default, and entering a score prediction alone must never activate it.
- Settlement must be transactional and idempotent so repeated fixture synchronization cannot credit the wallet twice.

---

## 9. Scoring Rules

Use a versioned scoring system so rules can change in future seasons without corrupting historical results.

### MVP scoring

| Outcome | Points |
|---|---:|
| Exact score | 5 |
| Correct result and exact goal difference | 3 |
| Correct winner or correct draw | 2 |
| Incorrect result | 0 |

Definitions:

- **Exact score:** Predicted home and away scores equal the final home and away scores.
- **Correct result:** Correctly predicts home win, away win, or draw.
- **Exact goal difference:** Predicted home-minus-away goal difference equals the final goal difference.
- An exact score always takes precedence over the other rules.

Example:

```text
Final score: Arsenal 3–1 Chelsea
```

| Prediction | Points | Explanation |
|---|---:|---|
| 3–1 | 5 | Exact score |
| 2–0 | 3 | Correct winner and +2 goal difference |
| 2–1 | 2 | Correct winner |
| 1–1 | 0 | Incorrect result |

For a final score of `1–1`:

- `1–1` earns 5.
- `0–0` or `2–2` earns 3 because the result and goal difference are correct.
- A non-draw earns 0.

### Scoring function

Implement scoring as a pure, unit-tested function.

```ts
type ScorePredictionInput = {
  predictedHome: number;
  predictedAway: number;
  actualHome: number;
  actualAway: number;
};

type ScorePredictionResult = {
  points: number;
  reason: "EXACT_SCORE" | "CORRECT_GOAL_DIFFERENCE" | "CORRECT_RESULT" | "INCORRECT";
  ruleVersion: string;
};
```

### Settlement conditions

Only score a fixture after the Footballdata.io adapter maps the raw provider status to internal `COMPLETED` and both final scores are present.

Do not couple scoring logic directly to one undocumented raw status string. Keep the provider-to-domain status map isolated in the adapter, preserve the raw status for diagnostics, and add mapping tests from captured provider fixtures.

Do not settle fixtures whose normalized status is:

- Not started
- Live
- Halftime
- Postponed
- Cancelled
- Suspended
- Abandoned

### Idempotency

Fixture scoring must be idempotent.

Running:

```ts
recalculateFixtureScores(fixtureId)
```

multiple times must update existing scoring records rather than add duplicate points.

If Footballdata.io later corrects a result, the application must:

1. Update the fixture.
2. Recalculate all predictions for that fixture.
3. Rebuild or invalidate affected leaderboard totals.

---

## 10. Postponed and Rescheduled Fixtures

Predictions must remain tied to the internal fixture document backed by the provider match ID.

When a fixture is postponed:

- Do not award points.
- Store the postponed status.
- Update the kickoff time when the provider supplies a new one.
- Reopen prediction editing until the new kickoff time.

Recommended behavior:

- Keep the user's existing prediction.
- Allow the user to modify it until the rescheduled kickoff.
- Show a visible rescheduled badge.

When a fixture is cancelled or abandoned:

- Do not award points until a valid completed result is available.
- Administrators must be able to trigger a later resynchronization.

---

## 11. Leaderboards

Each league must have:

### Season leaderboard

Columns:

- Rank
- User display name
- Favorite team
- Total points
- Exact scores
- Correct results
- Predictions made

### Gameweek leaderboard

Columns:

- Rank
- User display name
- Gameweek points
- Exact scores
- Correct results
- Predictions made

### Ranking order

Recommended tie-breakers:

1. Total points, descending
2. Number of exact-score predictions, descending
3. Number of correct-result predictions, descending
4. Earlier league join date
5. User ID as a deterministic final tie-breaker

Clearly display when users are tied.

### Firestore leaderboard model

Do not calculate a full leaderboard by reading every prediction on every request. Firestore is not a relational analytics database, and repeated fan-out reads will become expensive.

Maintain precomputed leaderboard-entry documents:

```text
leagues/{leagueId}/seasonLeaderboard/{userId}
leagues/{leagueId}/gameweeks/{gameweekId}/leaderboard/{userId}
```

Each entry should contain the fields required for sorting and display:

```text
userId
displayName
favoriteTeamId
points
exactScores
correctResults
predictionsMade
joinedAt
updatedAt
```

Leaderboard queries should use Firestore ordering and pagination:

```text
orderBy(points, desc)
orderBy(exactScores, desc)
orderBy(correctResults, desc)
orderBy(joinedAt, asc)
orderBy(userId, asc)
limit(pageSize)
startAfter(cursor)
```

Declare the required composite indexes in `firestore.indexes.json`.

### Updating leaderboards

After a fixture is settled:

1. Update the prediction's awarded points.
2. Update the user's season and gameweek aggregate documents.
3. Query the user's active league memberships.
4. Increment or recompute the user's season and gameweek leaderboard entry in each league.
5. Use deterministic document IDs and idempotency markers so retries produce the same totals.

For small MVP traffic, this may run in the Express synchronization worker. If write volume grows, enqueue one Cloud Task per scoring chunk or per user.

Do not attempt to place an unlimited fixture settlement inside one Firestore transaction. Process predictions in bounded chunks and track progress in a `scoringRuns/{runId}` document.

---


## 12. Frontend Requirements

### Main routes

```text
/
 /register
 /login
 /dashboard
 /gameweeks/:gameweekId
 /leagues
 /leagues/create
 /leagues/join
 /leagues/:leagueId
 /profile
 /admin
```

The admin route must be role protected.

### Landing page

Show:

- Product name
- Brief explanation
- Sign-up call to action
- Login link
- Independent/non-affiliation disclaimer

Avoid official Premier League or club branding unless licensing has been confirmed.

### Registration page

Include:

- Display-name input
- Email input
- Password input
- Favorite-team selector
- Validation messages
- Loading and error states

### Dashboard

Show:

- Current gameweek
- Prediction-completion progress, such as `7 of 10 submitted`
- Next prediction deadline
- Current gameweek points
- Season total points
- User's league ranks
- User's leagues
- Upcoming fixtures

### Gameweek page

Show all fixtures for the selected gameweek.

Requirements:

- Numeric home-score and away-score inputs
- Values must be nonnegative integers
- Recommended maximum prediction value: 20
- Save per fixture or provide a save-all action
- Display saved state and last-updated time
- Countdown or kickoff time
- Locked state after kickoff
- Final score and awarded points after settlement
- Skeleton loading state
- Empty state
- Error and retry state

### Leagues page

Show:

- All joined leagues
- Create-league action
- Join-by-code action

### League detail page

Show:

- League name
- Owner
- Invite code for owners/admins
- Season and gameweek leaderboard tabs
- Member count
- Member management for owners
- Predictions for a fixture only after that fixture has kicked off

### Profile page

Show:

- Display name
- Email
- Favorite team
- Season statistics
- Edit-profile functionality
- Logout action

### Responsive behavior

The UI must work at:

- 320px mobile width
- Tablet widths
- Desktop widths

On mobile:

- Fixture prediction controls must remain easy to tap.
- Tables should transform into cards or use a deliberate horizontal scroll.
- Navigation should collapse appropriately.

### Accessibility

Required:

- Semantic HTML
- Keyboard navigation
- Visible focus states
- Labels for all form controls
- Accessible validation messages
- Color must not be the only status indicator
- Minimum WCAG AA contrast target
- `aria-live` for save and scoring feedback where appropriate

---

## 13. Backend REST API

Prefix all application routes with:

```text
/api/v1
```

### Authentication

Firebase Authentication handles account creation, login, token refresh, logout, email verification, and password reset through the Firebase Web SDK.

The Express API provides application-profile endpoints:

```http
POST /api/v1/auth/register-profile
GET  /api/v1/auth/me
POST /api/v1/auth/revoke-sessions
```

`POST /auth/revoke-sessions` is optional and should be restricted to the authenticated user or an administrator.

### Teams and seasons

```http
GET /api/v1/seasons/current
GET /api/v1/teams
GET /api/v1/teams/:teamId
```

### Gameweeks and fixtures

```http
GET /api/v1/gameweeks
GET /api/v1/gameweeks/current
GET /api/v1/gameweeks/:gameweekId
GET /api/v1/gameweeks/:gameweekId/fixtures
GET /api/v1/fixtures/:fixtureId
```

### Predictions

```http
GET /api/v1/gameweeks/:gameweekId/predictions/me
PUT /api/v1/fixtures/:fixtureId/prediction
DELETE /api/v1/fixtures/:fixtureId/prediction
GET /api/v1/fixtures/:fixtureId/predictions
```

`GET /fixtures/:fixtureId/predictions` must enforce the visibility rule and reject access before kickoff except for the requesting user's own prediction.

Example prediction request:

```json
{
  "homeScore": 2,
  "awayScore": 1
}
```

### Leagues

```http
GET    /api/v1/leagues
POST   /api/v1/leagues
POST   /api/v1/leagues/join
GET    /api/v1/leagues/:leagueId
PATCH  /api/v1/leagues/:leagueId
DELETE /api/v1/leagues/:leagueId
POST   /api/v1/leagues/:leagueId/leave
POST   /api/v1/leagues/:leagueId/invite-code/regenerate
DELETE /api/v1/leagues/:leagueId/members/:userId
GET    /api/v1/leagues/:leagueId/leaderboard
GET    /api/v1/leagues/:leagueId/gameweeks/:gameweekId/leaderboard
```

### User profile

```http
GET   /api/v1/users/me
PATCH /api/v1/users/me
GET   /api/v1/users/me/stats
```

### Admin and synchronization

```http
POST /api/v1/admin/sync/teams
POST /api/v1/admin/sync/fixtures
POST /api/v1/admin/sync/fixtures/:fixtureId
POST /api/v1/admin/score/fixtures/:fixtureId
POST /api/v1/admin/score/gameweeks/:gameweekId
```

All admin endpoints must require the admin role and must be auditable.

---

## 14. Firebase and Firestore Data Requirements

### Data-access policy

For the MVP:

- React uses the Firebase Web SDK for Authentication.
- React calls the Express REST API for application data.
- Express uses Firebase Admin SDK to access Cloud Firestore.
- The browser must not write predictions, league memberships, fixtures, scores, roles, or leaderboard entries directly to Firestore.
- Firestore Security Rules should deny direct client reads and writes to protected business collections unless a specific client-readable collection is intentionally introduced.

The initial `firestore.rules` may use a deny-by-default policy because the Express backend uses Firebase Admin SDK and bypasses client Security Rules:

```text
match /{document=**} {
  allow read, write: if false;
}
```

This server-authoritative model ensures that users cannot bypass kickoff deadlines, scoring rules, prediction privacy, or league permissions.

### Recommended collections

```text
users
seasons
teams
gameweeks
fixtures
leagues
leagueMemberships
predictions
userSeasonStats
userGameweekStats
inviteCodes
scoringRuns
syncRuns
auditLogs
```

Recommended leaderboard subcollections:

```text
leagues/{leagueId}/seasonLeaderboard/{userId}
leagues/{leagueId}/gameweeks/{gameweekId}/leaderboard/{userId}
```

### Document ID strategy

Use deterministic IDs where uniqueness matters:

```text
users/{firebaseUid}

teams/footballdataIo_{providerTeamId}

fixtures/footballdataIo_{providerMatchId}

predictions/{userId}_{fixtureId}

leagueMemberships/{leagueId}_{userId}

inviteCodes/{normalizedInviteCode}

userSeasonStats/{seasonId}_{userId}

userGameweekStats/{gameweekId}_{userId}

leagues use Firestore auto-generated IDs.
```

Deterministic IDs provide uniqueness without relying on unsupported relational constraints.

### Suggested documents

#### `users/{uid}`

```ts
{
  email: string;
  displayName: string;
  favoriteTeamId: string;
  role: "USER" | "ADMIN";
  activeSeasonId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Firebase Authentication remains the source of truth for the user's email identity. The Firestore email field is a display/search copy and must not be used to verify credentials.

#### `seasons/{seasonId}`

```ts
{
  name: string;
  providerLeagueId: number;
  providerSeasonId: number;
  providerSeasonYear: number | null;
  startsAt: Timestamp;
  endsAt: Timestamp;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `teams/{teamId}`

```ts
{
  provider: "FOOTBALLDATA_IO";
  providerTeamId: number;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  activeSeasonIds: string[];
  isActive: boolean;
  updatedAt: Timestamp;
}
```

#### `gameweeks/{gameweekId}`

```ts
{
  seasonId: string;
  roundNumber: number | null;
  providerGameweek: number | null;
  providerRoundName: string | null;
  startsAt: Timestamp | null;
  endsAt: Timestamp | null;
  status: "UPCOMING" | "ACTIVE" | "COMPLETE";
  fixtureCount: number;
  updatedAt: Timestamp;
}
```

#### `fixtures/{fixtureId}`

```ts
{
  provider: "FOOTBALLDATA_IO";
  providerMatchId: number;
  seasonId: string;
  gameweekId: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: Timestamp;
  providerStatus: string;
  normalizedStatus:
    | "SCHEDULED"
    | "LIVE"
    | "HALFTIME"
    | "COMPLETED"
    | "POSTPONED"
    | "CANCELLED"
    | "SUSPENDED"
    | "ABANDONED"
    | "UNKNOWN";
  providerGameweek: number | null;
  providerRound: string | null;
  homeScore: number | null;
  awayScore: number | null;
  isSettled: boolean;
  resultVersion: string | null;
  finalizedAt: Timestamp | null;
  lastSyncedAt: Timestamp;
}
```

#### `leagues/{leagueId}`

```ts
{
  seasonId: string;
  name: string;
  normalizedName: string;
  ownerUserId: string | null;
  inviteCode: string | null;
  isDefault: boolean;
  favoriteTeamId: string | null;
  roundNumber: number | null;
  memberCount: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `leagueMemberships/{leagueId}_{userId}`

```ts
{
  leagueId: string;
  userId: string;
  seasonId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  joinedGameweek: number;
  joinedAt: Timestamp;
  isActive: boolean;
}
```

This top-level collection supports queries by either `leagueId` or `userId`.

#### `pointWallets/{userId}`

```ts
{
  userId: string;
  availablePoints: number;
  reservedPoints: number;
  predictionPoints: number;
  predictionSeasonId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `wagers/{userId}_{gameweekId}`

```ts
{
  userId: string;
  fixtureId: string;
  seasonId: string;
  gameweekId: string;
  roundNumber: number;
  homeTeamId: string;
  awayTeamId: string;
  selection: "HOME_WIN" | "DRAW" | "AWAY_WIN";
  stakePoints: number;
  status: "OPEN" | "WON" | "LOST";
  returnPoints: number | null;
  submittedAt: Timestamp;
  updatedAt: Timestamp;
  settledAt: Timestamp | null;
}
```

#### `predictions/{userId}_{fixtureId}`

```ts
{
  userId: string;
  fixtureId: string;
  seasonId: string;
  gameweekId: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  submittedAt: Timestamp;
  updatedAt: Timestamp;
  lockedAt: Timestamp | null;
  awardedPoints: number | null;
  scoringReason:
    | "EXACT_SCORE"
    | "CORRECT_GOAL_DIFFERENCE"
    | "CORRECT_RESULT"
    | "INCORRECT"
    | null;
  scoringRuleVersion: string | null;
  fixtureResultVersion: string | null;
  scoredAt: Timestamp | null;
}
```

#### `inviteCodes/{code}`

```ts
{
  leagueId: string;
  createdBy: string;
  createdAt: Timestamp;
  active: boolean;
}
```

Creating or regenerating an invite code must use a Firestore transaction so two leagues cannot claim the same code.

### Uniqueness and invariants

Enforce the following with deterministic IDs, transactions, and server validation:

- Unique Firebase Authentication email
- Unique application user profile per Firebase UID
- Unique Footballdata.io match ID
- Unique Footballdata.io team ID
- Unique prediction per user and fixture
- Unique membership per user and league
- Unique invite code
- Nonnegative integer prediction scores
- Home team must not equal away team
- Kickoff timestamp required for active fixtures

### Required indexes

Create composite indexes in `firestore.indexes.json` for actual query patterns, including:

- Fixtures by `seasonId`, `gameweekId`, and `kickoffAt`
- Fixtures by `seasonId`, `providerStatus`, and `kickoffAt`
- Predictions by `fixtureId` and `userId`
- Predictions by `userId`, `gameweekId`, and `updatedAt`
- Memberships by `userId`, `seasonId`, and `isActive`
- Memberships by `leagueId`, `isActive`, and `joinedAt`
- Leagues by `seasonId`, `isActive`, and `createdAt`
- Sync runs by `type`, `status`, and `startedAt`
- Scoring runs by `fixtureId`, `status`, and `createdAt`

Leaderboard subcollections require composite indexes matching the tie-breaker order.

Commit `firestore.indexes.json` to the repository and deploy it as part of CI/CD.

### Transactions and batched writes

Use Firestore transactions for operations that depend on current document state:

- User profile creation
- League creation, owner membership, and invite-code reservation
- Favorite-team changes and default membership migration
- Invite-code regeneration
- Permission-sensitive member removal
- Counter updates where concurrent writes are possible

Use batched writes for independent multi-document updates.

Fixture settlement may involve more documents than should be handled atomically. Process it as an idempotent workflow with:

- a `scoringRuns/{runId}` state document;
- deterministic prediction and leaderboard document IDs;
- bounded write batches;
- a resumable cursor;
- a result version;
- retry-safe updates.

### Timestamps

- Use Firestore `Timestamp` values.
- Use `FieldValue.serverTimestamp()` for server-generated creation and update times.
- Store fixture kickoff timestamps in UTC.
- Convert to the user's local timezone only in the frontend.

### Counters and contention

Avoid a single highly contended document for global totals.

For MVP-sized leagues, a `memberCount` transaction is acceptable. If contention develops, replace it with distributed counters or derive the count asynchronously.

### Data retention and deletion

Deleting a user from Firebase Authentication does not automatically remove Firestore data.

Implement an account-deletion workflow that:

1. disables or deletes the Firebase Authentication user;
2. anonymizes or removes the user profile;
3. removes active league memberships;
4. applies the chosen retention policy to historical predictions and leaderboard records;
5. writes an audit record.

---


## 15. Synchronization Jobs

### Initial season bootstrap

An administrator or deployment script must be able to:

1. Verify the Footballdata.io API key with `/account/usage` and check `/meta/status`.
2. Discover and verify the Premier League public `league_id`.
3. Discover and verify the active Premier League public `season_id`.
4. Create or update the active season document in Firestore.
5. Fetch Premier League teams for the verified provider season ID.
6. Create or update team documents.
7. Fetch every paginated season match.
8. Derive gameweek documents from match `game_week` and `round` values.
9. Create or update fixture documents using provider match IDs.
10. Verify that the import contains the expected complete season schedule or explicitly report incomplete provider coverage.
11. Create required Firestore indexes before production traffic.

### Scheduled synchronization

Recommended MVP schedules:

| Data | Suggested frequency |
|---|---|
| Teams | Weekly |
| Complete fixture list | Daily |
| Upcoming fixtures within 14 days | Every 3 hours |
| Fixtures on a matchday | Every 5–10 minutes |
| Recently completed fixtures | Every 5 minutes until settled |
| Completed fixture verification | Once 1–6 hours later |

Preferred production scheduling:

```text
Google Cloud Scheduler
        ↓
Authenticated Cloud Run or Cloud Function endpoint
        ↓
Footballdata.io provider
        ↓
Cloud Firestore
        ↓
Cloud Tasks for chunked scoring when needed
```

Do not make one provider request per end user. Synchronize shared football data into Cloud Firestore and serve all users from the local application data.

Do not rely solely on `node-cron` inside a horizontally scaled or serverless API because multiple instances may execute the same schedule. Cloud Scheduler should be the production scheduler.

### Job behavior

Every job must:

- Have a unique run ID.
- Store its state in `syncRuns/{runId}` or `scoringRuns/{runId}`.
- Log start and completion.
- Record success, partial success, or failure.
- Record provider request count when possible.
- Be safe to rerun.
- Use exponential backoff for transient errors.
- Handle HTTP 429 without aggressive retries.
- Read quota usage from response `meta` and periodically call `/account/usage`.
- Use a Firestore lease/lock document or idempotency key to prevent overlapping duplicate runs.
- Persist a cursor when processing large prediction sets.
- Be resumable after a process restart.

### Firestore write behavior

- Use deterministic fixture document IDs so synchronization is naturally upsert-based.
- Do not overwrite fields owned by the application when mapping provider responses.
- Use partial updates rather than replacing whole documents.
- Chunk large writes.
- Avoid unnecessary writes when provider data has not changed.
- Record a fixture `resultVersion` so corrected scores can trigger safe rescoring.

---


## 16. Footballdata.io Quota and Caching

Footballdata.io applies monthly request limits by plan. The backend must treat `GET /account/usage` and the usage metadata in actual API responses as the source of truth because pricing and quotas may change.

Current published assumptions to recheck before deployment:

- Free: 1,000 requests per month and access to up to 5 leagues
- Starter: $19 per month, 25,000 requests per month, access to up to 50 leagues, and commercial use
- Pro: $49 per month, 150,000 requests per month, access to up to 150 leagues, advanced data, and prediction-oriented endpoints

The application only needs Premier League fixtures and results, so development may begin on Free. Use Starter before a commercial launch unless the provider confirms another plan is sufficient for the exact use case.

The backend must call:

```http
GET /account/usage
```

and record:

```text
plan
requests_used
requests_limit
requests_remaining
usage_percentage
limit_type
```

If the provider returns HTTP `429` with `rate_limit_exceeded`, stop automatic retries that would consume resources, record the failed sync run, and alert an administrator.

Caching requirements:

- League and season metadata: 12–24 hours or longer after verification
- Teams: 12–24 hours
- Full historical/completed fixtures: cache indefinitely after verification, while allowing explicit correction checks
- Upcoming fixtures: 15–60 minutes
- Matchday fixtures before kickoff: 5–15 minutes
- Live fixtures, if later displayed: 30–120 seconds
- Recently completed results: 10–60 minutes until settled and verified
- User-specific predictions and leaderboards: short caching with explicit invalidation

Do not poll live endpoints unless the product actually displays live match state. For the MVP, polling around kickoff and final-result windows is enough.

Maintain a monthly request budget. A single season bootstrap should use paginated league/season endpoints, and subsequent jobs should request only relevant date windows or recent result sets.

---

## 17. Validation and Error Handling

### Prediction validation

Reject when:

- User is unauthenticated.
- Fixture does not exist.
- Fixture has kicked off.
- Either score is missing.
- Either score is not an integer.
- Either score is negative.
- Either score exceeds the configured maximum.

### Standard error format

Use one consistent structure:

```json
{
  "error": {
    "code": "PREDICTION_LOCKED",
    "message": "Predictions for this fixture are locked because the match has started.",
    "details": null,
    "requestId": "..."
  }
}
```

Do not expose stack traces or secrets in production.

### Recommended domain error codes

```text
AUTHENTICATION_REQUIRED
INVALID_CREDENTIALS
EMAIL_ALREADY_EXISTS
TEAM_NOT_FOUND
FIXTURE_NOT_FOUND
PREDICTION_LOCKED
INVALID_SCORE
LEAGUE_NOT_FOUND
INVALID_INVITE_CODE
ALREADY_LEAGUE_MEMBER
LEAGUE_PERMISSION_DENIED
PROVIDER_RATE_LIMITED
PROVIDER_UNAVAILABLE
```

---

## 18. Security Requirements

### Firebase Authentication

- Use Firebase Authentication for email/password identity.
- Verify every protected API request with Firebase Admin SDK.
- Derive the user ID from the verified token.
- Check token revocation for high-risk administrative operations when appropriate.
- Use Firebase custom claims for administrator authorization.
- Never trust role, email, or user ID values supplied by the frontend.

### Firestore

- Access Firestore through Firebase Admin SDK in the Express backend.
- Deny direct browser writes to protected application collections.
- Commit and test `firestore.rules`.
- Run Firestore Rules unit tests against the Firebase Emulator Suite.
- Use transactions for concurrent state changes.
- Use deterministic IDs and server-side authorization to prevent duplicate or unauthorized records.
- Avoid exposing service-account credentials to the frontend.

### General backend security

- Store Footballdata.io API keys and server credentials only in server-side environment variables or a secret manager.
- Prefer Google Secret Manager in production.
- Enable HTTPS in production.
- Configure CORS to allow only approved frontend origins.
- Use Helmet.
- Rate-limit profile completion, invite-code attempts, prediction writes, and admin endpoints.
- Validate and sanitize every request with Zod.
- Do not expose stack traces or secrets.
- Add CSRF protection if authentication is later moved to custom cookies.
- Use Firestore `Timestamp` values and UTC for football times.
- Generate cryptographically secure invite codes.
- Add audit logs for admin sync/scoring operations, role changes, and league-member removal.
- Configure Firebase App Check later if direct Firebase client access expands beyond Authentication.
- Restrict the backend service account to the minimum Google Cloud IAM permissions required.

### Firebase configuration

Firebase web configuration values such as the Web API key and project ID identify the project and are not server secrets. Security must come from Firebase Authentication, Security Rules, App Check where applicable, and server authorization.

Firebase Admin private keys and Footballdata.io API keys are secrets and must never be exposed to the browser or committed.

---


## 19. Privacy and Legal Requirements

The application is an independent prediction game and must not imply official affiliation.

Recommended disclaimer:

> Ultimate Fantasy League is an independent football prediction game and is not affiliated with, endorsed by, or sponsored by the Premier League or its member clubs.

Important:

- Footballdata.io provides API access but does not grant ownership of third-party league, club, logo, image, or trademark rights.
- Footballdata.io states that commercial use may require a paid plan. Confirm the selected plan before launch and retain written confirmation for the intended public prediction-game use case.
- Do not resell or expose Footballdata.io responses as a standalone raw-data feed. Serve only the normalized data needed by Ultimate Fantasy League.
- Do not describe provider data as official Premier League data unless separately authorized.
- Club badges, official Premier League branding, player images, kit imagery, and other branded assets may require separate permission.
- The MVP should support a text-only or initials-based team identity mode.
- Confirm commercial data rights before a public commercial launch.
- Review the name “Ultimate Fantasy League” for trademark and domain availability.
- Publish Terms of Service and a Privacy Policy before opening the app publicly.
- If prizes, entry fees, paid contests, betting-like features, or cash rewards are added, obtain legal review before implementation.

---

## 20. Testing Requirements

### Unit tests

Must cover:

- Scoring rules
- Exact-score precedence
- Draw scoring
- Prediction deadline comparison
- Fixture-status settlement rules
- Invite-code generation
- Favorite-team membership migration
- Provider response mapping

### Backend integration tests

Must cover:

- Registration creates an idempotent user profile without automatic league membership.
- Duplicate email rejection.
- Prediction creation before kickoff.
- Prediction update before kickoff.
- Prediction rejection at or after kickoff.
- Custom league creation.
- Join by invite code.
- Unauthorized member removal.
- Fixture settlement.
- Idempotent rescoring.
- Leaderboard ranking and tie-breakers.
- Prediction privacy before kickoff.

### Frontend tests

Must cover:

- Registration validation
- Fixture rendering
- Prediction submission
- Locked prediction state
- Loading, empty, and error states
- League leaderboard display
- Responsive navigation

### End-to-end tests

Recommended Playwright flows:

1. Register and choose a team.
2. Submit predictions.
3. Create a private league.
4. Join that league as another user.
5. Simulate kickoff and confirm predictions lock.
6. Simulate final result synchronization.
7. Confirm points and leaderboards update.

Use a fake football-data provider in automated tests. Tests must not call the live Footballdata.io service.

---

## 21. Observability

The backend must provide:

```http
GET /health
GET /ready
```

Logs should include:

- Request ID
- User ID when authenticated
- Route
- Status code
- Duration
- Sync-run ID
- Fixture ID for fixture processing
- Provider error information without secrets

Track metrics such as:

- Footballdata.io requests used and remaining
- Provider failures
- Prediction-save failures
- Fixtures awaiting settlement
- Scoring-run duration
- Active users
- Predictions per gameweek

---

## 22. Environment Variables and Firebase Configuration

Create `.env.example` without real secrets.

### Backend environment

```env
NODE_ENV=development
PORT=4000

FRONTEND_URL=http://localhost:5173

FIREBASE_PROJECT_ID=ultimate-fantasy-league
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Prefer Application Default Credentials in Google Cloud.
GOOGLE_APPLICATION_CREDENTIALS=

FOOTBALLDATA_IO_BASE_URL=https://footballdata.io/api/v1
FOOTBALLDATA_IO_API_KEY=
# Discover and verify these IDs through /leagues and /leagues/{league_id}/seasons.
FOOTBALLDATA_IO_LEAGUE_ID=
FOOTBALLDATA_IO_SEASON_ID=

MAX_CREATED_LEAGUES_PER_USER=5
MAX_PREDICTED_GOALS=20
SCORING_RULE_VERSION=2026.1

ENABLE_TEAM_LOGOS=false
ENABLE_EMAIL_VERIFICATION=false
ENABLE_PASSWORD_RESET=false
```

When `FIREBASE_PRIVATE_KEY` is stored as an environment variable, normalize escaped newlines before initializing the Admin SDK:

```ts
privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")
```

Do not require explicit private-key variables when the backend is running on Cloud Run or Cloud Functions with an attached service account. Use Application Default Credentials there.

### Frontend environment

Firebase web configuration is used by the Firebase Web SDK:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

VITE_API_BASE_URL=http://localhost:4000/api/v1
```

These web configuration values are not a replacement for Firestore Security Rules or backend authorization.

### Emulator environment

```env
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIREBASE_PROJECT_ID=ultimate-fantasy-league-local
```

The local setup must work without production Firebase credentials when the Emulator Suite is enabled.

---


## 23. Suggested Repository Structure

A monorepo is recommended.

```text
ultimate-fantasy-league/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   └── firebase/
│   │   ├── public/
│   │   └── package.json
│   └── api/
│       ├── src/
│       │   ├── config/
│       │   ├── controllers/
│       │   ├── domain/
│       │   ├── firebase/
│       │   ├── middleware/
│       │   ├── providers/
│       │   ├── repositories/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── jobs/
│       │   └── tests/
│       └── package.json
├── packages/
│   ├── shared-types/
│   ├── validation/
│   └── eslint-config/
├── scripts/
│   ├── seed-firestore.ts
│   ├── bootstrap-season.ts
│   └── create-admin.ts
├── firebase.json
├── .firebaserc
├── firestore.rules
├── firestore.indexes.json
├── requirements.md
├── .env.example
├── package.json
└── README.md
```

Recommended package manager: `pnpm`.

Use the Firebase Emulator Suite for local Firestore and Authentication. A local SQL container, ORM schema, and SQL migration directory are not required.

---


## 24. Codex Implementation Instructions

Codex should implement the application incrementally.

### Phase 1 — Foundation

1. Create the monorepo.
2. Configure TypeScript, formatting, linting, tests, and environment validation.
3. Initialize Firebase Admin SDK in the API and Firebase Web SDK in the frontend.
4. Configure Firebase Authentication and Cloud Firestore emulators.
5. Create Firestore repository abstractions.
6. Add `firestore.rules` and `firestore.indexes.json`.
7. Add seed scripts and a fake football-data provider.

### Phase 2 — Authentication and teams

1. Implement Firebase email/password registration and login in React.
2. Implement Express middleware that verifies Firebase ID tokens.
3. Implement the idempotent profile-completion endpoint.
4. Implement team selection.
5. Add Firebase Auth and Firestore Emulator integration tests.

### Phase 3 — Fixtures and predictions

1. Implement the Footballdata.io provider, Zod response validation, status normalization, and pagination handling.
2. Implement season bootstrap and fixture synchronization into Firestore.
3. Build gameweek and fixture endpoints.
4. Build the dashboard and gameweek UI.
5. Implement prediction upsert and deletion using deterministic document IDs.
6. Enforce server-side kickoff locking using server time.
7. Add required composite indexes.

### Phase 4 — Private leagues

1. Implement league creation and transactional invite-code reservation.
2. Implement joining, leaving, and member management.
3. Build league list and league detail pages.
4. Maintain member counts safely.

### Phase 5 — Scoring and leaderboards

1. Implement versioned scoring.
2. Implement idempotent, resumable fixture settlement.
3. Maintain user aggregate documents.
4. Maintain precomputed season and gameweek leaderboard entries.
5. Build paginated leaderboard endpoints.
6. Show points and scoring explanations in the UI.

### Phase 6 — Hardening

1. Add Google Cloud Scheduler jobs.
2. Add Cloud Tasks for scoring chunks when required.
3. Add rate limiting and security middleware.
4. Add API quota monitoring.
5. Add Firestore Rules tests.
6. Add full integration and end-to-end tests.
7. Add accessibility checks.
8. Add error monitoring and deployment configuration.

Codex must:

- Keep Footballdata.io behind the Express backend.
- Use Firebase Authentication for identity.
- Verify Firebase ID tokens on protected API routes.
- Use Firebase Admin SDK for server-side Firestore access.
- Keep protected Firestore writes server-authoritative.
- Use Firestore transactions only for bounded, contention-sensitive operations.
- Use batched writes or Cloud Tasks for large settlement operations.
- Use deterministic document IDs for uniqueness and retry safety.
- Add tests with each feature.
- Avoid hard-coded dates and seasons in domain logic.
- Use Firestore timestamps and UTC internally.
- Localize dates only in the frontend.
- Implement loading, empty, success, and error states.
- Prefer simple, maintainable code over premature abstractions.
- Document Firebase project setup, emulator setup, indexes, rules, and deployment commands in `README.md`.
- Never commit actual secrets or service-account JSON files.
- Use the fake provider in development when no Footballdata.io API key is configured.
- Use the Firebase Emulator Suite in automated tests.
- Avoid direct client access to protected Firestore collections.

---


## 25. MVP Acceptance Criteria

The MVP is complete when:

1. A user can register, select a favorite team, and automatically join Overall, the matching team supporter league, and their first scoring-eligible gameweek league.
2. A user can log in with Firebase Authentication and access protected Express routes using a verified Firebase ID token.
3. The Premier League, active season, teams, gameweeks, and all available season fixtures can be imported from Footballdata.io with pagination.
4. The backend validates the configured league and season IDs and exposes provider coverage or import incompleteness to administrators.
5. A user can predict every fixture's score before kickoff.
6. The backend rejects prediction changes at or after kickoff.
7. A user can create a private league using the single league model and invite another user.
8. Another user can join using the invite code.
9. Predictions from other users are hidden until the relevant fixture begins.
10. A completed fixture can be synchronized and scored automatically.
11. Reprocessing a fixture does not duplicate points.
12. Overall, supporter, gameweek cohort, and private leagues show correct gameweek and season rankings.
13. Postponed fixtures can be rescheduled without losing predictions.
14. The app works on mobile and desktop.
15. Automated tests cover the scoring and locking rules.
16. A user starts with 100 total points and can place no more than one 1–20 point outcome wager per eligible gameweek from those points.
17. Correct wagers return double, incorrect wagers lose their stake, and both teams observe the three-gameweek cooldown.
18. No Footballdata.io API key, Firebase Admin credential, or service-account secret is exposed to the browser.
19. The app displays an independent/non-affiliation disclaimer.
20. Club-logo display can be disabled through configuration.
---

## 26. Out of Scope for the Initial MVP

Unless explicitly added later, exclude:

- Selecting or managing individual football players
- Player prices and budgets
- Captains, benches, and transfers
- Goal-scorer predictions
- Live commentary
- Betting odds
- Cash prizes or paid entry
- Public chat
- Direct messages
- Social-media integrations
- Push notifications
- Native mobile applications
- Multiple competitions
- Historical seasons
- Advanced moderation tools
- Third-party login
- Email verification
- Password reset
- Public league discovery
- Real-time WebSocket score updates

---

## 27. Product Decisions Still Needed

The product owner should provide the following details before or during implementation.

### Branding and design

- Confirm the final product name.
- Logo or text-only identity.
- Preferred colors and visual style.
- Whether club logos may be shown.
- Light mode only or light and dark modes.
- Examples of apps whose design should influence the UI.

### Authentication

- Email/password only or Google/Apple sign-in.
- Whether email verification is required.
- Whether password reset must be part of the MVP.
- Minimum user age and supported countries.

### Favorite team

- Can users change their favorite team?
- How often?
- Should historical membership in the old team league remain visible?

### Leagues

- Maximum leagues a user may create.
- Maximum members per league.
- All MVP leagues are private and use the same prediction rules.
- Whether league owners may appoint admins.
- Whether a league can span multiple seasons.

### Prediction rules

- Confirm the `5 / 3 / 2 / 0` scoring model.
- Whether users can edit predictions until each fixture's kickoff.
- Whether other members' predictions remain hidden until kickoff.
- Whether one “Joker” or double-points fixture should exist per gameweek.
- Whether late registrations can predict future fixtures in the current gameweek.

### Leaderboards

- Required tie-breaker order.
- Whether an overall global leaderboard is needed.
- Whether users can view prior gameweeks and seasons.
- Whether rankings should update immediately after each result.

### Notifications

- Whether to send reminders for missing predictions.
- Email, push, or in-app notifications.
- How long before kickoff reminders should be sent.

### Administration

- Who can become an admin?
- Whether administrators need a web dashboard.
- Whether admins may manually correct fixtures, points, users, and league membership.
- Whether synchronization must be manually triggerable in production.

### Deployment and operations

- Firebase project name and Google Cloud billing account.
- Firestore database region; choose it before creating production data because it cannot be changed in place.
- Preferred frontend and backend hosting provider.
- Whether the backend will use Cloud Run or Firebase Functions.
- Expected number of users at launch.
- Expected geographic audience.
- Production domain.
- Monthly infrastructure budget.
- Analytics provider preference.
- Data retention and account deletion requirements.

### Legal and commercial model

- Free product or subscription-supported.
- Advertising plans.
- Prizes or paid competitions.
- Confirmation of football-data publication rights.
- Trademark review for the product name.
- Terms of Service and Privacy Policy ownership.

---

## 28. Recommended Decisions for a Fast MVP

When no other direction is provided, use these defaults:

- Responsive React + TypeScript web application.
- Node.js + Express + TypeScript API.
- Cloud Firestore + Firebase Admin SDK.
- Firebase Authentication with email/password.
- No email verification or password reset initially.
- One league model with no league-type or scoring-format field, including automatic Overall, team supporter, and gameweek cohort leagues.
- Maximum five created leagues per user.
- Unlimited memberships for the initial MVP.
- Per-fixture locking at kickoff.
- Predictions hidden from other users until kickoff.
- Scoring: exact score 5, correct result and goal difference 3, correct result 2, otherwise 0.
- No Joker or double-points feature initially.
- No global leaderboard initially.
- No club logos until usage rights are confirmed.
- Free access with no prizes, entry fees, or betting features.
- Footballdata.io Free for development and Starter for the initial commercial production launch, subject to current account limits and provider confirmation.
