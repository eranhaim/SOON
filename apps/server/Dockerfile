# Build context: repo root.  docker build -f apps/server/Dockerfile .

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/
RUN npm ci -w @soon/server -w @soon/shared --include-workspace-root
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN npm run build -w @soon/server

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev -w @soon/server -w @soon/shared --include-workspace-root && npm cache clean --force
COPY packages/shared packages/shared
COPY --from=build /app/apps/server/dist apps/server/dist
COPY apps/server/drizzle apps/server/drizzle
WORKDIR /app/apps/server
EXPOSE 4000
CMD ["sh", "-c", "node dist/migrate.js && exec node dist/index.js"]
