import { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function SharePage() {
  const [, params] = useRoute('/share/:code');
  const [, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [isAccessing, setIsAccessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [shareInfo, setShareInfo] = useState<any>(null);

  const code = params?.code;
  const basePath = import.meta.env.BASE_URL || '/mediavault/';

  useEffect(() => {
    if (!code) {
      setError('Invalid share link');
      setIsLoading(false);
      return;
    }

    // Fetch share info
    const fetchShareInfo = async () => {
      try {
        const response = await fetch(`${basePath}api/share/${code}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          setError('Share link not found or has expired');
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        setShareInfo(data);
        setIsLoading(false);

        // If no password required and valid, auto-access
        if (!data.requiresPassword && data.isValid) {
          accessShare();
        }
      } catch (err) {
        console.error('Error fetching share info:', err);
        setError('Failed to load share information');
        setIsLoading(false);
      }
    };

    fetchShareInfo();
  }, [code]);

  const accessShare = async () => {
    if (!code) return;

    setIsAccessing(true);
    setError(null);

    try {
      const response = await fetch(`${basePath}api/share/${code}/access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          password: password || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();

        if (response.status === 401 && errorData.requiresAuth) {
          // Redirect to login for email-protected shares
          window.location.href = `${basePath}auth/google?returnUrl=${encodeURIComponent(`/share/${code}`)}`;
          return;
        }

        setError(errorData.message || 'Failed to access shared resource');
        setIsAccessing(false);
        return;
      }

      const data = await response.json();

      // Redirect based on resource type
      if (data.resourceType === 'folder') {
        navigate(`/gallery?folderId=${data.resourceId}`);
      } else if (data.resourceType === 'file') {
        navigate(`/gallery?fileId=${data.resourceId}`);
      } else {
        setError('Unknown resource type');
        setIsAccessing(false);
      }
    } catch (err) {
      console.error('Error accessing share:', err);
      setError('An unexpected error occurred');
      setIsAccessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Loading Share</CardTitle>
            <CardDescription>Please wait...</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !shareInfo) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Share Not Available</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={() => navigate('/')}>Return to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (shareInfo?.requiresPassword) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Password Protected</CardTitle>
            <CardDescription>Enter the password to access this shared content</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && accessShare()}
            />
            <Button onClick={accessShare} disabled={isAccessing} className="w-full">
              {isAccessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accessing...
                </>
              ) : (
                'Access'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Accessing Share</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    </div>
  );
}
