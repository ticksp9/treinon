# TreinON web app for a club's own server.
# The backend address is NOT baked in: /config.js is generated at container start.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY deploy/servidor-clube/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/servidor-clube/docker-entrypoint.sh /docker-entrypoint.d/40-treinon-config.sh
RUN chmod +x /docker-entrypoint.d/40-treinon-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
