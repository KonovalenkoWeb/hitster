import fs from "fs";
import path from "path";

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
  const { db } = await import("../db");
  const { songs, songThemes } = await import("@shared/schema");
  const { eq, inArray } = await import("drizzle-orm");
  const targetCatalog =
    process.argv.find((arg) => arg.startsWith("--catalog="))?.split("=")[1] ||
    process.env.SEED_CATALOG ||
    "";

  if (targetCatalog) {
    const targetSongs = await db
      .select({ id: songs.id })
      .from(songs)
      .where(eq(songs.catalog, targetCatalog));
    const targetIds = targetSongs.map((s) => s.id);
    if (targetIds.length > 0) {
      await db.delete(songThemes).where(inArray(songThemes.songId, targetIds));
    }
    const deletedSongs = await db.delete(songs).where(eq(songs.catalog, targetCatalog)).returning({ id: songs.id });
    console.log(`Deleted songs in catalog "${targetCatalog}": ${deletedSongs.length}`);
    console.log("Catalog reset complete.");
    return;
  }

  await db.delete(songThemes);
  const deletedSongs = await db.delete(songs).returning({ id: songs.id });
  console.log(`Deleted songs: ${deletedSongs.length}`);
  console.log("Catalog reset complete.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exit(1);
  });
