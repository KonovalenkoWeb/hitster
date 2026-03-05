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

const counts = await client.query(`
  select
    count(*)::int as total,
    count(distinct lower(title) || '|' || lower(artist))::int as unique_title_artist
  from songs
  where catalog = 'main_catalog'
`);

const blockedLike = await client.query(`
  select count(*)::int as blocked_like
  from songs
  where catalog = 'main_catalog'
    and (
      title ~* '(remaster|remix|radio edit|karaoke|live|instrumental|tribute|best of|greatest hits)'
      or coalesce(album_name, '') ~* '(best of|greatest hits|hits|volume|vol\\.?|sampler|ministry of sound|remix|remaster|deluxe|anniversary)'
    )
`);

console.log(
  JSON.stringify(
    {
      counts: counts.rows[0],
      blockedLike: blockedLike.rows[0].blocked_like,
    },
    null,
    2,
  ),
);

await client.end();
