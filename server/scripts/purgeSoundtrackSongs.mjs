import fs from "fs";
import pg from "pg";

function loadEnv() {
  const env = {};
  const raw = fs.readFileSync(".env", "utf8");
  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = loadEnv();
const client = new pg.Client({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const pattern =
  "(soundtrack|original motion picture|motion picture|original score|film score|\\bost\\b)";

await client.connect();

const rows = await client.query(
  `select id from songs where coalesce(album_name, '') ~* $1`,
  [pattern],
);

const ids = rows.rows.map((r) => r.id);
if (ids.length === 0) {
  console.log("No soundtrack rows found.");
  await client.end();
  process.exit(0);
}

await client.query(`delete from song_themes where song_id = any($1::text[])`, [ids]);
await client.query(`delete from songs where id = any($1::text[])`, [ids]);

console.log(`Deleted soundtrack-like songs: ${ids.length}`);
await client.end();
