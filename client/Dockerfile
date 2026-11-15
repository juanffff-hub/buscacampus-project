FROM node:22-alpine AS build

ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=${VITE_API_URL}
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 8080
