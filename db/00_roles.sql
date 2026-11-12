-- ElectIQ :: 00_roles.sql
-- Bootstrap the RBAC roles first so that migrations 06/07 (which run before 03) can GRANT to them.
DO $$
DECLARE r TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['app_student','app_senior','app_faculty','app_admin'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_login') THEN
    CREATE ROLE app_login LOGIN NOINHERIT;
  END IF;
END $$;
