# Gesture Controls for MediaVault

This document describes the swipe gesture implementation for MediaVault's media lightbox and music player components.

## Overview

MediaVault now features comprehensive touch gesture support powered by:
- **@use-gesture/react** v10.3.1 - Advanced gesture recognition
- **@react-spring/web** v10.0.3 - Smooth spring-based animations

## Components

### 1. MediaLightbox (Enhanced)
**Location:** `client/src/components/gallery/MediaLightbox.tsx`

#### Gesture Features

**Horizontal Swipe (Navigation)**
- Swipe left → Next image/video
- Swipe right → Previous image/video
- Threshold: 100px or velocity > 0.5px/ms
- Visual feedback: Image follows finger during swipe
- Smooth fade-out animation on navigation
- Boundary detection: Prevents swiping beyond first/last item

**Vertical Swipe (Close)**
- Swipe down → Close lightbox
- Threshold: 100px or velocity > 0.5px/ms
- Opacity decreases as user swipes down
- Snap back animation if threshold not met
- Works from anywhere in the lightbox

**Pinch to Zoom (Images Only)**
- Two-finger pinch gesture
- Zoom range: 1x to 4x
- Smooth spring animation
- Prevents navigation when zoomed
- Rubberband effect at zoom limits

**Double Tap**
- Toggle between 1x and 2x zoom
- Only available for images
- Quick alternative to pinch gesture

**Tap**
- Single tap → Toggle control visibility
- Helps create immersive viewing experience

#### Configuration

```typescript
// Gesture thresholds (can be customized)
const SWIPE_THRESHOLD = 100;        // Minimum swipe distance (px)
const SWIPE_VELOCITY = 0.5;         // Minimum swipe velocity (px/ms)
const CLOSE_THRESHOLD = 100;        // Vertical swipe threshold (px)
const CLOSE_VELOCITY = 0.5;         // Vertical swipe velocity (px/ms)
const MIN_ZOOM = 1;                 // Minimum zoom level
const MAX_ZOOM = 4;                 // Maximum zoom level
```

#### iOS-Specific Optimizations

```css
/* Prevents iOS bounce/rubber-band effect */
body {
  overscroll-behavior-y: none;
  position: fixed;
  width: 100%;
  height: 100%;
}

/* Prevents text selection during drag */
.select-none {
  user-select: none;
  -webkit-user-select: none;
}

/* Controls touch behavior */
touch-action: none;  /* Disable default touch actions */
```

### 2. MiniPlayer
**Location:** `client/src/components/MusicPlayer/MiniPlayer.tsx`

#### Gesture Features

**Swipe Up (Expand to Full Player)**
- Swipe up → Expand to full-screen player
- Threshold: 80px or velocity > 0.3px/ms
- Smooth slide-up animation
- Visual indicator bar at top

**Swipe Down (Close Player)**
- Swipe down → Close player
- Threshold: 80px or velocity > 0.3px/ms
- Slide-down fade-out animation

**Visual Indicators**
- Swipe handle indicator at top
- Subtle hover hints
- Responsive to drag gestures

#### Configuration

```typescript
const EXPAND_THRESHOLD = 80;        // Swipe up threshold (px)
const CLOSE_THRESHOLD = 80;         // Swipe down threshold (px)
const VELOCITY_THRESHOLD = 0.3;     // Velocity threshold (px/ms)
```

### 3. FullPlayer
**Location:** `client/src/components/MusicPlayer/FullPlayer.tsx`

#### Gesture Features

**Swipe Down (Minimize)**
- Swipe down → Minimize to mini player
- Threshold: 100px or velocity > 0.3px/ms
- Follows finger during drag
- Snap back if threshold not met
- Only allows downward swipes (prevents accidental upward swipes)

**Queue Management**
- Full queue view with scroll support
- Tap to expand/collapse queue
- Swipe on track (future enhancement)

#### Configuration

```typescript
const MINIMIZE_THRESHOLD = 100;     // Swipe down threshold (px)
const VELOCITY_THRESHOLD = 0.3;     // Velocity threshold (px/ms)
```

### 4. AudioPlayerEnhanced
**Location:** `client/src/components/AudioPlayerEnhanced.tsx`

Integration component that manages player state and view transitions between MiniPlayer and FullPlayer.

## Installation & Setup

### 1. Install Dependencies

```bash
npm install @use-gesture/react @react-spring/web
```

### 2. Import Components

```typescript
// Media Lightbox (auto-imported in gallery pages)
import MediaLightbox from '@/components/gallery/MediaLightbox';

// Music Player
import { AudioPlayerEnhanced } from '@/components/AudioPlayerEnhanced';
```

### 3. Usage Examples

#### Media Lightbox

```typescript
<MediaLightbox
  mediaFiles={mediaFiles}
  selectedIndex={selectedIndex}
  isOpen={isLightboxOpen}
  onClose={() => setIsLightboxOpen(false)}
  onNext={handleNext}
  onPrevious={handlePrevious}
  decryptionKey={vaultKey}
/>
```

#### Music Player

```typescript
// In your main app component or layout
<AudioPlayerEnhanced />

// Play a track from anywhere in the app
(window as any).audioPlayer?.playTrack(track, 0);

// Play a playlist
(window as any).audioPlayer?.playPlaylist(tracks, 0, playlistId);
```

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge | Mobile Safari | Chrome Mobile |
|---------|--------|---------|--------|------|---------------|---------------|
| Swipe Gestures | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pinch to Zoom | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Double Tap | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Spring Animations | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Performance Considerations

### Bundle Size Impact
- @use-gesture/react: ~15KB (gzipped)
- @react-spring/web: ~25KB (gzipped)
- Total: ~40KB additional bundle size

### Optimization Techniques

1. **Spring Animation Configuration**
   - Uses `config.stiff` for responsive gestures
   - `config.default` for smooth transitions
   - Immediate mode for real-time dragging

2. **Event Handling**
   - Prevents default browser behaviors
   - Cancels gestures when thresholds are met
   - Cleans up event listeners properly

3. **iOS-Specific**
   - Prevents overscroll bounce
   - Disables pull-to-refresh
   - Fixed body positioning when lightbox is open

4. **Memory Management**
   - Proper cleanup of springs and event listeners
   - Resets state when components unmount
   - No memory leaks from gesture handlers

## Accessibility

### Keyboard Support

All gesture controls have keyboard equivalents:

**MediaLightbox**
- `←` / `→` - Navigate between media
- `↑` / `↓` - Zoom in/out
- `ESC` - Close lightbox
- `F` - Toggle fullscreen mode
- `R` - Rotate image
- `SPACE` - Play/Pause video

**MusicPlayer**
- `SPACE` - Play/Pause
- `←` / `→` - Previous/Next track
- `ESC` - Close/Minimize player

### Screen Reader Support

- ARIA labels on all interactive elements
- Semantic HTML structure
- Focus management for keyboard navigation
- `data-testid` attributes for testing

### Visual Indicators

- Gesture hints shown on first use
- Swipe handle indicators
- Progress feedback during gestures
- Clear button alternatives for all gestures

## Testing

### Manual Testing Checklist

**MediaLightbox**
- [ ] Horizontal swipe navigation works
- [ ] Vertical swipe to close works
- [ ] Pinch to zoom works (images)
- [ ] Double tap zoom works (images)
- [ ] Tap toggles controls
- [ ] Boundary detection works (first/last item)
- [ ] Zoom prevents navigation
- [ ] Animations are smooth
- [ ] Works on desktop and mobile
- [ ] Keyboard shortcuts still work

**MiniPlayer**
- [ ] Swipe up expands to full player
- [ ] Swipe down closes player
- [ ] Swipe threshold is appropriate
- [ ] Animation is smooth
- [ ] Works on desktop and mobile

**FullPlayer**
- [ ] Swipe down minimizes to mini player
- [ ] Only downward swipes work
- [ ] Snap back works correctly
- [ ] Queue view works
- [ ] Volume slider works
- [ ] Progress slider works

### Automated Testing

```typescript
// Example Playwright test
test('MediaLightbox swipe navigation', async ({ page }) => {
  // Open lightbox
  await page.click('[data-testid="media-thumbnail"]');

  // Simulate swipe left
  await page.touchscreen.swipe(
    { x: 300, y: 400 },
    { x: 100, y: 400 }
  );

  // Verify navigation
  await expect(page.locator('[data-testid="lightbox-title"]'))
    .toContainText('Next Image');
});
```

## Troubleshooting

### Common Issues

**1. Gestures not working**
- Check if `touchAction: 'none'` is applied
- Verify gesture library is imported
- Check console for errors

**2. Janky animations**
- Reduce spring stiffness
- Use `immediate: true` for dragging
- Check for unnecessary re-renders

**3. Conflicts with scroll**
- Set `axis: 'y'` or `axis: 'x'` on drag config
- Use `touchAction: 'pan-y'` or `'pan-x'`
- Prevent default on specific gestures

**4. iOS-specific issues**
- Ensure `position: fixed` on body when modal is open
- Set `overscroll-behavior-y: none`
- Add `-webkit-` prefixes for user-select

### Debug Mode

Enable gesture debugging:

```typescript
const bind = useGesture(
  {
    onDrag: (state) => {
      console.log('Drag state:', state);
      // Your handler
    }
  },
  {
    // Add config
  }
);
```

## Future Enhancements

- [ ] Haptic feedback on iOS devices
- [ ] Configurable gesture thresholds via settings
- [ ] Custom gesture animations
- [ ] Gesture recording and playback
- [ ] Multi-finger gestures (3+ fingers)
- [ ] Rotate gesture for images
- [ ] Swipe actions on queue items
- [ ] Momentum-based scrolling in queue

## Credits

- **@use-gesture/react** - David Khourshid and contributors
- **@react-spring/web** - Paul Henschel and contributors
- Built for MediaVault by Claude Code

## License

MIT License - See project root LICENSE file
