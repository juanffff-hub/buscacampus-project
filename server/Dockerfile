FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./

EXPOSE 4000
CMD ["sh", "-c", "npm run db:init && npm start"]
