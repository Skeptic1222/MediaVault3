import { describe, it, expect } from 'vitest';
import {
  validateMimeType,
  sanitizeFilename,
  getAllowedFileTypes,
  getAllowedExtensions,
} from '../../server/middleware/fileValidation';

describe('FileValidation Middleware', () => {
  describe('MIME Type Validation', () => {
    it('should validate correct MIME type for image files', () => {
      expect(validateMimeType('image/jpeg', 'photo.jpg')).toBe(true);
      expect(validateMimeType('image/jpeg', 'photo.jpeg')).toBe(true);
      expect(validateMimeType('image/png', 'screenshot.png')).toBe(true);
      expect(validateMimeType('image/gif', 'animation.gif')).toBe(true);
      expect(validateMimeType('image/webp', 'modern.webp')).toBe(true);
    });

    it('should validate correct MIME type for video files', () => {
      expect(validateMimeType('video/mp4', 'movie.mp4')).toBe(true);
      expect(validateMimeType('video/webm', 'video.webm')).toBe(true);
      expect(validateMimeType('video/quicktime', 'clip.mov')).toBe(true);
    });

    it('should validate correct MIME type for audio files', () => {
      expect(validateMimeType('audio/mpeg', 'song.mp3')).toBe(true);
      expect(validateMimeType('audio/mp4', 'track.m4a')).toBe(true);
      expect(validateMimeType('audio/wav', 'sound.wav')).toBe(true);
      expect(validateMimeType('audio/flac', 'lossless.flac')).toBe(true);
    });

    it('should validate correct MIME type for documents', () => {
      expect(validateMimeType('application/pdf', 'document.pdf')).toBe(true);
      expect(validateMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'report.docx')).toBe(true);
      expect(validateMimeType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'data.xlsx')).toBe(true);
      expect(validateMimeType('text/plain', 'notes.txt')).toBe(true);
      expect(validateMimeType('text/csv', 'data.csv')).toBe(true);
    });

    it('should reject MIME type mismatch', () => {
      expect(validateMimeType('image/jpeg', 'file.png')).toBe(false);
      expect(validateMimeType('video/mp4', 'file.avi')).toBe(false);
      expect(validateMimeType('audio/mpeg', 'file.wav')).toBe(false);
      expect(validateMimeType('application/pdf', 'file.docx')).toBe(false);
    });

    it('should reject unsupported MIME types', () => {
      expect(validateMimeType('application/x-executable', 'virus.exe')).toBe(false);
      expect(validateMimeType('application/x-sh', 'script.sh')).toBe(false);
      expect(validateMimeType('text/x-python', 'code.py')).toBe(false);
    });

    it('should handle case-insensitive extensions', () => {
      expect(validateMimeType('image/jpeg', 'PHOTO.JPG')).toBe(true);
      expect(validateMimeType('image/jpeg', 'Photo.JPEG')).toBe(true);
      expect(validateMimeType('image/png', 'Screenshot.PNG')).toBe(true);
    });

    it('should reject files without extensions', () => {
      expect(validateMimeType('image/jpeg', 'photo')).toBe(false);
      expect(validateMimeType('application/pdf', 'document')).toBe(false);
    });
  });

  describe('Filename Sanitization', () => {
    it('should remove path traversal attempts', () => {
      expect(sanitizeFilename('../../../etc/passwd')).toBe('passwd');
      expect(sanitizeFilename('..\\..\\..\\windows\\system32\\config')).toBe('config');
      expect(sanitizeFilename('../../../../root/.ssh/id_rsa')).toBe('id_rsa');
    });

    it('should remove dangerous characters', () => {
      expect(sanitizeFilename('file:name.txt')).toBe('file_name.txt');
      expect(sanitizeFilename('file*name?.txt')).toBe('file_name_.txt');
      expect(sanitizeFilename('file<name>|.txt')).toBe('file_name__.txt');
      expect(sanitizeFilename('file"name.txt')).toBe('file_name.txt');
    });

    it('should remove leading dots', () => {
      expect(sanitizeFilename('.htaccess')).toBe('htaccess');
      expect(sanitizeFilename('..secret')).toBe('secret');
      expect(sanitizeFilename('...hidden')).toBe('hidden');
    });

    it('should handle empty or whitespace-only filenames', () => {
      expect(sanitizeFilename('')).toBe('unnamed_file');
      expect(sanitizeFilename('   ')).toBe('unnamed_file');
      expect(sanitizeFilename('...')).toBe('unnamed_file');
    });

    it('should truncate long filenames while preserving extension', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const sanitized = sanitizeFilename(longName);

      expect(sanitized.length).toBeLessThanOrEqual(255);
      expect(sanitized.endsWith('.txt')).toBe(true);
    });

    it('should preserve valid filenames', () => {
      expect(sanitizeFilename('photo.jpg')).toBe('photo.jpg');
      expect(sanitizeFilename('my-document_v2.pdf')).toBe('my-document_v2.pdf');
      expect(sanitizeFilename('report 2024.docx')).toBe('report 2024.docx');
    });

    it('should handle Unicode characters', () => {
      // Allowed Unicode characters should be preserved
      expect(sanitizeFilename('文档.pdf')).toBe('文档.pdf');
      expect(sanitizeFilename('Документ.docx')).toBe('Документ.docx');
      expect(sanitizeFilename('Ñoño.txt')).toBe('Ñoño.txt');
    });
  });

  describe('getAllowedFileTypes', () => {
    it('should return array of allowed MIME types', () => {
      const types = getAllowedFileTypes();

      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
      expect(types).toContain('image/jpeg');
      expect(types).toContain('image/png');
      expect(types).toContain('video/mp4');
      expect(types).toContain('audio/mpeg');
      expect(types).toContain('application/pdf');
    });

    it('should not include executable MIME types', () => {
      const types = getAllowedFileTypes();

      expect(types).not.toContain('application/x-executable');
      expect(types).not.toContain('application/x-sh');
      expect(types).not.toContain('application/x-bat');
    });
  });

  describe('getAllowedExtensions', () => {
    it('should return array of allowed extensions', () => {
      const extensions = getAllowedExtensions();

      expect(Array.isArray(extensions)).toBe(true);
      expect(extensions.length).toBeGreaterThan(0);
      expect(extensions).toContain('jpg');
      expect(extensions).toContain('png');
      expect(extensions).toContain('mp4');
      expect(extensions).toContain('mp3');
      expect(extensions).toContain('pdf');
    });

    it('should not include dangerous extensions', () => {
      const extensions = getAllowedExtensions();

      expect(extensions).not.toContain('exe');
      expect(extensions).not.toContain('sh');
      expect(extensions).not.toContain('bat');
      expect(extensions).not.toContain('cmd');
      expect(extensions).not.toContain('ps1');
    });

    it('should have unique extensions', () => {
      const extensions = getAllowedExtensions();
      const uniqueExtensions = [...new Set(extensions)];

      expect(extensions.length).toBe(uniqueExtensions.length);
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle null byte injection attempts', () => {
      expect(sanitizeFilename('file.txt\0.exe')).not.toContain('\0');
    });

    it('should handle mixed path separators', () => {
      expect(sanitizeFilename('path/to\\file/../../../etc/passwd')).toBe('passwd');
    });

    it('should handle URL-encoded path traversal', () => {
      // %2e%2e%2f is "../"
      expect(sanitizeFilename('%2e%2e%2f%2e%2e%2fetc%2fpasswd')).not.toContain('/');
    });

    it('should reject MIME type for double extensions', () => {
      // file.pdf.exe should not be treated as PDF
      expect(validateMimeType('application/pdf', 'document.pdf.exe')).toBe(false);
    });
  });
});
