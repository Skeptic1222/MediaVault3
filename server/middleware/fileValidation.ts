/**
 * FILE: server/middleware/fileValidation.ts
 *
 * Enhanced file upload validation middleware
 * Implements MIME type checking and magic number (file signature) validation
 */

import type { Request } from 'express';
import type { FileFilterCallback } from 'multer';
import { promises as fs } from 'fs';

// Magic numbers (file signatures) for common file types
const FILE_SIGNATURES = {
  // Images
  jpg: [0xFF, 0xD8, 0xFF],
  png: [0x89, 0x50, 0x4E, 0x47],
  gif: [0x47, 0x49, 0x46],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF (WebP also checks bytes 8-11 for WEBP)
  bmp: [0x42, 0x4D],
  ico: [0x00, 0x00, 0x01, 0x00],

  // Videos
  mp4: [0x00, 0x00, 0x00, undefined, 0x66, 0x74, 0x79, 0x70], // ftyp at position 4
  webm: [0x1A, 0x45, 0xDF, 0xA3],
  avi: [0x52, 0x49, 0x46, 0x46], // RIFF (AVI also checks bytes 8-11 for AVI )
  mov: [0x00, 0x00, 0x00, undefined, 0x66, 0x74, 0x79, 0x70],

  // Audio
  mp3: [0xFF, 0xFB],
  m4a: [0x00, 0x00, 0x00, undefined, 0x66, 0x74, 0x79, 0x70],
  ogg: [0x4F, 0x67, 0x67, 0x53],
  wav: [0x52, 0x49, 0x46, 0x46], // RIFF (WAV also checks bytes 8-11 for WAVE)
  flac: [0x66, 0x4C, 0x61, 0x43], // fLaC

  // Documents
  pdf: [0x25, 0x50, 0x44, 0x46],
  doc: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1],
  docx: [0x50, 0x4B, 0x03, 0x04], // ZIP-based (DOCX)
  xlsx: [0x50, 0x4B, 0x03, 0x04], // ZIP-based (XLSX)
  pptx: [0x50, 0x4B, 0x03, 0x04], // ZIP-based (PPTX)

  // Archives
  zip: [0x50, 0x4B, 0x03, 0x04],
  rar: [0x52, 0x61, 0x72, 0x21],
  '7z': [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C],
  tar: [0x75, 0x73, 0x74, 0x61, 0x72], // at position 257
};

// Allowed MIME types and their corresponding extensions
const ALLOWED_TYPES = {
  // Images
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'image/bmp': ['bmp'],
  'image/x-icon': ['ico'],
  'image/svg+xml': ['svg'],

  // Videos
  'video/mp4': ['mp4'],
  'video/webm': ['webm'],
  'video/quicktime': ['mov'],
  'video/x-msvideo': ['avi'],
  'video/x-matroska': ['mkv'],

  // Audio
  'audio/mpeg': ['mp3'],
  'audio/mp4': ['m4a'],
  'audio/ogg': ['ogg'],
  'audio/wav': ['wav'],
  'audio/flac': ['flac'],
  'audio/aac': ['aac'],

  // Documents
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'application/vnd.ms-powerpoint': ['ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
  'text/plain': ['txt'],
  'text/csv': ['csv'],
  'text/markdown': ['md'],

  // Archives (if allowed)
  'application/zip': ['zip'],
  'application/x-rar-compressed': ['rar'],
  'application/x-7z-compressed': ['7z'],
  'application/x-tar': ['tar'],
  'application/gzip': ['gz'],
};

/**
 * Check if file extension matches MIME type
 */
export function validateMimeType(mimetype: string, filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return false;

  const allowedExts = ALLOWED_TYPES[mimetype as keyof typeof ALLOWED_TYPES];
  if (!allowedExts) return false;

  return allowedExts.includes(ext);
}

/**
 * Read magic number from file buffer
 */
async function readMagicNumber(filePath: string, bytesToRead: number = 16): Promise<number[]> {
  try {
    const buffer = Buffer.alloc(bytesToRead);
    const handle = await fs.open(filePath, 'r');
    await handle.read(buffer, 0, bytesToRead, 0);
    await handle.close();

    return Array.from(buffer);
  } catch (error) {
    console.error('Error reading magic number:', error);
    return [];
  }
}

/**
 * Validate file signature (magic number) against known types
 */
async function validateFileSignature(filePath: string, expectedExtension: string): Promise<boolean> {
  const magicNumbers = await readMagicNumber(filePath);
  if (magicNumbers.length === 0) return false;

  const signature = FILE_SIGNATURES[expectedExtension as keyof typeof FILE_SIGNATURES];
  if (!signature) {
    // No signature defined for this type, skip validation
    return true;
  }

  // Check if magic numbers match
  for (let i = 0; i < signature.length; i++) {
    if (signature[i] !== undefined && signature[i] !== magicNumbers[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Multer file filter with MIME type validation
 */
export function fileFilter(req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  // Check if MIME type is allowed
  if (!ALLOWED_TYPES[file.mimetype as keyof typeof ALLOWED_TYPES]) {
    return cb(new Error(`File type not allowed: ${file.mimetype}`));
  }

  // Check if extension matches MIME type
  if (!validateMimeType(file.mimetype, file.originalname)) {
    return cb(new Error(`File extension does not match MIME type: ${file.mimetype}`));
  }

  // Pass validation
  cb(null, true);
}

/**
 * Post-upload validation with magic number check
 * Call this after file is saved to disk
 */
export async function validateUploadedFile(
  filePath: string,
  mimetype: string,
  originalname: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Extract extension
    const ext = originalname.split('.').pop()?.toLowerCase();
    if (!ext) {
      return { valid: false, error: 'No file extension found' };
    }

    // Validate MIME type
    if (!validateMimeType(mimetype, originalname)) {
      return { valid: false, error: 'MIME type mismatch' };
    }

    // Validate file signature (magic number)
    const signatureValid = await validateFileSignature(filePath, ext);
    if (!signatureValid) {
      return {
        valid: false,
        error: `File signature does not match extension: .${ext}`
      };
    }

    // Get file stats for size validation
    const stats = await fs.stat(filePath);
    const maxSize = process.env.MAX_FILE_SIZE ? parseInt(process.env.MAX_FILE_SIZE) : 100 * 1024 * 1024;

    if (stats.size > maxSize) {
      return { valid: false, error: `File too large: ${stats.size} bytes` };
    }

    if (stats.size === 0) {
      return { valid: false, error: 'File is empty' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Validation error: ${error}` };
  }
}

/**
 * Sanitize filename to prevent path traversal and XSS
 */
export function sanitizeFilename(filename: string): string {
  // Remove null bytes first
  let safe = filename.replace(/\0/g, '');

  // Normalize path separators to forward slash
  safe = safe.replace(/\\/g, '/');

  // Extract just the filename (removes path traversal)
  const parts = safe.split('/');
  safe = parts[parts.length - 1] || '';

  // Remove any remaining dots used for path traversal
  safe = safe.replace(/\.\./g, '');

  // Remove other dangerous characters
  safe = safe.replace(/[*?:"<>|\/\\]/g, '_');

  // Remove leading dots
  safe = safe.replace(/^\.+/, '');

  // Trim whitespace
  safe = safe.trim();

  // Ensure not empty after cleaning
  if (!safe || safe.length === 0) {
    safe = 'unnamed_file';
  }

  // Limit length while preserving extension
  if (safe.length > 255) {
    const ext = safe.split('.').pop() || '';
    const name = safe.substring(0, 240);
    safe = ext ? `${name}.${ext}` : name;
  }

  return safe;
}

/**
 * Get allowed file types for client-side validation
 */
export function getAllowedFileTypes(): string[] {
  return Object.keys(ALLOWED_TYPES);
}

/**
 * Get allowed extensions
 */
export function getAllowedExtensions(): string[] {
  return Object.values(ALLOWED_TYPES).flat();
}
