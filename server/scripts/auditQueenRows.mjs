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

await client.connect();

const result = await client.query(`
  select
    id,
    title,
    artist,
    year,
    album_name,
    album_type,
    year_source,
    year_confidence,
    popularity,
    isrc
  from songs
  where catalog = 'main_catalog'
    and artist ilike '%queen%'
  order by year, title
`);

console.log(JSON.stringify(result.rows, null, 2));
await client.end();
