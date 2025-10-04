import { useRef } from 'react';
import { useGesture } from '@use-gesture/react';
import { useSpring, animated, config } from '@react-spring/web';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipForward, SkipBack, X, ChevronUp, Disc3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { File } from '@shared/schema';

interface AudioTrack extends File {
  artistName?: string;
  albumName?: string;
}

interface MiniPlayerProps {
  track: AudioTrack;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onExpand: () => void;
  onClose: () => void;
  className?: string;
}

export function MiniPlayer({
  track,
  isPlaying,
  onPlayPause,
  onNext,
  onPrevious,
  onExpand,
  onClose,
  className
}: MiniPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Spring animation for swipe gestures
  const [{ y }, api] = useSpring(() => ({
    y: 0,
    config: config.stiff,
  }));

  // Gesture handlers
  const bind = useGesture(
    {
      onDrag: ({ offset: [, oy], direction: [, dy], velocity: [, vy], cancel, tap }) => {
        // Tap to expand (optional, can be removed if too sensitive)
        if (tap) {
          return;
        }

        const expandThreshold = 80;
        const closeThreshold = 80;
        const velocityThreshold = 0.3;

        // Swipe up to expand
        if (dy < 0 && (Math.abs(oy) > expandThreshold || vy > velocityThreshold)) {
          cancel();
          api.start({
            y: -200,
            config: config.default,
            onRest: () => {
              onExpand();
              api.start({ y: 0, immediate: true });
            }
          });
          return;
        }

        // Swipe down to close
        if (dy > 0 && (Math.abs(oy) > closeThreshold || vy > velocityThreshold)) {
          cancel();
          api.start({
            y: 200,
            config: config.default,
            onRest: () => {
              onClose();
              api.start({ y: 0, immediate: true });
            }
          });
          return;
        }

        // Update position while dragging
        api.start({ y: oy, immediate: true });
      },

      onDragEnd: ({ offset: [, oy] }) => {
        // Snap back if threshold not met
        if (Math.abs(oy) < 80) {
          api.start({ y: 0 });
        }
      },
    },
    {
      drag: {
        from: () => [0, y.get()],
        axis: 'y',
        filterTaps: true,
        threshold: 10,
      },
    }
  );

  return (
    <animated.div
      ref={containerRef}
      {...bind()}
      className={cn(
        'fixed bottom-0 left-0 right-0 h-20 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 border-t border-neutral-700 z-40 select-none',
        'shadow-[0_-4px_12px_rgba(0,0,0,0.3)]',
        className
      )}
      style={{
        y,
        touchAction: 'pan-y',
      }}
      data-testid="mini-player"
    >
      {/* Swipe Indicator */}
      <div className="absolute top-1 left-1/2 -translate-x-1/2 w-12 h-1 bg-neutral-600 rounded-full" />

      <div className="max-w-screen-2xl mx-auto h-full flex items-center justify-between gap-3 px-4">
        {/* Track Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Album Art */}
          {track.thumbnailData ? (
            <img
              src={`data:image/jpeg;base64,${btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(track.thumbnailData))))}`}
              alt={track.originalName}
              className="w-14 h-14 rounded object-cover flex-shrink-0 shadow-md"
            />
          ) : (
            <div className="w-14 h-14 bg-neutral-700 rounded flex items-center justify-center flex-shrink-0">
              <Disc3 className="w-6 h-6 text-neutral-500" />
            </div>
          )}

          {/* Track Details */}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onExpand}>
            <div className="text-white font-medium truncate text-sm">
              {track.originalName}
            </div>
            <div className="text-neutral-400 text-xs truncate">
              {track.artistName || 'Unknown Artist'}
            </div>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrevious}
            className="text-neutral-400 hover:text-white h-8 w-8"
            data-testid="mini-button-previous"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onPlayPause}
            className="bg-white text-black hover:bg-white/90 rounded-full w-10 h-10"
            data-testid="mini-button-play-pause"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            className="text-neutral-400 hover:text-white h-8 w-8"
            data-testid="mini-button-next"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </Button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onExpand}
            className="text-neutral-400 hover:text-white h-8 w-8"
            data-testid="mini-button-expand"
          >
            <ChevronUp className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-neutral-400 hover:text-white h-8 w-8"
            data-testid="mini-button-close"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Touch Gesture Hint */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black/70 text-white text-xs px-3 py-1 rounded-full opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
        Swipe up to expand • Swipe down to close
      </div>
    </animated.div>
  );
}
