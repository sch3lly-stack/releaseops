# ReleaseOps engineering workflow

This file is the permanent operating manual for people and coding agents working in this
repository. Read it at the start of every development session. Update it when the procedure
changes. Do not delete it, and do not replace it, without explicit authorization. It stays in
the repository root, it is version controlled, and it must not be added to `.gitignore`.

GitHub is the system of record for planning, implementation, review, and release. A change is
not tracked because the code exists. It is tracked when an issue, a branch, a pull request, the
checks, and the merge all point at the same work.

## Session start

1. Read this file.
2. Inspect `git status`.
3. Review open issues: `gh issue list --repo sch3lly-stack/releaseops --state open`.
4. Review open pull requests.
5. Check failing GitHub Actions on those pull requests.
6. Identify unfinished work and anything labeled `status:blocked`.
7. Take the next open issue in milestone order, respecting the dependencies written on the issue.

Do not start meaningful work that has no issue.

## Issues

Every meaningful feature, bug fix, refactor, security improvement, infrastructure change, or
documentation task has a GitHub issue before a branch is created.

Each issue includes:

- A clear title.
- The objective.
- Background and technical context.
- The scope.
- Acceptance criteria.
- Dependencies.
- Testing requirements.
- A definition of done.
- A `type:*` label and a `priority:*` label.
- A milestone when the work belongs to a release.

Search open issues before creating one. Do not file a duplicate.

Do not close an issue because code was written. Close it only when the definition of done below
is met. Do not close incomplete work.

When an issue records work that already shipped, say that in the issue body. Name the date the
issue was opened, the pull request that landed the work, and the fact that the issue did not
exist while the work was in progress. Do not backdate an issue or imply a review that did not
happen.

Stretch goals in `docs/PLAN.md` section 15 are outside v1.0.0 unless someone explicitly asks for
an issue.

## Labels

- `type:feature`, `type:bug`, `type:refactor`, `type:security`, `type:documentation`,
  `type:testing`, `type:infrastructure`
- `priority:critical`, `priority:high`, `priority:medium`, `priority:low`
- `status:blocked` when the issue cannot proceed, with the blocker named in the body
- `phase-0` through `phase-6` for the roadmap phase
- `release` for version tags and the release workflow

`priority:critical` means a broken release, a security exposure, or a defect that stops the
current milestone. Ordinary roadmap work is `priority:high` or `priority:medium`.

## Branches

Do not do feature work directly on `main`.

Use a short-lived branch named for one issue:

- `feature/<issue>-<slug>`
- `bugfix/<issue>-<slug>`
- `hotfix/<issue>-<slug>`
- `refactor/<issue>-<slug>`
- `docs/<issue>-<slug>`
- `test/<issue>-<slug>`
- `security/<issue>-<slug>`

Keep unrelated work on separate branches.

## Commits

Use Conventional Commits.

```
feat(auth): implement role-based access control
fix(api): correct invalid pagination handling
test(deployments): add rollback integration tests
docs(architecture): document deployment workflow
```

Follow Semantic Versioning for releases. Do not commit `.env`, credentials, the generated Prisma
client, or build output.

## Pull requests

Every meaningful change enters `main` through a pull request. The description must:

- Link the issue. Use `Closes #<n>` when the merge finishes that issue.
- Explain what changed and why.
- Summarize the implementation and name the affected components.
- Record the testing that was performed.
- State risks.
- Include screenshots for a significant UI change.
- Include migration notes when the database changes.

Do not bundle unrelated changes to reduce the number of pull requests.

## Review and merge

Before merging, review the full diff. Check the issue requirements, unrelated edits, security,
duplication, the project style, tests, lint, type checking, the production build, and any
migration.

The required GitHub Actions check is "Lint, typecheck, and test".

On a workstation whose path contains a colon, pnpm will not put `node_modules/.bin` on `PATH`.
Run the tools with `node` and the package entry point, or rely on GitHub Actions. The CI checkout
path has no colon.

Write the engineering self-review as a pull request review comment. Do not approve your own pull
request from a second account, and do not describe that comment as an independent human review.
Use GitHub's review approval only when a different authorized reviewer is available.

If branch protection later requires an independent approval, do not bypass it. If a merge is
blocked, report the exact blocker and leave the pull request open.

`main` had no branch protection on 2026-11-13. Pull requests #1 and #2 used merge commits. Leave
that history as it is. Prefer squash merge for a focused branch from this point on:

```
gh pr merge <n> --squash --delete-branch
```

Merge only when:

- The required check has passed.
- The self-review is on the pull request.
- No blocking review comment is unresolved.
- The branch has no conflicts with `main`.
- The acceptance criteria are satisfied.
- The base branch is `main`.

After the merge, confirm the pull request state is `MERGED` and the linked issue is closed.

## Definition of done

A task is done only when all of the following are true:

- The implementation is finished.
- The acceptance criteria are satisfied.
- The relevant tests pass, and existing behavior has not regressed.
- The change has been reviewed.
- Documentation affected by the change is updated.
- The required CI checks pass.
- The pull request is merged.
- The issue is closed.

## Versions

| Milestone | Phase | Meaning                                    |
| --------- | ----- | ------------------------------------------ |
| v0.1.0    | 0     | Foundations                                |
| v0.2.0    | 1     | Auth and RBAC                              |
| v0.3.0    | 2     | Projects, environments, and builds         |
| v0.4.0    | 3     | Deployments and approvals                  |
| v0.5.0    | 4     | Dashboard, live updates, and notifications |
| v0.9.0    | 5     | Hardening and polish                       |
| v1.0.0    | 6     | Public demo and release                    |

Add a `CHANGELOG.md` entry for each meaningful release. Do not create a git tag unless the issue
for that release says to. On 2026-11-13, v0.1.0 and v0.2.0 were merged and not tagged. That
remaining work is the open tag issue.

Leave a milestone open until its issues, including the version tag, are done.

## Documentation

Keep these current when a change affects them:

- `README.md`
- `AGENTS.md`
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `SECURITY.md`, once that file exists
- `docs/PLAN.md`, which is the roadmap and is listed in `.prettierignore`
- Architecture notes, API notes, database notes, and ADRs when those documents exist

The threat model, `docs/ARCHITECTURE.md`, and the ADRs are still an open Phase 6 issue. Do not
pretend they exist before that issue lands.

## Repository facts

- GitHub repository: `sch3lly-stack/releaseops`. Public, MIT, copyright 2026.
- pnpm 12.18.0. Package settings live in `pnpm-workspace.yaml`. Dependency build scripts are
  denied unless `allowBuilds` lists them.
- Node.js `>=22.12` locally. CI uses Node.js 24.
- TypeScript 6.0.3. Stay on this release until typescript-eslint supports TypeScript 7.
- The API, worker, and shared packages use NodeNext and `.js` import specifiers. The web app uses
  Vite, React 19, and Tailwind 4.
- Prisma 7. The database URL lives in `apps/api/prisma.config.ts`, not in `schema.prisma`. The
  generated client is gitignored.
- Passwords use `hash-wasm` argon2id. Do not add the native `argon2` package. Its install script
  fails when the project path contains a colon.
- Do not log passwords or raw invite tokens.
- `can()` in `packages/shared` is the authorization authority. The interface only hides controls.
- The login rate limit is process-local. A shared limiter belongs to the later hardening issue.
- Docker Compose passwords are local defaults. Do not reuse them.
- The worker process starts, connects to Redis, and logs jobs. It does not yet turn webhook
  events into builds.
- The v1 Prisma schema already contains later tables such as projects and deployments. Application
  features for those tables are still the open Phase 2 through Phase 4 issues.

## Safety

Routine issue, branch, implementation, test, pull request, self-review, eligible merge, and
documentation work does not need an extra confirmation.

Stop and report before:

- Deleting user data.
- Running a destructive production database operation.
- Exposing private information.
- Changing repository ownership or access.
- Disabling a security control.
- Bypassing branch protection.
- Introducing a paid service or any other unexpected cost.
- Performing an irreversible production deployment.

Never hide a failing test, an unfinished implementation, or an unresolved security concern.

If `gh` cannot complete an operation, report the command and the error. Do not claim that an
issue, branch, pull request, or merge exists unless the command succeeded.

Creating a GitHub Project needs a token with the `project` scope. If `gh project` fails for a
missing scope, report that and continue with issues and milestones. Do not run an interactive
`gh auth refresh` unless the person asks for it.

## End of a task

1. Update the issue with what shipped and which tests ran.
2. Update the pull request.
3. Merge when the review section above is satisfied.
4. Confirm the issue is closed.
5. Name the next open issue.
