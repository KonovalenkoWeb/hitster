import { sql } from "drizzle-orm";
import { pgTable, text, varchar, bigint, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const playerProfiles = pgTable("player_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  displayName: text("display_name").notNull(),
  avatarColor: varchar("avatar_color", { length: 7 }).notNull().default('#8B5CF6'),
  artistName: text("artist_name"),
  musicStyle: text("music_style"),
  profileImage: text("profile_image"), // Base64 encoded Pixar-style generated image
  originalPhoto: text("original_photo"), // Base64 encoded uploaded photo
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at").notNull().defaultNow(),
});

export const insertPlayerProfileSchema = createInsertSchema(playerProfiles).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
});

export const updatePlayerProfileSchema = createInsertSchema(playerProfiles).omit({
  id: true,
  createdAt: true,
}).partial();

export type InsertPlayerProfile = z.infer<typeof insertPlayerProfileSchema>;
export type UpdatePlayerProfile = z.infer<typeof updatePlayerProfileSchema>;
export type PlayerProfile = typeof playerProfiles.$inferSelect;

export const spotifyCredentials = pgTable("spotify_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  refreshToken: text("refresh_token").notNull(),
  accessToken: text("access_token"),
  expiresAt: bigint("expires_at", { mode: "number" }),
});

export const insertSpotifyCredentialsSchema = createInsertSchema(spotifyCredentials).omit({
  id: true,
});

export type InsertSpotifyCredentials = z.infer<typeof insertSpotifyCredentialsSchema>;
export type SpotifyCredentials = typeof spotifyCredentials.$inferSelect;

export const profileImages = pgTable("profile_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imageData: text("image_data").notNull(), // Base64 encoded full-size image
  thumbnail: text("thumbnail"), // Base64 encoded 128x128px thumbnail
  mimeType: varchar("mime_type", { length: 50 }).notNull().default('image/png'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProfileImageSchema = createInsertSchema(profileImages).omit({
  id: true,
  createdAt: true,
});

export type InsertProfileImage = z.infer<typeof insertProfileImageSchema>;
export type ProfileImage = typeof profileImages.$inferSelect;

export const songs = pgTable("songs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  catalog: text("catalog").notNull().default("default"),
  externalId: text("external_id"),
  isrc: text("isrc"),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  year: integer("year").notNull(),
  yearConfidence: text("year_confidence").notNull().default("medium"),
  yearSource: text("year_source").notNull().default("album_release_date"),
  albumName: text("album_name"),
  albumType: text("album_type"),
  albumCover: text("album_cover"),
  previewUrl: text("preview_url"),
  popularity: integer("popularity").notNull().default(0),
  isKnownHit: boolean("is_known_hit").notNull().default(false),
  language: varchar("language", { length: 2 }).notNull().default("en"),
  energy: text("energy").notNull().default("upbeat"),
  isPlayable: boolean("is_playable").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const themes = pgTable("themes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const songThemes = pgTable("song_themes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  songId: varchar("song_id").notNull().references(() => songs.id, { onDelete: "cascade" }),
  themeId: varchar("theme_id").notNull().references(() => themes.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSongSchema = createInsertSchema(songs).omit({
  id: true,
  createdAt: true,
});

export const insertThemeSchema = createInsertSchema(themes).omit({
  id: true,
  createdAt: true,
});

export const insertSongThemeSchema = createInsertSchema(songThemes).omit({
  id: true,
  createdAt: true,
});

export type InsertSong = z.infer<typeof insertSongSchema>;
export type SongRecord = typeof songs.$inferSelect;
export type InsertTheme = z.infer<typeof insertThemeSchema>;
export type ThemeRecord = typeof themes.$inferSelect;
export type InsertSongTheme = z.infer<typeof insertSongThemeSchema>;
export type SongThemeRecord = typeof songThemes.$inferSelect;
