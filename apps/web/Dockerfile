FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/notifiers/package.json* ./packages/notifiers/
COPY packages/workflow-engine/package.json* ./packages/workflow-engine/
COPY apps/web/package.json ./apps/web/

RUN npm install

COPY packages/shared ./packages/shared
COPY packages/notifiers ./packages/notifiers
COPY packages/workflow-engine ./packages/workflow-engine
COPY apps/web ./apps/web

RUN npm run --workspace=@nexusflow/shared build
RUN npm run --workspace=nexusflow-web build

FROM nginx:alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
