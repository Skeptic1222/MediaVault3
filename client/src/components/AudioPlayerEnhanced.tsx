import { useState, useRef, useEffect } from 'react';
import { MiniPlayer } from '@/components/MusicPlayer/MiniPlayer';
import { FullPlayer } from '@/components/MusicPlayer/FullPlayer';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { getApiUrl } from '@/lib/api-config';
import type { File } from '@shared/schema';

interface AudioTrack extends File {
  artistName?: string;
  albumName?: string;
}

interface AudioPlayerEnhancedProps {
  className?: string;
}

type PlayerView = 'mini' | 'full' | 'hidden';

export function AudioPlayerEnhanced({ className }: AudioPlayerEnhancedProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'all' | 'one'>('none');
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [queue, setQueue] = useState<AudioTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [accessTokens, setAccessTokens] = useState<Map<string, string>>(new Map());
  const [playerView, setPlayerView] = useState<PlayerView>('hidden');
  const playStartTime = useRef<number>(0);

  // Record play history
  const recordPlayMutation = useMutation({
    mutationFn: (data: { fileId: string; playlistId?: string; duration: number; completed: boolean }) =>
      apiRequest('/api/play-history', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recently-played'] });
    },
  });

  // Generate access token for audio files
  const generateAccessToken = async (fileId: string): Promise<string> => {
    if (accessTokens.has(fileId)) {
      return accessTokens.get(fileId)!;
    }

    try {
      const response = await apiRequest(`/api/media/${fileId}/access-token`, {
        method: 'POST',
      });
      const data = await response.json();
      const token = data.token;

      setAccessTokens(prev => new Map(prev).set(fileId, token));

      // Clear token after 9 minutes (tokens expire at 10 minutes)
      setTimeout(() => {
        setAccessTokens(prev => {
          const newMap = new Map(prev);
          newMap.delete(fileId);
          return newMap;
        });
      }, 9 * 60 * 1000);

      return token;
    } catch (error) {
      console.error('Failed to generate access token:', error);
      throw error;
    }
  };

  // Handle audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      if (currentTrack && currentTrack.id) {
        const playDuration = Date.now() - playStartTime.current;
        recordPlayMutation.mutate({
          fileId: currentTrack.id,
          playlistId: playlistId || undefined,
          duration: Math.floor(playDuration / 1000),
          completed: true,
        });
      }

      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play();
      } else {
        handleNext();
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentTrack, repeatMode, playlistId]);

  // Play/pause toggle
  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);

      // Record partial play
      const playDuration = Date.now() - playStartTime.current;
      if (playDuration > 3000 && currentTrack.id && !recordPlayMutation.isPending) {
        recordPlayMutation.mutate({
          fileId: currentTrack.id,
          playlistId: playlistId || undefined,
          duration: Math.floor(playDuration / 1000),
          completed: false,
        });
      }
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
        playStartTime.current = Date.now();
      }).catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Failed to play audio:', err);
        }
        setIsPlaying(false);
      });
    }
  };

  // Skip to previous track
  const handlePrevious = () => {
    const audio = audioRef.current;
    if (!audio) return;

    // If more than 3 seconds into the song, restart it
    if (currentTime > 3) {
      audio.currentTime = 0;
      return;
    }

    if (queue.length === 0) return;

    let newIndex = queueIndex - 1;
    if (newIndex < 0) {
      newIndex = repeatMode === 'all' ? queue.length - 1 : 0;
    }

    playTrack(queue[newIndex], newIndex);
  };

  // Skip to next track
  const handleNext = () => {
    if (queue.length === 0) return;

    let newIndex = queueIndex + 1;
    if (newIndex >= queue.length) {
      if (repeatMode === 'all') {
        newIndex = 0;
      } else {
        setIsPlaying(false);
        return;
      }
    }

    if (isShuffling && repeatMode !== 'one') {
      newIndex = Math.floor(Math.random() * queue.length);
    }

    playTrack(queue[newIndex], newIndex);
  };

  // Play a specific track
  const playTrack = async (track: AudioTrack, index: number) => {
    setCurrentTrack(track);
    setQueueIndex(index);

    const audio = audioRef.current;
    if (audio) {
      // Stop current track properly
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      }

      // Load new track with access token
      try {
        const token = await generateAccessToken(track.id);
        audio.src = getApiUrl(`/api/media/${track.id}?token=${token}`);
      } catch (error) {
        console.error('Failed to load track with access token:', error);
        audio.src = getApiUrl(`/api/media/${track.id}`);
      }

      audio.load();

      // Wait for audio to be ready before playing
      const handleCanPlay = () => {
        audio.play().then(() => {
          setIsPlaying(true);
          playStartTime.current = Date.now();
        }).catch(err => {
          if (err.name !== 'AbortError') {
            console.error('Failed to play audio:', err);
          }
          setIsPlaying(false);
        });

        audio.removeEventListener('canplay', handleCanPlay);
      };

      audio.addEventListener('canplay', handleCanPlay);

      setTimeout(() => {
        audio.removeEventListener('canplay', handleCanPlay);
      }, 30000);
    }
  };

  // Add track to queue
  const addToQueue = (track: AudioTrack) => {
    setQueue([...queue, track]);
    if (!currentTrack) {
      playTrack(track, 0);
      setPlayerView('mini');
    }
  };

  // Play entire playlist
  const playPlaylist = (tracks: AudioTrack[], startIndex: number = 0, playlistId?: string) => {
    if (tracks.length === 0) return;

    setQueue(tracks);
    setPlaylistId(playlistId || null);
    playTrack(tracks[startIndex], startIndex);
    setPlayerView('mini');
  };

  // Remove from queue
  const removeFromQueue = (index: number) => {
    const newQueue = queue.filter((_, i) => i !== index);
    setQueue(newQueue);

    if (index < queueIndex) {
      setQueueIndex(queueIndex - 1);
    } else if (index === queueIndex && newQueue.length > 0) {
      const newIndex = Math.min(queueIndex, newQueue.length - 1);
      playTrack(newQueue[newIndex], newIndex);
    } else if (newQueue.length === 0) {
      setCurrentTrack(null);
      setIsPlaying(false);
      setQueueIndex(0);
      setPlayerView('hidden');
    }
  };

  // Clear queue
  const clearQueue = () => {
    setQueue([]);
    setCurrentTrack(null);
    setIsPlaying(false);
    setQueueIndex(0);
    setPlayerView('hidden');

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
    }
  };

  // Handle volume change
  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    setIsMuted(newVolume === 0);

    const audio = audioRef.current;
    if (audio) {
      audio.volume = newVolume;
    }
  };

  // Toggle mute
  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.volume = volume || 0.5;
      setVolume(volume || 0.5);
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  // Toggle repeat mode
  const toggleRepeatMode = () => {
    const modes: Array<'none' | 'all' | 'one'> = ['none', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
  };

  // Handle seeking
  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    const newTime = value[0];
    audio.currentTime = newTime;
    setCurrentTime(newTime);

    if (isPlaying) {
      playStartTime.current = Date.now();
    }
  };

  // Expose methods for external use
  useEffect(() => {
    (window as any).audioPlayer = {
      playTrack,
      addToQueue,
      playPlaylist,
      clearQueue,
      getCurrentTrack: () => currentTrack,
      getQueue: () => queue,
      isPlaying: () => isPlaying,
    };
  }, [currentTrack, queue, isPlaying]);

  if (!currentTrack || playerView === 'hidden') {
    return <audio ref={audioRef} />;
  }

  return (
    <>
      <audio ref={audioRef} />

      {playerView === 'mini' && (
        <MiniPlayer
          track={currentTrack}
          isPlaying={isPlaying}
          onPlayPause={togglePlayPause}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onExpand={() => setPlayerView('full')}
          onClose={() => setPlayerView('hidden')}
          className={className}
        />
      )}

      {playerView === 'full' && (
        <FullPlayer
          track={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          isMuted={isMuted}
          isShuffling={isShuffling}
          repeatMode={repeatMode}
          queue={queue}
          queueIndex={queueIndex}
          onPlayPause={togglePlayPause}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onSeek={handleSeek}
          onVolumeChange={handleVolumeChange}
          onToggleMute={toggleMute}
          onToggleShuffle={() => setIsShuffling(!isShuffling)}
          onToggleRepeat={toggleRepeatMode}
          onMinimize={() => setPlayerView('mini')}
          onClose={() => setPlayerView('hidden')}
          onRemoveFromQueue={removeFromQueue}
          className={className}
        />
      )}
    </>
  );
}
