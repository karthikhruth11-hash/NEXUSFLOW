FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace manifests
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/workflow-engine/package.json* ./packages/workflow-engine/
COPY packages/notifiers/package.json* ./packages/notifiers/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN npm install

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/workflow-engine ./packages/workflow-engine
COPY apps/api ./apps/api

# Build packages and API
RUN npm run --workspace=@nexusflow/shared build
RUN npm run --workspace=@nexusflow/workflow-engine build
RUN npm run --workspace=nexusflow-api build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/workflow-engine/package.json ./packages/workflow-engine/
COPY apps/api/package.json ./apps/api/

RUN npm install --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/workflow-engine/dist ./packages/workflow-engine/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 4000

CMD ["node", "apps/api/dist/server.js"]
