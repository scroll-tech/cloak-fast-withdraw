# ---- Build stage ----

FROM node:20-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src src
RUN npm run build

# ---- Runtime stage ----

FROM node:20-slim
WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY migrations migrations
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
