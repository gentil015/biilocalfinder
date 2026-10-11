FROM node:20-alpine AS builder
WORKDIR /app
COPY apps/api/package.json apps/api/package-lock.json* ./
RUN npm install
COPY apps/api ./
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
EXPOSE 4000
CMD ["node", "dist/main"]
