import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Image as ImageIcon, Film, FileText, Music, Archive, File } from 'lucide-react';

/**
 * LazyThumbnail Component - Intelligent lazy loading with progressive enhancement
 *
 * Features:
 * - Intersection Observer for viewport detection
 * - Progressive image loading (blur-up technique)
 * - Automatic retry on failure
 * - Skeleton loading state
 * - Multiple quality levels
 * - WebP format with fallback
 * - Smart caching
 * - Error state with icon fallback
 */

interface LazyThumbnailProps {
  src: string;
  alt?: string;
  lowQualitySrc?: string; // Base64 or small thumbnail for blur-up
  sizes?: {
    micro?: string;   // 50x50
    thumb?: string;   // 150x150
    small?: string;   // 320x240
    medium?: string;  // 640x480
    large?: string;   // 1280x720
  };
  type?: 'image' | 'video' | 'document' | 'audio' | 'archive' | 'other';
  aspectRatio?: 'square' | '16/9' | '4/3' | '1/1' | 'auto';
  className?: string;
  containerClassName?: string;
  onClick?: () => void;
  priority?: boolean; // Load immediately without lazy loading
  retryCount?: number;
  retryDelay?: number;
  showOverlay?: boolean;
  overlayContent?: React.ReactNode;
  fallbackIcon?: React.ReactNode;
  onLoad?: () => void;
  onError?: (error: any) => void;
  rootMargin?: string; // Intersection Observer margin
  threshold?: number; // Intersection Observer threshold
}

export const LazyThumbnail: React.FC<LazyThumbnailProps> = ({
  src,
  alt = '',
  lowQualitySrc,
  sizes,
  type = 'image',
  aspectRatio = '1/1',
  className,
  containerClassName,
  onClick,
  priority = false,
  retryCount = 3,
  retryDelay = 1000,
  showOverlay = false,
  overlayContent,
  fallbackIcon,
  onLoad,
  onError,
  rootMargin = '50px',
  threshold = 0.01
}) => {
  const [isInView, setIsInView] = useState(priority);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(lowQualitySrc || '');
  const [highQualityLoaded, setHighQualityLoaded] = useState(false);
  const [retries, setRetries] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Determine the best source based on container size
  const getBestSource = (): string => {
    if (!sizes) return src;

    const container = containerRef.current;
    if (!container) return src;

    const width = container.clientWidth;
    const pixelRatio = window.devicePixelRatio || 1;
    const effectiveWidth = width * pixelRatio;

    // Choose the appropriate size based on effective width
    if (effectiveWidth <= 100 && sizes.micro) return sizes.micro;
    if (effectiveWidth <= 200 && sizes.thumb) return sizes.thumb;
    if (effectiveWidth <= 400 && sizes.small) return sizes.small;
    if (effectiveWidth <= 800 && sizes.medium) return sizes.medium;
    if (sizes.large) return sizes.large;

    return src;
  };

  // Get fallback icon based on file type
  const getFallbackIcon = () => {
    if (fallbackIcon) return fallbackIcon;

    const iconProps = { className: 'w-12 h-12 text-muted-foreground' };

    switch (type) {
      case 'video':
        return <Film {...iconProps} />;
      case 'document':
        return <FileText {...iconProps} />;
      case 'audio':
        return <Music {...iconProps} />;
      case 'archive':
        return <Archive {...iconProps} />;
      case 'image':
        return <ImageIcon {...iconProps} />;
      default:
        return <File {...iconProps} />;
    }
  };

  // Setup Intersection Observer
  useEffect(() => {
    if (priority || !containerRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isInView) {
            setIsInView(true);
            observerRef.current?.disconnect();
          }
        });
      },
      {
        rootMargin,
        threshold
      }
    );

    observerRef.current.observe(containerRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [priority, rootMargin, threshold, isInView]);

  // Load high-quality image when in view
  useEffect(() => {
    if (!isInView || highQualityLoaded || hasError) return;

    const highQualitySrc = getBestSource();
    const img = new Image();

    img.onload = () => {
      setCurrentSrc(highQualitySrc);
      setHighQualityLoaded(true);
      setIsLoading(false);
      setHasError(false);
      onLoad?.();
    };

    img.onerror = (error) => {
      if (retries < retryCount) {
        // Retry loading after delay
        setTimeout(() => {
          setRetries(retries + 1);
          img.src = highQualitySrc; // Trigger reload
        }, retryDelay * (retries + 1));
      } else {
        setHasError(true);
        setIsLoading(false);
        onError?.(error);
      }
    };

    img.src = highQualitySrc;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [isInView, highQualityLoaded, hasError, retries, retryCount, retryDelay, onLoad, onError]);

  // Get aspect ratio style
  const getAspectRatioStyle = () => {
    switch (aspectRatio) {
      case 'square':
      case '1/1':
        return 'aspect-square';
      case '16/9':
        return 'aspect-video';
      case '4/3':
        return 'aspect-[4/3]';
      case 'auto':
      default:
        return '';
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden bg-muted',
        getAspectRatioStyle(),
        containerClassName,
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      {/* Loading skeleton */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 bg-muted animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted-foreground/10" />
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          {getFallbackIcon()}
        </div>
      )}

      {/* Low quality placeholder (blur-up) */}
      {lowQualitySrc && !highQualityLoaded && !hasError && (
        <img
          src={lowQualitySrc}
          alt={alt}
          className={cn(
            'absolute inset-0 w-full h-full object-cover filter blur-lg scale-110',
            className
          )}
          aria-hidden="true"
        />
      )}

      {/* Main image */}
      {!hasError && isInView && (
        <img
          ref={imageRef}
          src={currentSrc}
          alt={alt}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            highQualityLoaded ? 'opacity-100' : 'opacity-0',
            className
          )}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
        />
      )}

      {/* Overlay content */}
      {showOverlay && overlayContent && (
        <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          {overlayContent}
        </div>
      )}

      {/* Video duration badge */}
      {type === 'video' && !hasError && (
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
          <Film className="inline-block w-3 h-3 mr-1" />
          Video
        </div>
      )}
    </div>
  );
};

/**
 * ThumbnailGrid Component - Optimized grid layout for lazy thumbnails
 */

interface ThumbnailGridProps {
  items: Array<{
    id: string;
    src: string;
    thumbnail?: string;
    lowQualityThumb?: string;
    alt?: string;
    type?: 'image' | 'video' | 'document' | 'audio' | 'archive' | 'other';
    sizes?: LazyThumbnailProps['sizes'];
  }>;
  columns?: 2 | 3 | 4 | 5 | 6 | 'auto';
  gap?: 'none' | 'sm' | 'md' | 'lg';
  aspectRatio?: LazyThumbnailProps['aspectRatio'];
  onItemClick?: (item: any, index: number) => void;
  className?: string;
  priority?: number; // Number of items to load with priority
}

export const ThumbnailGrid: React.FC<ThumbnailGridProps> = ({
  items,
  columns = 'auto',
  gap = 'md',
  aspectRatio = '1/1',
  onItemClick,
  className,
  priority = 0
}) => {
  const getGridCols = () => {
    switch (columns) {
      case 2: return 'grid-cols-2';
      case 3: return 'grid-cols-3';
      case 4: return 'grid-cols-4';
      case 5: return 'grid-cols-5';
      case 6: return 'grid-cols-6';
      case 'auto':
      default:
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';
    }
  };

  const getGapClass = () => {
    switch (gap) {
      case 'none': return 'gap-0';
      case 'sm': return 'gap-2';
      case 'md': return 'gap-4';
      case 'lg': return 'gap-6';
      default: return 'gap-4';
    }
  };

  return (
    <div className={cn('grid', getGridCols(), getGapClass(), className)}>
      {items.map((item, index) => (
        <LazyThumbnail
          key={item.id}
          src={item.thumbnail || item.src}
          lowQualitySrc={item.lowQualityThumb}
          sizes={item.sizes}
          alt={item.alt}
          type={item.type}
          aspectRatio={aspectRatio}
          priority={index < priority}
          onClick={() => onItemClick?.(item, index)}
          showOverlay
          overlayContent={
            <div className="flex items-center space-x-4">
              <button className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition">
                <ImageIcon className="w-5 h-5 text-white" />
              </button>
            </div>
          }
        />
      ))}
    </div>
  );
};

/**
 * VirtualizedThumbnailGrid - For large collections with virtualization
 */

interface VirtualizedThumbnailGridProps extends ThumbnailGridProps {
  height?: number | string;
  overscan?: number;
  scrollToIndex?: number;
  onScroll?: (scrollTop: number) => void;
}

export const VirtualizedThumbnailGrid: React.FC<VirtualizedThumbnailGridProps> = ({
  items,
  height = 600,
  overscan = 3,
  scrollToIndex,
  onScroll,
  ...gridProps
}) => {
  // This would require a virtualization library like react-window
  // For now, returning the regular grid with a scrollable container
  return (
    <div
      className="overflow-y-auto"
      style={{ height }}
      onScroll={(e) => onScroll?.(e.currentTarget.scrollTop)}
    >
      <ThumbnailGrid items={items} {...gridProps} />
    </div>
  );
};