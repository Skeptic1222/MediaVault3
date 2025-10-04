import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Shield, Folder, Archive, Lock } from 'lucide-react';

export interface VaultStealthConfig {
  mode: 'discreet' | 'hidden' | 'disguised';
  hideStatsWhenLocked: boolean;
  disguiseConfig?: {
    displayName: string;
    iconName: 'folder' | 'archive' | 'files';
  };
  keyboardShortcut: string;
  showInUserMenu: boolean;
}

export interface UserPreferences {
  theme?: string;
  vaultStealth?: VaultStealthConfig;
}

const DEFAULT_CONFIG: VaultStealthConfig = {
  mode: 'discreet',
  hideStatsWhenLocked: false,
  keyboardShortcut: 'ctrl+shift+v',
  showInUserMenu: true,
  disguiseConfig: {
    displayName: 'Archive',
    iconName: 'folder',
  },
};

export function useVaultStealth() {
  const { data: preferences, isLoading } = useQuery<UserPreferences>({
    queryKey: ['/api/user/preferences'],
    retry: false,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const config = preferences?.vaultStealth || DEFAULT_CONFIG;

  const updatePreferences = useMutation({
    mutationFn: async (newPreferences: Partial<UserPreferences>) => {
      const response = await apiRequest('PUT', '/api/user/preferences', newPreferences);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] });
    },
  });

  const getVaultLabel = (): string => {
    if (config.mode === 'disguised') {
      return config.disguiseConfig?.displayName || 'Archive';
    }
    return 'Vault';
  };

  const getVaultIcon = () => {
    if (config.mode === 'disguised') {
      const iconName = config.disguiseConfig?.iconName || 'folder';
      switch (iconName) {
        case 'archive':
          return Archive;
        case 'files':
          return Folder;
        case 'folder':
        default:
          return Folder;
      }
    }
    return Shield;
  };

  const shouldShowInNav = (): boolean => {
    return config.mode !== 'hidden';
  };

  const shouldShowStats = (vaultItems: number): boolean => {
    // If hideStatsWhenLocked is enabled and vaultItems is 0 (locked), hide it
    if (config.hideStatsWhenLocked && vaultItems === 0) {
      return false;
    }
    return true;
  };

  const getStatsLabel = (): string => {
    if (config.mode === 'disguised') {
      return 'Archived Items';
    }
    return 'Vault Items';
  };

  const updateStealthMode = async (newConfig: Partial<VaultStealthConfig>) => {
    const updatedPreferences: UserPreferences = {
      ...preferences,
      vaultStealth: {
        ...config,
        ...newConfig,
      },
    };
    return updatePreferences.mutateAsync(updatedPreferences);
  };

  return {
    config,
    isLoading,
    getVaultLabel,
    getVaultIcon,
    shouldShowInNav,
    shouldShowStats,
    getStatsLabel,
    updateStealthMode,
    isUpdating: updatePreferences.isPending,
  };
}
