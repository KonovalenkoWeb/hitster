import { db } from "./db";
import { profileImages } from "@shared/schema";
import { eq, lt } from "drizzle-orm";
import { generateThumbnail } from "./imageUtils";
import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'image-cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log('Created image-cache directory');
}

export class ImageStorage {
  /**
   * Save a base64 image to database with thumbnail and return the image ID
   */
  async saveImage(base64Data: string, mimeType: string = 'image/png'): Promise<string> {
    // Generate thumbnail
    const thumbnail = await generateThumbnail(base64Data);

    const result = await db
      .insert(profileImages)
      .values({
        imageData: base64Data,
        thumbnail: thumbnail,
        mimeType: mimeType,
      })
      .returning({ id: profileImages.id });

    const imageId = result[0].id;
    const dataSize = Buffer.from(base64Data, 'base64').length;
    const thumbSize = Buffer.from(thumbnail, 'base64').length;
    console.log(`Saved profile image to DB: ${imageId} (${dataSize} bytes, thumbnail: ${thumbSize} bytes)`);

    return imageId;
  }

  /**
   * Get thumbnail from cache or database
   */
  async getThumbnail(imageId: string): Promise<{ data: string; mimeType: string } | null> {
    // Check cache first
    const cachePath = path.join(CACHE_DIR, `${imageId}_thumb.cache`);
    if (fs.existsSync(cachePath)) {
      try {
        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        return { data: cached.data, mimeType: cached.mimeType };
      } catch (error) {
        console.error('Cache read error:', error);
        // Continue to database fallback
      }
    }

    // Fetch from database
    const result = await db
      .select({
        thumbnail: profileImages.thumbnail,
        imageData: profileImages.imageData,
        mimeType: profileImages.mimeType,
      })
      .from(profileImages)
      .where(eq(profileImages.id, imageId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    let thumbnailData = result[0].thumbnail;

    // Generate thumbnail if missing
    if (!thumbnailData) {
      console.log(`Generating missing thumbnail for ${imageId}`);
      thumbnailData = await generateThumbnail(result[0].imageData);

      // Update database with new thumbnail
      await db
        .update(profileImages)
        .set({ thumbnail: thumbnailData })
        .where(eq(profileImages.id, imageId));
    }

    const imageData = {
      data: thumbnailData,
      mimeType: result[0].mimeType,
    };

    // Write to cache
    try {
      fs.writeFileSync(cachePath, JSON.stringify(imageData));
    } catch (error) {
      console.error('Cache write error:', error);
    }

    return imageData;
  }

  /**
   * Get full-size image data from database (not cached)
   */
  async getImage(imageId: string): Promise<{ data: string; mimeType: string } | null> {
    const result = await db
      .select({
        imageData: profileImages.imageData,
        mimeType: profileImages.mimeType,
      })
      .from(profileImages)
      .where(eq(profileImages.id, imageId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return {
      data: result[0].imageData,
      mimeType: result[0].mimeType,
    };
  }

  /**
   * Clear cached thumbnail for an image
   */
  clearCache(imageId: string): void {
    const cachePath = path.join(CACHE_DIR, `${imageId}_thumb.cache`);
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
      console.log(`Cleared cache for ${imageId}`);
    }
  }

  /**
   * Check if an image exists in database
   */
  async imageExists(imageId: string): Promise<boolean> {
    const result = await db
      .select({ id: profileImages.id })
      .from(profileImages)
      .where(eq(profileImages.id, imageId))
      .limit(1);

    return result.length > 0;
  }

  /**
   * Delete an image from database and cache
   */
  async deleteImage(imageId: string): Promise<void> {
    // Clear cache
    this.clearCache(imageId);

    // Delete from database
    await db
      .delete(profileImages)
      .where(eq(profileImages.id, imageId));

    console.log(`Deleted profile image from DB: ${imageId}`);
  }

  /**
   * Clean up old images from database (older than specified days)
   */
  async cleanupOldImages(daysOld: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await db
      .delete(profileImages)
      .where(lt(profileImages.createdAt, cutoffDate))
      .returning({ id: profileImages.id });

    if (result.length > 0) {
      console.log(`Cleaned up ${result.length} old profile images from DB`);
    }
  }
}

export const imageStorage = new ImageStorage();

// Run cleanup on startup (async)
imageStorage.cleanupOldImages(7).catch(err =>
  console.error('Failed to cleanup old images:', err)
);
