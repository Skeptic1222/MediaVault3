/**
 * FILE: server/services/searchService.ts
 *
 * Advanced search service with full-text search, filtering, and saved searches
 */

import { db } from '../db';
import { mediaFiles, files, categories, savedSearches, tags, fileTags } from '../../shared/schema';
import { eq, and, or, gte, lte, like, ilike, inArray, sql, desc, asc } from 'drizzle-orm';
import type { SavedSearch, InsertSavedSearch } from '../../shared/schema';
import { logger } from '../utils/logger';

export interface SearchCriteria {
  query?: string;               // Full-text search query
  mimeTypes?: string[];          // Filter by MIME types
  categoryIds?: string[];        // Filter by categories
  tagIds?: string[];             // Filter by tags
  dateFrom?: Date;               // Date range start
  dateTo?: Date;                 // Date range end
  fileSizeMin?: number;          // Minimum file size in bytes
  fileSizeMax?: number;          // Maximum file size in bytes
  isEncrypted?: boolean;         // Filter encrypted/vault files
  isFavorite?: boolean;          // Filter favorites
  hasThumbnail?: boolean;        // Files with thumbnails
  sortBy?: 'created_at' | 'updated_at' | 'filename' | 'file_size' | 'mime_type';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  files: any[];
  total: number;
  hasMore: boolean;
}

/**
 * Advanced search across media files with multiple criteria
 */
export async function advancedSearch(
  userId: string,
  criteria: SearchCriteria
): Promise<SearchResult> {
  try {
    const {
      query,
      mimeTypes,
      categoryIds,
      tagIds,
      dateFrom,
      dateTo,
      fileSizeMin,
      fileSizeMax,
      isEncrypted,
      isFavorite,
      hasThumbnail,
      sortBy = 'created_at',
      sortOrder = 'desc',
      limit = 50,
      offset = 0
    } = criteria;

    // Build WHERE conditions
    const conditions: any[] = [
      eq(mediaFiles.uploadedBy, userId),
      eq(mediaFiles.isDeleted, false)
    ];

    // Full-text search on filename and original name
    if (query) {
      conditions.push(
        or(
          ilike(mediaFiles.filename, `%${query}%`),
          ilike(mediaFiles.originalName, `%${query}%`)
        )
      );
    }

    // MIME type filter
    if (mimeTypes && mimeTypes.length > 0) {
      conditions.push(inArray(mediaFiles.mimeType, mimeTypes));
    }

    // Category filter
    if (categoryIds && categoryIds.length > 0) {
      conditions.push(inArray(mediaFiles.categoryId, categoryIds as any));
    }

    // Date range filter
    if (dateFrom) {
      conditions.push(gte(mediaFiles.createdAt, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(mediaFiles.createdAt, dateTo));
    }

    // File size filter
    if (fileSizeMin !== undefined) {
      conditions.push(gte(mediaFiles.fileSize, fileSizeMin));
    }
    if (fileSizeMax !== undefined) {
      conditions.push(lte(mediaFiles.fileSize, fileSizeMax));
    }

    // Encrypted/vault filter
    if (isEncrypted !== undefined) {
      conditions.push(eq(mediaFiles.isEncrypted, isEncrypted));
    }

    // Favorite filter
    if (isFavorite !== undefined) {
      conditions.push(eq(mediaFiles.isFavorite, isFavorite));
    }

    // Thumbnail filter
    if (hasThumbnail === true) {
      conditions.push(sql`${mediaFiles.thumbnailData} IS NOT NULL`);
    }

    // Tag filter (requires join)
    let baseQuery = db
      .select()
      .from(mediaFiles)
      .where(and(...conditions));

    // Apply tag filter if specified
    if (tagIds && tagIds.length > 0) {
      // This would require a proper join with fileTags table
      // For now, we'll filter based on the tags array in mediaFiles
      const tagConditions = tagIds.map(tagId =>
        sql`${mediaFiles.tags} @> ARRAY[${tagId}]::text[]`
      );
      conditions.push(or(...tagConditions));
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(mediaFiles)
      .where(and(...conditions));

    const total = Number(countResult[0]?.count || 0);

    // Build sort
    const orderByColumn = mediaFiles[sortBy as keyof typeof mediaFiles] || mediaFiles.createdAt;
    const orderFn = sortOrder === 'asc' ? asc : desc;

    // Execute search query
    const results = await db
      .select()
      .from(mediaFiles)
      .where(and(...conditions))
      .orderBy(orderFn(orderByColumn))
      .limit(limit)
      .offset(offset);

    logger.info(`Advanced search executed: ${results.length} results found (total: ${total})`);

    return {
      files: results,
      total,
      hasMore: offset + results.length < total
    };
  } catch (error) {
    logger.error('Error in advanced search:', error);
    throw error;
  }
}

/**
 * Save a search for quick access
 */
export async function saveSearch(
  userId: string,
  name: string,
  searchCriteria: SearchCriteria,
  options?: {
    description?: string;
    icon?: string;
    color?: string;
    isPinned?: boolean;
  }
): Promise<SavedSearch> {
  try {
    const [savedSearch] = await db
      .insert(savedSearches)
      .values({
        userId,
        name,
        description: options?.description,
        searchCriteria: searchCriteria as any,
        icon: options?.icon,
        color: options?.color,
        isPinned: options?.isPinned || false,
        usageCount: 0
      })
      .returning();

    logger.info(`Saved search created: ${name} for user ${userId}`);
    return savedSearch;
  } catch (error) {
    logger.error('Error saving search:', error);
    throw error;
  }
}

/**
 * Get all saved searches for a user
 */
export async function getUserSavedSearches(userId: string): Promise<SavedSearch[]> {
  try {
    const searches = await db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId))
      .orderBy(desc(savedSearches.isPinned), desc(savedSearches.usageCount));

    return searches;
  } catch (error) {
    logger.error('Error getting saved searches:', error);
    throw error;
  }
}

/**
 * Execute a saved search
 */
export async function executeSavedSearch(
  userId: string,
  searchId: string
): Promise<SearchResult> {
  try {
    const [savedSearch] = await db
      .select()
      .from(savedSearches)
      .where(and(
        eq(savedSearches.id, searchId),
        eq(savedSearches.userId, userId)
      ));

    if (!savedSearch) {
      throw new Error('Saved search not found');
    }

    // Update usage count and last used timestamp
    await db
      .update(savedSearches)
      .set({
        usageCount: sql`${savedSearches.usageCount} + 1`,
        lastUsedAt: new Date()
      })
      .where(eq(savedSearches.id, searchId));

    // Execute the search
    const results = await advancedSearch(userId, savedSearch.searchCriteria as SearchCriteria);

    logger.info(`Executed saved search: ${savedSearch.name}`);
    return results;
  } catch (error) {
    logger.error('Error executing saved search:', error);
    throw error;
  }
}

/**
 * Delete a saved search
 */
export async function deleteSavedSearch(userId: string, searchId: string): Promise<void> {
  try {
    await db
      .delete(savedSearches)
      .where(and(
        eq(savedSearches.id, searchId),
        eq(savedSearches.userId, userId)
      ));

    logger.info(`Deleted saved search: ${searchId}`);
  } catch (error) {
    logger.error('Error deleting saved search:', error);
    throw error;
  }
}

/**
 * Update a saved search
 */
export async function updateSavedSearch(
  userId: string,
  searchId: string,
  updates: Partial<InsertSavedSearch>
): Promise<SavedSearch> {
  try {
    const [updated] = await db
      .update(savedSearches)
      .set(updates)
      .where(and(
        eq(savedSearches.id, searchId),
        eq(savedSearches.userId, userId)
      ))
      .returning();

    if (!updated) {
      throw new Error('Saved search not found');
    }

    logger.info(`Updated saved search: ${searchId}`);
    return updated;
  } catch (error) {
    logger.error('Error updating saved search:', error);
    throw error;
  }
}

/**
 * Get search suggestions based on user's search history and tags
 */
export async function getSearchSuggestions(userId: string, query: string): Promise<string[]> {
  try {
    const suggestions: string[] = [];

    // Get matching filenames
    const filenameMatches = await db
      .select({ originalName: mediaFiles.originalName })
      .from(mediaFiles)
      .where(and(
        eq(mediaFiles.uploadedBy, userId),
        ilike(mediaFiles.originalName, `%${query}%`)
      ))
      .limit(5);

    suggestions.push(...filenameMatches.map(f => f.originalName));

    // Get matching tags
    const tagMatches = await db
      .select({ name: tags.name })
      .from(tags)
      .where(and(
        eq(tags.userId, userId),
        ilike(tags.name, `%${query}%`)
      ))
      .limit(5);

    suggestions.push(...tagMatches.map(t => t.name));

    // Remove duplicates and return
    return [...new Set(suggestions)].slice(0, 10);
  } catch (error) {
    logger.error('Error getting search suggestions:', error);
    return [];
  }
}
