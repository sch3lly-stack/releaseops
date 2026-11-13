#!/bin/sh
set -eu
pnpm --filter @releaseops/api db:migrate
pnpm --filter @releaseops/api start
