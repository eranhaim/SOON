# Web build of the Expo app, served by Caddy (which also proxies /api to the server).
# Build context: repo root.  docker build -f apps/mobile/Dockerfile --build-arg EXPO_PUBLIC_API_URL=... .

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/
RUN npm ci -w @soon/mobile -w @soon/shared --include-workspace-root
COPY packages/shared packages/shared
COPY apps/mobile apps/mobile
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}
WORKDIR /app/apps/mobile
RUN npx expo export --platform web --output-dir dist

FROM caddy:2-alpine
COPY deploy/web.Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/mobile/dist /srv
EXPOSE 80
