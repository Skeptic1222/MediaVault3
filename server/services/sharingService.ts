/**
 * FILE: server/services/sharingService.ts
 *
 * Gallery and album sharing service
 * Supports sharing albums, folders, and individual files with public links
 */

import { db } from '../db';
import { shareLinks, albums, folders, files, mediaFiles } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { ShareLink, InsertShareLink } from '../../shared/schema';
import { logger } from '../logger';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

export type ResourceType = 'album' | 'folder' | 'file' | 'category';

export interface CreateShareLinkOptions {
  resourceType: ResourceType;
  resourceId: string;
  userId: string;
  password?: string;
  expiresIn?: number; // hours
  maxUses?: number;
  permissions?: {
    canDownload?: boolean;
    canView?: boolean;
  };
}

export interface ShareLinkInfo {
  shareLink: ShareLink;
  resource: any;
  isValid: boolean;
  requiresPassword: boolean;
}

/**
 * Generate a unique share code
 */
function generateShareCode(): string {
  return nanoid(12); // 12 character URL-safe code
}

/**
 * Hash password for share link
 */
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Create a share link for a resource
 */
export async function createShareLink(options: CreateShareLinkOptions): Promise<ShareLink> {
  try {
    const {
      resourceType,
      resourceId,
      userId,
      password,
      expiresIn,
      maxUses,
      permissions
    } = options;

    // Verify user owns the resource
    const ownsResource = await verifyResourceOwnership(resourceType, resourceId, userId);
    if (!ownsResource) {
      throw new Error('User does not own this resource');
    }

    // Generate unique code
    const code = generateShareCode();

    // Calculate expiration
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 60 * 60 * 1000)
      : null;

    // Create share link
    const [shareLink] = await db
      .insert(shareLinks)
      .values({
        code,
        resourceType,
        resourceId,
        createdBy: userId,
        password: password ? hashPassword(password) : null,
        permissions: permissions || { canView: true, canDownload: true },
        maxUses: maxUses || null,
        usageCount: 0,
        expiresAt
      })
      .returning();

    logger.info(`Share link created: ${code} for ${resourceType}:${resourceId}`);
    return shareLink;
  } catch (error) {
    logger.error('Error creating share link:', error);
    throw error;
  }
}

/**
 * Verify user owns the resource
 */
async function verifyResourceOwnership(
  resourceType: ResourceType,
  resourceId: string,
  userId: string
): Promise<boolean> {
  try {
    switch (resourceType) {
      case 'album': {
        const [album] = await db
          .select()
          .from(albums)
          .where(and(
            eq(albums.id, resourceId),
            eq(albums.userId, userId)
          ));
        return !!album;
      }
      case 'folder': {
        const [folder] = await db
          .select()
          .from(folders)
          .where(and(
            eq(folders.id, resourceId),
            eq(folders.userId, userId)
          ));
        return !!folder;
      }
      case 'file': {
        const [file] = await db
          .select()
          .from(files)
          .where(and(
            eq(files.id, resourceId),
            eq(files.userId, userId)
          ));
        if (file) return true;

        // Also check mediaFiles table
        const [mediaFile] = await db
          .select()
          .from(mediaFiles)
          .where(and(
            eq(mediaFiles.id, resourceId),
            eq(mediaFiles.uploadedBy, userId)
          ));
        return !!mediaFile;
      }
      default:
        return false;
    }
  } catch (error) {
    logger.error('Error verifying resource ownership:', error);
    return false;
  }
}

/**
 * Get share link by code
 */
export async function getShareLinkByCode(code: string): Promise<ShareLinkInfo | null> {
  try {
    const [shareLink] = await db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.code, code));

    if (!shareLink) {
      return null;
    }

    // Check if expired
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return {
        shareLink,
        resource: null,
        isValid: false,
        requiresPassword: !!shareLink.password
      };
    }

    // Check if max uses reached
    if (shareLink.maxUses && shareLink.usageCount >= shareLink.maxUses) {
      return {
        shareLink,
        resource: null,
        isValid: false,
        requiresPassword: !!shareLink.password
      };
    }

    // Get resource
    const resource = await getSharedResource(shareLink.resourceType as ResourceType, shareLink.resourceId);

    return {
      shareLink,
      resource,
      isValid: true,
      requiresPassword: !!shareLink.password
    };
  } catch (error) {
    logger.error('Error getting share link:', error);
    return null;
  }
}

/**
 * Access shared resource (with password verification)
 */
export async function accessSharedResource(
  code: string,
  password?: string
): Promise<{ success: boolean; resource?: any; error?: string }> {
  try {
    const shareInfo = await getShareLinkByCode(code);

    if (!shareInfo) {
      return { success: false, error: 'Share link not found' };
    }

    if (!shareInfo.isValid) {
      return { success: false, error: 'Share link expired or max uses reached' };
    }

    // Verify password if required
    if (shareInfo.requiresPassword) {
      if (!password) {
        return { success: false, error: 'Password required' };
      }

      const hashedPassword = hashPassword(password);
      if (hashedPassword !== shareInfo.shareLink.password) {
        return { success: false, error: 'Invalid password' };
      }
    }

    // Increment usage count
    await db
      .update(shareLinks)
      .set({
        usageCount: sql`${shareLinks.usageCount} + 1`,
        lastAccessedAt: new Date()
      })
      .where(eq(shareLinks.code, code));

    logger.info(`Share link accessed: ${code}`);
    return { success: true, resource: shareInfo.resource };
  } catch (error) {
    logger.error('Error accessing shared resource:', error);
    return { success: false, error: 'Failed to access shared resource' };
  }
}

/**
 * Get shared resource by type and ID
 */
async function getSharedResource(resourceType: ResourceType, resourceId: string): Promise<any> {
  try {
    switch (resourceType) {
      case 'album': {
        const [album] = await db
          .select()
          .from(albums)
          .where(eq(albums.id, resourceId));
        return album;
      }
      case 'folder': {
        const [folder] = await db
          .select()
          .from(folders)
          .where(eq(folders.id, resourceId));
        return folder;
      }
      case 'file': {
        // Try files table first
        const [file] = await db
          .select()
          .from(files)
          .where(eq(files.id, resourceId));
        if (file) return file;

        // Try mediaFiles table
        const [mediaFile] = await db
          .select()
          .from(mediaFiles)
          .where(eq(mediaFiles.id, resourceId));
        return mediaFile;
      }
      default:
        return null;
    }
  } catch (error) {
    logger.error('Error getting shared resource:', error);
    return null;
  }
}

/**
 * Get all share links for a resource
 */
export async function getResourceShareLinks(
  resourceType: ResourceType,
  resourceId: string,
  userId: string
): Promise<ShareLink[]> {
  try {
    const links = await db
      .select()
      .from(shareLinks)
      .where(and(
        eq(shareLinks.resourceType, resourceType),
        eq(shareLinks.resourceId, resourceId),
        eq(shareLinks.createdBy, userId)
      ));

    return links;
  } catch (error) {
    logger.error('Error getting resource share links:', error);
    return [];
  }
}

/**
 * Delete share link
 */
export async function deleteShareLink(code: string, userId: string): Promise<boolean> {
  try {
    const [deleted] = await db
      .delete(shareLinks)
      .where(and(
        eq(shareLinks.code, code),
        eq(shareLinks.createdBy, userId)
      ))
      .returning();

    if (deleted) {
      logger.info(`Share link deleted: ${code}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Error deleting share link:', error);
    return false;
  }
}

/**
 * Update share link settings
 */
export async function updateShareLink(
  code: string,
  userId: string,
  updates: {
    password?: string;
    expiresAt?: Date | null;
    maxUses?: number | null;
    permissions?: any;
  }
): Promise<ShareLink | null> {
  try {
    const updateData: any = {};

    if (updates.password !== undefined) {
      updateData.password = updates.password ? hashPassword(updates.password) : null;
    }
    if (updates.expiresAt !== undefined) {
      updateData.expiresAt = updates.expiresAt;
    }
    if (updates.maxUses !== undefined) {
      updateData.maxUses = updates.maxUses;
    }
    if (updates.permissions !== undefined) {
      updateData.permissions = updates.permissions;
    }

    const [updated] = await db
      .update(shareLinks)
      .set(updateData)
      .where(and(
        eq(shareLinks.code, code),
        eq(shareLinks.createdBy, userId)
      ))
      .returning();

    if (updated) {
      logger.info(`Share link updated: ${code}`);
      return updated;
    }
    return null;
  } catch (error) {
    logger.error('Error updating share link:', error);
    return null;
  }
}

/**
 * Get user's all share links
 */
export async function getUserShareLinks(userId: string): Promise<ShareLink[]> {
  try {
    const links = await db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.createdBy, userId))
      .orderBy(sql`${shareLinks.createdAt} DESC`);

    return links;
  } catch (error) {
    logger.error('Error getting user share links:', error);
    return [];
  }
}
