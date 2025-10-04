/**
 * FILE: server/services/mediaProcessingService.ts
 *
 * Media processing service for video transcoding, image optimization, and thumbnails
 * Integrates with background job queue for async processing
 */

import { db } from '../db';
import { processingJobs, files, mediaFiles } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { ProcessingJob, InsertProcessingJob } from '../../shared/schema';
import { logger } from '../logger';
import sharp from 'sharp';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export type JobType =
  | 'transcode_video'
  | 'optimize_image'
  | 'generate_thumbnail'
  | 'extract_metadata';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface JobResult {
  success: boolean;
  outputPath?: string;
  metadata?: any;
  error?: string;
}

/**
 * Create a new processing job
 */
export async function createProcessingJob(
  userId: string,
  fileId: string,
  jobType: JobType,
  inputParams?: any,
  priority: number = 5
): Promise<ProcessingJob> {
  try {
    const [job] = await db
      .insert(processingJobs)
      .values({
        userId,
        fileId,
        jobType,
        status: 'pending',
        progress: 0,
        priority,
        inputParams: inputParams || {},
        attempts: 0,
        maxAttempts: 3
      })
      .returning();

    logger.info(`Created processing job: ${job.id} (type: ${jobType})`);
    return job;
  } catch (error) {
    logger.error('Error creating processing job:', error);
    throw error;
  }
}

/**
 * Get next pending job from queue (priority-based)
 */
export async function getNextPendingJob(): Promise<ProcessingJob | null> {
  try {
    const [job] = await db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.status, 'pending'))
      .orderBy(sql`${processingJobs.priority} DESC, ${processingJobs.createdAt} ASC`)
      .limit(1);

    return job || null;
  } catch (error) {
    logger.error('Error getting next pending job:', error);
    return null;
  }
}

/**
 * Update job status and progress
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  updates?: {
    progress?: number;
    outputData?: any;
    errorMessage?: string;
    startedAt?: Date;
    completedAt?: Date;
  }
): Promise<ProcessingJob | null> {
  try {
    const [updated] = await db
      .update(processingJobs)
      .set({
        status,
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(processingJobs.id, jobId))
      .returning();

    logger.info(`Updated job ${jobId}: ${status}`);
    return updated || null;
  } catch (error) {
    logger.error(`Error updating job ${jobId}:`, error);
    return null;
  }
}

/**
 * Process video transcoding job
 */
export async function processVideoTranscode(
  job: ProcessingJob,
  sourcePath: string
): Promise<JobResult> {
  try {
    // Update status to processing
    await updateJobStatus(job.id, 'processing', {
      progress: 0,
      startedAt: new Date()
    });

    const outputPath = sourcePath.replace(/\.[^.]+$/, '_transcoded.mp4');
    const params = job.inputParams as any || {};

    // Default transcoding settings
    const quality = params.quality || 'medium'; // low, medium, high
    const resolution = params.resolution || '1280x720';

    // FFmpeg command for video transcoding
    const ffmpegCmd = `ffmpeg -i "${sourcePath}" -vcodec libx264 -crf ${quality === 'low' ? 28 : quality === 'high' ? 18 : 23} -preset ${quality === 'low' ? 'ultrafast' : quality === 'high' ? 'slow' : 'medium'} -s ${resolution} -acodec aac -b:a 128k "${outputPath}"`;

    logger.info(`Transcoding video: ${ffmpegCmd}`);

    // Execute FFmpeg (requires FFmpeg installed on system)
    const { stdout, stderr } = await execAsync(ffmpegCmd);

    // Update progress
    await updateJobStatus(job.id, 'processing', { progress: 90 });

    // Verify output file exists
    const stats = await fs.stat(outputPath);

    if (!stats.isFile()) {
      throw new Error('Transcoded file not created');
    }

    // Complete job
    await updateJobStatus(job.id, 'completed', {
      progress: 100,
      completedAt: new Date(),
      outputData: {
        outputPath,
        fileSize: stats.size,
        resolution,
        quality
      }
    });

    logger.info(`Video transcoding completed: ${outputPath}`);
    return { success: true, outputPath, metadata: { resolution, quality, fileSize: stats.size } };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Video transcoding failed:', errorMessage);

    // Increment attempts
    await db
      .update(processingJobs)
      .set({
        attempts: sql`${processingJobs.attempts} + 1`,
        errorMessage
      })
      .where(eq(processingJobs.id, job.id));

    // Check if max attempts reached
    const [updated] = await db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.id, job.id));

    if (updated && updated.attempts >= updated.maxAttempts) {
      await updateJobStatus(job.id, 'failed', {
        errorMessage,
        completedAt: new Date()
      });
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Process image optimization job
 */
export async function processImageOptimization(
  job: ProcessingJob,
  sourcePath: string
): Promise<JobResult> {
  try {
    await updateJobStatus(job.id, 'processing', {
      progress: 0,
      startedAt: new Date()
    });

    const params = job.inputParams as any || {};
    const format = params.format || 'webp'; // webp, jpeg, png
    const quality = params.quality || 80;
    const maxWidth = params.maxWidth || 1920;
    const maxHeight = params.maxHeight || 1080;

    const ext = format === 'jpeg' ? 'jpg' : format;
    const outputPath = sourcePath.replace(/\.[^.]+$/, `_optimized.${ext}`);

    logger.info(`Optimizing image: ${sourcePath} -> ${outputPath}`);

    // Use Sharp for image optimization
    let pipeline = sharp(sourcePath);

    // Resize if needed
    const metadata = await pipeline.metadata();
    if (metadata.width && metadata.width > maxWidth || metadata.height && metadata.height > maxHeight) {
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Update progress
    await updateJobStatus(job.id, 'processing', { progress: 50 });

    // Convert format and optimize
    if (format === 'webp') {
      pipeline = pipeline.webp({ quality });
    } else if (format === 'jpeg') {
      pipeline = pipeline.jpeg({ quality, progressive: true });
    } else if (format === 'png') {
      pipeline = pipeline.png({ compressionLevel: 9 });
    }

    await pipeline.toFile(outputPath);

    // Get output stats
    const stats = await fs.stat(outputPath);
    const originalStats = await fs.stat(sourcePath);
    const savings = Math.round((1 - stats.size / originalStats.size) * 100);

    // Complete job
    await updateJobStatus(job.id, 'completed', {
      progress: 100,
      completedAt: new Date(),
      outputData: {
        outputPath,
        originalSize: originalStats.size,
        optimizedSize: stats.size,
        savings: `${savings}%`,
        format
      }
    });

    logger.info(`Image optimization completed: ${outputPath} (${savings}% savings)`);
    return {
      success: true,
      outputPath,
      metadata: {
        originalSize: originalStats.size,
        optimizedSize: stats.size,
        savings
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Image optimization failed:', errorMessage);

    await db
      .update(processingJobs)
      .set({
        attempts: sql`${processingJobs.attempts} + 1`,
        errorMessage
      })
      .where(eq(processingJobs.id, job.id));

    const [updated] = await db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.id, job.id));

    if (updated && updated.attempts >= updated.maxAttempts) {
      await updateJobStatus(job.id, 'failed', {
        errorMessage,
        completedAt: new Date()
      });
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Get user's processing jobs
 */
export async function getUserJobs(userId: string, limit: number = 50): Promise<ProcessingJob[]> {
  try {
    const jobs = await db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.userId, userId))
      .orderBy(sql`${processingJobs.createdAt} DESC`)
      .limit(limit);

    return jobs;
  } catch (error) {
    logger.error('Error getting user jobs:', error);
    return [];
  }
}

/**
 * Get job by ID
 */
export async function getJobById(jobId: string): Promise<ProcessingJob | null> {
  try {
    const [job] = await db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.id, jobId));

    return job || null;
  } catch (error) {
    logger.error('Error getting job:', error);
    return null;
  }
}

/**
 * Cancel a pending job
 */
export async function cancelJob(jobId: string, userId: string): Promise<boolean> {
  try {
    const [job] = await db
      .select()
      .from(processingJobs)
      .where(and(
        eq(processingJobs.id, jobId),
        eq(processingJobs.userId, userId),
        eq(processingJobs.status, 'pending')
      ));

    if (!job) {
      return false;
    }

    await db
      .delete(processingJobs)
      .where(eq(processingJobs.id, jobId));

    logger.info(`Job ${jobId} cancelled by user ${userId}`);
    return true;
  } catch (error) {
    logger.error('Error cancelling job:', error);
    return false;
  }
}
