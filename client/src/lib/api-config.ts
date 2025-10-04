/**
 * API configuration for handling base paths
 * When deployed under a subpath (e.g., /mediavault), all API calls need to be prefixed
 */

// Get base path from import.meta.env or fall back to empty string
const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

/**
 * Prepends the base path to an API endpoint
 * @param endpoint - The API endpoint (e.g., '/api/auth/user')
 * @returns The full path including base (e.g., '/mediavault/api/auth/user')
 */
export function getApiUrl(endpoint: string): string {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // If base path exists and endpoint starts with /api, prepend base path
  if (BASE_PATH && cleanEndpoint.startsWith('/api')) {
    return `${BASE_PATH}${cleanEndpoint}`;
  }

  return cleanEndpoint;
}

/**
 * The base URL for API calls
 */
export const API_BASE_URL = BASE_PATH;
