#!/bin/sh

set -eu

: "${PROD_MIGRATION_PASSWORD:?PROD_MIGRATION_PASSWORD is required}"
: "${PROD_APP_PASSWORD:?PROD_APP_PASSWORD is required}"
: "${TEST_MIGRATION_PASSWORD:?TEST_MIGRATION_PASSWORD is required}"
: "${TEST_APP_PASSWORD:?TEST_APP_PASSWORD is required}"

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=prod_migration_password="$PROD_MIGRATION_PASSWORD" \
  --set=prod_app_password="$PROD_APP_PASSWORD" \
  --set=test_migration_password="$TEST_MIGRATION_PASSWORD" \
  --set=test_app_password="$TEST_APP_PASSWORD" <<'SQL'
CREATE ROLE ntr_prod_migrator LOGIN PASSWORD :'prod_migration_password';
CREATE ROLE ntr_prod_app LOGIN PASSWORD :'prod_app_password';
CREATE ROLE ntr_test_migrator LOGIN PASSWORD :'test_migration_password';
CREATE ROLE ntr_test_app LOGIN PASSWORD :'test_app_password';

CREATE DATABASE ntr_prod OWNER ntr_prod_migrator;
CREATE DATABASE ntr_test OWNER ntr_test_migrator;

REVOKE ALL ON DATABASE ntr_prod FROM PUBLIC;
REVOKE ALL ON DATABASE ntr_test FROM PUBLIC;
GRANT CONNECT ON DATABASE ntr_prod TO ntr_prod_app;
GRANT CONNECT ON DATABASE ntr_test TO ntr_test_app;

\connect ntr_prod
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO ntr_prod_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ntr_prod_migrator IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ntr_prod_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ntr_prod_migrator IN SCHEMA public
GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ntr_prod_app;

\connect ntr_test
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO ntr_test_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ntr_test_migrator IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ntr_test_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ntr_test_migrator IN SCHEMA public
GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ntr_test_app;
SQL
