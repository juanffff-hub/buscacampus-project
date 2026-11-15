FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
RUN mkdir -p /var/lib/buscacampus/uploads /var/lib/buscacampus/private_uploads \
  && chown -R node:node /var/lib/buscacampus
USER node

EXPOSE 4000
CMD ["sh", "-c", "npm run db:init && npm start"]
