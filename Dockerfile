# WIJAHA preview image: Node server + embedded PostgreSQL (pgvector).
# Preview only: the database is ephemeral and re-seeded with demo data on every cold start.
FROM node:22-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/pgdg.gpg \
 && echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update && apt-get install -y --no-install-recommends postgresql-16 postgresql-16-pgvector \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=development \
    SERVE_STATIC=true \
    COOKIE_BRIDGE=true \
    ENABLE_DEMO_LOGIN=true \
    AI_PROVIDER=mock \
    BILLING_PROVIDER=mock \
    EMAIL_PROVIDER=console \
    SQL_HOST=127.0.0.1 \
    SQL_DB_NAME=wijaha \
    SQL_USER=app_user \
    SQL_PASSWORD=preview \
    SQL_ADMIN_USER=postgres \
    SQL_ADMIN_PASSWORD=preview
EXPOSE 3000
CMD ["sh", "deploy/entrypoint.sh"]
