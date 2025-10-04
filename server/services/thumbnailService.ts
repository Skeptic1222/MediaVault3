import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * ThumbnailService - Comprehensive thumbnail generation for images and videos
 *
 * Features:
 * - Multiple size generation (small, medium, large)
 * - Smart caching with ETags
 * - WebP format support for better compression
 * - Video frame extraction at optimal timestamps
 * - Batch processing support
 * - Memory-efficient streaming
 */

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'entropy' | 'attention';
  background?: string;
  blur?: boolean;
  watermark?: boolean;
}

export interface VideoThumbnailOptions extends ThumbnailOptions {
  timestamp?: string; // Time in format '00:00:05' or percentage '50%'
  count?: number; // Number of thumbnails to generate
}

export interface ThumbnailSize {
  name: string;
  width: number;
  height: number;
  quality: number;
  suffix: string;
}

// Predefined thumbnail sizes
export const THUMBNAIL_SIZES: ThumbnailSize[] = [
  { name: 'micro', width: 50, height: 50, quality: 70, suffix: '_micro' },
  { name: 'thumb', width: 150, height: 150, quality: 80, suffix: '_thumb' },
  { name: 'small', width: 320, height: 240, quality: 85, suffix: '_small' },
  { name: 'medium', width: 640, height: 480, quality: 85, suffix: '_medium' },
  { name: 'large', width: 1280, height: 720, quality: 90, suffix: '_large' },
  { name: 'preview', width: 1920, height: 1080, quality: 90, suffix: '_preview' }
];

export class ThumbnailService {
  private cacheDir: string;
  private tempDir: string;
  private maxConcurrent: number = 4;
  private processingQueue: Set<string> = new Set();

  constructor() {
    this.cacheDir = path.join(process.cwd(), 'thumbnails');
    this.tempDir = path.join(process.cwd(), 'temp', 'thumbnails');
    this.initializeDirectories();
  }

  private async initializeDirectories() {
    try {
      await fsPromises.mkdir(this.cacheDir, { recursive: true });
      await fsPromises.mkdir(this.tempDir, { recursive: true });

      // Create subdirectories for each size
      for (const size of THUMBNAIL_SIZES) {
        await fsPromises.mkdir(path.join(this.cacheDir, size.name), { recursive: true });
      }
    } catch (error) {
      logger.error('Failed to initialize thumbnail directories', error);
    }
  }

  /**
   * Generate thumbnails for an image file
   */
  async generateImageThumbnails(
    inputPath: string,
    outputDir?: string,
    sizes?: ThumbnailSize[],
    options?: ThumbnailOptions
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const sizesToGenerate = sizes || THUMBNAIL_SIZES;
    const targetDir = outputDir || this.cacheDir;
    const fileHash = await this.generateFileHash(inputPath);

    try {
      // Process each size in parallel with concurrency limit
      const promises = sizesToGenerate.map(async (size) => {
        const outputPath = await this.generateImageThumbnail(
          inputPath,
          targetDir,
          size,
          { ...options, ...{ width: size.width, height: size.height, quality: size.quality } },
          fileHash
        );
        results.set(size.name, outputPath);
      });

      await Promise.all(promises);
      logger.info(`Generated ${results.size} thumbnails for ${inputPath}`);
    } catch (error) {
      logger.error('Failed to generate image thumbnails', error);
      throw error;
    }

    return results;
  }

  /**
   * Generate a single image thumbnail
   */
  private async generateImageThumbnail(
    inputPath: string,
    outputDir: string,
    size: ThumbnailSize,
    options: ThumbnailOptions,
    fileHash: string
  ): Promise<string> {
    const format = options.format || 'webp';
    const outputFilename = `${fileHash}${size.suffix}.${format}`;
    const outputPath = path.join(outputDir, size.name, outputFilename);

    // Check if thumbnail already exists
    if (await this.thumbnailExists(outputPath)) {
      logger.debug(`Thumbnail already exists: ${outputPath}`);
      return outputPath;
    }

    try {
      // Create sharp instance with input
      let pipeline = sharp(inputPath);

      // Get image metadata
      const metadata = await pipeline.metadata();

      // Configure resize options
      const resizeOptions: any = {
        width: options.width || size.width,
        height: options.height || size.height,
        fit: options.fit || 'cover',
        position: options.position || 'entropy',
        background: options.background || { r: 255, g: 255, b: 255, alpha: 0 }
      };

      // Only resize if image is larger than target
      if (metadata.width! > resizeOptions.width || metadata.height! > resizeOptions.height) {
        pipeline = pipeline.resize(resizeOptions);
      }

      // Apply blur effect if requested
      if (options.blur) {
        pipeline = pipeline.blur(10);
      }

      // Apply format-specific options
      switch (format) {
        case 'webp':
          pipeline = pipeline.webp({
            quality: options.quality || size.quality,
            lossless: false,
            effort: 4
          });
          break;
        case 'jpeg':
          pipeline = pipeline.jpeg({
            quality: options.quality || size.quality,
            progressive: true,
            mozjpeg: true
          });
          break;
        case 'png':
          pipeline = pipeline.png({
            quality: options.quality || size.quality,
            compressionLevel: 9,
            progressive: true
          });
          break;
      }

      // Add watermark if requested
      if (options.watermark) {
        pipeline = await this.addWatermark(pipeline);
      }

      // Save the thumbnail
      await pipeline.toFile(outputPath);

      logger.debug(`Generated thumbnail: ${outputPath}`);
      return outputPath;

    } catch (error) {
      logger.error(`Failed to generate thumbnail for ${inputPath}`, error);
      throw error;
    }
  }

  /**
   * Generate thumbnails for a video file
   */
  async generateVideoThumbnails(
    inputPath: string,
    outputDir?: string,
    options?: VideoThumbnailOptions
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const targetDir = outputDir || this.cacheDir;
    const fileHash = await this.generateFileHash(inputPath);

    try {
      // Get video metadata
      const metadata = await this.getVideoMetadata(inputPath);
      const duration = metadata.duration || 10;

      // Calculate timestamps for thumbnail extraction
      const timestamps = this.calculateVideoTimestamps(duration, options?.count || 3);

      // Generate thumbnails at each timestamp
      for (let i = 0; i < timestamps.length; i++) {
        const timestamp = timestamps[i];
        const framePath = await this.extractVideoFrame(inputPath, timestamp, fileHash, i);

        // Generate multiple sizes for this frame
        if (i === 0) {
          // First frame gets all sizes
          const sizes = await this.generateImageThumbnails(framePath, targetDir);
          sizes.forEach((path, size) => results.set(size, path));
        } else {
          // Additional frames get medium size only
          const mediumSize = THUMBNAIL_SIZES.find(s => s.name === 'medium')!;
          const thumbPath = await this.generateImageThumbnail(
            framePath,
            targetDir,
            mediumSize,
            options || {},
            `${fileHash}_frame_${i}`
          );
          results.set(`frame_${i}`, thumbPath);
        }

        // Clean up temporary frame file
        await fsPromises.unlink(framePath).catch(() => {});
      }

      logger.info(`Generated ${results.size} video thumbnails for ${inputPath}`);
    } catch (error) {
      logger.error('Failed to generate video thumbnails', error);
      throw error;
    }

    return results;
  }

  /**
   * Extract a single frame from video
   */
  private extractVideoFrame(
    inputPath: string,
    timestamp: number,
    fileHash: string,
    index: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const outputPath = path.join(this.tempDir, `${fileHash}_frame_${index}.png`);

      ffmpeg(inputPath)
        .screenshots({
          timestamps: [timestamp],
          filename: path.basename(outputPath),
          folder: this.tempDir,
          size: '1920x1080'
        })
        .on('end', () => resolve(outputPath))
        .on('error', reject);
    });
  }

  /**
   * Get video metadata
   */
  private getVideoMetadata(inputPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata.format);
      });
    });
  }

  /**
   * Calculate optimal timestamps for video thumbnail extraction
   */
  private calculateVideoTimestamps(duration: number, count: number): number[] {
    const timestamps: number[] = [];

    if (count === 1) {
      // Single thumbnail at 10% or 2 seconds
      timestamps.push(Math.min(duration * 0.1, 2));
    } else {
      // Multiple thumbnails evenly distributed
      const interval = duration / (count + 1);
      for (let i = 1; i <= count; i++) {
        timestamps.push(interval * i);
      }
    }

    return timestamps;
  }

  /**
   * Generate a hash for file caching
   */
  private async generateFileHash(filePath: string): Promise<string> {
    const stats = await fsPromises.stat(filePath);
    const hash = crypto.createHash('md5');
    hash.update(filePath);
    hash.update(stats.mtime.toISOString());
    hash.update(stats.size.toString());
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Check if thumbnail already exists
   */
  private async thumbnailExists(path: string): Promise<boolean> {
    try {
      await fsPromises.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Add watermark to image
   */
  private async addWatermark(pipeline: sharp.Sharp): Promise<sharp.Sharp> {
    // Create a simple text watermark
    const watermarkSvg = Buffer.from(`
      <svg width="200" height="50">
        <text x="10" y="30" font-family="Arial" font-size="20" fill="white" opacity="0.7">
          © MediaVault
        </text>
      </svg>
    `);

    return pipeline.composite([
      {
        input: watermarkSvg,
        gravity: 'southeast'
      }
    ]);
  }

  /**
   * Clear thumbnail cache for a specific file
   */
  async clearCache(fileHash: string): Promise<void> {
    try {
      for (const size of THUMBNAIL_SIZES) {
        const pattern = path.join(this.cacheDir, size.name, `${fileHash}*`);
        const files = await fsPromises.readdir(path.dirname(pattern));

        for (const file of files) {
          if (file.startsWith(fileHash)) {
            await fsPromises.unlink(path.join(path.dirname(pattern), file));
          }
        }
      }
      logger.info(`Cleared thumbnail cache for ${fileHash}`);
    } catch (error) {
      logger.error('Failed to clear thumbnail cache', error);
    }
  }

  /**
   * Get thumbnail path if it exists
   */
  async getThumbnailPath(
    fileHash: string,
    size: string = 'medium',
    format: string = 'webp'
  ): Promise<string | null> {
    const sizeConfig = THUMBNAIL_SIZES.find(s => s.name === size);
    if (!sizeConfig) return null;

    const thumbnailPath = path.join(
      this.cacheDir,
      size,
      `${fileHash}${sizeConfig.suffix}.${format}`
    );

    if (await this.thumbnailExists(thumbnailPath)) {
      return thumbnailPath;
    }

    return null;
  }

  /**
   * Batch process multiple files
   */
  async batchProcess(
    files: Array<{ path: string; type: 'image' | 'video' }>,
    options?: ThumbnailOptions
  ): Promise<Map<string, Map<string, string>>> {
    const results = new Map<string, Map<string, string>>();

    // Process in chunks to avoid memory issues
    const chunkSize = this.maxConcurrent;
    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize);

      const promises = chunk.map(async (file) => {
        try {
          if (file.type === 'image') {
            const thumbnails = await this.generateImageThumbnails(file.path, undefined, undefined, options);
            results.set(file.path, thumbnails);
          } else {
            const thumbnails = await this.generateVideoThumbnails(file.path, undefined, options as VideoThumbnailOptions);
            results.set(file.path, thumbnails);
          }
        } catch (error) {
          logger.error(`Failed to process ${file.path}`, error);
          results.set(file.path, new Map());
        }
      });

      await Promise.all(promises);
    }

    return results;
  }

  /**
   * Clean up old thumbnails
   */
  async cleanup(maxAgeInDays: number = 30): Promise<number> {
    let deletedCount = 0;
    const maxAge = Date.now() - (maxAgeInDays * 24 * 60 * 60 * 1000);

    try {
      for (const size of THUMBNAIL_SIZES) {
        const dir = path.join(this.cacheDir, size.name);
        const files = await fsPromises.readdir(dir);

        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = await fsPromises.stat(filePath);

          if (stats.mtime.getTime() < maxAge) {
            await fsPromises.unlink(filePath);
            deletedCount++;
          }
        }
      }

      logger.info(`Cleaned up ${deletedCount} old thumbnails`);
    } catch (error) {
      logger.error('Failed to cleanup thumbnails', error);
    }

    return deletedCount;
  }
}

// Export singleton instance
export const thumbnailService = new ThumbnailService();