import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { thumbnailService } from '../services/thumbnailService';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import { verifyToken } from '../middleware/authSecurity';
import sharp from 'sharp';
import crypto from 'crypto';

/**
 * Media Preview API Routes
 *
 * Endpoints:
 * - GET /api/media/:id/thumbnail - Get or generate thumbnail for media
 * - GET /api/media/:id/thumbnails - Get all thumbnail sizes
 * - POST /api/media/:id/generate-thumbnails - Force regenerate thumbnails
 * - GET /api/media/:id/preview - Stream optimized preview
 * - GET /api/media/:id/metadata - Get detailed media metadata
 * - DELETE /api/media/:id/cache - Clear thumbnail cache
 */

const router = Router();

// Middleware to verify media access
const verifyMediaAccess = asyncHandler(async (req: any, res: any, next: any) => {
  const { id } = req.params;
  const userId = req.user?.userId;

  // Check if user has access to this media
  // This should be implemented based on your database schema
  // For now, we'll assume authenticated users have access
  if (!userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  next();
});

/**
 * Get or generate thumbnail for media file
 *
 * Query parameters:
 * - size: micro | thumb | small | medium | large | preview (default: medium)
 * - format: jpeg | png | webp (default: webp)
 * - quality: 1-100 (default: 85)
 * - fit: cover | contain | fill | inside | outside (default: cover)
 * - blur: true/false - Apply blur effect (default: false)
 * - watermark: true/false - Add watermark (default: false)
 */
router.get('/api/media/:id/thumbnail',
  verifyToken,
  verifyMediaAccess,
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const {
      size = 'medium',
      format = 'webp',
      quality = 85,
      fit = 'cover',
      blur = false,
      watermark = false
    } = req.query;

    try {
      // Get media file path from database
      // This is a placeholder - implement based on your database
      const mediaPath = await getMediaPath(id);
      if (!mediaPath) {
        return res.status(404).json({ error: 'Media not found' });
      }

      // Generate file hash for caching
      const fileHash = await generateFileHash(mediaPath);

      // Check if thumbnail exists in cache
      let thumbnailPath = await thumbnailService.getThumbnailPath(fileHash, size, format);

      if (!thumbnailPath) {
        // Generate thumbnail if not cached
        const isVideo = isVideoFile(mediaPath);

        if (isVideo) {
          const thumbnails = await thumbnailService.generateVideoThumbnails(
            mediaPath,
            undefined,
            { format, quality: parseInt(quality), fit, blur: blur === 'true', watermark: watermark === 'true' }
          );
          thumbnailPath = thumbnails.get(size) || null;
        } else {
          const thumbnails = await thumbnailService.generateImageThumbnails(
            mediaPath,
            undefined,
            undefined,
            { format, quality: parseInt(quality), fit, blur: blur === 'true', watermark: watermark === 'true' }
          );
          thumbnailPath = thumbnails.get(size) || null;
        }
      }

      if (!thumbnailPath) {
        return res.status(500).json({ error: 'Failed to generate thumbnail' });
      }

      // Set cache headers
      res.set({
        'Cache-Control': 'public, max-age=31536000', // 1 year
        'ETag': fileHash,
        'Content-Type': `image/${format}`
      });

      // Check if client has cached version
      if (req.headers['if-none-match'] === fileHash) {
        return res.status(304).end();
      }

      // Stream thumbnail
      const stream = fs.createReadStream(thumbnailPath);
      stream.pipe(res);

    } catch (error) {
      logger.error('Failed to serve thumbnail', error);
      res.status(500).json({ error: 'Failed to generate thumbnail' });
    }
  })
);

/**
 * Get all available thumbnail sizes for a media file
 */
router.get('/api/media/:id/thumbnails',
  verifyToken,
  verifyMediaAccess,
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;

    try {
      const mediaPath = await getMediaPath(id);
      if (!mediaPath) {
        return res.status(404).json({ error: 'Media not found' });
      }

      const fileHash = await generateFileHash(mediaPath);
      const thumbnails: Record<string, string> = {};

      // Check for existing thumbnails
      const sizes = ['micro', 'thumb', 'small', 'medium', 'large', 'preview'];
      for (const size of sizes) {
        const thumbnailPath = await thumbnailService.getThumbnailPath(fileHash, size);
        if (thumbnailPath) {
          // Convert to URL
          thumbnails[size] = `/api/media/${id}/thumbnail?size=${size}`;
        }
      }

      res.json({
        mediaId: id,
        available: Object.keys(thumbnails).length > 0,
        thumbnails,
        sizes: sizes
      });

    } catch (error) {
      logger.error('Failed to get thumbnails', error);
      res.status(500).json({ error: 'Failed to get thumbnails' });
    }
  })
);

/**
 * Force regenerate all thumbnails for a media file
 */
router.post('/api/media/:id/generate-thumbnails',
  verifyToken,
  verifyMediaAccess,
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { sizes, format = 'webp', quality = 85 } = req.body;

    try {
      const mediaPath = await getMediaPath(id);
      if (!mediaPath) {
        return res.status(404).json({ error: 'Media not found' });
      }

      const fileHash = await generateFileHash(mediaPath);

      // Clear existing cache
      await thumbnailService.clearCache(fileHash);

      // Generate new thumbnails
      const isVideo = isVideoFile(mediaPath);
      let generated: Map<string, string>;

      if (isVideo) {
        generated = await thumbnailService.generateVideoThumbnails(
          mediaPath,
          undefined,
          { format, quality }
        );
      } else {
        generated = await thumbnailService.generateImageThumbnails(
          mediaPath,
          undefined,
          sizes,
          { format, quality }
        );
      }

      const thumbnails: Record<string, string> = {};
      generated.forEach((path, size) => {
        thumbnails[size] = `/api/media/${id}/thumbnail?size=${size}`;
      });

      res.json({
        success: true,
        mediaId: id,
        generated: thumbnails
      });

    } catch (error) {
      logger.error('Failed to generate thumbnails', error);
      res.status(500).json({ error: 'Failed to generate thumbnails' });
    }
  })
);

/**
 * Stream optimized preview for quick loading
 * Generates a lower quality version on-the-fly for faster loading
 */
router.get('/api/media/:id/preview',
  verifyToken,
  verifyMediaAccess,
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { width = 1280, height = 720, quality = 70 } = req.query;

    try {
      const mediaPath = await getMediaPath(id);
      if (!mediaPath) {
        return res.status(404).json({ error: 'Media not found' });
      }

      if (isVideoFile(mediaPath)) {
        // For videos, return the first frame as preview
        const fileHash = await generateFileHash(mediaPath);
        const thumbnails = await thumbnailService.generateVideoThumbnails(
          mediaPath,
          undefined,
          { width: parseInt(width), height: parseInt(height), quality: parseInt(quality), count: 1 }
        );

        const previewPath = thumbnails.get('large');
        if (previewPath) {
          const stream = fs.createReadStream(previewPath);
          res.set('Content-Type', 'image/jpeg');
          stream.pipe(res);
        } else {
          res.status(500).json({ error: 'Failed to generate preview' });
        }
      } else {
        // For images, generate optimized preview
        const pipeline = sharp(mediaPath)
          .resize(parseInt(width), parseInt(height), {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: parseInt(quality), progressive: true });

        res.set('Content-Type', 'image/jpeg');
        pipeline.pipe(res);
      }

    } catch (error) {
      logger.error('Failed to generate preview', error);
      res.status(500).json({ error: 'Failed to generate preview' });
    }
  })
);

/**
 * Get detailed media metadata including EXIF data
 */
router.get('/api/media/:id/metadata',
  verifyToken,
  verifyMediaAccess,
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;

    try {
      const mediaPath = await getMediaPath(id);
      if (!mediaPath) {
        return res.status(404).json({ error: 'Media not found' });
      }

      const stats = fs.statSync(mediaPath);
      const metadata: any = {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        format: path.extname(mediaPath).substring(1).toLowerCase()
      };

      if (isVideoFile(mediaPath)) {
        // Get video metadata using ffmpeg
        // This would require ffmpeg probe implementation
        metadata.type = 'video';
        // Add video-specific metadata
      } else {
        // Get image metadata using sharp
        try {
          const imageMetadata = await sharp(mediaPath).metadata();
          metadata.type = 'image';
          metadata.width = imageMetadata.width;
          metadata.height = imageMetadata.height;
          metadata.channels = imageMetadata.channels;
          metadata.density = imageMetadata.density;
          metadata.hasAlpha = imageMetadata.hasAlpha;
          metadata.orientation = imageMetadata.orientation;

          // EXIF data
          if (imageMetadata.exif) {
            const exif = imageMetadata.exif;
            metadata.exif = {
              make: exif.toString().match(/Make=([^,\n]+)/)?.[1],
              model: exif.toString().match(/Model=([^,\n]+)/)?.[1],
              dateTime: exif.toString().match(/DateTime=([^,\n]+)/)?.[1],
              iso: exif.toString().match(/ISO=([^,\n]+)/)?.[1],
              focalLength: exif.toString().match(/FocalLength=([^,\n]+)/)?.[1],
              aperture: exif.toString().match(/FNumber=([^,\n]+)/)?.[1],
              shutterSpeed: exif.toString().match(/ExposureTime=([^,\n]+)/)?.[1],
              gps: exif.toString().match(/GPS/i) ? 'Available' : null
            };
          }
        } catch (error) {
          logger.error('Failed to get image metadata', error);
        }
      }

      res.json(metadata);

    } catch (error) {
      logger.error('Failed to get metadata', error);
      res.status(500).json({ error: 'Failed to get metadata' });
    }
  })
);

/**
 * Clear thumbnail cache for a specific media file
 */
router.delete('/api/media/:id/cache',
  verifyToken,
  verifyMediaAccess,
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;

    try {
      const mediaPath = await getMediaPath(id);
      if (!mediaPath) {
        return res.status(404).json({ error: 'Media not found' });
      }

      const fileHash = await generateFileHash(mediaPath);
      await thumbnailService.clearCache(fileHash);

      res.json({
        success: true,
        message: 'Thumbnail cache cleared'
      });

    } catch (error) {
      logger.error('Failed to clear cache', error);
      res.status(500).json({ error: 'Failed to clear cache' });
    }
  })
);

/**
 * Batch generate thumbnails for multiple media files
 */
router.post('/api/media/batch-thumbnails',
  verifyToken,
  asyncHandler(async (req: any, res: any) => {
    const { mediaIds, options } = req.body;

    if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
      return res.status(400).json({ error: 'Media IDs array required' });
    }

    try {
      const files = [];
      for (const id of mediaIds) {
        const mediaPath = await getMediaPath(id);
        if (mediaPath) {
          files.push({
            id,
            path: mediaPath,
            type: isVideoFile(mediaPath) ? 'video' : 'image'
          });
        }
      }

      const results = await thumbnailService.batchProcess(files, options);

      const response: Record<string, any> = {};
      files.forEach(file => {
        const thumbnails = results.get(file.path);
        if (thumbnails) {
          const urls: Record<string, string> = {};
          thumbnails.forEach((path, size) => {
            urls[size] = `/api/media/${file.id}/thumbnail?size=${size}`;
          });
          response[file.id] = urls;
        }
      });

      res.json({
        success: true,
        processed: files.length,
        thumbnails: response
      });

    } catch (error) {
      logger.error('Failed to batch generate thumbnails', error);
      res.status(500).json({ error: 'Failed to batch generate thumbnails' });
    }
  })
);

// Helper functions

async function getMediaPath(mediaId: string): Promise<string | null> {
  // This should be implemented to get the actual file path from your database
  // For now, returning a placeholder
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const possiblePaths = [
    path.join(uploadsDir, `${mediaId}.jpg`),
    path.join(uploadsDir, `${mediaId}.png`),
    path.join(uploadsDir, `${mediaId}.mp4`),
    path.join(uploadsDir, `${mediaId}.webm`)
  ];

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}

async function generateFileHash(filePath: string): Promise<string> {
  const stats = fs.statSync(filePath);
  const hash = crypto.createHash('md5');
  hash.update(filePath);
  hash.update(stats.mtime.toISOString());
  hash.update(stats.size.toString());
  return hash.digest('hex').substring(0, 16);
}

function isVideoFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.mkv', '.flv', '.wmv'].includes(ext);
}

export default router;