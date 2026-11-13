# Contributing to ReleaseOps

This repository tracks work in GitHub issues, short-lived branches, and pull requests. Coding
agents follow the same rules in [AGENTS.md](AGENTS.md).

## Issues

Open an issue before starting meaningful work. The issue should state the objective, the scope,
the acceptance criteria, the dependencies, how it will be tested, and the definition of done.

Use a `type:*` label and a `priority:*` label. Put the issue on the milestone it belongs to.

## Branches

Branch from `main`. Name the branch after the issue:

- `feature/24-short-description`
- `bugfix/31-short-description`
- `hotfix/12-short-description`
- `refactor/18-short-description`
- `docs/34-short-description`
- `test/40-short-description`
- `security/42-short-description`

One focused change per branch.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(auth): implement role-based access control
fix(api): correct invalid pagination handling
docs(workflow): record the engineering rules
```

## Pull requests

Open a pull request into `main`. The template asks for the issue link, what changed, why, how it
was tested, the risks, screenshots for UI changes, and migration notes for database changes.

Use `Closes #<issue>` when the merge completes that issue.

`main` requires a pull request, a green "Lint, typecheck, and test" check, and a linear history.
Approving reviews are not required. A maintainer still reviews the diff, including their own pull
requests. That self-review is a review comment. It is not an independent human approval.

Squash is the only merge method. GitHub deletes the head branch after the merge.

## Checks

The same commands CI runs:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

If the project path contains a colon, pnpm cannot place `node_modules/.bin` on `PATH`. Run the
CLI through `node` and its package entry point, or use CI.

## Local setup

See the README. Copy `.env.example` to `.env`. Do not commit `.env`, the generated Prisma client,
or build output. The Docker Compose password is a local default.
