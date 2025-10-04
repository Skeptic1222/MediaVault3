import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, Share2, Lock, Clock, Hash } from "lucide-react";
import type { ShareLink } from "@shared/schema";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: 'file' | 'folder' | 'album' | 'category';
  resourceId: string;
  resourceName: string;
}

export default function ShareDialog({
  open,
  onOpenChange,
  resourceType,
  resourceId,
  resourceName,
}: ShareDialogProps) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [expiresIn, setExpiresIn] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  // Fetch existing share links for this resource
  const { data: existingLinks } = useQuery<ShareLink[]>({
    queryKey: [`/api/share/resource/${resourceType}/${resourceId}`],
    enabled: open,
  });

  // Create share link mutation
  const createShareMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resourceType,
          resourceId,
          password: usePassword ? password : undefined,
          expiresIn: expiresIn ? parseInt(expiresIn) : undefined,
          maxUses: maxUses ? parseInt(maxUses) : undefined,
        }),
      });
    },
    onSuccess: (data: any) => {
      setShareUrl(data.url);
      queryClient.invalidateQueries({ queryKey: [`/api/share/resource/${resourceType}/${resourceId}`] });
      toast({
        title: "Success",
        description: "Share link created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create share link",
        variant: "destructive",
      });
    },
  });

  // Delete share link mutation
  const deleteShareMutation = useMutation({
    mutationFn: async (code: string) => {
      return await apiRequest(`/api/share/${code}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/share/resource/${resourceType}/${resourceId}`] });
      toast({
        title: "Success",
        description: "Share link deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete share link",
        variant: "destructive",
      });
    },
  });

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied",
      description: "Link copied to clipboard",
    });
  };

  const handleCreateShare = () => {
    createShareMutation.mutate();
  };

  const formatExpiryDate = (date: Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share "{resourceName}"
          </DialogTitle>
          <DialogDescription>
            Create a shareable link for this {resourceType}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Password Protection */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="use-password" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Password Protection
              </Label>
              <p className="text-sm text-muted-foreground">
                Require password to access
              </p>
            </div>
            <Switch
              id="use-password"
              checked={usePassword}
              onCheckedChange={setUsePassword}
            />
          </div>

          {usePassword && (
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>
          )}

          {/* Expiration */}
          <div>
            <Label htmlFor="expires" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Expires In (hours)
            </Label>
            <Input
              id="expires"
              type="number"
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              placeholder="Leave empty for no expiration"
            />
          </div>

          {/* Max Uses */}
          <div>
            <Label htmlFor="max-uses" className="flex items-center gap-2">
              <Hash className="w-4 h-4" />
              Max Uses
            </Label>
            <Input
              id="max-uses"
              type="number"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Leave empty for unlimited"
            />
          </div>

          {/* Share URL */}
          {shareUrl && (
            <div className="p-4 bg-secondary rounded-lg">
              <Label>Share Link</Label>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopyLink(shareUrl)}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}

          {/* Existing Links */}
          {existingLinks && existingLinks.length > 0 && (
            <div className="space-y-2">
              <Label>Existing Share Links</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {existingLinks.map((link) => (
                  <div
                    key={link.code}
                    className="flex items-center justify-between p-2 bg-secondary rounded text-sm"
                  >
                    <div className="flex-1">
                      <div className="font-mono">{link.code}</div>
                      <div className="text-xs text-muted-foreground">
                        {link.password && <Lock className="w-3 h-3 inline mr-1" />}
                        {link.usageCount}/{link.maxUses || '∞'} uses
                        {' • '}
                        Expires: {formatExpiryDate(link.expiresAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyLink(`${window.location.origin}/share/${link.code}`)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteShareMutation.mutate(link.code)}
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleCreateShare}
            disabled={createShareMutation.isPending || (usePassword && !password)}
          >
            Create Share Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
