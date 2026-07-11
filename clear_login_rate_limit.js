const { Client } = require("pg");

const client = new Client({
  connectionString: "postgresql://inherix_app:Inherix%402026AppDB@localhost:5432/inherix_mvp",
});

async function run() {
  await client.connect();
  const res = await client.query("DELETE FROM security_events WHERE event_type = 'LOGIN_FAILED'");
  console.log(`Deleted ${res.rowCount} rows`);
  await client.end();
}

run().catch(console.error);
