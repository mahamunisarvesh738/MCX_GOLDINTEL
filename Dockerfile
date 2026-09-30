# Multi-stage Docker build for MCX Bullion Commodity Derivatives Intelligence
FROM node:20-alpine AS builder

WORKDIR /app

# Install client dependencies and build React app
COPY client/package*.json ./client/
RUN cd client && npm install --legacy-peer-deps

COPY client/ ./client/
RUN cd client && npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --only=production

COPY server/ ./server/
COPY --from=builder /app/dist ./dist

EXPOSE 5000 10000

CMD ["node", "server/index.js"]
