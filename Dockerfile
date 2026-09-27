# Vercel 외 환경(Cloud Run / Render / Railway / Fly.io 등) 배포용 이미지.
# 실행 시 DATABASE_URL, DIRECT_URL, ANTHROPIC_API_KEY, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 필요.
# 컨테이너 시작 시 prisma migrate deploy 후 서버 기동. PORT 기본 3000 (Cloud Run은 자동 주입).
FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
# migrate deploy용 Prisma CLI (standalone 번들에는 포함되지 않음)
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
USER node
EXPOSE 3000
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
