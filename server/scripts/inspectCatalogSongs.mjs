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

const patterns = [
  "Pennies From Heaven",
  "Hold On",
  "Mamas Don't Let Your Babies Grow Up",
];

const artists = ["Sam & Dave", "Waylon Jennings", "Louis Prima"];

await client.connect();

for (const p of patterns) {
  const result = await client.query(
    "select catalog,title,artist,year,album_name from songs where title ilike $1 order by catalog, year limit 50",
    [`%${p}%`]
  );
  console.log(`\nTITLE PATTERN: ${p} -> ${result.rowCount} rows`);
  for (const row of result.rows) console.log(JSON.stringify(row));
}

for (const a of artists) {
  const result = await client.query(
    "select catalog,title,artist,year,album_name from songs where artist ilike $1 order by catalog, year limit 50",
    [`%${a}%`]
  );
  console.log(`\nARTIST PATTERN: ${a} -> ${result.rowCount} rows`);
  for (const row of result.rows) console.log(JSON.stringify(row));
}

await client.end();
