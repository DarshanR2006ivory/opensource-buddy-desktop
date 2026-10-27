# OpenSource Buddy

OpenSource Buddy helps developers discover real public GitHub issues that fit their skills, experience, and interests. Issue results come from the official GitHub REST API; the app does not ship sample issues. Match scores are transparent estimates, not guarantees that an issue is suitable.

## What is included

- Responsive React, Vite, TypeScript, and Tailwind application.
- Supabase email/password authentication, private developer profiles, saved issues, and contribution progress.
- GitHub issue search, filtering, pagination, five-minute search/issue caching, and a server-side optional GitHub token.
- Local AI contribution mentor backend calls OpenRouter server-side and grounds guidance in the selected issue. Repository files are not fetched; suggested paths and causes are labeled unverified.
- PostgreSQL migration with indexes, foreign keys, checks, and Row Level Security.
- Unit/UI tests plus GitHub Actions for validation and optional backend deployment.

## Repository layout

```text
src/
  app/                 Routing, app shell, and authentication state
  components/          Shared forms, issue cards, and UI primitives
  lib/                 Supabase, GitHub Edge Function client, matching, profiles
  pages/                Landing, auth, onboarding, dashboard, explorer, detail,
                        mentor, saved issues, and profile pages
  types/                Domain types
  styles.css            Tailwind directives and responsive design system
server/
  ai-mentor.ts           Authenticated local OpenRouter API handler
supabase/
  config.toml           Edge Function JWT settings
  migrations/           PostgreSQL schema and RLS
  functions/
    _shared/            CORS, GitHub API, and request helpers
    search-issues/       Public GitHub search/detail endpoint and cache
    contribution-guide/ Legacy authenticated guide endpoint (not used by current mentor UI)
tests/                  Matching, API error handling, and UI tests
.github/workflows/      CI and optional Supabase deployment
```

## Browser-based setup

You do not need to install VS Code or a local toolchain to deploy or maintain the app. Use the GitHub and provider dashboards in a browser; GitHub Actions runs tests/builds and can deploy the backend.

### 1. Create Supabase project and schema

1. Create a project from the [Supabase Dashboard](https://supabase.com/dashboard).
2. Open **Project Settings → API**. Copy the Project URL and the public anon/publishable key into your local `.env` file as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. These are public browser credentials; never use a `service_role` or secret key here.
3. Apply the SQL migrations in filename order. In the Supabase SQL Editor, run `supabase/migrations/20261025000000_initial_schema.sql` followed by `supabase/migrations/20261025120000_user_owned_crud.sql`. Alternatively, use the documented GitHub Actions migration deployment workflow.
4. Under **Authentication → URL Configuration**, add `http://localhost:5173` as a redirect URL. Configure email confirmation and SMTP according to your account needs.

### 2. Deploy the Edge Functions and configure secrets

The GitHub Actions workflow `.github/workflows/supabase-deploy.yml` applies migrations and deploys the GitHub issue search Edge Function. In GitHub, open **Settings → Secrets and variables → Actions** and add:

- Repository variable `SUPABASE_PROJECT_REF`: the project reference shown in Supabase Project Settings.
- Repository secret `SUPABASE_ACCESS_TOKEN`: a Supabase access token created in the Supabase account dashboard.
- Repository secret `SUPABASE_DB_URL`: the project's database connection string. Treat it as a password.

The workflow runs on pushes to `main` that change `supabase/`, or on demand from the **Actions** tab. If the migration was already applied manually, the workflow's migration step will safely recognize it.

In Supabase **Edge Functions → Secrets**, configure:

- `GITHUB_TOKEN` (optional): a fine-grained GitHub token with public repository read access. Without it, search uses GitHub's lower unauthenticated rate limit. Keep it server-side.

Search works without `GITHUB_TOKEN`, within GitHub's unauthenticated search limits. Do not add server-side secrets with a `VITE_` prefix.

The AI Mentor runs locally as Vite server middleware at `/api/ai-mentor` (`server/ai-mentor.ts`). The backend verifies the Supabase access token and saves guides through the caller's existing RLS permissions. OpenRouter is called only from the local Node server, never from React. Configure `OPENROUTER_API_KEY` and optionally `OPENROUTER_MODEL` in the ignored `.env.local` file; never prefix server secrets with `VITE_`.

### 3. Local development

For a local development environment, use Node.js 20 or newer. The Supabase JS dependency is already included in this repository:

```sh
npm ci
# Windows PowerShell (only if .env.local does not already exist):
Copy-Item .env.example .env.local
# macOS/Linux (only if .env.local does not already exist):
cp .env.example .env.local
# Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and OPENROUTER_API_KEY in .env.local.
npm run dev
npm test
npm run build
```

Open `http://localhost:5173`. The same Vite dev server serves the frontend and local `/api/ai-mentor` backend. Supabase Edge Functions continue to provide GitHub issue search.

The checked-out project currently contains a React/Vite web app and does not contain a Tauri 2 shell (`src-tauri`/Tauri dependencies). The same Vite client module can be used by a future Tauri wrapper, but no Tauri packaging or native runtime integration is present or claimed here.

## Product behavior and data

- **Explore** searches public, open issues through `search-issues`; filters include language, beginner-friendly labels, keywords, repository, sort, and page. A selected language is verified against the repository metadata API (cached for 24 hours), because GitHub's issue-search endpoint does not filter by repository language. The result count shows GitHub issue candidates before language filtering, not a global count of verified matches.
- **Issue details** show the API-returned title, description, labels, repository, and original issue link.
- **Recommendations** compare profile terms to issue text and show a per-factor score for skill/interest overlap, experience fit, beginner-friendly signals, clarity, and freshness. Some signals are heuristics; always review the issue and repository.
- **Saved issues** are private to the signed-in user. Progress statuses are held in `contribution_progress`; saved references are in `saved_issues`.
- **Mentor** can be launched with **Ask AI Mentor** from an issue card or issue detail page. It verifies the user's Supabase access token in the local server route, then sends selected issue details to OpenRouter. It displays structured guidance, supports retry and copy, and saves guides to `contribution_guides` through the authenticated Supabase session and RLS. Suggested causes, file paths, and commands are unverified; the route never claims code was changed or tests were run. Issue progress continues to use `contribution_progress`. The older Supabase `contribution-guide` function remains for compatibility but the UI does not call it.
- **Cache** stores public issue metadata and paginated search results in Supabase for five minutes, and repository languages for 24 hours. A cache write failure is surfaced while the successful live GitHub result is still shown. GitHub errors and rate limits are returned explicitly.
- **RLS** keeps profiles, saved references, guides, and progress scoped to `auth.uid()`. Cached public issue metadata is readable; search cache and GitHub issue writes are server-side. The profile and user-owned record operations use the signed-in user's session and RLS policies, not the service-role key.

## Supabase profile and user-data access

`src/lib/supabase.ts` creates the single browser client only when `VITE_SUPABASE_URL` is valid and both values are present. The app shows a startup setup notice listing missing/invalid variables. Only the public anon/publishable key belongs in Vite; never configure a `service_role` or secret key there. `.env.example` intentionally contains empty values; local `.env` is ignored by Git.

The data services use the existing migration schema without renaming columns:

- `profiles`: `id`, `languages`, `skills`, `experience_level`, `interests`, `project_types`, `github_username`, and `updated_at`; profile retrieval and upsert are scoped to the signed-in user's `auth.uid()`.
- `saved_issues`: the existing `(user_id, issue_id)` relation. Saving is an upsert (re-saving refreshes `created_at`), listing is scoped to the current user, and removal deletes only that user's relation. There is no separate mutable saved-issue payload column; progress belongs in `contribution_progress`.
- `contribution_guides`: new guide creation is performed by the authenticated local `server/ai-mentor.ts` route using the user's Supabase token and existing RLS insert policy. The older Supabase contribution-guide function remains but is not used by the current UI. Users can list/read, update the JSON guide, and delete only their own guide rows; migrations preserve the original columns.
- `contribution_progress`: status upsert/update, reads alongside the user's saved issues, and delete are scoped to the current user.

### Manual database and user-isolation check

1. Apply both migrations in order and deploy the Supabase Edge Functions. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` locally; restart Vite after editing env files.
2. Register two test accounts (User A and User B). Sign in as A, create/update the profile, save an issue, change its progress, and generate a mentor guide. Confirm each operation shows its loading/success state and the records appear after reload.
3. Sign in as B. Confirm B sees only B's profile, saved issues, progress, and guides. In the Supabase API/SQL editor, test with authenticated sessions if verifying direct RLS denial: selecting or changing A's records as B must return no accessible rows or an RLS error, never A's data.
4. As A, delete a guide and remove a saved issue; confirm they disappear for A and remain inaccessible to B. Confirm B cannot update/delete A's records.
5. Temporarily clear either Vite variable and restart the app. Confirm the startup banner identifies the missing variable; restore the values afterward.

These are manual validation steps, not a claim that authenticated CRUD or cross-user isolation was tested against the supplied live project. No test account was available for this session.

### Test the local AI Mentor API

1. Set `OPENROUTER_API_KEY` in `.env.local`; optionally set `OPENROUTER_MODEL` (default `openai/gpt-4o-mini`). Also set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` or `.env.local`. Do not use `VITE_` for OpenRouter credentials.
2. Run `npm run dev`, open `http://localhost:5173`, and sign in. The Vite server serves both the app and `POST /api/ai-mentor`; no Vercel CLI or deployment is used.
3. Select **Ask AI Mentor** on an issue. The server validates the Supabase session before calling OpenRouter and saves the guide in the existing `contribution_guides` table under RLS. Retry failures and use **Copy guide** to copy the sections.
4. Confirm unauthenticated calls return 401 and unsupported methods return 405. Verify guide ownership using two test users.

The guide includes an issue explanation, expected outcome, suggested solution approach, prerequisites, repository setup workflow, possible causes, file areas to inspect, a concise 5–6 step implementation plan, illustrative code when useful, testing guidance, edge cases, and a pull-request checklist. The response is intentionally concise but allows up to 6,000 output tokens so the selected model does not truncate the required JSON. The API input is size-limited, issue URLs must be GitHub issue URLs matching the supplied repository, and each OpenRouter attempt has a 60-second timeout. If a timeout persists, configure a faster model with `OPENROUTER_MODEL`. The prompt treats issue text as untrusted data and explicitly says no repository tree was inspected. Test commands, file paths, root causes, and example code are recommendations only, not verified or executed.

## Issue match scoring

Each candidate gets five independently normalized component scores from 0 to 100. The overall score is the weighted sum:

```text
overall = round(
  skill_match × 0.35
  + experience_difficulty_fit × 0.25
  + beginner_friendly_labels × 0.15
  + description_clarity × 0.15
  + freshness × 0.10
)
```

| Component | Weight | Heuristic |
| --- | ---: | --- |
| Skill match | 35% | Percentage of the developer's distinct language, skill, and interest terms matched against issue title/body/labels/repository. Programming languages use exact repository-language metadata when available; otherwise they are matched against issue text. No profile terms yields 0 until the developer adds preferences. |
| Experience and difficulty fit | 25% | Compare experience preference with a difficulty hint inferred from labels (`beginner`/`easy`/`good first issue`, `intermediate`/`medium`, or `advanced`/`hard`). The fit scores (developer experience × inferred difficulty) are: beginner × beginner/intermediate/advanced = 100/70/45; intermediate = 50/100/75; advanced = 20/60/100. Missing, conflicting, or unrecognized difficulty signals use a neutral 60. |
| Beginner-friendly labels | 15% | Recognized beginner labels score 100; `help wanted` alone scores 40; otherwise 0. |
| Issue description clarity | 15% | Start at 20 for fewer than 40 characters, 40 for 40–119, or 60 for 120 or more. Add 15 for section headings, 15 for explicit requirement phrases, and 10 for actionable details, capped at 100. Missing descriptions score 0. |
| Freshness | 10% | Updates within 7/30/90/180 days score 100/80/60/35, respectively; older issues score 10. Missing or invalid dates use a neutral 50. |

Every result displays all five component values as `0–100`, its configured weight and weighted points, plus the explanation used for that issue/profile pair. Edit languages, skills, interests, or experience in onboarding/profile settings to recalculate; matching is computed from the current profile and issue data at render time, not written as a new database record on refresh.

These scores prioritize discovery, not suitability. Label conventions differ between projects; a label is a weak difficulty hint, and difficulty **cannot be reliably determined from labels alone**. Description length/structure is not a measure of correctness or implementation effort. Repository language is a single primary-language field and may not reflect the files touched by an issue. Review the linked issue, current repository contribution instructions, and maintainer discussion before choosing work.

## Environment and security notes

`.env.example` contains placeholders only. The frontend uses the Supabase URL and public anon/publishable key. The OpenRouter key is loaded by the local Node development server from `.env.local` and is never exposed to the browser; the optional GitHub token belongs in Supabase Edge Function secrets. Never commit `.env` or paste secrets into client code.

GitHub API search calls are made server-side from Supabase Edge Functions; GitHub HTML pages are not scraped. Search and mentor requests validate their inputs, use bounded timeouts, and produce explicit errors for invalid responses, rate limits, and unavailable services. The mentor needs the local backend, Supabase URL/anon key, authenticated user session, and server-side `OPENROUTER_API_KEY`. Tests use mocked provider responses; no live OpenRouter or authenticated Supabase guide write is claimed until configured and tested.

## Testing the GitHub Issues integration

The deployed `search-issues` Supabase Edge Function calls the official `GET https://api.github.com/search/issues` endpoint. It requests 20 issues by default, caps each request at 20, and clamps pagination to pages 1–50. Search always includes `is:issue is:open`; keywords, repository, and beginner-friendly label qualifiers are added as requested. Programming-language filtering is verified against the GitHub repository API because the issue-search endpoint does not filter by repository language. That repository-language metadata is cached for 24 hours.

The function also caches normalized issue and search results in Supabase for five minutes. Unauthenticated public GitHub API requests are used when `GITHUB_TOKEN` is absent; to raise GitHub's rate limits, add a fine-grained token with public repository read access to **Supabase → Edge Functions → Secrets**. Keep the token there: it is only attached by the server-side function and is never exposed in the browser bundle. AI is not required for issue search.

To verify locally, run `npm ci` followed by `npm test` and `npm run build`. `tests/aiMentorApi.test.ts` mocks Supabase authentication and OpenRouter responses and checks authenticated guide saving, invalid sessions, issue URL validation, missing provider configuration, rate limiting, CORS preflight, and method rejection. It does not need live API credentials. `tests/githubIssues.test.ts` covers the GitHub REST integration; `tests/contributionGuide.test.ts` covers the legacy Edge Function's fallback helper. `npm run dev` runs both the frontend and mentor API locally.

## Checks

```sh
npm test
npm run build
```