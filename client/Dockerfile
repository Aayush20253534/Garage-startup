# syntax=docker/dockerfile:1

FROM node:22-alpine AS build

WORKDIR /app

# Vite variables are public build-time configuration. Secrets must never use
# the VITE_ prefix because they are embedded in the browser bundle.
ARG VITE_API_URL=/api/v1
ARG VITE_USE_RELATIVE_API=true
ARG VITE_API_FALLBACK_URL=
ARG VITE_FIREBASE_API_KEY=
ARG VITE_FIREBASE_AUTH_DOMAIN=
ARG VITE_FIREBASE_PROJECT_ID=
ARG VITE_FIREBASE_APP_ID=
ARG VITE_ERROR_REPORTING_ENABLED=false
ARG VITE_APP_VERSION=docker

ENV VITE_API_URL=${VITE_API_URL} \
    VITE_USE_RELATIVE_API=${VITE_USE_RELATIVE_API} \
    VITE_API_FALLBACK_URL=${VITE_API_FALLBACK_URL} \
    VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY} \
    VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN} \
    VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID} \
    VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID} \
    VITE_ERROR_REPORTING_ENABLED=${VITE_ERROR_REPORTING_ENABLED} \
    VITE_APP_VERSION=${VITE_APP_VERSION}

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund && npm cache clean --force

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime

RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
