FROM node:22.14-bookworm-slim AS build

RUN corepack enable && corepack prepare pnpm@11.1.3 --activate

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build
RUN pnpm --filter @atira/demo deploy --prod --legacy /app/deploy

FROM node:22.14-bookworm-slim

WORKDIR /app
COPY --from=build /app/deploy ./

ENV HOST=0.0.0.0
ENV PORT=8080
EXPOSE 8080

CMD ["node", "--experimental-strip-types", "server.ts", "--production"]
