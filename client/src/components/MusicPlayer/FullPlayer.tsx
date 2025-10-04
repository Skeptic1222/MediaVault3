import { useRef, useState } from 'react';
import { useGesture } from '@use-gesture/react';
import { useSpring, animated, config } from '@react-spring/web';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Shuffle, Repeat, Repeat1, ChevronDown, Heart, MoreHorizontal,
  Disc3, List, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { File } from '@shared/schema';

interface AudioTrack extends File {
  artistName?: string;
  albumName?: string;
}

interface FullPlayerProps {
  track: AudioTrack;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffling: boolean;
  repeatMode: 'none' | 'all' | 'one';
  queue: AudioTrack[];
  queueIndex: number;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (value: number[]) => void;
  onVolumeChange: (value: number[]) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onRemoveFromQueue?: (index: number) => void;
  className?: string;
}

export function FullPlayer({
  track,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  isShuffling,
  repeatMode,
  queue,
  queueIndex,
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onToggleRepeat,
  onMinimize,
  onClose,
  onRemoveFromQueue,
  className
}: FullPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showQueue, setShowQueue] = useState(false);

  // Spring animation for swipe gestures
  const [{ y }, api] = useSpring(() => ({
    y: 0,
    config: config.stiff,
  }));

  // Gesture handlers
  const bind = useGesture(
    {
      onDrag: ({ offset: [, oy], direction: [, dy], velocity: [, vy], cancel, tap }) => {
        // Ignore taps
        if (tap) return;

        const minimizeThreshold = 100;
        const velocityThreshold = 0.3;

        // Swipe down to minimize
        if (dy > 0 && (oy > minimizeThreshold || vy > velocityThreshold)) {
          cancel();
          api.start({
            y: window.innerHeight,
            config: config.default,
            onRest: () => {
              onMinimize();
              api.start({ y: 0, immediate: true });
            }
          });
          return;
        }

        // Update position while dragging (only allow downward drag)
        if (oy > 0) {
          api.start({ y: oy, immediate: true });
        }
      },

      onDragEnd: ({ offset: [, oy] }) => {
        // Snap back if threshold not met
        if (oy < 100) {
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
        bounds: { top: 0 },
      },
    }
  );

  // Format time for display
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <animated.div
      ref={containerRef}
      className={cn(
        'fixed inset-0 bg-gradient-to-b from-neutral-900 via-neutral-800 to-black z-50 flex flex-col select-none',
        className
      )}
      style={{
        y,
        touchAction: 'pan-y',
      }}
      data-testid="full-player"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-800">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMinimize}
          className="text-neutral-400 hover:text-white"
          data-testid="full-button-minimize"
        >
          <ChevronDown className="w-6 h-6" />
        </Button>

        <div className="text-white text-sm font-medium">
          Now Playing
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-neutral-400 hover:text-white"
          data-testid="full-button-close"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Swipe Indicator */}
      <div {...bind()} className="cursor-grab active:cursor-grabbing py-2">
        <div className="w-12 h-1 bg-neutral-600 rounded-full mx-auto" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
        {/* Album Art */}
        <div className="relative mb-8">
          {track.thumbnailData ? (
            <img
              src={`data:image/jpeg;base64,${btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(track.thumbnailData))))}`}
              alt={track.originalName}
              className="w-72 h-72 md:w-96 md:h-96 rounded-lg shadow-2xl object-cover"
            />
          ) : (
            <div className="w-72 h-72 md:w-96 md:h-96 bg-neutral-800 rounded-lg flex items-center justify-center shadow-2xl">
              <Disc3 className="w-24 h-24 text-neutral-600" />
            </div>
          )}

          {/* Favorite Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white rounded-full"
            data-testid="full-button-favorite"
          >
            <Heart className="w-5 h-5" />
          </Button>
        </div>

        {/* Track Info */}
        <div className="text-center mb-8 max-w-md">
          <h2 className="text-white text-2xl md:text-3xl font-bold mb-2 truncate">
            {track.originalName}
          </h2>
          <p className="text-neutral-400 text-lg truncate">
            {track.artistName || 'Unknown Artist'}
          </p>
          {track.albumName && (
            <p className="text-neutral-500 text-sm mt-1 truncate">
              {track.albumName}
            </p>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-2xl mb-8">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={1}
            onValueChange={onSeek}
            className="w-full"
            data-testid="full-slider-progress"
          />
          <div className="flex items-center justify-between text-xs text-neutral-400 mt-2">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-6 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleShuffle}
            className={cn(
              "text-neutral-400 hover:text-white",
              isShuffling && "text-green-500"
            )}
            data-testid="full-button-shuffle"
          >
            <Shuffle className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onPrevious}
            className="text-neutral-400 hover:text-white"
            data-testid="full-button-previous"
          >
            <SkipBack className="w-6 h-6 fill-current" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onPlayPause}
            className="bg-white text-black hover:bg-white/90 rounded-full w-16 h-16"
            data-testid="full-button-play-pause"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-1" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            className="text-neutral-400 hover:text-white"
            data-testid="full-button-next"
          >
            <SkipForward className="w-6 h-6 fill-current" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleRepeat}
            className={cn(
              "text-neutral-400 hover:text-white",
              repeatMode !== 'none' && "text-green-500"
            )}
            data-testid="full-button-repeat"
          >
            {repeatMode === 'one' ? (
              <Repeat1 className="w-5 h-5" />
            ) : (
              <Repeat className="w-5 h-5" />
            )}
          </Button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-4 w-full max-w-md">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMute}
            className="text-neutral-400 hover:text-white"
            data-testid="full-button-volume"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </Button>

          <Slider
            value={[isMuted ? 0 : volume]}
            max={1}
            step={0.01}
            onValueChange={onVolumeChange}
            className="flex-1"
            data-testid="full-slider-volume"
          />
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center justify-around p-4 border-t border-neutral-800">
        <Button
          variant="ghost"
          size="icon"
          className="text-neutral-400 hover:text-white"
        >
          <MoreHorizontal className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowQueue(!showQueue)}
          className={cn(
            "text-neutral-400 hover:text-white",
            showQueue && "text-white"
          )}
          data-testid="full-button-queue"
        >
          <List className="w-5 h-5" />
        </Button>
      </div>

      {/* Queue Panel */}
      {showQueue && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-lg z-10 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-neutral-800">
            <h3 className="text-white text-lg font-semibold">Queue</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowQueue(false)}
              className="text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {queue.map((queueTrack, index) => (
                <div
                  key={`${queueTrack.id}-${index}`}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors",
                    index === queueIndex && "bg-white/10"
                  )}
                  data-testid={`queue-item-${index}`}
                >
                  {queueTrack.thumbnailData ? (
                    <img
                      src={`data:image/jpeg;base64,${btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(queueTrack.thumbnailData))))}`}
                      alt={queueTrack.originalName}
                      className="w-12 h-12 rounded object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-neutral-800 rounded flex items-center justify-center">
                      <Disc3 className="w-5 h-5 text-neutral-600" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm truncate font-medium">
                      {queueTrack.originalName}
                    </div>
                    <div className="text-neutral-400 text-xs truncate">
                      {queueTrack.artistName || 'Unknown Artist'}
                    </div>
                  </div>

                  {index === queueIndex && isPlaying && (
                    <div className="text-green-500 text-xs font-medium">
                      Playing
                    </div>
                  )}

                  {onRemoveFromQueue && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveFromQueue(index)}
                      className="text-neutral-400 hover:text-white h-8 w-8"
                      data-testid={`button-remove-${index}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Gesture Hint */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-4 py-2 rounded-full opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
        Swipe down to minimize
      </div>
    </animated.div>
  );
}

