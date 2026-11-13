# ReleaseOps — Project Plan

A web application for managing software deployments: tracking build pipelines, gating production releases behind approvals, recording release history, and surfacing deployment health.

This document is the working plan. It defines scope, architecture, data model, API, and a phased build order with acceptance criteria for each phase.

---

## Table of Contents

1. [Goals & Non-Goals](#1-goals--non-goals)
2. [Portfolio Skills Demonstrated](#2-portfolio-skills-demonstrated)
3. [Tech Stack](#3-tech-stack)
4. [System Architecture](#4-system-architecture)
5. [Domain Model & Database Schema](#5-domain-model--database-schema)
6. [Roles & Permissions (RBAC)](#6-roles--permissions-rbac)
7. [Feature Specifications](#7-feature-specifications)
8. [REST API Design](#8-rest-api-design)
9. [Frontend Pages & UX](#9-frontend-pages--ux)
10. [Security Design](#10-security-design)
11. [Testing Strategy](#11-testing-strategy)
12. [CI/CD for ReleaseOps Itself](#12-cicd-for-releaseops-itself)
13. [Repository Structure](#13-repository-structure)
14. [Phased Roadmap & Milestones](#14-phased-roadmap--milestones)
15. [Stretch Goals](#15-stretch-goals)
16. [Making It Portfolio-Ready](#16-making-it-portfolio-ready)
17. [Risks & Mitigations](#17-risks--mitigations)

---

## 1. Goals & Non-Goals

### Goals
- Show a live **dashboard** of pipeline and deployment status across projects and environments.
- Ingest real **build and deployment events from GitHub** via webhooks.
- Enforce an **approval workflow** before anything reaches production.
- Provide **role-based access** (Administrator, Developer, Approver).
- Keep an **append-only audit log** of every security-relevant action.
- **Notify** people when builds or deployments fail.
- Be **deployable with one command** (`docker compose up`) and be built and tested by its own CI/CD pipeline.

### Non-Goals (for v1)
- Running builds itself. ReleaseOps *orchestrates and tracks*; GitHub Actions does the building.
- Multi-tenant SaaS billing or organizations.
- Replacing Kubernetes or Argo CD. Deployment execution is triggered through GitHub Actions `workflow_dispatch`.

---

## 2. Portfolio Skills Demonstrated

| Skill | Where it shows up |
|---|---|
| Full-stack development | React SPA + Node API + Postgres, all typed end to end |
| REST API design | Versioned resources, pagination, filtering, consistent errors, OpenAPI spec |
| Auth & RBAC | Sessions/JWT, password hashing, GitHub OAuth, per-route permission checks |
| Database design | Normalized schema, migrations, indexes, constraints, enum state machines |
| CI/CD automation | GitHub Actions pipeline for the app itself + webhook integration + deploy triggers |
| Audit & security | Append-only audit log, HMAC webhook verification, rate limiting, OWASP mitigations |
| Event-driven design | Webhook ingestion → job queue → notifications / real-time UI updates |
| DevOps | Docker, Compose, health checks, structured logging, metrics |

---

## 3. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** (strict) everywhere | One language, shared types |
| Monorepo | **pnpm workspaces** | Shares types/validation between web and API |
| Frontend | **React 19 + Vite**, React Router, **TanStack Query**, Tailwind CSS + shadcn/ui, Recharts | Fast dev loop, good server-state caching, polished UI |
| Backend | **Node.js + Fastify** (or Express) | Fast, schema-first, good TS support |
| Validation | **Zod** (shared package) | One schema for API input, DB writes, and frontend forms |
| ORM / migrations | **Prisma** (or Drizzle) | Typed queries, migration history checked into git |
| Database | **PostgreSQL 16** | Relational integrity, JSONB for webhook payloads |
| Queue / cache | **Redis + BullMQ** | Async webhook processing, notification retries |
| Real-time | **Server-Sent Events** (or Socket.IO) | Live dashboard updates |
| Auth | Email/password (argon2) + **GitHub OAuth**; httpOnly session cookies | Secure by default, no tokens in localStorage |
| Testing | **Vitest**, Supertest, **Playwright**, Testcontainers | Unit, integration, end to end |
| Infra | **Docker**, Docker Compose | One-command local and production-like setup |
| CI/CD | **GitHub Actions**, GHCR for images | Matches the domain of the app |
| Observability | pino (JSON logs), `/healthz` + `/readyz`, Prometheus `/metrics` | Shows production thinking |

---

## 4. System Architecture

```
                    ┌──────────────────────────┐
                    │        GitHub            │
                    │  (repos, Actions, OAuth) │
                    └────┬──────────────▲──────┘
          webhooks (HMAC)│              │ workflow_dispatch / REST
                         ▼              │
┌──────────┐  HTTPS  ┌───────────────────┴───────┐      ┌────────────┐
│  React   │◄───────►│      API (Fastify)        │◄────►│ PostgreSQL │
│   SPA    │   SSE   │  auth · RBAC · REST · SSE │      └────────────┘
└──────────┘         └───────┬───────────▲───────┘
                             │ enqueue   │ events
                             ▼           │
                       ┌──────────┐  ┌───┴──────────────┐
                       │  Redis   │◄►│  Worker (BullMQ) │──► Email / Slack / Discord
                       └──────────┘  └──────────────────┘
```

**Request flow for a webhook:**
1. GitHub POSTs `workflow_run` to `/api/v1/webhooks/github`.
2. API verifies the `X-Hub-Signature-256` HMAC and dedupes by `X-GitHub-Delivery` ID.
3. Raw payload is stored in `webhook_deliveries`, a job is enqueued, and the API returns `202` right away.
4. Worker maps the payload to a `Build` (or `Deployment`), upserts it, writes an audit entry, and publishes an event.
5. The API's SSE stream pushes the update to connected dashboards. On failure the worker enqueues a notification job.

**Production deploy flow:**
1. Developer requests a deploy of build `X` to `production`.
2. A `Deployment` is created with status `pending_approval`, and Approvers are notified.
3. An Approver approves (they cannot approve their own request; the required approval count is configurable per environment).
4. ReleaseOps calls the GitHub `workflow_dispatch` API to start the deploy workflow with the build SHA.
5. The deploy workflow reports progress back through webhooks: `in_progress` → `succeeded`/`failed`.

---

## 5. Domain Model & Database Schema

### Entities

| Table | Key columns | Notes |
|---|---|---|
| `users` | id, email (unique), name, password_hash (nullable), github_id (nullable), role, is_active, created_at | Role enum: `admin`, `developer`, `approver` |
| `sessions` | id, user_id, expires_at, ip, user_agent | Server-side sessions; revocable |
| `projects` | id, name, slug (unique), description, github_owner, github_repo, default_branch, webhook_secret_enc, created_by | One project per GitHub repo |
| `project_members` | project_id, user_id, project_role | Optional per-project scoping (Phase 5) |
| `environments` | id, project_id, name (`dev`/`staging`/`production`), order, requires_approval, required_approvals, deploy_workflow_file | Unique (project_id, name) |
| `builds` | id, project_id, github_run_id (unique), commit_sha, branch, commit_message, author, status, conclusion, started_at, finished_at, duration_ms, url | Status: `queued`, `in_progress`, `success`, `failure`, `cancelled` |
| `deployments` | id, project_id, environment_id, build_id, requested_by, status, started_at, finished_at, rollback_of (nullable FK), notes | State machine below |
| `approvals` | id, deployment_id, approver_id, decision (`approved`/`rejected`), comment, created_at | Unique (deployment_id, approver_id) |
| `audit_logs` | id, actor_id (nullable for system), action, entity_type, entity_id, before (JSONB), after (JSONB), ip, user_agent, created_at | **Append-only.** No UPDATE/DELETE grants at the DB level |
| `webhook_deliveries` | id, delivery_id (unique), event, project_id, payload (JSONB), status, error, received_at, processed_at | Idempotency + replay |
| `notification_channels` | id, project_id, type (`email`/`slack`/`discord`/`webhook`), config_enc, events[] | Which events go where |
| `notifications` | id, channel_id, event, entity_id, status, attempts, last_error, sent_at | Delivery tracking |

### Deployment state machine

```
pending_approval ──approve──► approved ──dispatch──► in_progress ──► succeeded
       │                                                  │
       └──reject──► rejected                              └──► failed ──► (rollback creates new deployment)
       └──cancel──► cancelled
```
Non-production environments skip `pending_approval` and start at `approved`.
Transitions are enforced in one service function (`transitionDeployment`), never with ad-hoc updates.

### Indexes
- `builds (project_id, created_at DESC)`, `builds (status)`
- `deployments (environment_id, created_at DESC)`, `deployments (status)`
- `audit_logs (entity_type, entity_id)`, `audit_logs (actor_id, created_at DESC)`
- `webhook_deliveries (delivery_id)` unique

---

## 6. Roles & Permissions (RBAC)

| Action | Admin | Developer | Approver |
|---|:-:|:-:|:-:|
| View dashboard, builds, deployments | ✅ | ✅ | ✅ |
| Create / edit / delete projects | ✅ | ❌ | ❌ |
| Configure environments & webhooks | ✅ | ❌ | ❌ |
| Deploy to dev / staging | ✅ | ✅ | ❌ |
| Request production deploy | ✅ | ✅ | ❌ |
| Approve / reject production deploy | ✅ | ❌ | ✅ |
| Approve **own** request | ❌ | ❌ | ❌ |
| Trigger rollback | ✅ | ✅ (requires approval in prod) | ❌ |
| Manage users & roles | ✅ | ❌ | ❌ |
| View audit log | ✅ | Own actions only | ✅ |
| Manage notification channels | ✅ | ❌ | ❌ |

**Implementation:**
- Permissions are defined once in `packages/shared/permissions.ts` as `can(user, action, resource?)`.
- The API enforces them with a `requirePermission('deployment:approve')` route hook.
- The frontend reads the same function to hide or disable controls. This is a UX convenience only; the server is the authority.
- Every permission denial is logged as `auth.denied`.

---

## 7. Feature Specifications

### 7.1 Authentication
- Email/password sign-up (admin-invite only after the first user), login, logout.
- GitHub OAuth login that links to an existing account by verified email.
- The first registered user becomes Admin (bootstrap).
- Sessions use httpOnly, Secure, SameSite=Lax cookies with a 7-day sliding expiry.
- Logins are rate-limited (5 per minute per IP+email).

### 7.2 Dashboard
- Summary cards: active projects, builds today, success rate over 7 days, deploys awaiting approval.
- A project × environment grid showing the current version (SHA + build #) and health status per cell.
- Recent activity feed, updated live over SSE.
- Charts: build success rate over time, deployment frequency, mean build duration, change failure rate.
  These cover the DORA metrics, which is a strong talking point.

### 7.3 Projects
- CRUD for projects, linked to a GitHub `owner/repo`.
- On creation, generate a webhook secret and show copy-paste setup instructions, or register the webhook automatically through the GitHub API if the user has authorized OAuth.
- Configure environments, their order, approval requirements, and the deploy workflow file name.

### 7.4 Builds
- Created and updated from `workflow_run` webhooks.
- List view filterable by project, branch, status, and date range, with pagination.
- Detail view: commit info, duration, a link to the GitHub run, and the deployments that used this build.

### 7.5 Deployments
- "Deploy" action on any successful build, with an environment picker.
- Promotion flow: dev → staging → production. Optionally require that a build has succeeded in staging before it can go to production.
- Deployment detail page: timeline of state transitions, approvals, and logs link.
- **Rollback:** one click to redeploy the last successful build for that environment.

### 7.6 Approval Workflow
- Approval queue page for Approvers.
- Approve or reject with a required comment on rejection.
- Configurable `required_approvals` (e.g. 2-person rule) per environment.
- Self-approval is blocked.
- Optional expiry: pending approvals auto-cancel after N hours.

### 7.7 Audit Log
- Every create, update, delete, state transition, login, failed login, role change, and permission denial is recorded.
- Searchable and filterable UI with CSV export.
- Writes happen in the **same DB transaction** as the change they describe.

### 7.8 GitHub Integration
- Inbound: `workflow_run`, `push`, `deployment_status` events.
- Outbound: `workflow_dispatch` to trigger deploys and commit status checks.
- A "Webhook deliveries" admin page shows payloads and errors and has a **Replay** button.

### 7.9 Notifications
- Events: `build.failed`, `deployment.failed`, `deployment.pending_approval`, `deployment.succeeded` (production only).
- Channels: email (Nodemailer, with Mailpit in dev), Slack and Discord incoming webhooks, and generic webhooks.
- Delivered through the job queue with retries and exponential backoff. Every attempt is tracked.
- In-app notification bell.

---

## 8. REST API Design

**Conventions**
- Base path `/api/v1`, JSON only, `camelCase` fields.
- Cursor pagination: `?limit=25&cursor=...` → `{ data: [...], nextCursor }`.
- Filtering via query params, e.g. `?status=failure&branch=main`.
- Error shape: `{ error: { code: "VALIDATION_ERROR", message, details } }` with correct HTTP status codes.
- An OpenAPI spec is generated from Zod schemas and served at `/api/docs`.

**Endpoints**

| Method | Path | Permission |
|---|---|---|
| POST | `/auth/register` · `/auth/login` · `/auth/logout` | public / authed |
| GET | `/auth/github` · `/auth/github/callback` | public |
| GET | `/auth/me` | authed |
| GET/POST | `/projects` | read / `project:create` |
| GET/PATCH/DELETE | `/projects/:id` | read / `project:update` / `project:delete` |
| GET/POST | `/projects/:id/environments` | read / `env:manage` |
| PATCH | `/environments/:id` | `env:manage` |
| GET | `/projects/:id/builds` · `/builds/:id` | read |
| GET | `/deployments?status=&environmentId=` | read |
| POST | `/deployments` `{ buildId, environmentId }` | `deployment:create` |
| GET | `/deployments/:id` | read |
| POST | `/deployments/:id/approve` · `/reject` | `deployment:approve` |
| POST | `/deployments/:id/cancel` · `/rollback` | `deployment:create` |
| GET | `/approvals/pending` | `deployment:approve` |
| GET | `/audit-logs?actorId=&entityType=&from=&to=` | `audit:read` |
| GET/PATCH | `/users` · `/users/:id` | `user:manage` |
| GET/POST/DELETE | `/projects/:id/notification-channels` | `notify:manage` |
| GET | `/metrics/summary` · `/metrics/dora?projectId=` | read |
| GET | `/events` (SSE stream) | authed |
| POST | `/webhooks/github` | HMAC signature |
| POST | `/webhook-deliveries/:id/replay` | admin |
| GET | `/healthz` · `/readyz` · `/metrics` | public / internal |

---

## 9. Frontend Pages & UX

| Route | Page |
|---|---|
| `/login`, `/register` | Auth |
| `/` | Dashboard |
| `/projects`, `/projects/new`, `/projects/:slug` | Project list, create, detail (tabs: Overview, Builds, Deployments, Environments, Settings) |
| `/builds/:id` | Build detail |
| `/deployments`, `/deployments/:id` | Deployment list and timeline |
| `/approvals` | Approval queue |
| `/audit` | Audit log explorer |
| `/admin/users`, `/admin/webhooks` | User management, webhook deliveries |
| `/settings` | Profile, notification preferences |

**UX requirements:** dark/light mode, status color system (green/amber/red/gray), loading skeletons, empty states with setup guidance, toast feedback, keyboard-accessible controls, and a responsive layout down to tablet width.

---

## 10. Security Design

- **Passwords:** argon2id hashing. No plaintext secrets in logs.
- **Sessions:** httpOnly cookies, rotated on login, invalidated on role change or deactivation.
- **CSRF:** SameSite cookies plus a double-submit token on state-changing requests.
- **Webhooks:** HMAC-SHA256 verification with `timingSafeEqual`, replay protection via delivery ID, and a payload size limit.
- **Secrets at rest:** webhook secrets and channel configs encrypted with AES-256-GCM using a key from env.
- **Input validation:** Zod on every route, and parameterized queries via the ORM.
- **Headers:** `@fastify/helmet` (CSP, HSTS) and CORS locked to the web origin.
- **Rate limiting:** global limits plus stricter ones on auth routes.
- **Least privilege:** the DB role used by the app cannot `UPDATE`/`DELETE` on `audit_logs`.
- **Supply chain:** Dependabot, `pnpm audit`, CodeQL, Trivy image scan, and pinned action SHAs in workflows.
- **Docs:** a `SECURITY.md` with a short threat model (STRIDE table) is a strong portfolio signal.

---

## 11. Testing Strategy

| Layer | Tool | Target |
|---|---|---|
| Unit | Vitest | Permission matrix, deployment state machine, webhook signature, payload mappers. Aim for ~90% on `services/` |
| Integration | Vitest + Supertest + Testcontainers (real Postgres/Redis) | Every API route: happy path, auth failure, permission failure, validation failure |
| Contract | Recorded GitHub webhook fixtures | Each supported event type maps correctly |
| E2E | Playwright | Critical journeys: register → create project → receive webhook → deploy → approve → see on dashboard |
| Frontend | Vitest + React Testing Library | Forms, permission-gated UI |

Coverage is reported in CI and shown as a README badge.

---

## 12. CI/CD for ReleaseOps Itself

The project should eat its own dog food: its own pipeline reports into a running ReleaseOps instance.

**`.github/workflows/ci.yml`**, on PRs and pushes to `main`:
1. Install (pnpm, cached) → lint (ESLint) → typecheck (`tsc --noEmit`) → format check (Prettier)
2. Unit and integration tests (Postgres and Redis service containers)
3. Playwright E2E against `docker compose`
4. Build Docker images for `api`, `worker`, `web`
5. Security: CodeQL, `pnpm audit`, Trivy image scan

**`.github/workflows/release.yml`**, on push to `main` or a tag:
1. Build and push images to **GHCR** tagged with the SHA and semver
2. Deploy to **staging** automatically
3. Deploy to **production** through a GitHub Environment with required reviewers, mirroring the app's own approval concept
4. Run smoke tests against `/readyz`

**`.github/workflows/deploy.yml`**: a `workflow_dispatch` target that ReleaseOps itself triggers.

**Also:** Dependabot, branch protection on `main`, Conventional Commits, and an automated changelog (release-please).

---

## 13. Repository Structure

```
releaseops/
├── apps/
│   ├── api/                 # Fastify REST API + SSE
│   │   ├── src/
│   │   │   ├── routes/      # one file per resource
│   │   │   ├── services/    # business logic (state machine, approvals)
│   │   │   ├── integrations/github/
│   │   │   ├── plugins/     # auth, rbac, audit, rate-limit
│   │   │   └── server.ts
│   │   ├── prisma/          # schema.prisma, migrations/, seed.ts
│   │   └── test/
│   ├── worker/              # BullMQ consumers: webhooks, notifications
│   └── web/                 # React + Vite SPA
│       └── src/{pages,components,hooks,api,lib}
├── packages/
│   ├── shared/              # Zod schemas, types, permissions, constants
│   └── config/              # eslint, tsconfig, prettier presets
├── e2e/                     # Playwright tests
├── docker/                  # Dockerfiles
├── docs/                    # PLAN.md, ARCHITECTURE.md, API.md, ADRs, screenshots
├── scripts/                 # simulate-webhooks.ts, seed-demo.ts
├── .github/workflows/
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 14. Phased Roadmap & Milestones

Estimates assume part-time work of about 10–15 hours/week. Each phase ends with a demoable result and a tagged release.

### Phase 0 — Foundations (Week 1) → `v0.1.0`
- [x] Monorepo scaffold (pnpm workspaces, TS strict, ESLint, Prettier, Husky + lint-staged)
- [x] `docker-compose.yml` with Postgres, Redis, Mailpit
- [x] Fastify skeleton with `/healthz`, pino logging, and a central error handler
- [x] Vite React skeleton with Tailwind, routing, and an API client
- [x] CI workflow: lint, typecheck, test on every PR
- [x] Prisma schema v1 and first migration

**Done when:** `docker compose up` brings up the stack and CI is green.

### Phase 1 — Auth & RBAC (Weeks 2–3) → `v0.2.0`
- [x] Users and sessions tables, register/login/logout, argon2
- [x] First-user-is-admin bootstrap and the admin invite flow
- [x] `can()` permission matrix in `shared` with full unit tests
- [x] `requirePermission` route hook
- [x] Audit log plugin covering auth events
- [x] Login and register pages, protected routes, user menu
- [x] Admin user management page (change role, deactivate)

**Done when:** every role sees exactly what it should, and there are tests proving each denial.

### Phase 2 — Projects, Environments, Builds (Weeks 4–5) → `v0.3.0`
- [ ] Projects and environments CRUD (API + UI)
- [ ] GitHub webhook endpoint: HMAC verify, dedupe, store, enqueue
- [ ] Worker: `workflow_run` → `builds` upsert
- [ ] Builds list and detail pages with filters and pagination
- [ ] `scripts/simulate-webhooks.ts` for demoing without a real repo
- [ ] Webhook deliveries admin page with replay

**Done when:** pushing to a real linked repo makes a build appear in ReleaseOps.

### Phase 3 — Deployments & Approvals (Weeks 6–7) → `v0.4.0`
- [ ] Deployment state machine service with exhaustive unit tests
- [ ] Create a deployment from a build; non-production deploys auto-approve
- [ ] Approval queue, approve/reject, self-approval block, N-approver rule
- [ ] GitHub `workflow_dispatch` trigger plus `deployment_status` ingestion
- [ ] Deployment timeline UI
- [ ] Rollback
- [ ] Audit entries for every transition, written in the same transaction

**Done when:** the full flow works end to end: build → staging → request prod → approve → deployed.

### Phase 4 — Dashboard, Real-Time, Notifications (Weeks 8–9) → `v0.5.0`
- [ ] Dashboard summary cards and the project × environment grid
- [ ] SSE event stream and live UI updates via TanStack Query invalidation
- [ ] DORA metrics endpoints and charts
- [ ] Notification channels (email, Slack, Discord) with retry and backoff
- [ ] In-app notification bell
- [ ] Audit log explorer with filters and CSV export

**Done when:** a failed build turns the dashboard red within seconds and sends a Slack/email alert.

### Phase 5 — Hardening & Polish (Week 10) → `v0.9.0`
- [ ] Security pass: helmet, CSRF, rate limiting, encrypted secrets, DB grants on audit_logs
- [ ] GitHub OAuth login
- [ ] Playwright E2E suite covering the critical journeys
- [ ] Prometheus `/metrics`, `/readyz` checks for DB and Redis
- [ ] Accessibility pass (axe), dark mode, empty states, skeletons
- [ ] CodeQL, Trivy, Dependabot

### Phase 6 — Ship It (Weeks 11–12) → `v1.0.0`
- [ ] Release workflow: GHCR images → staging → production with required reviewers
- [ ] Deploy a public demo (Fly.io / Render / Railway + managed Postgres) with seeded demo data and read-only demo accounts per role
- [ ] README with screenshots, GIF, architecture diagram, and badges
- [ ] `docs/ARCHITECTURE.md`, `SECURITY.md`, ADRs for key decisions
- [ ] Point ReleaseOps' own CI webhooks at the demo instance (dogfooding)

---

## 15. Stretch Goals
- Per-project membership and roles (project-scoped RBAC)
- Deployment freeze windows and change calendar
- Feature-flag style canary deploys (percentage rollout tracking)
- GitLab / Bitbucket adapters behind an `SCMProvider` interface
- Terraform for the demo infrastructure
- Kubernetes Helm chart
- Public status page per project
- AI-generated release notes from commit messages

---

## 16. Making It Portfolio-Ready
- **README first impression:** one-line pitch, live demo link, demo credentials for each role, a 30-second GIF, and an architecture diagram.
- **Badges:** CI status, coverage, license, latest release.
- **ADRs** (`docs/adr/`): short records explaining *why* you chose Fastify, SSE over WebSockets, server-side sessions over JWT, and so on. Interviewers love these.
- **Commit hygiene:** Conventional Commits, small PRs, and issues linked to milestones. The GitHub history becomes part of the portfolio.
- **Talking points:** idempotent webhook processing, transactional audit logging, state machine enforcement, two-person approval rule, and DORA metrics.

---

## 17. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Scope creep | Strict phase gates; anything new goes to Stretch Goals |
| GitHub webhooks hard to test locally | `simulate-webhooks.ts` script, recorded fixtures, `smee.io` / `gh webhook forward` for live testing |
| Free-tier hosting sleeps or limits | Seeded demo data; document local `docker compose` as the primary demo path |
| Leaking secrets in a public repo | `.env.example` only, gitleaks in CI, GitHub secret scanning enabled |
| Real-time complexity | Start with polling via TanStack Query `refetchInterval`, then upgrade to SSE in Phase 4 |
