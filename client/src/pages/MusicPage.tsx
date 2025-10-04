import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { getApiUrl } from '@/lib/api-config';
import Navbar from '@/components/ui/navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Music, Play, Plus, Search, Clock, TrendingUp, ListMusic,
  MoreHorizontal, Edit, Trash2, Music2, Disc3, PlayCircle,
  Pause, Shuffle, Heart, Download, Share2, Users, Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { File, Playlist } from '@shared/schema';

// Form schema for creating/editing playlists
const playlistFormSchema = z.object({
  name: z.string().min(1, 'Playlist name is required').max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(false),
});

type PlaylistFormValues = z.infer<typeof playlistFormSchema>;

// Extend File type for music-specific properties
interface AudioFile extends File {
  isPlaying?: boolean;
  artistName?: string;
  albumName?: string;
}

export default function MusicPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Form for creating/editing playlists
  const form = useForm<PlaylistFormValues>({
    resolver: zodResolver(playlistFormSchema),
    defaultValues: {
      name: '',
      description: '',
      isPublic: false,
    },
  });

  // Fetch all audio files
  const { data: audioFiles = [], isLoading: filesLoading } = useQuery<AudioFile[]>({
    queryKey: ['/api/files', { fileType: 'audio' }],
    queryFn: async () => {
      const response = await fetch(getApiUrl('/api/files?fileType=audio&sortBy=filename&sortOrder=asc'));
      if (!response.ok) throw new Error('Failed to fetch audio files');
      const data = await response.json();
      // The API returns an array directly, not wrapped in an object
      return Array.isArray(data) ? data : [];
    },
  });

  // Fetch user's playlists
  const { data: playlists = [], isLoading: playlistsLoading } = useQuery<Playlist[]>({
    queryKey: ['/api/playlists'],
  });

  // Fetch selected playlist tracks
  const { data: playlistData } = useQuery({
    queryKey: ['/api/playlists', selectedPlaylistId, 'tracks'],
    enabled: !!selectedPlaylistId,
    queryFn: async () => {
      const response = await fetch(`/api/playlists/${selectedPlaylistId}/tracks`);
      if (!response.ok) throw new Error('Failed to fetch playlist tracks');
      return response.json();
    },
  });

  // Fetch recently played
  const { data: recentlyPlayed = [] } = useQuery<AudioFile[]>({
    queryKey: ['/api/recently-played'],
  });

  // Fetch most played
  const { data: mostPlayed = [] } = useQuery<{ file: AudioFile; playCount: number }[]>({
    queryKey: ['/api/most-played'],
  });

  // Create playlist mutation
  const createPlaylistMutation = useMutation({
    mutationFn: (data: PlaylistFormValues) =>
      apiRequest('/api/playlists', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playlists'] });
      setShowCreateDialog(false);
      form.reset();
      toast({
        title: 'Playlist created',
        description: 'Your playlist has been created successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create playlist. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Update playlist mutation
  const updatePlaylistMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PlaylistFormValues }) =>
      apiRequest(`/api/playlists/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playlists'] });
      setEditingPlaylist(null);
      form.reset();
      toast({
        title: 'Playlist updated',
        description: 'Your playlist has been updated successfully.',
      });
    },
  });

  // Delete playlist mutation
  const deletePlaylistMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/playlists/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playlists'] });
      if (selectedPlaylistId === deletePlaylistMutation.variables) {
        setSelectedPlaylistId(null);
      }
      toast({
        title: 'Playlist deleted',
        description: 'Your playlist has been deleted successfully.',
      });
    },
  });

  // Add track to playlist mutation
  const addToPlaylistMutation = useMutation({
    mutationFn: ({ playlistId, fileId }: { playlistId: string; fileId: string }) =>
      apiRequest(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        body: JSON.stringify({ fileId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playlists'] });
      toast({
        title: 'Track added',
        description: 'Track has been added to the playlist.',
      });
    },
  });

  // Remove track from playlist mutation
  const removeFromPlaylistMutation = useMutation({
    mutationFn: ({ playlistId, fileId }: { playlistId: string; fileId: string }) =>
      apiRequest(`/api/playlists/${playlistId}/tracks/${fileId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/playlists'] });
      toast({
        title: 'Track removed',
        description: 'Track has been removed from the playlist.',
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: PlaylistFormValues) => {
    if (editingPlaylist) {
      updatePlaylistMutation.mutate({ id: editingPlaylist.id, data });
    } else {
      createPlaylistMutation.mutate(data);
    }
  };

  // Play a track or playlist
  const handlePlay = (track: AudioFile, playlist?: AudioFile[]) => {
    const audioPlayer = (window as any).audioPlayer;
    if (!audioPlayer) {
      toast({
        title: 'Audio player not ready',
        description: 'Please wait a moment and try again.',
        variant: 'destructive',
      });
      return;
    }

    if (playlist && playlist.length > 0) {
      const index = playlist.findIndex(t => t.id === track.id);
      audioPlayer.playPlaylist(playlist, index >= 0 ? index : 0, selectedPlaylistId);
    } else {
      audioPlayer.playTrack(track, 0);
    }
    
    setCurrentlyPlaying(track.id);
  };

  // Play entire playlist
  const handlePlayPlaylist = (playlistId: string, tracks: AudioFile[]) => {
    const audioPlayer = (window as any).audioPlayer;
    if (!audioPlayer || tracks.length === 0) return;

    audioPlayer.playPlaylist(tracks, 0, playlistId);
    if (tracks[0]) {
      setCurrentlyPlaying(tracks[0].id);
    }
  };

  // Add track to queue
  const handleAddToQueue = (track: AudioFile) => {
    const audioPlayer = (window as any).audioPlayer;
    if (!audioPlayer) return;

    audioPlayer.addToQueue(track);
    toast({
      title: 'Added to queue',
      description: `${track.originalName} has been added to the queue.`,
    });
  };

  // Listen to navbar search changes
  useEffect(() => {
    const handleNavbarSearchChange = (event: CustomEvent) => {
      setSearchQuery(event.detail.query || '');
    };

    window.addEventListener('navbarSearchChange' as any, handleNavbarSearchChange as any);
    return () => {
      window.removeEventListener('navbarSearchChange' as any, handleNavbarSearchChange as any);
    };
  }, []);

  // Filter audio files based on search
  const filteredAudioFiles = audioFiles.filter(file =>
    (file.originalName || file.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get current view's tracks
  const getCurrentTracks = () => {
    if (selectedPlaylistId && playlistData) {
      return playlistData.tracks || [];
    }
    
    switch (activeTab) {
      case 'recent':
        return recentlyPlayed;
      case 'popular':
        return mostPlayed.map(item => item.file);
      default:
        return filteredAudioFiles;
    }
  };

  const currentTracks = getCurrentTracks();

  // Sidebar content component for reuse in desktop and mobile views
  const SidebarContent = () => (
    <>
        <div className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Music className="w-8 h-8 text-green-500" />
            <h1 className="text-xl font-bold">Music</h1>
          </div>

          {/* Library Section */}
          <div className="space-y-4">
            <Button
              variant={activeTab === 'all' && !selectedPlaylistId ? 'secondary' : 'ghost'}
              className="w-full justify-start h-12"
              onClick={() => {
                setActiveTab('all');
                setSelectedPlaylistId(null);
                setMobileSidebarOpen(false);
              }}
              data-testid="button-all-songs"
            >
              <ListMusic className="w-5 h-5 mr-3" />
              All Songs
            </Button>

            <Button
              variant={activeTab === 'recent' && !selectedPlaylistId ? 'secondary' : 'ghost'}
              className="w-full justify-start h-12"
              onClick={() => {
                setActiveTab('recent');
                setSelectedPlaylistId(null);
                setMobileSidebarOpen(false);
              }}
              data-testid="button-recently-played"
            >
              <Clock className="w-5 h-5 mr-3" />
              Recently Played
            </Button>

            <Button
              variant={activeTab === 'popular' && !selectedPlaylistId ? 'secondary' : 'ghost'}
              className="w-full justify-start h-12"
              onClick={() => {
                setActiveTab('popular');
                setSelectedPlaylistId(null);
                setMobileSidebarOpen(false);
              }}
              data-testid="button-most-played"
            >
              <TrendingUp className="w-5 h-5 mr-3" />
              Most Played
            </Button>
          </div>

          {/* Playlists Section */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-neutral-400">PLAYLISTS</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowCreateDialog(true);
                  setMobileSidebarOpen(false);
                }}
                className="h-11 w-11"
                data-testid="button-create-playlist"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>

            <ScrollArea className="h-[calc(100vh-400px)]">
              <div className="space-y-1">
                {playlistsLoading ? (
                  <div className="text-neutral-500 text-sm p-2">Loading...</div>
                ) : playlists.length === 0 ? (
                  <div className="text-neutral-500 text-sm p-2">No playlists yet</div>
                ) : (
                  playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      className={cn(
                        "group flex items-center gap-2 p-3 rounded hover:bg-neutral-800 cursor-pointer",
                        selectedPlaylistId === playlist.id && "bg-neutral-800"
                      )}
                      onClick={() => {
                        setSelectedPlaylistId(playlist.id);
                        setMobileSidebarOpen(false);
                      }}
                      data-testid={`playlist-${playlist.id}`}
                    >
                      <Music2 className="w-5 h-5 text-neutral-400" />
                      <span className="flex-1 truncate text-sm">{playlist.name}</span>
                      {playlist.isPublic && (
                        <Users className="w-4 h-4 text-neutral-500" />
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 opacity-0 group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`playlist-menu-${playlist.id}`}
                          >
                            <MoreHorizontal className="w-5 h-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-neutral-900 border-neutral-800">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPlaylist(playlist);
                              form.setValue('name', playlist.name);
                              form.setValue('description', playlist.description || '');
                              form.setValue('isPublic', playlist.isPublic || false);
                              setMobileSidebarOpen(false);
                            }}
                          >
                            <Edit className="w-5 h-5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete playlist "${playlist.name}"?`)) {
                                deletePlaylistMutation.mutate(playlist.id);
                                setMobileSidebarOpen(false);
                              }
                            }}
                            className="text-red-500"
                          >
                            <Trash2 className="w-5 h-5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
    </>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      {/* Main content container */}
      <div className="flex h-[calc(100vh-4rem)] pt-16">
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex w-64 bg-neutral-950 border-r border-neutral-800 flex-col">
          <SidebarContent />
        </div>

        {/* Mobile Sidebar Sheet */}
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed bottom-20 left-4 z-40 lg:hidden h-14 w-14 rounded-full bg-green-500 hover:bg-green-600 text-black shadow-lg"
              data-testid="mobile-sidebar-button"
            >
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 bg-neutral-950 border-neutral-800 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Music Library</SheetTitle>
            </SheetHeader>
            <SidebarContent />
          </SheetContent>
        </Sheet>

        {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-b from-neutral-800 to-neutral-900 p-4 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex-1">
              {selectedPlaylistId && playlistData ? (
                <>
                  <h1 className="text-2xl md:text-4xl font-bold mb-2">{playlistData.playlist.name}</h1>
                  {playlistData.playlist.description && (
                    <p className="text-neutral-300 text-sm md:text-base">{playlistData.playlist.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-4 text-sm text-neutral-400">
                    <span>{playlistData.tracks?.length || 0} songs</span>
                    <span>•</span>
                    <span>
                      {Math.floor((playlistData.playlist.totalDuration || 0) / 60)} min
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="text-2xl md:text-4xl font-bold mb-2">
                    {activeTab === 'recent' ? 'Recently Played' :
                     activeTab === 'popular' ? 'Most Played' : 'All Songs'}
                  </h1>
                  <p className="text-neutral-300 text-sm md:text-base">
                    {currentTracks.length} tracks
                  </p>
                </>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {selectedPlaylistId && playlistData && playlistData.tracks.length > 0 && (
                <Button
                  size="lg"
                  className="bg-green-500 hover:bg-green-600 text-black rounded-full h-12 md:h-auto"
                  onClick={() => handlePlayPlaylist(selectedPlaylistId, playlistData.tracks)}
                  data-testid="button-play-playlist"
                >
                  <PlayCircle className="w-5 h-5 mr-2" />
                  Play
                </Button>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Search songs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-11 h-12 bg-neutral-800 border-transparent focus:bg-neutral-700 w-full sm:w-64"
                  data-testid="input-search"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Track List */}
        <ScrollArea className="flex-1 p-3 md:p-6 pb-24">
          {filesLoading || playlistsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-neutral-500">Loading...</div>
            </div>
          ) : currentTracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
              <Music className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg">No tracks found</p>
              {searchQuery && (
                <p className="text-sm mt-2">Try adjusting your search</p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {currentTracks.map((track: AudioFile, index: number) => (
                <div
                  key={track.id}
                  className={cn(
                    "group flex items-center gap-2 md:gap-4 p-2 md:p-3 rounded hover:bg-neutral-800",
                    currentlyPlaying === track.id && "bg-neutral-800"
                  )}
                  data-testid={`track-${track.id}`}
                >
                  <div className="w-12 flex items-center justify-center">
                    <span className="md:group-hover:hidden text-neutral-500 text-sm">{index + 1}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hidden md:group-hover:inline-flex h-11 w-11"
                      onClick={() => handlePlay(track, currentTracks)}
                      data-testid={`button-play-${track.id}`}
                    >
                      {currentlyPlaying === track.id ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      {track.thumbnailData ? (
                        <img
                          src={`data:image/jpeg;base64,${btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(track.thumbnailData))))}`}
                          alt=""
                          className="w-10 h-10 rounded"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-neutral-700 rounded flex items-center justify-center">
                          <Disc3 className="w-5 h-5 text-neutral-500" />
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{track.originalName}</div>
                        <div className="text-sm text-neutral-400 truncate">
                          {track.artistName || 'Unknown Artist'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="hidden md:block text-sm text-neutral-400">
                    {track.duration ? `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}` : '--:--'}
                  </div>

                  <div className="flex items-center gap-1 md:gap-2 md:opacity-0 md:group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      onClick={() => handleAddToQueue(track)}
                      data-testid={`button-queue-${track.id}`}
                    >
                      <Plus className="w-5 h-5" />
                    </Button>

                    {!selectedPlaylistId && playlists.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11"
                            data-testid={`button-add-to-playlist-${track.id}`}
                          >
                            <ListMusic className="w-5 h-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-neutral-900 border-neutral-800">
                          {playlists.map((playlist) => (
                            <DropdownMenuItem
                              key={playlist.id}
                              onClick={() => addToPlaylistMutation.mutate({
                                playlistId: playlist.id,
                                fileId: track.id,
                              })}
                              className="h-12"
                            >
                              {playlist.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}

                    {selectedPlaylistId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 text-red-500"
                        onClick={() => removeFromPlaylistMutation.mutate({
                          playlistId: selectedPlaylistId,
                          fileId: track.id,
                        })}
                        data-testid={`button-remove-${track.id}`}
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Create/Edit Playlist Dialog */}
      <Dialog open={showCreateDialog || !!editingPlaylist} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setEditingPlaylist(null);
          form.reset();
        }
      }}>
        <DialogContent className="bg-neutral-900 border-neutral-800">
          <DialogHeader>
            <DialogTitle>
              {editingPlaylist ? 'Edit Playlist' : 'Create Playlist'}
            </DialogTitle>
            <DialogDescription>
              {editingPlaylist ? 'Update your playlist details.' : 'Create a new playlist to organize your music.'}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="My Playlist" data-testid="input-playlist-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe your playlist..."
                        rows={3}
                        data-testid="input-playlist-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="isPublic"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-public"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Make playlist public</FormLabel>
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowCreateDialog(false);
                    setEditingPlaylist(null);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createPlaylistMutation.isPending || updatePlaylistMutation.isPending}
                  data-testid="button-save-playlist"
                >
                  {editingPlaylist ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}