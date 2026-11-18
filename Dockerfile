FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN DATABASE_URL=postgresql://build@localhost/build npx prisma generate && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY src/prisma/database-url.ts ./src/prisma/
USER node
# ponytail: migração no start serve para uma instância; com várias réplicas, rodar migrate deploy num passo de deploy separado.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
