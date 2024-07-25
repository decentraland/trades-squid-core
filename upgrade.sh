DB_USER=$TRADES_SQUID_DB_USER
DB_PASSWORD=$TRADES_SQUID_DB_PASSWORD
DB_NAME=$SQUID_DB_NAME
DB_HOST=$SQUID_DB_HOST
DB_PORT=$SQUID_DB_PORT

export PGPASSWORD=$DB_PASSWORD

psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME" --host "$DB_HOST" --port "$DB_PORT" <<-EOSQL
  DO \$\$
  DECLARE
      old_schema_name TEXT;
  BEGIN
    -- Fetch the old schema name from the table
    SELECT schema INTO old_schema_name FROM squids WHERE name = 'trades';
    
    -- Rename the old schema
    EXECUTE format('ALTER SCHEMA squid_trades RENAME TO %I', old_schema_name);
    
    -- Rename the new schema to the desired name
    EXECUTE format('ALTER SCHEMA %I RENAME TO squid_trades', '$DB_SCHEMA');
    
    -- Update the search path for the user
    EXECUTE format('ALTER USER %I SET search_path TO squid_trades', '$CURRENT_SQUID_DB_USER');
    
    UPDATE squids SET schema = '$DB_SCHEMA' WHERE name = 'trades';
    
  -- Commit the transaction
  COMMIT;
  END \$\$;
EOSQL
  


