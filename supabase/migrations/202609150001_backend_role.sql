-- Credentials are set separately by the operator and never included in migrations.
create role conversation_mvp_backend nologin nosuperuser nocreatedb nocreaterole
  noinherit noreplication nobypassrls;
grant usage on schema private to conversation_mvp_backend;
grant select, insert, update, delete on private.app_entities to conversation_mvp_backend;
create policy backend_entities on private.app_entities
  for all to conversation_mvp_backend using (true) with check (true);
alter role conversation_mvp_backend set statement_timeout = '15s';
alter role conversation_mvp_backend set idle_in_transaction_session_timeout = '30s';
