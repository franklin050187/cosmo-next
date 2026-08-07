import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

const MIGRATIONS_DIR = resolve(import.meta.dirname, "migrations");

async function main() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT ?? "6543", 10),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  await client.query(
    "CREATE TABLE IF NOT EXISTS _migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let applied = 0;
  for (const file of files) {
    const id = file.replace(/\.sql$/, "");
    const done = await client.query("SELECT 1 FROM _migrations WHERE id = $1", [id]);
    if (done.rowCount) continue;

    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO _migrations (id) VALUES ($1)", [id]);
      await client.query("COMMIT");
      console.log(`applied ${file}`);
      applied++;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }

  await client.end();
  console.log(applied ? `${applied} migration(s) applied` : "migrations up to date");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
