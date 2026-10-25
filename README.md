# OpenSource Buddy

OpenSource Buddy helps developers discover real public GitHub issues that fit their skills, experience, and interests. Issue results come from the official GitHub REST API; the app does not ship sample issues. Match scores are transparent estimates, not guarantees that an issue is suitable.

## What is included

- Responsive React, Vite, TypeScript, and Tailwind application.
- Supabase email/password authentication, private developer profiles, saved issues, and contribution progress.
- GitHub issue search, filtering, pagination, five-minute search/issue caching, and a server-side optional GitHub token.
- Optional AI contribution mentor grounded in the actual issue and repository README/contribution guidance when available. Generated guidance is labeled and must be verified.
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
supabase/
  config.toml           Edge Function JWT settings
  migrations/           PostgreSQL schema and RLS
  functions/
    _shared/            CORS, GitHub API, and request helpers
    search-issues/       Public GitHub search/detail endpoint and cache
    contribution-guide/ Authenticated optional AI guide endpoint
tests/                  Matching, API error handling, and UI tests
.github/workflows/      CI and optional Supabase deployment
```

## Browser-based setup

You do not need to install VS Code or a local toolchain to deploy or maintain the app. Use the GitHub and provider dashboards in a browser; GitHub Actions runs tests/builds and can deploy the backend.

### 1. Create Supabase project and schema

1. Create a project from the [Supabase Dashboard](https://supabase.com/dashboard).
2. Open **Project Settings → API**. Copy the Project URL and the public anon/publishable key into Vercel as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. These are public browser credentials; never use a `service_role` or secret key here.
3. Apply the SQL migrations in filename order. In the Supabase SQL Editor, run `supabase/migrations/20261025000000_initial_schema.sql` followed by `supabase/migrations/20261025120000_user_owned_crud.sql`. Alternatively, use the documented GitHub Actions migration deployment workflow.
4. Under **Authentication → URL Configuration**, add the Vercel production URL and any preview URL patterns you use. Configure email confirmation and SMTP according to your account needs.

### 2. Deploy the Edge Functions and configure secrets

The GitHub Actions workflow `.github/workflows/supabase-deploy.yml` applies migrations and deploys both functions from the repository. In GitHub, open **Settings → Secrets and variables → Actions** and add:

- Repository variable `SUPABASE_PROJECT_REF`: the project reference shown in Supabase Project Settings.
- Repository secret `SUPABASE_ACCESS_TOKEN`: a Supabase access token created in the Supabase account dashboard.
- Repository secret `SUPABASE_DB_URL`: the project's database connection string. Treat it as a password.

The workflow runs on pushes to `main` that change `supabase/`, or on demand from the **Actions** tab. If the migration was already applied manually, the workflow's migration step will safely recognize it.

In Supabase **Edge Functions → Secrets**, configure:

- `GITHUB_TOKEN` (optional): a fine-grained GitHub token with public repository read access. Without it, search uses GitHub's lower unauthenticated rate limit. Keep it server-side.
- `OPENROUTER_API_KEY` (optional): enables AI-generated contribution guides through OpenRouter. It is never sent to the browser. Without it, the mentor returns a non-AI starter guide grounded in the live issue and reports missing repository details instead of inventing them.
- `OPENROUTER_MODEL` (optional, default `openai/gpt-4o-mini`): an OpenRouter model slug available to your account.
- `OPENROUTER_BASE_URL` (optional, default `https://openrouter.ai/api/v1`): the OpenRouter API base URL.
- `OPENROUTER_SITE_URL` (optional): your deployed site URL, sent as OpenRouter's `HTTP-Referer` attribution header.

Search works without `GITHUB_TOKEN`, within GitHub's unauthenticated search limits. AI-generated guidance is available only after configuring its provider secret; non-AI fallback guidance works without that secret. Do not add any of these secrets with a `VITE_` prefix.

The mentor checks the repository README and `CONTRIBUTING.md`, `.github/CONTRIBUTING.md`, and `docs/CONTRIBUTING.md` through the GitHub REST API. Its result includes links to the source issue and repository, with README/contribution links only when those files are found. To enable AI, create an API key in your OpenRouter account and add it under **Supabase → Edge Functions → Secrets** as `OPENROUTER_API_KEY`; optionally set `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL`, and `OPENROUTER_SITE_URL` there. Deploy the `contribution-guide` Edge Function after changing it. No AI key is needed for fallback guidance.

### 3. Deploy the frontend to Vercel

1. Import this GitHub repository in the [Vercel Dashboard](https://vercel.com/new).
2. Keep the detected Vite build settings (`npm run build`, output directory `dist`).
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in **Project Settings → Environment Variables** for Preview and Production.
4. Deploy. The included `vercel.json` rewrites client-side routes to the Vite entry point.

Vercel builds on pushes to the connected branch. Pull-request previews are useful for checking the UI; configure matching Supabase redirect URLs if preview authentication is required.

### 4. Local or browser-based development

For a local development environment, use Node.js 20 or newer. The Supabase JS dependency is already included in this repository:

```sh
npm ci
# Windows PowerShell:
Copy-Item .env.example .env
# macOS/Linux:
cp .env.example .env
# Fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
npm run dev
npm test
npm run build
```

Alternatively, edit files in GitHub's browser editor and use Actions to run checks; no local editor is required. The Supabase GitHub Actions workflow can deploy backend changes after the repository secrets and variable above are configured.

The checked-out project currently contains a React/Vite web app and does not contain a Tauri 2 shell (`src-tauri`/Tauri dependencies). The same Vite client module can be used by a future Tauri wrapper, but no Tauri packaging or native runtime integration is present or claimed here.

## Product behavior and data

- **Explore** searches public, open issues through `search-issues`; filters include language, beginner-friendly labels, keywords, repository, sort, and page. A selected language is verified against the repository metadata API (cached for 24 hours), because GitHub's issue-search endpoint does not filter by repository language. The result count shows GitHub issue candidates before language filtering, not a global count of verified matches.
- **Issue details** show the API-returned title, description, labels, repository, and original issue link.
- **Recommendations** compare profile terms to issue text and show a per-factor score for skill/interest overlap, experience fit, beginner-friendly signals, clarity, and freshness. Some signals are heuristics; always review the issue and repository.
- **Saved issues** are private to the signed-in user. Progress statuses are held in `contribution_progress`; saved references are in `saved_issues`.
- **Mentor** verifies the user's Supabase session and fetches the live issue plus README and contribution guidance from checked repository locations. With `OPENROUTER_API_KEY`, it requests a structured guide from OpenRouter; without the key, it returns a useful non-AI starter guide. Both modes include direct source links when available, identify missing information, and avoid unsupported file recommendations. Provider/network/invalid-response errors are surfaced with a retry action rather than silently replaced with fallback content.
- **Cache** stores public issue metadata and paginated search results in Supabase for five minutes, and repository languages for 24 hours. A cache write failure is surfaced while the successful live GitHub result is still shown. GitHub errors and rate limits are returned explicitly.
- **RLS** keeps profiles, saved references, guides, and progress scoped to `auth.uid()`. Cached public issue metadata is readable; search cache and GitHub issue writes are server-side. The profile and user-owned record operations use the signed-in user's session and RLS policies, not the service-role key.

## Supabase profile and user-data access

`src/lib/supabase.ts` creates the single browser client only when `VITE_SUPABASE_URL` is valid and both values are present. The app shows a startup setup notice listing missing/invalid variables. Only the public anon/publishable key belongs in Vite; never configure a `service_role` or secret key there. `.env.example` intentionally contains empty values; local `.env` is ignored by Git.

The data services use the existing migration schema without renaming columns:

- `profiles`: `id`, `languages`, `skills`, `experience_level`, `interests`, `project_types`, `github_username`, and `updated_at`; profile retrieval and upsert are scoped to the signed-in user's `auth.uid()`.
- `saved_issues`: the existing `(user_id, issue_id)` relation. Saving is an upsert (re-saving refreshes `created_at`), listing is scoped to the current user, and removal deletes only that user's relation. There is no separate mutable saved-issue payload column; progress belongs in `contribution_progress`.
- `contribution_guides`: generated guide creation remains server-side through the authenticated `contribution-guide` Edge Function. Users can list/read, update the JSON guide, and delete only their own guide rows. The second migration adds authenticated insert/update/delete RLS policies and grants while preserving the original columns.
- `contribution_progress`: status upsert/update, reads alongside the user's saved issues, and delete are scoped to the current user.

### Manual database and user-isolation check

1. Apply both migrations in order and deploy the Edge Functions. Configure the local/Vercel public `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; restart Vite after editing `.env`.
2. Register two test accounts (User A and User B). Sign in as A, create/update the profile, save an issue, change its progress, and generate a mentor guide. Confirm each operation shows its loading/success state and the records appear after reload.
3. Sign in as B. Confirm B sees only B's profile, saved issues, progress, and guides. In the Supabase API/SQL editor, test with authenticated sessions if verifying direct RLS denial: selecting or changing A's records as B must return no accessible rows or an RLS error, never A's data.
4. As A, delete a guide and remove a saved issue; confirm they disappear for A and remain inaccessible to B. Confirm B cannot update/delete A's records.
5. Temporarily clear either Vite variable and restart the app. Confirm the startup banner identifies the missing variable; restore the values afterward.

These are manual validation steps, not a claim that authenticated CRUD or cross-user isolation was tested against the supplied live project. No test account was available for this session.

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

`.env.example` contains blank placeholders only. The frontend uses only the Supabase URL and public anon/publishable key. Supabase service-role credentials, GitHub tokens, and AI credentials belong in Supabase Edge Function secrets or the deployment secret store. Never commit `.env` or paste secrets into client code.

The GitHub API calls are made server-side from Edge Functions; GitHub HTML pages are not scraped. Search and mentor requests validate their inputs, use bounded timeouts, and produce explicit errors for invalid responses, rate limits, and unavailable services. The mentor fallback needs a deployed Supabase Edge Function and valid Supabase/GitHub access but does not need an AI provider secret. No live integration has been claimed as tested until provider credentials are configured.

## Testing the GitHub Issues integration

The deployed `search-issues` Supabase Edge Function calls the official `GET https://api.github.com/search/issues` endpoint. It requests 20 issues by default, caps each request at 20, and clamps pagination to pages 1–50. Search always includes `is:issue is:open`; keywords, repository, and beginner-friendly label qualifiers are added as requested. Programming-language filtering is verified against the GitHub repository API because the issue-search endpoint does not filter by repository language. That repository-language metadata is cached for 24 hours.

The function also caches normalized issue and search results in Supabase for five minutes. Unauthenticated public GitHub API requests are used when `GITHUB_TOKEN` is absent; to raise GitHub's rate limits, add a fine-grained token with public repository read access to **Supabase → Edge Functions → Secrets**. Keep the token there: it is only attached by the server-side function and is never exposed in the browser bundle. AI is not required for issue search.

To verify locally, run `npm ci` followed by `npm test` and `npm run build`. `tests/githubIssues.test.ts` mocks `fetch` responses from the GitHub REST API and checks query construction, issue normalization, 20-item and page caps, empty results, malformed data, network failures, HTTP 403, and HTTP 429 behavior without needing a GitHub token or Supabase account. `tests/contributionGuide.test.ts` checks that the no-AI fallback covers the guide sections, describes missing issue/documentation details, includes only available source links, and filters unsupported file-path suggestions. For an end-to-end check, deploy the Supabase schema and `search-issues` function, configure the two public `VITE_SUPABASE_*` values for the frontend, and search for a keyword such as `accessibility`; the UI links each result to its original GitHub issue and repository. The app reports configuration/rate-limit/network errors instead of substituting demo issues.

## Checks

```sh
npm test
npm run build
```