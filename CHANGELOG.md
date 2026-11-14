# Changelog

All notable changes to ReleaseOps are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`v0.1.0` and `v0.2.0` are tagged at the historical merge commits named below. The workspace
version in `package.json` is `0.2.0` on a later commit, so that version bump is not inside either
tag. Documentation merged after auth is listed under Unreleased and is not part of `v0.2.0`.

## [Unreleased]

### Added

- `AGENTS.md`, `CONTRIBUTING.md`, this changelog, a pull request template, and an issue template
  that make GitHub the system of record for the project.
- A short daily engineering routine in `.cursor/rules/engineering-workflow.mdc`.

### Changed

- `main` requires a pull request, the CI check, and a linear history. Squash is the only merge
  method. Approving reviews are not required. Dependabot alerts are enabled.
- The root workspace version and the API, web, and worker package versions are `0.2.0`. This
  change is newer than the `v0.2.0` tag.

## [0.2.0] - 2026-11-13

Git tag `v0.2.0` points at `b2770ef6581e0b245d4c2e370353db2c65a7e4ba`, the merge of
[pull request #2](https://github.com/JN-Schell/releaseops/pull/2)
(`feat: add email sessions, invites, and role checks`, branch `phase-1-auth`). Later
documentation commits are not in this tag. The tagged tree still reports `0.1.0` in
`package.json`.

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

Git tag `v0.1.0` points at `296bcbf1a977d4aa5ecbe7e7110bd4d23f995b6f`, the merge of
[pull request #1](https://github.com/JN-Schell/releaseops/pull/1)
(`feat: scaffold Phase 0 foundations`, branch `phase-0-foundations`).

### Added

- pnpm workspace with a strict TypeScript, ESLint, Prettier, and Husky setup.
- Docker Compose services for Postgres, Redis, Mailpit, the API, the worker, and the web app.
- Fastify API with `/healthz`, `/readyz`, structured logging, and a central error handler.
- Vite, React, and Tailwind application shell with an API client.
- GitHub Actions workflow that lints, typechecks, migrates, tests, and builds.
- Prisma schema v1 and the initial migration.
- A worker process that connects to Redis and logs jobs.
