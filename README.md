# ReleaseOps

**A CI/CD management platform:** track build pipelines, gate production deployments behind approvals, and keep a full audit trail of every release.

> 🚧 **Status: planning / early development.** See the [project plan](docs/PLAN.md) for the full roadmap.

## Features (planned)

- 📊 **Dashboard** with live pipeline and deployment status across projects and environments
- 📁 **Projects & environments** linked to GitHub repositories
- 🔨 **Build tracking** ingested from GitHub Actions via signed webhooks
- 🚀 **Deployments** with promotion (dev → staging → production) and one-click rollback
- ✅ **Approval workflow** for production: two-person rule, no self-approval
- 👥 **Role-based access:** Administrator, Developer, Approver
- 📜 **Audit log:** append-only and searchable, with CSV export
- 🔔 **Notifications** for failed builds and deployments (email, Slack, Discord)
- 📈 **DORA metrics:** deployment frequency, change failure rate, lead time

## Tech Stack

React · TypeScript · Node.js (Fastify) · PostgreSQL · Redis/BullMQ · Prisma · Docker · GitHub Actions

## Architecture

```
GitHub ──webhooks──► API (Fastify) ◄──► PostgreSQL
   ▲                   │   ▲
   └─workflow_dispatch─┘   │ SSE
                       Redis/Worker ──► Email / Slack / Discord
                           │
                     React SPA (Vite)
```

Details are in [docs/PLAN.md](docs/PLAN.md#4-system-architecture).

## Roadmap

| Phase | Milestone | Version |
|---|---|---|
| 0 | Foundations: monorepo, Docker, CI | v0.1.0 |
| 1 | Auth & RBAC | v0.2.0 |
| 2 | Projects, environments, builds via webhooks | v0.3.0 |
| 3 | Deployments & approval workflow | v0.4.0 |
| 4 | Dashboard, real-time updates, notifications | v0.5.0 |
| 5 | Security hardening & polish | v0.9.0 |
| 6 | Public demo & release | v1.0.0 |

## License

[MIT](LICENSE)
