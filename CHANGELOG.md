# Changelog

All notable changes to ReleaseOps are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versions below were shipped by merging to `main`. Git tags `v0.1.0` and `v0.2.0` do not exist
yet. Creating those tags is an open issue. `package.json` still reports `0.1.0`.

## [Unreleased]

### Added

- `AGENTS.md`, `CONTRIBUTING.md`, this changelog, a pull request template, and an issue template
  that make GitHub the system of record for the project.

## [0.2.0] - 2026-11-13

Shipped in [pull request #2](https://github.com/sch3lly-stack/releaseops/pull/2). Not tagged.

### Added

- Email and password registration, login, and logout with httpOnly session cookies.
- Argon2id password hashes through `hash-wasm`.
- First-registrant administrator bootstrap and admin-created invites.
- The shared `can()` permission matrix, route enforcement, and denial audits.
- Audit rows for authentication and user-administration events, written in the same database
  transaction as the change.
- Login, register, protected routes, the user menu, and the administrator user-management page.
- A process-local login rate limit of five attempts per minute for each IP and email pair.

## [0.1.0] - 2026-11-13

Shipped in [pull request #1](https://github.com/sch3lly-stack/releaseops/pull/1). Not tagged.

### Added

- pnpm workspace with a strict TypeScript, ESLint, Prettier, and Husky setup.
- Docker Compose services for Postgres, Redis, Mailpit, the API, the worker, and the web app.
- Fastify API with `/healthz`, `/readyz`, structured logging, and a central error handler.
- Vite, React, and Tailwind application shell with an API client.
- GitHub Actions workflow that lints, typechecks, migrates, tests, and builds.
- Prisma schema v1 and the initial migration.
- A worker process that connects to Redis and logs jobs.
