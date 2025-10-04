import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Heart, Download, Share2, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { useGesture } from "@use-gesture/react";
import { useSpring, animated, config } from "@react-spring/web";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ImageViewer } from "@/components/ImageViewer";
import { getApiUrl } from "@/lib/api-config";
import { getSignedMediaUrl } from "@/lib/signed-urls";
import type { MediaFile } from "@shared/schema";

interface MediaLightboxProps {
  mediaFiles: MediaFile[];
  selectedIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onShare?: (mediaId: string, filename: string) => void;
  decryptionKey?: string | null;
}

type FullscreenMode = 'normal' | 'fullscreen' | 'stretched';

export default function MediaLightbox({
  mediaFiles,
  selectedIndex,
  isOpen,
  onClose,
  onNext,
  onPrevious,
  onShare,
  decryptionKey
}: MediaLightboxProps) {
  const [fullscreenMode, setFullscreenMode] = useState<FullscreenMode>('normal');
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const currentFile = mediaFiles[selectedIndex];
  const isVideo = currentFile?.mimeType.startsWith('video/');
  const isImage = currentFile?.mimeType.startsWith('image/');

  // Spring animation for swipe gestures
  const [{ x, y, opacity, scale }, api] = useSpring(() => ({
    x: 0,
    y: 0,
    opacity: 1,
    scale: 1,
    config: config.stiff,
  }));

  // Reset animations when index changes
  useEffect(() => {
    api.start({ x: 0, y: 0, opacity: 1, scale: 1, immediate: false });
    setImageZoom(1);
    setImagePosition({ x: 0, y: 0 });
  }, [selectedIndex, api]);

  // Gesture handlers
  const bind = useGesture(
    {
      onDrag: ({ offset: [ox, oy], direction: [dx, dy], velocity: [vx, vy], cancel, tap, event }) => {
        // Prevent default browser behavior
        event?.preventDefault();

        // Tap to toggle controls
        if (tap) {
          setShowControls(prev => !prev);
          return;
        }

        // Don't allow swipe if image is zoomed
        if (imageZoom > 1) {
          return;
        }

        const absOx = Math.abs(ox);
        const absOy = Math.abs(oy);

        // Vertical swipe to close (swipe down)
        if (absOy > absOx && dy > 0) {
          const closeThreshold = 100;
          const closeVelocity = 0.5;

          if (absOy > closeThreshold || vy > closeVelocity) {
            // Close lightbox with animation
            api.start({
              y: 600,
              opacity: 0,
              config: config.default,
              onRest: () => {
                onClose();
              }
            });
            cancel();
            return;
          }

          // Update position and opacity while dragging
          const opacityValue = Math.max(0, 1 - absOy / 600);
          api.start({ y: oy, opacity: opacityValue, immediate: true });
          return;
        }

        // Horizontal swipe for navigation (only if multiple images)
        if (mediaFiles.length > 1 && absOx > absOy) {
          const swipeThreshold = 100;
          const swipeVelocity = 0.5;

          // Check if swipe is strong enough
          if (absOx > swipeThreshold || vx > swipeVelocity) {
            cancel();

            // Determine direction
            if (dx > 0 && selectedIndex > 0) {
              // Swipe right -> Previous
              api.start({
                x: window.innerWidth,
                opacity: 0,
                config: config.default,
                onRest: () => {
                  onPrevious();
                }
              });
            } else if (dx < 0 && selectedIndex < mediaFiles.length - 1) {
              // Swipe left -> Next
              api.start({
                x: -window.innerWidth,
                opacity: 0,
                config: config.default,
                onRest: () => {
                  onNext();
                }
              });
            } else {
              // Bounce back if at boundaries
              api.start({ x: 0, opacity: 1 });
            }
            return;
          }

          // Update position while dragging
          api.start({ x: ox, immediate: true });
        }
      },

      onDragEnd: ({ offset: [ox, oy] }) => {
        // Snap back if threshold not met
        const absOx = Math.abs(ox);
        const absOy = Math.abs(oy);

        if (absOy < 100 && absOx < 100) {
          api.start({ x: 0, y: 0, opacity: 1, scale: 1 });
        }
      },

      // Pinch to zoom for images
      onPinch: ({ offset: [distance], origin: [ox, oy], first, last }) => {
        if (!isImage) return;

        if (first) {
          // Store initial zoom level
          setImageZoom(1);
        }

        const newZoom = Math.max(1, Math.min(4, 1 + distance / 200));
        setImageZoom(newZoom);

        if (last && newZoom <= 1.1) {
          // Reset zoom if released at low zoom
          setImageZoom(1);
          setImagePosition({ x: 0, y: 0 });
        }
      },

    },
    {
      drag: {
        from: () => [x.get(), y.get()],
        filterTaps: true,
        threshold: 10,
      },
      pinch: {
        scaleBounds: { min: 1, max: 4 },
        rubberband: true,
      },
    }
  );

  // Hide controls after 3 seconds of inactivity
  useEffect(() => {
    if (!showControls) return;

    const timer = setTimeout(() => {
      setShowControls(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [showControls]);

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setFullscreenMode('normal');
      setRotation(0);
      setIsPlaying(false);
      setShowControls(true);
      setImageZoom(1);
      setImagePosition({ x: 0, y: 0 });
      api.start({ x: 0, y: 0, opacity: 1, scale: 1, immediate: true });
    }
  }, [isOpen, selectedIndex, api]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (selectedIndex > 0) onPrevious();
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (selectedIndex < mediaFiles.length - 1) onNext();
        break;
      case 'ArrowUp':
        e.preventDefault();
        // Cycle: normal -> fullscreen -> stretched
        setFullscreenMode(prev => {
          if (prev === 'normal') return 'fullscreen';
          if (prev === 'fullscreen') return 'stretched';
          return 'stretched'; // Stay at stretched when at max
        });
        break;
      case 'ArrowDown':
        e.preventDefault();
        // Cycle: stretched -> fullscreen -> normal
        setFullscreenMode(prev => {
          if (prev === 'stretched') return 'fullscreen';
          if (prev === 'fullscreen') return 'normal';
          return 'normal'; // Stay at normal when at min
        });
        break;
      case ' ':
        e.preventDefault();
        if (currentFile?.mimeType.startsWith('video/')) {
          setIsPlaying(!isPlaying);
        }
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        // Toggle through fullscreen modes with F key
        setFullscreenMode(prev => {
          if (prev === 'normal') return 'fullscreen';
          if (prev === 'fullscreen') return 'stretched';
          return 'normal';
        });
        break;
      case 'r':
      case 'R':
        e.preventDefault();
        setRotation((prev) => (prev + 90) % 360);
        break;
    }
  }, [isOpen, onClose, onNext, onPrevious, currentFile, isPlaying, selectedIndex, mediaFiles.length]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent iOS bounce and pull-to-refresh
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, [handleKeyDown, isOpen]);

  const [signedMediaUrl, setSignedMediaUrl] = useState<string | null>(null);

  // Generate signed URL for encrypted media
  useEffect(() => {
    if (currentFile?.isEncrypted && decryptionKey) {
      getSignedMediaUrl(currentFile.id, decryptionKey).then(url => {
        setSignedMediaUrl(url);
      });
    } else {
      setSignedMediaUrl(null);
    }
  }, [currentFile, decryptionKey]);

  const getMediaUrl = (file: MediaFile) => {
    if (file.isEncrypted && decryptionKey && signedMediaUrl) {
      // Use signed URL instead of raw token
      return signedMediaUrl;
    } else if (!file.isEncrypted) {
      return getApiUrl(`/api/media/${file.id}`);
    }
    return null;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (!isOpen || !currentFile) return null;

  const mediaUrl = getMediaUrl(currentFile);

  return (
    <animated.div
      ref={containerRef}
      className="fixed inset-0 bg-black/95 backdrop-blur-lg z-50 flex items-center justify-center select-none"
      style={{
        opacity,
        touchAction: imageZoom > 1 ? 'pan-x pan-y' : 'none',
      }}
      onMouseMove={() => setShowControls(true)}
      data-testid="media-lightbox"
    >
      <animated.div
        {...bind()}
        className="relative max-w-full max-h-full flex items-center justify-center"
        style={{
          x,
          y,
          scale,
          touchAction: 'none',
        }}
      >
        {/* Media Content */}
        <div className={`relative transition-all duration-300 ${
          fullscreenMode === 'normal' ? 'max-w-[80vw] max-h-[80vh]' :
          fullscreenMode === 'fullscreen' ? 'max-w-[95vw] max-h-[95vh]' : 'w-screen h-screen'
        }`}>
          {mediaUrl ? (
            isVideo ? (
              <VideoPlayer
                sources={mediaUrl}
                poster={undefined}
                title={currentFile.originalName}
                autoPlay={true}
                controls={true}
                customControls={true}
                className={`transition-all duration-300 ${
                  fullscreenMode === 'stretched' ? 'w-full h-full' : 'max-w-full max-h-full'
                }`}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                allowDownload={true}
                width={fullscreenMode === 'stretched' ? '100%' : undefined}
                height={fullscreenMode === 'stretched' ? '100%' : undefined}
              />
            ) : (
              <ImageViewer
                images={{
                  id: currentFile.id,
                  src: mediaUrl,
                  thumbnail: getApiUrl(`/api/media/${currentFile.id}/thumbnail?size=thumb`),
                  title: currentFile.originalName,
                  metadata: {
                    width: currentFile.width ?? undefined,
                    height: currentFile.height ?? undefined,
                    size: currentFile.fileSize,
                    format: currentFile.mimeType.split('/')[1],
                    dateTime: currentFile.createdAt ? currentFile.createdAt.toString() : undefined,
                    tags: currentFile.tags ?? undefined
                  }
                }}
                inline={true}
                showThumbnails={false}
                showInfo={false}
                allowDownload={true}
                className={`transition-all duration-300 ${
                  fullscreenMode === 'stretched' ? 'w-full h-full' : 'max-w-full max-h-full'
                }`}
              />
            )
          ) : (
            <div className="w-96 h-96 bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl mb-4">🔒</div>
                <div className="text-lg font-semibold mb-2">Content Encrypted</div>
                <div className="text-sm text-muted-foreground">
                  Valid decryption key required to view this content
                </div>
              </div>
            </div>
          )}
        </div>
      </animated.div>

      {/* Navigation Controls */}
      {showControls && mediaFiles.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-black/50 hover:bg-black/70 text-white rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              onPrevious();
            }}
            disabled={selectedIndex === 0}
            data-testid="lightbox-previous"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-black/50 hover:bg-black/70 text-white rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            disabled={selectedIndex === mediaFiles.length - 1}
            data-testid="lightbox-next"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </>
      )}

      {/* Top Controls */}
      {showControls && (
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          {/* View Mode Controls */}
          <div className="flex bg-black/50 rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              className={`text-white hover:bg-white/20 ${fullscreenMode === 'normal' ? 'bg-white/20' : ''}`}
              onClick={() => setFullscreenMode('normal')}
              title="Normal view"
              data-testid="view-normal"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`text-white hover:bg-white/20 ${fullscreenMode === 'fullscreen' ? 'bg-white/20' : ''}`}
              onClick={() => setFullscreenMode('fullscreen')}
              title="Fullscreen"
              data-testid="view-fullscreen"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20"
              onClick={() => setRotation((prev) => (prev + 90) % 360)}
              title="Rotate"
              data-testid="rotate"
            >
              <RotateCw className="w-4 h-4" />
            </Button>
          </div>

          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full"
            onClick={onClose}
            data-testid="lightbox-close"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
      )}

      {/* Media Info Panel */}
      {showControls && (
        <div className="absolute bottom-4 left-4 right-4 bg-black/70 rounded-lg p-4 text-white max-w-4xl mx-auto z-10">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1" data-testid="lightbox-title">
                {currentFile.originalName}
              </h3>
              <div className="text-sm text-gray-300 flex items-center gap-4" data-testid="lightbox-meta">
                <span>{isVideo ? '🎥' : '📸'} {currentFile.tags?.[0] || 'Media'}</span>
                <span>{formatFileSize(currentFile.fileSize)}</span>
                {currentFile.width && currentFile.height && (
                  <span>{currentFile.width}x{currentFile.height}</span>
                )}
                {currentFile.isEncrypted && <span>🔒 AES-256</span>}
                <span>{selectedIndex + 1} of {mediaFiles.length}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 ml-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                title="Add to Favorites"
                data-testid="favorite-button"
              >
                <Heart className={`w-5 h-5 ${currentFile.isFavorite ? 'fill-current text-red-400' : ''}`} />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                title="Download"
                onClick={() => {
                  if (mediaUrl) {
                    const a = document.createElement('a');
                    a.href = mediaUrl;
                    a.download = currentFile.originalName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }
                }}
                data-testid="download-button"
              >
                <Download className="w-5 h-5" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                title="Share"
                onClick={() => onShare?.(currentFile.id, currentFile.originalName)}
                data-testid="share-button"
              >
                <Share2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {!mediaUrl && currentFile.isEncrypted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full"></div>
        </div>
      )}

      {/* Gesture Hints (Mobile) */}
      {showControls && (
        <div className="absolute bottom-24 right-6 bg-black/70 rounded-lg p-3 text-sm text-white hidden sm:block">
          <div className="font-semibold mb-2">Touch Gestures</div>
          <div className="space-y-1 text-xs">
            <div>Swipe left/right - Navigate</div>
            <div>Swipe down - Close</div>
            <div>Tap - Toggle controls</div>
            {isImage && (
              <>
                <div>Pinch - Zoom</div>
                <div>Double tap - Toggle zoom</div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Keyboard Hints */}
      {showControls && (
        <div className="absolute bottom-6 right-6 bg-black/70 rounded-lg p-3 text-sm text-white hidden sm:hidden md:block">
          <div className="font-semibold mb-2">Keyboard Shortcuts</div>
          <div className="space-y-1 text-xs">
            <div><kbd className="px-1 py-0.5 bg-white/20 rounded">ESC</kbd> Close</div>
            <div><kbd className="px-1 py-0.5 bg-white/20 rounded">←→</kbd> Navigate</div>
            <div><kbd className="px-1 py-0.5 bg-white/20 rounded">↑↓</kbd> Zoom in/out</div>
            <div><kbd className="px-1 py-0.5 bg-white/20 rounded">F</kbd> Fullscreen</div>
            <div><kbd className="px-1 py-0.5 bg-white/20 rounded">R</kbd> Rotate</div>
            {currentFile?.mimeType.startsWith('video/') && (
              <div><kbd className="px-1 py-0.5 bg-white/20 rounded">SPACE</kbd> Play/Pause</div>
            )}
          </div>
        </div>
      )}
    </animated.div>
  );
}
