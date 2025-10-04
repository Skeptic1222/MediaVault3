import { getApiUrl } from './api-config';

/**
 * Cache for signed URLs to avoid regenerating for the same file
 * Maps: fileId -> { signature, expiresAt }
 */
const signedUrlCache = new Map<string, { signature: string; expiresAt: number }>();

/**
 * Generate a signed URL for encrypted media that doesn't expose the vault token
 * @param fileId - The media file ID
 * @param vaultToken - The vault access token
 * @returns Promise<string | null> - The signed URL or null if failed
 */
export async function getSignedMediaUrl(
  fileId: string,
  vaultToken: string
): Promise<string | null> {
  try {
    // Check cache first
    const cached = signedUrlCache.get(fileId);
    if (cached && Date.now() < cached.expiresAt - 60000) { // Refresh 1min before expiry
      return getApiUrl(`/api/media/${fileId}?decrypt=true&sig=${encodeURIComponent(cached.signature)}`);
    }

    // Generate new signed URL
    const response = await fetch(getApiUrl('/api/vault/sign-url'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ fileId, vaultToken })
    });

    if (!response.ok) {
      console.error('[Signed URL] Failed to generate:', response.statusText);
      return null;
    }

    const data = await response.json();
    const expiresAt = new Date(data.expiresAt).getTime();

    // Cache the signature
    signedUrlCache.set(fileId, {
      signature: data.signature,
      expiresAt
    });

    return getApiUrl(`/api/media/${fileId}?decrypt=true&sig=${encodeURIComponent(data.signature)}`);
  } catch (error) {
    console.error('[Signed URL] Error generating signed URL:', error);
    return null;
  }
}

/**
 * Generate a signed thumbnail URL
 * @param fileId - The media file ID
 * @param vaultToken - The vault access token
 * @param size - Thumbnail size (optional)
 * @returns Promise<string | null> - The signed URL or null if failed
 */
export async function getSignedThumbnailUrl(
  fileId: string,
  vaultToken: string,
  size?: string
): Promise<string | null> {
  try {
    const cacheKey = `${fileId}-thumb-${size || 'default'}`;
    const cached = signedUrlCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt - 60000) {
      const sizeParam = size ? `&size=${size}` : '';
      return getApiUrl(`/api/media/${fileId}/thumbnail?decrypt=true&sig=${encodeURIComponent(cached.signature)}${sizeParam}`);
    }

    const response = await fetch(getApiUrl('/api/vault/sign-url'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ fileId, vaultToken })
    });

    if (!response.ok) {
      console.error('[Signed Thumbnail URL] Failed to generate:', response.statusText);
      return null;
    }

    const data = await response.json();
    const expiresAt = new Date(data.expiresAt).getTime();

    signedUrlCache.set(cacheKey, {
      signature: data.signature,
      expiresAt
    });

    const sizeParam = size ? `&size=${size}` : '';
    return getApiUrl(`/api/media/${fileId}/thumbnail?decrypt=true&sig=${encodeURIComponent(data.signature)}${sizeParam}`);
  } catch (error) {
    console.error('[Signed Thumbnail URL] Error generating signed URL:', error);
    return null;
  }
}

/**
 * Clear the signed URL cache (call when vault is locked)
 */
export function clearSignedUrlCache() {
  signedUrlCache.clear();
  console.log('[Signed URL] Cache cleared');
}
