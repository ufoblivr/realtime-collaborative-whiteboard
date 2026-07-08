FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run prisma:generate
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=base /app/package*.json ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/.next ./.next
COPY --from=base /app/public ./public
COPY --from=base /app/server.mjs ./server.mjs
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/src ./src
EXPOSE 3000
CMD ["node", "server.mjs"]
