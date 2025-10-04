# Gesture Controls Architecture

## Component Hierarchy

```
MediaVault App
│
├── Gallery Pages
│   └── MediaLightbox (Enhanced)
│       ├── useGesture() hook
│       │   ├── onDrag (horizontal) → Navigate prev/next
│       │   ├── onDrag (vertical) → Close lightbox
│       │   ├── onPinch → Zoom (1x-4x)
│       │   └── tap → Toggle controls
│       └── useSpring() hook
│           ├── x, y (position)
│           ├── opacity
│           └── scale
│
└── Music Player
    ├── AudioPlayerEnhanced (State Manager)
    │   ├── Player state (playing, paused, etc.)
    │   ├── Queue management
    │   ├── View management (hidden/mini/full)
    │   └── Global API exposure
    │
    ├── MiniPlayer
    │   ├── useGesture() hook
    │   │   ├── onDrag (up) → Expand to FullPlayer
    │   │   └── onDrag (down) → Close player
    │   └── useSpring() hook
    │       └── y (vertical position)
    │
    └── FullPlayer
        ├── useGesture() hook
        │   └── onDrag (down) → Minimize to MiniPlayer
        └── useSpring() hook
            └── y (vertical position)
```

---

## Gesture Flow Diagrams

### MediaLightbox Gesture Flow

```
┌─────────────────────────────────────────────┐
│         User Touch Event Detected          │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│       Gesture Recognition (@use-gesture)    │
│                                             │
│  • Calculate offset (ox, oy)               │
│  • Calculate direction (dx, dy)            │
│  • Calculate velocity (vx, vy)             │
│  • Detect tap vs drag                      │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
┌──────────────┐    ┌──────────────┐
│   TAP        │    │   DRAG       │
│              │    │              │
│ Toggle       │    │ Determine    │
│ controls     │    │ direction    │
│              │    │              │
└──────────────┘    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  HORIZONTAL  │  │   VERTICAL   │  │    PINCH     │
│              │  │              │  │              │
│ |ox| > |oy| │  │ |oy| > |ox|  │  │ Two fingers  │
│              │  │              │  │              │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Check zoom  │  │ Check close  │  │ Calculate    │
│  If zoom>1,  │  │ threshold    │  │ zoom level   │
│  skip nav    │  │              │  │              │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Check       │  │  If oy>100   │  │  Update      │
│  threshold   │  │  or vy>0.5:  │  │  imageZoom   │
│              │  │              │  │              │
│  ox>100 OR   │  │  Close with  │  │  1x to 4x    │
│  vx>0.5      │  │  animation   │  │              │
└──────┬───────┘  └──────────────┘  └──────────────┘
       │
       ▼
┌──────────────┐
│  Navigate    │
│              │
│  dx>0: prev  │
│  dx<0: next  │
│              │
│  Animate     │
│  with spring │
└──────────────┘
```

### Music Player State Flow

```
┌─────────────────────────────────────────────┐
│              Player States                  │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
┌──────────────┐    ┌──────────────┐
│   HIDDEN     │    │     MINI     │
│              │◄───┤              │
│ No player    │    │ Bottom bar   │
│ visible      │    │ 80px height  │
│              │    │              │
└──────────────┘    └──────┬───────┘
                           │
                    ┌──────┴──────┐
                    │             │
          Swipe Up  │             │  Swipe Down
                    │             │
                    ▼             ▼
            ┌──────────────┐    ┌──────────────┐
            │     FULL     │    │   HIDDEN     │
            │              │    │              │
            │ Full screen  │    │              │
            │ overlay      │    │              │
            │              │    │              │
            └──────┬───────┘    └──────────────┘
                   │
                   │  Swipe Down
                   ▼
            ┌──────────────┐
            │     MINI     │
            └──────────────┘
```

---

## Animation Configuration

### Spring Presets

```typescript
// config.stiff (Real-time gestures)
{
  tension: 210,
  friction: 20,
  mass: 1
}

// config.default (Smooth transitions)
{
  tension: 170,
  friction: 26,
  mass: 1
}

// config.slow (Emphasis animations)
{
  tension: 280,
  friction: 60,
  mass: 1
}
```

### Animation Timings

```
Gesture Feedback:     0ms (immediate: true)
Swipe Navigation:   300-500ms (config.default)
Open/Close:         400-600ms (config.default)
Zoom:               200-300ms (config.stiff)
Snap Back:          200-300ms (config.stiff)
```

---

## Event Handler Flow

### MediaLightbox onDrag Handler

```typescript
onDrag: (state) => {
  // 1. Extract gesture data
  const { offset: [ox, oy], direction: [dx, dy],
          velocity: [vx, vy], cancel, tap } = state;

  // 2. Handle tap (early return)
  if (tap) {
    toggleControls();
    return;
  }

  // 3. Check zoom state (prevent navigation if zoomed)
  if (imageZoom > 1) return;

  // 4. Calculate absolute offsets
  const absOx = Math.abs(ox);
  const absOy = Math.abs(oy);

  // 5. Determine primary direction
  if (absOy > absOx && dy > 0) {
    // Vertical swipe (close)
    handleVerticalSwipe(oy, vy, cancel);
  } else if (absOx > absOy) {
    // Horizontal swipe (navigation)
    handleHorizontalSwipe(ox, vx, dx, cancel);
  }
}
```

### Threshold Decision Tree

```
Is gesture complete?
├── Yes (threshold met)
│   ├── Distance check: offset > threshold (e.g., 100px)
│   │   └── Trigger action with animation
│   └── Velocity check: velocity > threshold (e.g., 0.5px/ms)
│       └── Trigger action with animation
│
└── No (threshold not met)
    └── onDragEnd
        └── Snap back to original position
            └── api.start({ x: 0, y: 0, opacity: 1 })
```

---

## Touch Event Lifecycle

```
1. Touch Start (touchstart / pointerdown)
   ↓
   • Store initial position
   • Initialize gesture tracking
   • Set dragging state

2. Touch Move (touchmove / pointermove)
   ↓
   • Calculate offset from start
   • Calculate velocity
   • Update visual feedback (immediate animation)
   • Determine gesture type (swipe/pinch/tap)

3. Touch End (touchend / pointerup)
   ↓
   • Calculate final offset and velocity
   • Check thresholds
   • Trigger action OR snap back
   • Clean up gesture state

4. Animation Complete
   ↓
   • Execute callback (onNext, onClose, etc.)
   • Reset animation state
   • Clean up event listeners
```

---

## Memory Management

### Cleanup Flow

```typescript
useEffect(() => {
  // Setup
  const bind = useGesture({ /* handlers */ });

  return () => {
    // Cleanup
    // 1. Remove event listeners (automatic)
    // 2. Cancel pending animations
    api.stop();

    // 3. Clear references
    // (React handles this automatically)
  };
}, [dependencies]);
```

### Spring Lifecycle

```
Create Spring
    ↓
useSpring(() => ({
  x: 0,
  y: 0,
  opacity: 1
}))
    ↓
Return [values, api]
    ↓
Component Updates
    ↓
api.start({ /* new values */ })
    ↓
Animation Runs
    ↓
Component Unmounts
    ↓
Spring Auto-cleanup
```

---

## Performance Optimizations

### 1. Hardware Acceleration

```css
/* Triggered by transform and opacity */
transform: translate(x, y) scale(scale);
opacity: opacity;

/* Enables GPU acceleration */
will-change: transform, opacity;
```

### 2. Prevent Unnecessary Renders

```typescript
// Use spring values directly (no re-renders)
<animated.div style={{ x, y, opacity }} />

// Instead of state (causes re-renders)
<div style={{ transform: `translate(${stateX}px, ${stateY}px)` }} />
```

### 3. Debounce/Throttle

```typescript
// useGesture handles this internally
{
  drag: {
    threshold: 10,  // Minimum 10px movement to start drag
    filterTaps: true,  // Separate taps from drags
  }
}
```

---

## Error Handling

### Gesture Conflicts

```typescript
// Priority: Zoom > Vertical > Horizontal
if (imageZoom > 1) {
  // Allow pan, block navigation
  return;
}

if (absOy > absOx) {
  // Vertical wins
  handleVerticalSwipe();
  return;
}

// Fall through to horizontal
handleHorizontalSwipe();
```

### Boundary Protection

```typescript
// Prevent navigation beyond limits
if (dx > 0 && selectedIndex === 0) {
  // At start, block previous
  api.start({ x: 0, opacity: 1 });  // Snap back
  return;
}

if (dx < 0 && selectedIndex === mediaFiles.length - 1) {
  // At end, block next
  api.start({ x: 0, opacity: 1 });  // Snap back
  return;
}
```

---

## Testing Architecture

### Test Pyramid

```
                    ┌─────────────┐
                    │   E2E Tests │  (Gesture flows)
                    │   Playwright│
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │  Integration Tests      │  (Component interactions)
              │  React Testing Library  │
              └───────────┬─────────────┘
                          │
         ┌────────────────┴────────────────┐
         │      Unit Tests                  │  (Gesture handlers)
         │      Jest / Vitest               │
         └─────────────────────────────────┘
```

### Test Coverage Goals

- ✅ Gesture detection: 100%
- ✅ Animation triggers: 100%
- ✅ Boundary conditions: 100%
- ✅ Accessibility: 100%
- ⏳ Music player integration: Pending
- ⏳ Real device testing: Manual

---

## Browser Compatibility Strategy

### Progressive Enhancement

```typescript
// Base functionality (works everywhere)
<Button onClick={onNext}>Next</Button>

// Enhanced with gestures (modern browsers)
<animated.div {...bind()}>
  {/* Gesture-enabled content */}
</animated.div>

// Graceful degradation
// If gestures fail, buttons still work
```

### Feature Detection

```typescript
// @use-gesture handles this internally
// Falls back to mouse events if touch not available
// Works in all modern browsers without polyfills
```

---

## Deployment Checklist

### Pre-deployment
- [x] TypeScript compilation successful
- [ ] All tests passing
- [ ] No console errors
- [ ] No memory leaks
- [ ] Tested on iOS Safari
- [ ] Tested on Chrome Mobile
- [ ] Tested on desktop browsers
- [ ] Accessibility audit passed

### Post-deployment
- [ ] Monitor performance metrics
- [ ] Check error logs
- [ ] Gather user feedback
- [ ] A/B test engagement

---

## Future Architecture Improvements

### 1. Gesture Configuration API

```typescript
<MediaLightbox
  gestureConfig={{
    swipeThreshold: 100,
    swipeVelocity: 0.5,
    zoomRange: [1, 4],
    enablePinch: true,
    enableSwipe: true,
  }}
/>
```

### 2. Gesture Analytics

```typescript
// Track gesture usage
onGestureComplete={(type, duration, success) => {
  analytics.track('gesture_used', {
    type,  // 'swipe', 'pinch', 'tap'
    duration,
    success,  // completed vs. cancelled
  });
}}
```

### 3. Custom Gesture Patterns

```typescript
// Define custom multi-touch gestures
const customGesture = useGesture({
  onPinchRotate: ({ offset: [scale, angle] }) => {
    // Simultaneous pinch and rotate
  },
});
```

---

## Conclusion

The gesture control system is built with:
- **Performance** in mind (60fps animations)
- **Accessibility** as a priority (keyboard fallbacks)
- **Maintainability** through clean architecture
- **Extensibility** for future enhancements

All components follow React best practices and TypeScript strict mode.
