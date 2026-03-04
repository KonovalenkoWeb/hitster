import sharp from 'sharp';

/**
 * Generate a 128x128px thumbnail from base64 image data
 */
export async function generateThumbnail(base64Data: string): Promise<string> {
  try {
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Resize to 128x128 with cover fit (crops to square)
    const thumbnailBuffer = await sharp(buffer)
      .resize(128, 128, {
        fit: 'cover',
        position: 'center',
      })
      .png({ quality: 80 }) // Optimize for web
      .toBuffer();

    // Convert back to base64
    const thumbnailBase64 = thumbnailBuffer.toString('base64');

    const originalSize = buffer.length;
    const thumbnailSize = thumbnailBuffer.length;
    console.log(`Generated thumbnail: ${originalSize} bytes -> ${thumbnailSize} bytes (${Math.round(thumbnailSize / originalSize * 100)}% of original)`);

    return thumbnailBase64;
  } catch (error) {
    console.error('Thumbnail generation error:', error);
    throw new Error('Failed to generate thumbnail');
  }
}
