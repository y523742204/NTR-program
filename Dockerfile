# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@11.7.0 --activate

WORKDIR /workspace

ARG NPM_REGISTRY=https://registry.npmmirror.com

RUN pnpm config set registry "$NPM_REGISTRY" \
  && pnpm config set fetch-timeout 600000

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

FROM base AS dependencies

RUN --mount=type=cache,id=ntr-pnpm,target=/pnpm/store,sharing=locked \
  pnpm config set store-dir /pnpm/store \
  && pnpm install --frozen-lockfile

FROM dependencies AS build

COPY apps/api apps/api
COPY packages/shared packages/shared

RUN rm -f packages/shared/tsconfig.tsbuildinfo \
  && pnpm --filter @ntr/shared build \
  && pnpm --filter @ntr/api build

FROM base AS production-dependencies

ENV NODE_ENV="production"

RUN --mount=type=cache,id=ntr-pnpm,target=/pnpm/store,sharing=locked \
  pnpm config set store-dir /pnpm/store \
  && pnpm install --prod --frozen-lockfile --ignore-scripts --filter @ntr/api...

FROM build AS migration

ENV NODE_ENV="production"

WORKDIR /workspace/apps/api

CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV="production"
ENV API_PORT="3000"
ENV UPLOAD_ROOT="/app/uploads"

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=production-dependencies --chown=node:node /workspace/node_modules node_modules
COPY --from=production-dependencies --chown=node:node /workspace/apps/api/node_modules apps/api/node_modules
COPY --from=production-dependencies --chown=node:node /workspace/apps/api/package.json apps/api/package.json
COPY --from=production-dependencies --chown=node:node /workspace/packages/shared/package.json packages/shared/package.json
COPY --from=build --chown=node:node /workspace/apps/api/dist apps/api/dist
COPY --from=build --chown=node:node /workspace/packages/shared/dist packages/shared/dist

RUN mkdir -p "$UPLOAD_ROOT" && chown node:node "$UPLOAD_ROOT"

USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"]

CMD ["node", "apps/api/dist/main.js"]
