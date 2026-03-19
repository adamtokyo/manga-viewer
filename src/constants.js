/**
 * Application Configuration and Constants
 */

// ===== STORAGE & PERSISTENCE =====
export const STORAGE_KEY = 'manga_index';

// ===== CACHE CONFIGURATION =====
export const CACHE = {
  MAX_READAHEAD: 20,
  MAX_COMPRESSED_CACHE_SIZE: 20,
  MAX_DECODED_CACHE_SIZE: 3,
  CLEANUP_BUFFER: 5,
};

// ===== ANIMATION TIMINGS (milliseconds) =====
export const TIMING = {
  SWIPE_ANIMATION: 200,        // ms for swipe transition
  UI_AUTO_HIDE: 5000,           // ms before UI auto-hides
  UI_FLASH: 200,                // ms for tap zone flash
  NO_ENTRY_DISPLAY: 1000,       // ms for no-entry icon visibility
  LOADING_TRANSITION: 300,      // ms for loading spinner fade
  ONBOARDING_DISPLAY: 5000,     // ms before onboarding fades
  ONBOARDING_FADE: 500,         // ms for onboarding fade duration
  DEEP_READAHEAD_DELAY: 100,   // ms before starting deep readahead
  FS_CHANGE_DELAY: 100,         // ms after fullscreen change for resize
};

// ===== ANIMATION EASING =====
export const EASING = {
  SWIPE: 'ease-out',
};

// ===== ZOOM & PAN CONFIGURATION =====
export const ZOOM = {
  MIN: 1,
  MAX: 5,
  ZOOM_THRESHOLD: 1.01,  // Threshold to consider image "zoomed"
  THRESHOLD: 0.005,       // Mouse wheel zoom sensitivity
};

// ===== GESTURE THRESHOLDS =====
export const GESTURES = {
  SWIPE_DEADZONE: 10,      // px minimum movement before swipe activates
  SWIPE_COMMIT: 50,        // px minimum movement to commit swipe
  TAP_THRESHOLD: 10,       // px maximum movement to register as tap
  TAP_DURATION: 300,       // ms maximum duration to register as tap
};

// ===== UI ZONE LAYOUT =====
export const UI_ZONES = {
  TOP_HEIGHT: 0.2,         // 20% of screen
  MIDDLE_HEIGHT: 0.6,      // 60% of screen
  BOTTOM_HEIGHT: 0.2,      // 20% of screen
  LEFT_THIRD: 1 / 3,
  RIGHT_THIRD: 2 / 3,
};

// ===== KEYBOARD NAVIGATION =====
export const PAN_AMOUNT = 50;  // px movement per arrow key press

// ===== IMAGE DIMENSIONS =====
export const IMAGE_RATIO = 2 / 3;  // Assumed aspect ratio (width:height)

// ===== ZOOM ANIMATION PARAMETERS =====
export const PINCH_SCALE_LIMITS = {
  MIN: 1,
  MAX: 5,
};

// ===== PAN LIMITS =====
export const getPanLimits = (renderedWidth, renderedHeight, scale, windowWidth, windowHeight) => ({
  maxPanX: Math.max(0, (renderedWidth * scale - windowWidth) / 2),
  maxPanY: Math.max(0, (renderedHeight * scale - windowHeight) / 2),
});
