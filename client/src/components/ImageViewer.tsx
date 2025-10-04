import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  Grid,
  Info,
  Share2,
  Heart,
  Edit,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';

/**
 * ImageViewer Component - Advanced image viewing with zoom and controls
 *
 * Features:
 * - Zoom in/out with mouse wheel and pinch gestures
 * - Pan support with drag
 * - Rotate image
 * - Fullscreen mode
 * - Image gallery navigation
 * - Thumbnail strip
 * - Image information panel
 * - Download functionality
 * - Share capabilities
 * - Edit mode trigger
 * - Keyboard navigation
 * - Touch gesture support
 * - Lazy loading for performance
 */

interface ImageData {
  id: string;
  src: string;
  thumbnail?: string;
  title?: string;
  description?: string;
  metadata?: {
    width?: number;
    height?: number;
    size?: number;
    format?: string;
    camera?: string;
    lens?: string;
    iso?: number;
    aperture?: string;
    shutterSpeed?: string;
    dateTime?: string;
    location?: string;
    tags?: string[];
  };
}

interface ImageViewerProps {
  images: ImageData | ImageData[];
  initialIndex?: number;
  open?: boolean;
  onClose?: () => void;
  onNavigate?: (index: number) => void;
  onDownload?: (image: ImageData) => void;
  onShare?: (image: ImageData) => void;
  onEdit?: (image: ImageData) => void;
  onDelete?: (image: ImageData) => void;
  onFavorite?: (image: ImageData) => void;
  showThumbnails?: boolean;
  showInfo?: boolean;
  allowDownload?: boolean;
  allowShare?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  className?: string;
  inline?: boolean; // Show inline instead of modal
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  images,
  initialIndex = 0,
  open = true,
  onClose,
  onNavigate,
  onDownload,
  onShare,
  onEdit,
  onDelete,
  onFavorite,
  showThumbnails = true,
  showInfo = true,
  allowDownload = true,
  allowShare = true,
  allowEdit = false,
  allowDelete = false,
  className,
  inline = false
}) => {
  const imageArray = Array.isArray(images) ? images : [images];

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showThumbnailStrip, setShowThumbnailStrip] = useState(showThumbnails);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastTouchDistance = useRef<number>(0);

  const currentImage = imageArray[currentIndex];

  // Reset view when image changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    setImageLoading(true);
    setImageError(false);
  }, [currentIndex]);

  // Format file size
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  // Navigation
  const navigate = useCallback((direction: 'prev' | 'next') => {
    let newIndex: number;
    if (direction === 'prev') {
      newIndex = currentIndex === 0 ? imageArray.length - 1 : currentIndex - 1;
    } else {
      newIndex = currentIndex === imageArray.length - 1 ? 0 : currentIndex + 1;
    }
    setCurrentIndex(newIndex);
    onNavigate?.(newIndex);
  }, [currentIndex, imageArray.length, onNavigate]);

  // Zoom controls
  const handleZoom = useCallback((delta: number) => {
    setZoom(prevZoom => Math.max(0.5, Math.min(5, prevZoom + delta)));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Rotation control
  const rotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      try {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        }
        setIsFullscreen(true);
      } catch (err) {
        console.error('Failed to enter fullscreen:', err);
      }
    } else {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        setIsFullscreen(false);
      } catch (err) {
        console.error('Failed to exit fullscreen:', err);
      }
    }
  }, [isFullscreen]);

  // Download image
  const handleDownload = useCallback(() => {
    if (!currentImage) return;

    if (onDownload) {
      onDownload(currentImage);
    } else {
      const link = document.createElement('a');
      link.href = currentImage.src;
      link.download = currentImage.title || `image-${currentImage.id}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [currentImage, onDownload]);

  // Mouse drag handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  }, [zoom, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    e.preventDefault();

    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  }, [isDragging, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    handleZoom(delta);
  }, [handleZoom]);

  // Touch gesture handling
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch to zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      lastTouchDistance.current = distance;
    } else if (e.touches.length === 1 && zoom > 1) {
      // Single touch drag
      const touch = e.touches[0];
      setIsDragging(true);
      dragStartRef.current = {
        x: touch.clientX - position.x,
        y: touch.clientY - position.y
      };
    }
  }, [zoom, position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch to zoom
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      if (lastTouchDistance.current > 0) {
        const scale = distance / lastTouchDistance.current;
        handleZoom((scale - 1) * 2);
      }

      lastTouchDistance.current = distance;
    } else if (e.touches.length === 1 && isDragging && zoom > 1) {
      // Single touch drag
      e.preventDefault();
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - dragStartRef.current.x,
        y: touch.clientY - dragStartRef.current.y
      });
    }
  }, [isDragging, zoom, handleZoom]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    lastTouchDistance.current = 0;
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open && !inline) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          navigate('prev');
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigate('next');
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleZoom(0.2);
          break;
        case '-':
          e.preventDefault();
          handleZoom(-0.2);
          break;
        case '0':
          e.preventDefault();
          resetZoom();
          break;
        case 'r':
          e.preventDefault();
          rotate();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'i':
          e.preventDefault();
          setShowInfoPanel(prev => !prev);
          break;
        case 'Escape':
          e.preventDefault();
          if (isFullscreen) {
            toggleFullscreen();
          } else if (onClose && !inline) {
            onClose();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, inline, navigate, handleZoom, resetZoom, rotate, toggleFullscreen, isFullscreen, onClose]);

  const viewerContent = (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full h-full bg-black/95 select-none',
        inline ? '' : 'fixed inset-0 z-50',
        className
      )}
    >
      {/* Header Controls */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex items-center space-x-2">
          {currentImage?.title && (
            <h3 className="text-white text-lg font-semibold">{currentImage.title}</h3>
          )}
          <Badge variant="secondary" className="bg-black/50 text-white">
            {currentIndex + 1} / {imageArray.length}
          </Badge>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => setShowInfoPanel(!showInfoPanel)}
          >
            <Info className="h-5 w-5" />
          </Button>

          {allowShare && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => onShare?.(currentImage)}
            >
              <Share2 className="h-5 w-5" />
            </Button>
          )}

          {allowEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => onEdit?.(currentImage)}
            >
              <Edit className="h-5 w-5" />
            </Button>
          )}

          {allowDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 hover:text-red-500"
              onClick={() => onDelete?.(currentImage)}
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          )}

          {!inline && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Image Container */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {/* Navigation Arrows */}
        {imageArray.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10"
              onClick={() => navigate('prev')}
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10"
              onClick={() => navigate('next')}
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          </>
        )}

        {/* Image */}
        <div
          className="relative"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            transition: isDragging ? 'none' : 'transform 0.2s',
            cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {imageError ? (
            <div className="text-white text-center">
              <p className="text-4xl mb-2">⚠️</p>
              <p>Failed to load image</p>
            </div>
          ) : (
            <img
              ref={imageRef}
              src={currentImage?.src}
              alt={currentImage?.title || 'Image'}
              className="max-w-[90vw] max-h-[80vh] object-contain"
              draggable={false}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageLoading(false);
                setImageError(true);
              }}
            />
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/50 to-transparent">
        {/* Thumbnail Strip */}
        {showThumbnailStrip && imageArray.length > 1 && (
          <div className="flex items-center justify-center space-x-2 p-2 overflow-x-auto">
            {imageArray.map((image, index) => (
              <button
                key={image.id}
                className={cn(
                  'relative w-16 h-16 rounded overflow-hidden transition-all',
                  index === currentIndex ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                )}
                onClick={() => {
                  setCurrentIndex(index);
                  onNavigate?.(index);
                }}
              >
                <img
                  src={image.thumbnail || image.src}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Control Bar */}
        <div className="flex items-center justify-center space-x-4 p-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => handleZoom(-0.2)}
            disabled={zoom <= 0.5}
          >
            <ZoomOut className="h-5 w-5" />
          </Button>

          <Slider
            value={[zoom]}
            min={0.5}
            max={5}
            step={0.1}
            className="w-32"
            onValueChange={(value) => setZoom(value[0])}
          />

          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => handleZoom(0.2)}
            disabled={zoom >= 5}
          >
            <ZoomIn className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={resetZoom}
          >
            <span className="text-sm font-medium">{Math.round(zoom * 100)}%</span>
          </Button>

          <div className="w-px h-6 bg-white/30" />

          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={rotate}
          >
            <RotateCw className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => setShowThumbnailStrip(!showThumbnailStrip)}
          >
            <Grid className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={toggleFullscreen}
          >
            <Maximize className="h-5 w-5" />
          </Button>

          {allowDownload && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={handleDownload}
            >
              <Download className="h-5 w-5" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "text-white hover:bg-white/20",
              isFavorited ? "text-red-500" : ""
            )}
            onClick={() => {
              setIsFavorited(!isFavorited);
              onFavorite?.(currentImage);
            }}
          >
            <Heart className={cn("h-5 w-5", isFavorited ? "fill-current" : "")} />
          </Button>
        </div>
      </div>

      {/* Info Panel */}
      {showInfoPanel && showInfo && currentImage?.metadata && (
        <div className="absolute right-0 top-20 bottom-20 w-80 bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <h4 className="text-white font-semibold mb-4">Image Information</h4>

          <div className="space-y-2 text-sm text-white/80">
            {currentImage.metadata.width && currentImage.metadata.height && (
              <div>
                <span className="text-white/60">Dimensions:</span>
                <span className="ml-2">{currentImage.metadata.width} × {currentImage.metadata.height}</span>
              </div>
            )}

            {currentImage.metadata.size && (
              <div>
                <span className="text-white/60">Size:</span>
                <span className="ml-2">{formatFileSize(currentImage.metadata.size)}</span>
              </div>
            )}

            {currentImage.metadata.format && (
              <div>
                <span className="text-white/60">Format:</span>
                <span className="ml-2">{currentImage.metadata.format.toUpperCase()}</span>
              </div>
            )}

            {currentImage.metadata.camera && (
              <div>
                <span className="text-white/60">Camera:</span>
                <span className="ml-2">{currentImage.metadata.camera}</span>
              </div>
            )}

            {currentImage.metadata.lens && (
              <div>
                <span className="text-white/60">Lens:</span>
                <span className="ml-2">{currentImage.metadata.lens}</span>
              </div>
            )}

            {currentImage.metadata.iso && (
              <div>
                <span className="text-white/60">ISO:</span>
                <span className="ml-2">{currentImage.metadata.iso}</span>
              </div>
            )}

            {currentImage.metadata.aperture && (
              <div>
                <span className="text-white/60">Aperture:</span>
                <span className="ml-2">f/{currentImage.metadata.aperture}</span>
              </div>
            )}

            {currentImage.metadata.shutterSpeed && (
              <div>
                <span className="text-white/60">Shutter:</span>
                <span className="ml-2">{currentImage.metadata.shutterSpeed}</span>
              </div>
            )}

            {currentImage.metadata.dateTime && (
              <div>
                <span className="text-white/60">Date:</span>
                <span className="ml-2">{new Date(currentImage.metadata.dateTime).toLocaleString()}</span>
              </div>
            )}

            {currentImage.metadata.location && (
              <div>
                <span className="text-white/60">Location:</span>
                <span className="ml-2">{currentImage.metadata.location}</span>
              </div>
            )}

            {currentImage.metadata.tags && currentImage.metadata.tags.length > 0 && (
              <div>
                <span className="text-white/60">Tags:</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {currentImage.metadata.tags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="bg-white/10">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (inline) {
    return viewerContent;
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose?.()}>
      <DialogContent className="max-w-full max-h-full w-full h-full p-0 bg-transparent border-0">
        {viewerContent}
      </DialogContent>
    </Dialog>
  );
};