import fs from "fs";
import path from "path";
import { and, eq, gte, sql } from "drizzle-orm";

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const file = fs.readFileSync(envPath, "utf-8");
  for (const rawLine of file.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile();

async function run() {
  const threshold = Number.parseInt(
    process.argv.find((arg) => arg.startsWith("--threshold="))?.split("=")[1] ||
      process.env.KNOWN_HIT_POPULARITY ||
      "70",
    10
  );
  const catalog =
    process.argv.find((arg) => arg.startsWith("--catalog="))?.split("=")[1] ||
    process.env.SEED_CATALOG ||
    "";

  const { db } = await import("../db");
  const { songs } = await import("@shared/schema");

  if (catalog) {
    await db
      .update(songs)
      .set({ isKnownHit: sql`${songs.popularity} >= ${threshold}` })
      .where(eq(songs.catalog, catalog));
    const count = await db
      .select({ count: sql<number>`count(*)` })
      .from(songs)
      .where(and(eq(songs.catalog, catalog), gte(songs.popularity, threshold)));
    console.log(`Updated known-hit flags in catalog "${catalog}" with threshold ${threshold}.`);
    console.log(`Known hits now: ${Number(count[0]?.count || 0)}`);
    return;
  }

  await db.update(songs).set({ isKnownHit: sql`${songs.popularity} >= ${threshold}` });
  const count = await db
    .select({ count: sql<number>`count(*)` })
    .from(songs)
    .where(gte(songs.popularity, threshold));
  console.log(`Updated known-hit flags in all catalogs with threshold ${threshold}.`);
  console.log(`Known hits now: ${Number(count[0]?.count || 0)}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Recalc known hits failed:", err);
    process.exit(1);
  });
