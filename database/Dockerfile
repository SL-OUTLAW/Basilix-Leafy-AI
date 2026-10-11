FROM timescale/timescaledb:2.29.2-pg18

COPY init.sql /docker-entrypoint-initdb.d/01-init.sql
COPY backend-init.sql /docker-entrypoint-initdb.d/02-backend-init.sql

EXPOSE 5432