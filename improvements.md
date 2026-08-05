# UltimateFPL codebase improvement review

> Implementation update: the first remediation pass now protects administrative
> and league-scoped routes, validates runtime configuration, centralizes secure
> cookie settings, declares authentication dependencies directly, validates
> persisted frontend sessions, fixes the confirmed rank typo and collection-name
> mismatches, and adds baseline backend tests plus frontend type checking. The
> remaining recommendations below are retained as the follow-up roadmap.

## Scope and review status

This review covers the tracked backend and frontend source, package/configuration files, route-to-controller-to-service flows, authentication and league access controls, Firestore naming and query patterns, React component structure, API/storage utilities, and the current uncommitted frontend changes. Generated dependencies and binary assets were not reviewed. No existing source files were changed.

The repository is a promising working prototype, but it needs a security and consistency pass before production use. The highest-value work is to lock down mutation/admin endpoints, establish one canonical data schema, add validation and tests, and split the largest modules into focused units.

## Priority 0: security and data-integrity risks

### Protect administrative and destructive routes

Several routes can mutate or erase broad datasets without authentication or an administrator check:

- `backend/db/users/index.js:9-13` exposes user population, listing, deletion by email, and deletion of all users.
- `backend/db/fixtures/index.js:8-21` exposes fixture deletion and population.
- `backend/db/simulate/index.js:7-12` explicitly notes that admin authentication is missing but still mounts simulation routes.
- `backend/db/leagues/index.js:17-25`, `:50-54`, and `:72-75` expose default-league creation, score backfill, and calculate-all operations.
- `backend/db/userPredictions/index.js:32-44` exposes score calculation for one or all users.
- `backend/db/h2hWagers/index.js:32-43` labels wager resolution/voiding as admin/cron work but only requires an ordinary user token.

Add an `requireAdmin` middleware (prefer custom claims or a server-side role lookup), use a separate authenticated job identity for cron work, and consider not mounting maintenance routes at all in the public application process. Destructive operations should be idempotent where possible, audit logged, rate limited, and guarded by explicit confirmation/job parameters.

### Enforce league membership on every league-scoped endpoint

`verifyLeagueMembership` exists in `backend/middleware/leagueAccess.js:121-161` but is not used by the league table, rankings, history, score mutation, or H2H routes. Authentication alone does not prove authorization for a requested `leagueId`. Apply membership middleware to read routes and an admin/league-owner policy to mutation routes. In particular, `backend/db/leagues/index.js:28-76` and all routes in `backend/db/h2hWagers/index.js` need resource-level authorization.

`GET /api/leagues/:id` and `GET /api/leagues/` are public (`backend/db/leagues/index.js:78-80`), which can expose private league metadata and membership details through `getLeagueById`. Return only intentionally public discovery fields, or require membership for private leagues.

### Fix authentication configuration and token handling

- `jsonwebtoken` is imported directly by `backend/middleware/auth.js` and `backend/db/users/users.service.js`, but is not declared as a direct dependency in `backend/package.json`. It currently appears only transitively in the lockfile. Add it explicitly so installs remain reproducible.
- Fail fast at startup if `JWT_SECRET`, `FIREBASE_DATABASE_ID`, or required API configuration is absent. Enforce a strong secret and avoid silently signing with invalid configuration.
- Cookie options are hard-coded with `secure: false` in `backend/db/users/users.controller.js:13-19` and `:92-98`. Make `secure` environment-aware, use an appropriate production `sameSite` policy, and keep login/logout cookie options in one helper so they cannot drift.
- The backend says the token should not be in the response body but still returns it (`backend/db/users/users.controller.js:25-26` and `:104-105`). The frontend persists that bearer token in AsyncStorage. Decide on one platform-aware strategy: secure, HTTP-only cookies for web and OS secure credential storage for native. AsyncStorage is not suitable for long-lived secrets.
- Validate the complete `Authorization` header format rather than taking the second whitespace-separated value in `backend/middleware/auth.js:27-30`.
- Add login/signup rate limiting and basic abuse protection. Avoid logging tokens, credentials, full user records, or sensitive prediction/member data.

### Add request validation and bounded inputs

Controllers mostly destructure raw bodies/params and services rely on coercion. Introduce a schema validator such as Zod, Joi, or express-validator at the route boundary. Validate and normalize:

- email, password policy, display name, favorite team, and league code;
- integer gameweeks and fixture IDs with valid ranges;
- score values, captain flags, wager outcomes, and positive wager amounts;
- pagination with maximum `pageSize` and maximum history limits;
- simulation/population ranges to prevent accidental unbounded work.

Return a consistent `400` response with field-level details. Never pass unvalidated IDs into document paths or unbounded values into loops/queries.

### Make multi-document writes atomic

League creation/joining, wager matching/resolution, prediction updates, and score/rank updates span multiple documents. Failures or concurrent requests can leave partial state or overspend a wager balance. Use Firestore transactions for read-modify-write invariants and batched writes for all-or-nothing independent updates. Add idempotency keys/status fields to scheduled scoring and simulation jobs. Document concurrency invariants (for example, a user's available H2H balance may never become negative).

## Priority 1: confirmed correctness and reliability issues

### Correct the rank lookup typo

`backend/db/leagues/leagues.service.js:209` compares `s.oderId === userId`. `oderId` is almost certainly a typo for the canonical user identifier and will prevent the current user's rank from being found. Correct it after standardizing the score-entry type, and cover the behavior with a unit/integration test.

### Resolve collection and field-name drift

The code uses both `userPredictions` and `user_predictions`, `users_leagues` and `league_members`, `leagueId` and `league_id`, `userId` and `user_id`, `fixtureId` and `fixture_id`, plus both `totalScore` and `total_score`. Examples include:

- `backend/db/userPredictions/userPredictions.service.js` versus `backend/schemas/index.js:69`;
- membership writes in `backend/db/leagues/leagues.service.js:74-78` and middleware reads expecting `leagueId` in `backend/middleware/leagueAccess.js:40-42`;
- compatibility fallback logic in `backend/db/leagueScores/leagueScores2.service.js:759-762`;
- frontend fallback parsing in `frontend/screens/UserPredictions.tsx:234-242`.

This is not just stylistic: queries against the wrong field/collection return empty results and can cause authorization failures. Define one schema, write a migration/backfill script, verify counts, then remove compatibility fallbacks. Keep collection names in a shared backend constants module rather than scattering string literals.

### Fix the current TypeScript build

`npx tsc --noEmit` currently fails at `frontend/pages/Login.tsx:12` because TypeScript has no declaration for `../assets/fulltimepl-2.png`, even though the asset exists. Prefer the React Native `require(...)` form already used in `frontend/screens/Home.tsx:642`, or add an asset module declaration included by `tsconfig.json`. Add `typecheck` to `frontend/package.json` and CI so this cannot regress.

### Verify auth state with the server

`frontend/App.tsx:23-40` treats the presence of any nonempty stored token as authenticated. Expired or revoked tokens therefore enter the authenticated navigator until a later request fails. Add `/api/users/me` (or equivalent), validate the token during boot, clear invalid credentials, and centralize 401 handling so navigation resets to login. `initialRouteName` is only evaluated when the navigator mounts; model authentication as explicit signed-out/signed-in navigation trees or context state.

### Correct health and startup behavior

`GET /health/database` in `backend/index.js:69-76` always reports healthy without querying Firestore, while the root message contains the typo "Backend in running" at `:66`. Make liveness independent and cheap, make readiness perform a bounded real dependency check, and return failure status codes when dependencies are unavailable. Export an unstarted app from an app module and call `listen` only in a server entrypoint; this makes integration testing possible without opening a port on import.

### Remove or repair obsolete Firebase initialization

`backend/firebase.js` mixes Firebase Admin initialization with the browser-only Analytics import, embeds client configuration, prints entire app/database objects, and overlaps with `backend/firestore.js`. It appears unused. Delete it if obsolete; otherwise consolidate Firebase initialization in one module and use environment/application-default credentials. Keep service-account JSON out of repository and deployment images where workload identity or secret injection is available. The current `.gitignore` coverage should be extended with an example environment file containing names only.

### Use server timestamps consistently

Firestore writes frequently use `new Date()` (for example, prediction and league services). Prefer Firestore server timestamps for authoritative creation/update times, and define how timestamp values are serialized at the API boundary. This avoids client/server clock differences and inconsistent Date/Timestamp handling.

## Priority 2: maintainability and consistency

### Adopt a single naming convention

Recommended convention:

| Layer | Convention | Examples |
|---|---|---|
| JavaScript/TypeScript variables, functions, JSON API fields | `camelCase` | `userId`, `fixtureId`, `totalScore`, `joinedGameweek` |
| React components, types, interfaces | `PascalCase` | `LeagueDetails`, `LeagueMember`, `FixturesResponse` |
| Constants | descriptive `UPPER_SNAKE_CASE` only for true constants | `MAX_PAGE_SIZE`, `TOKEN_TTL_MS` |
| Boolean variables | `is`/`has`/`can`/`should` prefix | `isPrivate`, `hasFinished`, `canWager` |
| Firestore collections | one documented style (recommended `snake_case`) | `user_predictions`, `league_members`, `league_scores` |
| Files | consistent by role | `leagues.controller.js`, `leagues.service.js`, `LeagueTable.tsx` |

Use camelCase at the application/API boundary even if persisted Firestore fields remain snake_case; isolate conversion in repository mappers. Avoid ambiguous names such as `data`, `result`, `snap`, `d`, `f`, `pred`, and `gwResult` outside very small scopes. Rename `leagueScores2.*` to a domain name such as `leagueScores.*` after removing the legacy implementation; version APIs at the HTTP boundary, not in filenames. Rename singular/plural inconsistencies such as `userPrediction.controller.js` versus `userPredictions.service.js`.

Create shared domain types/schemas for `User`, `League`, `LeagueMember`, `Fixture`, `Prediction`, `LeagueScore`, `Wager`, and API envelopes. Currently interfaces are duplicated across screens, and `RootStackParamList`/`TabParamList` are redefined or diverge between `frontend/types/navigation.ts`, `frontend/pages/Login.tsx`, `Signup.tsx`, and `components/MainApp.tsx`. Use the shared navigation types with typed navigators to eliminate `(navigation as any)` in `frontend/screens/Leagues.tsx:118`.

### Split oversized modules by responsibility

Several files combine fetching, transformation, business rules, state management, rendering, and large style blocks:

- `frontend/screens/Home.tsx` is roughly 900 lines.
- `frontend/screens/LeagueDetails.tsx` is roughly 800 lines in the current working tree.
- `backend/db/leagueScores/leagueScores2.service.js` exceeds 1,000 lines.
- `backend/db/h2hWagers/h2hWagers.service.js` and `userPredictions.service.js` contain multiple workflows and persistence concerns.

Extract frontend hooks such as `useCurrentGameweek`, `usePredictions`, `useLeagueTable`, and `useWagers`; extract presentational components for headers, fixture cards, score summaries, and H2H sections. On the backend, separate pure scoring/ranking functions from Firestore repositories and orchestration services. Pure functions will be straightforward to test.

### Replace `any` and formalize API response types

Strict TypeScript is enabled, but `any` is common in storage, API params, error handling, league data, fixtures, wagers, and navigation. Define generic API response types and return types for every API method. Type Axios errors with `unknown` plus `axios.isAxiosError`, and validate server payloads at runtime when trust matters. Replace index signatures such as `{ [fixtureId: string]: any }` with `Record<string, Wager>`.

The frontend currently handles inconsistent response shapes (`response.league`, `response.data.table`, direct arrays, and success flags). Standardize on one envelope, for example `{ data, error, meta }`, and configure the Axios layer to unwrap it once. Encode query parameters with typed objects rather than `Record<string, any>` (`frontend/utils/api.ts:190`).

### Centralize configuration and design tokens

Validate `EXPO_PUBLIC_BACKEND_URL` before creating Axios (`frontend/utils/api.ts:6`) and provide documented development/production configuration. Centralize route paths, timeouts, retry policy, cache TTLs, and feature flags. Extract repeated colors, spacing, typography, and header/tab options into a theme; hard-coded Bootstrap-like colors are repeated throughout screens and components.

### Improve React state and effects

Audit each effect for stable dependencies, cancellation, and stale responses. Large screens issue related requests from multiple effects (`Home.tsx:389-407`, `LeagueDetails.tsx:346-358`), which can race when gameweek or league changes. Use focused data hooks with `AbortController`/Axios cancellation, ignore stale completions, and expose uniform loading/error/refresh states. Consider TanStack Query for request deduplication, caching, invalidation, retries, and mutation state rather than maintaining a second custom cache layer.

Avoid embedding constructed JSX in state (`LeagueDetails.tsx` sets header content while loading league data). Store domain data and derive UI during render. Memoize only after profiling; first keep components small and props stable.

### Standardize errors and logging

Controllers repeat `try/catch` blocks and leak inconsistent response formats or `err.message` details. Add async error middleware, typed/domain errors with status codes, a 404 handler, and a final error handler that does not expose internals in production. Use structured logging with request/correlation IDs and environment-controlled levels instead of widespread `console.log`. Security audit logs should record identifiers and outcomes without dumping league lists or user objects.

### Remove dead and commented-out code

Delete `backend/db/users/users.js` if it is only an obsolete commented implementation, remove commented routes/imports in `MainApp.tsx` and route files, remove the test-cookie endpoint from production (`backend/index.js:45-62`), and either implement or remove the empty scoring response in `backend/db/constants/index.js:55-69`. `DISCOVER_FEATURE.md` is empty and should be populated or deleted. Keeping old behavior in version control is preferable to retaining large commented blocks.

## Priority 3: performance and operational maturity

### Avoid full-collection scans and N+1 reads

Multiple services call `.get()` on whole collections or fetch one user/league document per result. Examples include league score backfills and table construction, all-user scoring, user listing, and H2H table user hydration. Add bounded pagination, required composite indexes, and denormalized display fields where appropriate. Use Firestore `getAll`/chunked reads and bulk writer for controlled maintenance work. Never expose an unpaginated `getAllUsers` or `getAllLeagues` in production.

Document expected query shapes and commit `firestore.indexes.json`; it is currently ignored/not tracked even though compound queries are central to the application. Track and deploy authoritative Firestore security rules too. Server-side Admin SDK bypasses rules, so API authorization remains mandatory.

### Add caching with explicit invalidation semantics

Fixture caching for 24 hours can serve stale match status/scores (`frontend/utils/storage.ts:11-15`). Use different TTLs for future, live, and completed fixtures, or server cache headers/version keys. Cache keys should include schema/API version and relevant user/league identity. Define invalidation after prediction submission, score calculation, fixture refresh, and wager mutation.

### Add graceful process lifecycle and resilience

Shutdown should stop accepting requests, allow a bounded drain period, then force exit if needed; handle startup rejection and unhandled promise rejections through centralized logging. Configure body-size limits, request timeouts, Helmet security headers, compression where useful, CORS from validated environment configuration, and rate limits by endpoint risk.

## Testing and quality gates

There are no test, lint, format, or type-check scripts in the current package manifests, and no visible CI workflow. Establish:

1. Unit tests for pure score calculations, captain doubling, rank changes, wager matching/payouts, and validation.
2. Service tests against the Firestore emulator for transactions, membership, joining, duplicate requests, and migrations.
3. API integration tests with Supertest for authentication, authorization, validation, status codes, pagination, and private-league data exposure.
4. Frontend component/hook tests for auth bootstrap, fixture/prediction transformations, loading/error states, and navigation.
5. A small end-to-end path: sign up, create/join league, submit predictions, calculate results, view table, and place/resolve a wager.

Add scripts such as `lint`, `format:check`, `typecheck`, `test`, and `test:coverage` to the appropriate packages. Use ESLint with TypeScript/React Hooks rules, Prettier, and a CI job that installs with `npm ci`, audits dependencies according to an agreed policy, runs all checks, and verifies production builds. Add pre-commit hooks only if they remain fast; CI is the authoritative gate.

## Documentation and repository structure

- Expand the root README with prerequisites, architecture, local setup, required environment variable names, Firebase emulator setup, common scripts, deployment, and troubleshooting. The current README contains only a title and deploy command.
- Add `.env.example` files with placeholders and validate configuration at startup. Never include actual service credentials.
- Consider npm workspaces at the root to coordinate frontend/backend scripts and dependency updates.
- Document the canonical Firestore schema, indexes, security model, API routes, scoring rules, wager invariants, and data migration procedure.
- Add ADRs for material decisions such as authentication strategy, naming at persistence boundaries, and scheduled job execution.
- Adopt a predictable backend layout such as `routes/`, `controllers/`, `services/`, `repositories/`, `domain/`, `middleware/`, and `config/`; retain feature folders if preferred, but apply the same internal structure to every feature.

## Suggested implementation sequence

1. Immediately disable or protect every maintenance/destructive endpoint; apply league membership/role authorization and rate limiting.
2. Add configuration validation, explicitly declare `jsonwebtoken`, fix cookie/token storage choices, and remove sensitive debug routes/logs.
3. Specify the canonical Firestore/API schema, write a backed-up and reversible migration, fix `oderId`, and remove dual-name fallbacks after verification.
4. Add boundary validation, transactions/idempotency, consistent errors, and real readiness checks.
5. Restore a clean TypeScript check and introduce lint/format/test/CI gates.
6. Extract and test pure scoring, ranking, and wager logic; add emulator-backed authorization/data-integrity tests.
7. Split the largest frontend screens and backend services, introduce shared types and typed navigation/API clients, and centralize theme/configuration.
8. Profile Firestore reads and frontend renders, then address collection scans, N+1 reads, indexes, pagination, and cache invalidation.

## Definition of done for the improvement pass

- No public or ordinary-user route can run administrative, destructive, score-resolution, or simulation work.
- Every private resource is protected by resource-level authorization, with negative tests.
- One documented field/collection naming scheme is used; migrated data is verified and compatibility paths are removed.
- `npm ci`, lint, formatting check, frontend type-check, tests, and production builds pass in CI.
- Critical multi-document invariants are transactional and retry/idempotency behavior is tested.
- No production secrets are stored in AsyncStorage, source files, logs, or the repository.
- Public endpoints are paginated and expensive maintenance operations are bounded and observable.
- README, environment examples, schema/index documentation, and operational runbooks match the deployed system.
