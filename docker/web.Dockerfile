FROM node:22-alpine AS build
RUN npm install -g pnpm@12.18.0
WORKDIR /app
COPY . .
ENV HUSKY=0
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @releaseops/shared build \
  && pnpm --filter @releaseops/web build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
