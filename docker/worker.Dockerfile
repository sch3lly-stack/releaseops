FROM node:22-alpine
RUN npm install -g pnpm@12.18.0
WORKDIR /app
COPY . .
ENV HUSKY=0
ENV NODE_ENV=production
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @releaseops/shared build \
  && pnpm --filter @releaseops/worker build
CMD ["pnpm", "--filter", "@releaseops/worker", "start"]
