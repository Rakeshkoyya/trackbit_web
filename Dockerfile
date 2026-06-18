# syntax=docker/dockerfile:1
#
# TrackBit Web — production image (Next.js standalone output).
# Build context: the repo root (trackbit_web/). Built by Dokploy from this Dockerfile.
#
# IMPORTANT: NEXT_PUBLIC_* values are inlined into the browser bundle at BUILD
# time, not read at runtime. So the API URL must be passed as a build arg in
# Dokploy (Build Args), e.g.:
#     NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com/api/v1
# Setting it only as a runtime env var will NOT change the compiled bundle.

# ---- deps: install node_modules from the lock file ----
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compile the Next.js app ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- runner: minimal runtime image ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Run as a non-root user.
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Static assets + the standalone server (which bundles its own minimal node_modules).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
