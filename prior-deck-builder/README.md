# PRIOR Deck Builder

Clean-project starter for the PRIOR Deck Builder handoff. The repo is split into:

- `apps/web`: Next.js manager UI with dashboard, brief form, review flow, polling, and download actions
- `services/api`: Express API for deck CRUD, generation triggers, ownership enforcement hooks, and signed download URLs
- `services/worker`: background worker that picks up queued outline, copy, and build jobs
- `packages/shared`: shared deck statuses, layout registry, and request/response schemas
- `packages/core`: Mongo model, repository helpers, AI/build/storage adapters, and workflow processors

## Fastest Local Start

Use Docker Compose if you want the quickest installable path for an external team.

1. Install Docker Desktop or Docker Engine with Compose V2.
2. Run `npm run docker:up`.
3. Open `http://localhost:3000` for the web app.
4. Open `http://localhost:3001/api/health` to confirm the API is healthy.

That starts:

- MongoDB on `27017`
- the API on `3001`
- the worker as a background process
- the web app on `3000`

## Local Development Without Docker

1. Run `npm install`.
2. Copy `.env.example` to `.env` and fill in the required secrets.
3. Run `npm run dev`.

Default local ports:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- Worker: background poller, no HTTP port

## Docker Compose Details

The root `docker-compose.yml` uses the official `node:22` and `mongo:7` images, so no custom Dockerfile is required for local development.

Services:

- `deps`: one-shot bootstrap that runs `npm ci` into a shared `node_modules` volume
- `mongo`: persistent MongoDB data volume
- `api`: Express API on port `3001`
- `worker`: background job processor
- `web`: Next.js app on port `3000`

Helpful commands:

- `npm run docker:logs`
- `npm run docker:down`
- `npm run docker:reset`

## Environment

Important variables:

- `AUTH_MODE`
- `AUTH_AUDIENCE`
- `AUTH_ISSUER`
- `AUTH_JWT_SECRET`
- `AUTH_JWKS_URI`
- `MONGODB_URI`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `DOWNLOAD_SIGNING_SECRET`
- `STORAGE_MODE=local|s3`
- `LOCAL_STORAGE_DIR`
- `PPTX_TEMPLATE_PATH`
- `TEMPLATE_VERSION`
- `MODEL_VERSION`
- `WORKER_POLL_INTERVAL_MS`
- `DO_SPACES_BUCKET`
- `DO_SPACES_REGION`
- `DO_SPACES_ENDPOINT`
- `DO_SPACES_KEY`
- `DO_SPACES_SECRET`

The repo ships with `.env.example` for local host development. The Docker Compose file overrides the container runtime values needed for the local stack, so the same code can run in both modes.

## Notes

- Auth is abstracted behind a request header in local dev (`x-user-id`) so the tech team can swap in Auth0/JWT middleware without rewriting the deck workflow.
- The worker uses deck state in MongoDB as the queue source, which keeps the v1 topology small while still separating long-running work from the API.
- Generated files are stored locally by default and can be swapped to Spaces by setting the storage environment variables.
