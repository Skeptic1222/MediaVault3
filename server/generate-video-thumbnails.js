#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const FFMPEG_PATH = 'C:\\ffmpeg\\bin\\ffmpeg.exe';
const FFPROBE_PATH = 'C:\\ffmpeg\\bin\\ffprobe.exe';

/**
 * Generate thumbnail for a video file
 */
function generateVideoThumbnail(videoPath, outputPath, timestamp = '00:00:01') {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', videoPath,
      '-ss', timestamp,
      '-vframes', '1',
      '-vf', 'scale=320:240:force_original_aspect_ratio=decrease,pad=320:240:(ow-iw)/2:(oh-ih)/2',
      '-y',
      outputPath
    ];

    const ffmpeg = spawn(FFMPEG_PATH, args);

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`Thumbnail generated: ${outputPath}`);
        resolve(outputPath);
      } else {
        console.error('FFmpeg error:', stderr);
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Get video duration using ffprobe
 */
function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ];

    const ffprobe = spawn(FFPROBE_PATH, args);

    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(stdout.trim());
        resolve(duration);
      } else {
        reject(new Error(`FFprobe exited with code ${code}: ${stderr}`));
      }
    });

    ffprobe.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Process all videos in a directory
 */
async function processVideosInDirectory(dirPath) {
  const uploadDir = path.join(dirPath, 'uploads');
  const thumbnailDir = path.join(dirPath, 'uploads', 'thumbnails');

  // Create thumbnail directory if it doesn't exist
  if (!fs.existsSync(thumbnailDir)) {
    fs.mkdirSync(thumbnailDir, { recursive: true });
    console.log(`Created thumbnail directory: ${thumbnailDir}`);
  }

  // Get all files in upload directory
  const files = fs.readdirSync(uploadDir);
  const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.wmv', '.flv'];

  const videoFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return videoExtensions.includes(ext);
  });

  console.log(`Found ${videoFiles.length} video files to process`);

  for (const videoFile of videoFiles) {
    const videoPath = path.join(uploadDir, videoFile);
    const baseName = path.basename(videoFile, path.extname(videoFile));
    const thumbnailPath = path.join(thumbnailDir, `${baseName}_thumb.jpg`);

    // Skip if thumbnail already exists
    if (fs.existsSync(thumbnailPath)) {
      console.log(`Thumbnail already exists for ${videoFile}, skipping...`);
      continue;
    }

    try {
      console.log(`Processing: ${videoFile}`);

      // Get video duration
      const duration = await getVideoDuration(videoPath);
      console.log(`  Duration: ${duration.toFixed(2)} seconds`);

      // Generate thumbnail at 10% of video duration or 1 second
      const timestamp = Math.min(duration * 0.1, 1);
      const timeString = formatTimestamp(timestamp);

      await generateVideoThumbnail(videoPath, thumbnailPath, timeString);
      console.log(`  ✓ Thumbnail created: ${path.basename(thumbnailPath)}`);

    } catch (error) {
      console.error(`  ✗ Failed to process ${videoFile}:`, error.message);
    }
  }

  console.log('Video thumbnail generation complete!');
}

/**
 * Format seconds to HH:MM:SS format
 */
function formatTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Check if FFmpeg is available
if (!fs.existsSync(FFMPEG_PATH)) {
  console.error('FFmpeg not found at:', FFMPEG_PATH);
  console.error('Please install FFmpeg first');
  process.exit(1);
}

if (!fs.existsSync(FFPROBE_PATH)) {
  console.error('FFprobe not found at:', FFPROBE_PATH);
  console.error('Please install FFmpeg first');
  process.exit(1);
}

// Process videos in the current MediaVault directory
const mediaVaultPath = 'C:\\inetpub\\wwwroot\\MediaVault';

if (require.main === module) {
  processVideosInDirectory(mediaVaultPath)
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = {
  generateVideoThumbnail,
  getVideoDuration,
  processVideosInDirectory
};