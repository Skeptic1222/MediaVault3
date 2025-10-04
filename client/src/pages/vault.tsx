import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getApiUrl } from "@/lib/api-config";
import { clearSignedUrlCache } from "@/lib/signed-urls";
import Navbar from "@/components/ui/navbar";
import VaultAccessModal from "@/components/vault/VaultAccessModal";
import MediaGrid from "@/components/gallery/MediaGrid";
import MediaLightbox from "@/components/gallery/MediaLightbox";
import CategoryHierarchy from "@/components/gallery/CategoryHierarchy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Lock, Eye, EyeOff } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import type { Category } from "@shared/schema";

export default function Vault() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [vaultAccessToken, setVaultAccessToken] = useState<string | null>(null);
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>();

  // Check vault status on mount
  useEffect(() => {
    const checkVaultStatus = async () => {
      if (!isAuthenticated) return;

      try {
        const response = await apiRequest('/api/vault/status');
        const data = await response.json();

        if (data.isUnlocked && data.accessToken) {
          setIsVaultUnlocked(true);
          setVaultAccessToken(data.accessToken);
          console.log('[Vault] Restored vault session from server');
        }
      } catch (error) {
        console.error('[Vault] Failed to check vault status:', error);
      }
    };

    if (isAuthenticated) {
      checkVaultStatus();
    }
  }, [isAuthenticated]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = getApiUrl('/api/login');
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: vaultStats } = useQuery({
    queryKey: ["/api/stats"],
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    enabled: isAuthenticated,
  });

  const { data: vaultMedia, isLoading: vaultMediaLoading } = useQuery({
    queryKey: ["/api/media", { isVault: true }],
    queryFn: async () => {
      const params = new URLSearchParams({
        isVault: 'true',
        limit: '100',
        offset: '0'
      });
      const response = await fetch(getApiUrl(`/api/media?${params}`));
      if (!response.ok) throw new Error('Failed to fetch vault media');
      return response.json();
    },
    enabled: isAuthenticated && isVaultUnlocked,
    retry: false,
  });

  // Keyboard navigation for media lightbox
  const {
    selectedIndex,
    isLightboxOpen,
    openLightbox,
    closeLightbox,
    navigateNext,
    navigatePrevious,
  } = useKeyboardNavigation(vaultMedia?.files || []);

  const vaultAuthMutation = useMutation({
    mutationFn: async (passphrase: string) => {
      const response = await apiRequest('/api/vault/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase }),
      });
      return response.json();
    },
    onSuccess: (data) => {
      setIsVaultUnlocked(true);
      setVaultAccessToken(data.accessToken);
      setShowVaultModal(false);
      toast({
        title: "Vault Unlocked",
        description: "You now have access to encrypted content.",
      });
      // Refetch vault media
      queryClient.invalidateQueries({ queryKey: ["/api/media", { isVault: true }] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = getApiUrl('/api/login');
        }, 500);
        return;
      }
      toast({
        title: "Access Denied",
        description: "Invalid vault passphrase. Please try again.",
        variant: "destructive",
      });
    },
  });

  const setupVaultMutation = useMutation({
    mutationFn: async (passphrase: string) => {
      const response = await apiRequest('/api/vault/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase }),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Vault Setup Complete",
        description: "Your vault has been configured successfully.",
      });
      setShowVaultModal(false);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = getApiUrl('/api/login');
        }, 500);
        return;
      }
      toast({
        title: "Setup Failed",
        description: "Failed to setup vault. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleVaultAccess = () => {
    setShowVaultModal(true);
  };

  const handleVaultAuth = (passphrase: string) => {
    vaultAuthMutation.mutate(passphrase);
  };

  const handleVaultSetup = (passphrase: string) => {
    setupVaultMutation.mutate(passphrase);
  };

  const lockVault = async () => {
    try {
      // Call API to lock vault and clear session
      await apiRequest('/api/vault/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      // Clear signed URL cache to prevent access to encrypted content
      clearSignedUrlCache();

      setIsVaultUnlocked(false);
      setVaultAccessToken(null);
      toast({
        title: "Vault Locked",
        description: "Encrypted content is now secured.",
      });
    } catch (error) {
      console.error('[Vault] Failed to lock vault:', error);
      // Still lock locally even if API fails
      clearSignedUrlCache();
      setIsVaultUnlocked(false);
      setVaultAccessToken(null);
    }
  };

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Vault Header */}
          <div className="text-center mb-8" data-testid="vault-header">
            <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-accent" />
            </div>
            <h1 className="text-4xl font-bold mb-2">
              <span className="bg-gradient-to-r from-accent to-destructive bg-clip-text text-transparent">
                Secure Vault
              </span>
            </h1>
            <p className="text-muted-foreground text-lg">
              AES-256 encrypted storage for your most sensitive content
            </p>
          </div>

          {/* Vault Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="border-accent/20 bg-accent/5" data-testid="card-vault-items">
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-accent mb-2" data-testid="text-vault-items-count">
                    {vaultStats?.vaultItems?.toLocaleString() || '0'}
                  </div>
                  <div className="text-sm text-muted-foreground">Encrypted Items</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border" data-testid="card-vault-status">
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    {isVaultUnlocked ? (
                      <Eye className="w-8 h-8 text-green-400" />
                    ) : (
                      <EyeOff className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Vault Status: {isVaultUnlocked ? 'Unlocked' : 'Locked'}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border" data-testid="card-encryption-strength">
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary mb-2">AES-256</div>
                  <div className="text-sm text-muted-foreground">Encryption Standard</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Vault Access Controls */}
          <div className="text-center mb-8">
            {isVaultUnlocked ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-green-400 mb-4">
                  <Lock className="w-5 h-5" />
                  <span className="font-medium">Vault is unlocked - You have access to encrypted content</span>
                </div>
                <Button 
                  variant="outline" 
                  onClick={lockVault}
                  data-testid="button-lock-vault"
                >
                  Lock Vault
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
                  <Lock className="w-5 h-5" />
                  <span>Vault is locked - Enter passphrase to access encrypted content</span>
                </div>
                <Button 
                  onClick={handleVaultAccess}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  data-testid="button-unlock-vault"
                >
                  Unlock Vault
                </Button>
              </div>
            )}
          </div>

          {/* Vault Content */}
          {isVaultUnlocked ? (
            <div data-testid="vault-content">
              {/* Folder Navigation */}
              <CategoryHierarchy
                categories={categories || []}
                selectedCategoryId={selectedCategoryId}
                onCategorySelect={(categoryId) => setSelectedCategoryId(categoryId)}
              />

              <h2 className="text-2xl font-bold mb-6">Encrypted Media</h2>
              
              {vaultMediaLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                  <p className="text-muted-foreground mt-4">Loading encrypted content...</p>
                </div>
              ) : vaultMedia?.files?.length > 0 ? (
                <>
                  <MediaGrid
                    mediaFiles={vaultMedia.files}
                    isLoading={false}
                    selectedIndex={selectedIndex}
                    onMediaSelect={(mediaId, index) => {
                      openLightbox(index);
                    }}
                    isVaultMode={true}
                    decryptionKey={vaultAccessToken}
                    data-testid="vault-media-grid"
                  />
                  <MediaLightbox
                    mediaFiles={vaultMedia?.files || []}
                    selectedIndex={selectedIndex}
                    isOpen={isLightboxOpen}
                    onClose={closeLightbox}
                    onNext={navigateNext}
                    onPrevious={navigatePrevious}
                    decryptionKey={vaultAccessToken || undefined}
                    data-testid="vault-media-lightbox"
                  />
                </>
              ) : (
                <Card className="text-center py-12" data-testid="vault-empty-state">
                  <CardContent>
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <Lock className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No Encrypted Content</h3>
                    <p className="text-muted-foreground">
                      Upload media with encryption enabled to populate your vault
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card className="text-center py-12" data-testid="vault-locked-state">
              <CardContent>
                <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Vault Locked</h3>
                <p className="text-muted-foreground mb-6">
                  Authentication required to access encrypted content
                </p>
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    • All content is encrypted with AES-256-GCM
                  </div>
                  <div className="text-sm text-muted-foreground">
                    • Biometric authentication supported
                  </div>
                  <div className="text-sm text-muted-foreground">
                    • Zero-knowledge architecture
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Vault Access Modal */}
      <VaultAccessModal
        isOpen={showVaultModal}
        onClose={() => setShowVaultModal(false)}
        onAuthenticate={handleVaultAuth}
        onSetup={handleVaultSetup}
        isAuthenticating={vaultAuthMutation.isPending}
        isSettingUp={setupVaultMutation.isPending}
        data-testid="vault-access-modal"
      />
    </div>
  );
}
