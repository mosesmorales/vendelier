\getenv migrator_password VENDELIER_MIGRATOR_PASSWORD
\getenv app_password VENDELIER_APP_PASSWORD

SELECT format('CREATE ROLE vendelier_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD %L', :'migrator_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vendelier_migrator') \gexec
SELECT format('CREATE ROLE vendelier_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vendelier_app') \gexec

ALTER DATABASE :"DBNAME" OWNER TO vendelier_migrator;
REVOKE ALL ON DATABASE :"DBNAME" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"DBNAME" TO vendelier_app;

SELECT 'CREATE DATABASE vendelier_shadow OWNER vendelier_migrator'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'vendelier_shadow') \gexec
REVOKE ALL ON DATABASE vendelier_shadow FROM PUBLIC;
