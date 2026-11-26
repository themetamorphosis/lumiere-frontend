# Lumière frontend

Lumière (Watch Vault) tracks movies, TV, and anime. The frontend uses Next.js
16, React 19, TypeScript, and Tailwind CSS 4. The FastAPI backend stores
accounts, libraries, and share links in PostgreSQL.

## Run locally

Keep the frontend and backend checkouts as sibling directories. Use Node from
`.node-version` with npm, Python 3.11, and PostgreSQL 16.

1. Create a PostgreSQL database and user. In the backend, copy `.env.example`
   to `.env`. Set `DATABASE_URL`, generate a unique `SECRET_KEY`, and use
   `http://localhost:3000` for `FRONTEND_URL`. Set `TMDB_API_KEY` to enable
   title search and discovery. Registration and manual library entries also
   work with the example placeholder.
2. From the backend checkout, install dependencies, apply migrations, and
   start the API.

   ```bash
   python3.11 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   alembic upgrade head
   uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```

3. From the frontend checkout, copy `.env.example` to `.env.local`, install
   from the lockfile, and start Next.js.

   ```bash
   cp .env.example .env.local
   npm ci
   npm run dev
   ```

Open [Lumière locally](http://localhost:3000).

### Password recovery

Set the backend's `FRONTEND_URL` to the public frontend origin and configure
`SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, and any SMTP credentials using the
backend's `.env.example`. Production and staging require HTTPS reset links
and SMTP STARTTLS.

For local testing with Mailpit, use `SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025`,
`SMTP_FROM=accounts@lumiere.test`, and `SMTP_STARTTLS=false` when both
services run directly on the same host. Open **Forgot your password?** on the
sign-in page. Reset links expire after 30 minutes and can be used once.

## Production build

```bash
npm ci
npm run typecheck
npm run lint
npm run test:coverage
npm run build
npm start
```

Set `NEXT_PUBLIC_API_URL` to the browser-visible API base URL, including
`/api/v1`, before building. Set `API_URL` at runtime if Next.js reaches the
backend through a different hostname. The build uses bundled fonts. For a
production install that will not run Chromium tests, use
`PUPPETEER_SKIP_DOWNLOAD=true npm ci`.

Set `AI_API_KEY` in the Next.js server environment at runtime to enable the
assistant for signed-in users. `AI_API_URL` and `AI_MODEL` override the provider
defaults listed in `.env.example`. Without an AI key the launcher stays hidden
and the chat POST endpoint returns HTTP 503.

For Docker Compose, set the backend and optional AI variables in a frontend
`.env` file or in your shell. Then start Postgres, migrate, and start the app.

```bash
docker compose up -d --wait postgres
docker compose run --rm backend alembic upgrade head
docker compose up --build
```

## Release checks

Point the local checks at an API backed by a disposable database with migrations
applied, and run the frontend with `npm run build` and `npm start`. Both checks
write fixture data. They default to `http://localhost:3000` for the web app and
`http://127.0.0.1:8000/api/v1` for the API. Override these addresses with
`LUMIERE_WEB_URL` and `LUMIERE_API_URL`.

- `npm run check:e2e` registers a mobile browser user, imports a CSV, reloads the
  library, opens its public link in an anonymous context, and verifies that
  revocation returns HTTP 404. GitHub Actions checks out the backend from the
  `backend_ref` dispatch input, `LUMIERE_BACKEND_REF` repository variable, or
  backend `master`, in that order. Use a backend ref containing the matching
  registration, import, and sharing changes. For a private backend checkout,
  set the `LUMIERE_BACKEND_READ_TOKEN` secret to a read-only credential.
- `npm run check:performance` imports 10,000 titles, then measures 20 local API
  reads of 500 titles and five cold library visits. Browser runs use a
  1440 × 900 viewport, 4× CPU throttling, 25 ms network latency, and 20/10 Mbps
  down/up. The API budget is 250 ms p95, including JSON parsing. The browser
  budget is 4,500 ms p95 from navigation until the first result and the full
  library count are visible.
- `STAGING_API_URL=https://your-staging-api.example/api/v1 npm run check:staging-tmdb`
  checks live search and details for *The Matrix* (1999). Configure a valid
  `TMDB_API_KEY` on the staging backend. To run this in GitHub Actions, add the
  `STAGING_API_URL` repository variable and select `staging_tmdb` when
  dispatching the frontend CI workflow.
