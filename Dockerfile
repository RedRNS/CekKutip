# syntax=docker/dockerfile:1
#
# CekKutip: one Node service that serves the API and the built web app.
#
#   docker build -t cekkutip .
#   docker run --rm -p 8787:8787 --env-file .env cekkutip
#
# The web build stops when src/site.config.ts still has TODO placeholders, because those values appear
# on public pages. To try the image locally before they are filled in, add --build-arg ALLOW_TODO=1.
# Never set it for a real deploy.

# ---- 1. Build the web app and the server bundle -------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
ARG ALLOW_TODO=0
RUN CEKKUTIP_ALLOW_TODO=${ALLOW_TODO} npm run build

# ---- 2. Production dependencies of the server only ----------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev -w @cekkutip/server --ignore-scripts --no-audit --no-fund \
 && npm cache clean --force

# ---- 3. The image that runs ----------------------------------------------------------------------
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8787 \
    STATIC_DIR=/app/web \
    EVALUATION_SUMMARY=/app/eval/results/summary.json
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist/server ./server
COPY --from=build /app/apps/web/dist ./web
COPY --from=build /app/eval/results ./eval/results
USER node
EXPOSE 8787
# Hosts that sleep an idle service (see docs/DEPLOY.md) call the same address.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1
CMD ["node", "server/index.js"]
