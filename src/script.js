import {
  STORAGE_KEY,
  CACHE,
  TIMING,
  EASING,
  ZOOM,
  GESTURES,
  UI_ZONES,
  PAN_AMOUNT,
  IMAGE_RATIO,
  getPanLimits,
} from './constants.js';

// ===== CORE STATE =====
let currentIndex = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
let maxFoundIndex = Infinity;
let isTransitioning = false;

// ===== CACHING ENGINE =====
const blobCache = new Map();
const decodedCache = new Map();
const loadingPromises = new Map();

// ===== FETCH QUEUE SYSTEM =====
const fetchQueue = [];
let activeFetches = 0;
const MAX_CONCURRENT_FETCHES = 2;

async function processFetchQueue() {
  while (activeFetches < MAX_CONCURRENT_FETCHES && fetchQueue.length > 0) {
    activeFetches++;
    const { index, priority } = fetchQueue.shift();
    
    try {
      await preloadCompressed(index, priority);
    } finally {
      activeFetches--;
    }
  }
}

function queuedPreload(index, priority = "auto") {
  if (index > maxFoundIndex || blobCache.has(index)) return Promise.resolve();
  if (loadingPromises.has(index)) return loadingPromises.get(index);
  
  return new Promise((resolve) => {
    fetchQueue.push({ index, priority, resolve });
    processFetchQueue();
    
    // Track this as a loading promise so getDecodedImage can wait for it
    const wrapped = (async () => {
      while (fetchQueue.some(item => item.index === index)) {
        await new Promise(r => setTimeout(r, 10));
      }
      await (loadingPromises.get(index) || Promise.resolve());
      resolve();
    })();
    loadingPromises.set(index, wrapped);
  });
}

function getImagePath(index) {
  return `${String(index).padStart(3, '0')}.avif`;
}

async function preloadCompressed(index, priority = "auto") {
  if (index > maxFoundIndex || blobCache.has(index)) return;
  if (loadingPromises.has(index)) return loadingPromises.get(index);

  const promise = (async () => {
    try {
      const res = await fetch(getImagePath(index), { priority });
      if (!res.ok) {
        if (res.status === 404) maxFoundIndex = Math.min(maxFoundIndex, index - 1);
        return;
      }
      const blob = await res.blob();
      blobCache.set(index, URL.createObjectURL(blob));
    } catch (e) {
      console.error('Fetch error:', e);
    }
  })();

  loadingPromises.set(index, promise);
  try {
    await promise;
  } finally {
    loadingPromises.delete(index);
  }
}

async function getDecodedImage(index) {
  if (index < 0 || index > maxFoundIndex) return null;
  if (decodedCache.has(index)) return decodedCache.get(index);

  if (!blobCache.has(index)) {
    await preloadCompressed(index);
  }
  if (!blobCache.has(index)) return null;

  const img = new Image();
  img.src = blobCache.get(index);
  try {
    await img.decode();
    decodedCache.set(index, img);
    return img;
  } catch (e) {
    console.error('Decode error:', e);
    return null;
  }
}

async function updateCache() {
  // 1. Prioritize current
  await preloadCompressed(currentIndex, "high");

  // 2. Prioritize immediate neighbors (Next, Prev)
  if (currentIndex > 0) {
    const priority = [currentIndex + 1, currentIndex - 1];
    const neighborPromises = priority.map(idx => Promise.resolve(preloadCompressed(idx, "high")));
    await Promise.all(neighborPromises);
  } else {
    await preloadCompressed(currentIndex + 1, "high");
  }

  // Clean up old compressed
  for (const [idx, url] of blobCache.entries()) {
    if (idx < currentIndex - CACHE.CLEANUP_BUFFER || idx > currentIndex + CACHE.MAX_READAHEAD + CACHE.CLEANUP_BUFFER) {
      URL.revokeObjectURL(url);
      blobCache.delete(idx);
    }
  }

  // Keep exactly current, prev, next decoded
  const needed = [currentIndex - 1, currentIndex, currentIndex + 1];
  for (const idx of needed) {
    if (idx >= 0 && idx <= maxFoundIndex) getDecodedImage(idx);
  }

  // Clean up old decoded
  for (const idx of decodedCache.keys()) {
    if (!needed.includes(idx)) decodedCache.delete(idx);
  }

  // 2. Deep readahead (delayed to allow critical requests to start first)
  setTimeout(() => {
    for (let i = currentIndex + 2; i <= currentIndex + CACHE.MAX_READAHEAD; i++) {
      if (i <= maxFoundIndex) queuedPreload(i);
    }
  }, TIMING.DEEP_READAHEAD_DELAY);
}

// ===== DOM ELEMENTS =====
const layerTop = document.getElementById('layer-top');
const layerBottom = document.getElementById('layer-bottom');
const imgTop = document.getElementById('img-top');
const imgBottom = document.getElementById('img-bottom');

const btnFullscreen = document.getElementById('btn-fullscreen');
const iconFsEnter = document.getElementById('icon-fs-enter');
const iconFsExit = document.getElementById('icon-fs-exit');
const btnRewind = document.getElementById('btn-rewind');

const loadingSpinner = document.getElementById('loading-spinner');
const noEntryIcon = document.getElementById('no-entry');
const onboardingAnim = document.getElementById('onboarding');

const mangaContainer = document.getElementById('manga-container');

// ===== VIEWPORT & IMAGE SIZING =====
let renderedWidth = 0, renderedHeight = 0;

function updateContainerSizes() {
  const screenRatio = window.innerWidth / window.innerHeight;
  if (screenRatio > IMAGE_RATIO) {
    renderedHeight = window.innerHeight;
    renderedWidth = renderedHeight * IMAGE_RATIO;
  } else {
    renderedWidth = window.innerWidth;
    renderedHeight = renderedWidth / IMAGE_RATIO;
  }
  imgTop.style.width = `${renderedWidth}px`;
  imgTop.style.height = `${renderedHeight}px`;
  imgBottom.style.width = `${renderedWidth}px`;
  imgBottom.style.height = `${renderedHeight}px`;
}

window.addEventListener('resize', () => {
  updateContainerSizes();
  clampPan();
  applyTransform();
});

// ===== UI & AUTO-HIDE LOGIC =====
let uiTimeout;
let isUIVisible = false;

function showUI() {
  isUIVisible = true;
  btnFullscreen.classList.remove('opacity-0');
  btnFullscreen.classList.remove('pointer-events-none');
  btnFullscreen.classList.add('pointer-events-auto');
  if (currentIndex > 0) {
    btnRewind.classList.remove('hidden');
    btnRewind.classList.remove('pointer-events-none');
    btnRewind.classList.add('pointer-events-auto');
    // slight delay to allow display:block to apply before opacity transition
    requestAnimationFrame(() => btnRewind.classList.remove('opacity-0'));
  }

  clearTimeout(uiTimeout);
  uiTimeout = setTimeout(hideUI, TIMING.UI_AUTO_HIDE);

  // Onboarding disappears permanently after timeout if active
  if (onboardingAnim.style.display !== 'none') {
    setTimeout(() => {
      onboardingAnim.style.opacity = '0';
      setTimeout(() => onboardingAnim.style.display = 'none', TIMING.ONBOARDING_FADE);
    }, TIMING.ONBOARDING_DISPLAY);
  }
}

function hideUI() {
  isUIVisible = false;
  btnFullscreen.classList.add('opacity-0');
  btnFullscreen.classList.remove('pointer-events-auto');
  btnFullscreen.classList.add('pointer-events-none');
  btnRewind.classList.add('opacity-0');
  btnRewind.classList.remove('pointer-events-auto');
  btnRewind.classList.add('pointer-events-none');
  clearTimeout(uiTimeout);
}

function flashElement(id) {
  const el = document.getElementById(id);
  el.classList.add('flash-active');
  setTimeout(() => el.classList.remove('flash-active'), TIMING.UI_FLASH);
  showUI();
}

function showNoEntry() {
  noEntryIcon.style.opacity = '1';
  setTimeout(() => noEntryIcon.style.opacity = '0', TIMING.NO_ENTRY_DISPLAY);
}

function toggleLoading(show) {
  loadingSpinner.style.opacity = show ? '1' : '0';
}

// ===== DISPLAY LOGIC =====
async function renderCurrent(forceFullRender = false) {
  updateCache();
  toggleLoading(true);
  const img = await getDecodedImage(currentIndex);
  toggleLoading(false);

  if (!img) {
    isTransitioning = false; // Ensure we don't get stuck
    return;
  }

  imgTop.src = img.src;
  localStorage.setItem(STORAGE_KEY, currentIndex);

  if (currentIndex === 0) {
    btnRewind.classList.add('hidden', 'opacity-0');
  } else if (isUIVisible) {
    btnRewind.classList.remove('hidden');
    btnRewind.classList.remove('pointer-events-none');
    btnRewind.classList.add('pointer-events-auto');
    requestAnimationFrame(() => btnRewind.classList.remove('opacity-0'));
  }
}

async function prepareAdjacentImage(offset) {
  const targetIdx = currentIndex + offset;
  if (targetIdx < 0 || targetIdx > maxFoundIndex) return false;

  let img = decodedCache.get(targetIdx);
  if (!img) {
    toggleLoading(true);
    img = await getDecodedImage(targetIdx);
    toggleLoading(false);
  }
  if (img) {
    imgBottom.src = img.src;
    return true;
  }
  return false;
}

// ===== NAVIGATION ANIMATIONS =====
async function animateTo(offset) {
  if (isTransitioning) return;
  const targetIdx = currentIndex + offset;
  if (targetIdx < 0) return;

  const isReady = await prepareAdjacentImage(offset);
  if (!isReady) {
    if (offset > 0) showNoEntry();
    return;
  }

  isTransitioning = true;
  // Next (offset +1): Swipe Right -> layerTop moves right (+100vw), layerBottom moves from left (-100vw) to center
  // Prev (offset -1): Swipe Left -> layerTop moves left (-100vw), layerBottom moves from right (+100vw) to center
  const dirX = offset > 0 ? window.innerWidth : -window.innerWidth;
  const startXBottom = -dirX; // Opposite direction

  // Set up bottom layer starting position
  layerBottom.style.transition = 'none';
  layerBottom.style.transform = `translateX(${startXBottom}px)`;

  // Force reflow to ensure the transform is applied before animation
  layerBottom.offsetHeight;

  // Start animation for both layers
  layerTop.style.transition = `transform ${TIMING.SWIPE_ANIMATION}ms ${EASING.SWIPE}`;
  layerBottom.style.transition = `transform ${TIMING.SWIPE_ANIMATION}ms ${EASING.SWIPE}`;
  layerTop.style.transform = `translateX(${dirX}px)`;
  layerBottom.style.transform = 'translateX(0)';

  setTimeout(() => {
    // Animation complete - swap layers
    const tempSrc = imgTop.src;
    imgTop.src = imgBottom.src;
    imgBottom.src = tempSrc;

    // Reset transforms
    layerTop.style.transition = 'none';
    layerBottom.style.transition = 'none';
    layerTop.style.transform = 'translateX(0)';
    layerBottom.style.transform = `translateX(${startXBottom}px)`;

    currentIndex = targetIdx;
    resetZoom();
    localStorage.setItem(STORAGE_KEY, currentIndex);
    updateCache();
    isTransitioning = false;

    // Update UI
    if (currentIndex === 0) {
      btnRewind.classList.add('hidden', 'opacity-0');
    } else if (isUIVisible) {
      btnRewind.classList.remove('hidden');
      btnRewind.classList.remove('pointer-events-none');
      btnRewind.classList.add('pointer-events-auto');
      requestAnimationFrame(() => btnRewind.classList.remove('opacity-0'));
    }
  }, TIMING.SWIPE_ANIMATION);
}

function gotoNext() { animateTo(1); }
function gotoPrev() { animateTo(-1); }

function jumpToStart() {
  if (isTransitioning || currentIndex === 0) return;
  currentIndex = 0;
  resetZoom();
  renderCurrent();
  hideUI();
}

// ===== ZOOM AND PAN STATE =====
let scale = 1;
let panX = 0, panY = 0;

function isZoomed() { return scale > ZOOM.ZOOM_THRESHOLD; }

function resetZoom() {
  scale = 1;
  panX = 0;
  panY = 0;
  applyTransform();
}

function clampPan() {
  if (!isZoomed()) {
    panX = 0;
    panY = 0;
    return;
  }
  const { maxPanX, maxPanY } = getPanLimits(renderedWidth, renderedHeight, scale, window.innerWidth, window.innerHeight);
  panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
  panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
}

function applyTransform() {
  if (isZoomed()) {
    imgTop.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  } else {
    imgTop.style.transform = 'translate(0px, 0px) scale(1)';
  }
}

// ===== GESTURE HANDLING =====
let pointers = [];
let initialPinchDist = 0;
let initialScale = 1;
let initialPinchCenter = { x: 0, y: 0 };
let initialPinchPan = { x: 0, y: 0 };
let startX = 0, startY = 0;
let lastPanX = 0, lastPanY = 0;
let startTime = 0;
let swipeOffsetPrepared = 0; // 1 for next, -1 for prev

mangaContainer.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return; // Ignore button clicks
  e.preventDefault();
  pointers.push({ id: e.pointerId, x: e.clientX, y: e.clientY });

  if (pointers.length === 2) {
    initialPinchDist = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
    initialScale = scale;
    initialPinchCenter = {
      x: (pointers[0].x + pointers[1].x) / 2 - window.innerWidth / 2,
      y: (pointers[0].y + pointers[1].y) / 2 - window.innerHeight / 2
    };
    initialPinchPan = { x: panX, y: panY };
  } else if (pointers.length === 1) {
    startX = e.clientX;
    startY = e.clientY;
    lastPanX = panX;
    lastPanY = panY;
    startTime = Date.now();
    layerTop.style.transition = 'none';
    layerBottom.style.transition = 'none';
    swipeOffsetPrepared = 0;
  }
});

mangaContainer.addEventListener('pointermove', async (e) => {
  e.preventDefault();
  const idx = pointers.findIndex(p => p.id === e.pointerId);
  if (idx !== -1) {
    pointers[idx].x = e.clientX;
    pointers[idx].y = e.clientY;
  }

  if (pointers.length === 2) {
    const dist = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
    scale = initialScale * (dist / initialPinchDist);
    scale = Math.max(ZOOM.MIN, Math.min(scale, ZOOM.MAX));

    const currentCenter = {
      x: (pointers[0].x + pointers[1].x) / 2 - window.innerWidth / 2,
      y: (pointers[0].y + pointers[1].y) / 2 - window.innerHeight / 2
    };
    const scaleRatio = scale / initialScale;
    panX = currentCenter.x - (initialPinchCenter.x - initialPinchPan.x) * scaleRatio;
    panY = currentCenter.y - (initialPinchCenter.y - initialPinchPan.y) * scaleRatio;

    clampPan();
    applyTransform();
  } else if (pointers.length === 1 && !isTransitioning) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (isZoomed()) {
      panX = lastPanX + dx;
      panY = lastPanY + dy;
      clampPan();
      applyTransform();
    } else {
      // Swiping
      if (Math.abs(dx) > GESTURES.SWIPE_DEADZONE) {
        const offset = dx > 0 ? 1 : -1; // dx>0 (drag right) = Next, dx<0 (drag left) = Prev
        if (swipeOffsetPrepared !== offset) {
          const ready = await prepareAdjacentImage(offset);
          if (ready) {
            swipeOffsetPrepared = offset;
            // Position bottom layer for the swipe
            const bottomStartX = offset > 0 ? -window.innerWidth : window.innerWidth;
            layerBottom.style.transition = 'none';
            layerBottom.style.transform = `translateX(${bottomStartX}px)`;
          } else {
            swipeOffsetPrepared = 0; // Hit boundary
          }
        }

        if (swipeOffsetPrepared !== 0) {
          const bottomStartX = swipeOffsetPrepared > 0 ? -window.innerWidth : window.innerWidth;
          layerTop.style.transform = `translateX(${dx}px)`;
          layerBottom.style.transform = `translateX(${bottomStartX + dx}px)`;
        }
      }
    }
  }
});

function handlePointerUp(e) {
  const idx = pointers.findIndex(p => p.id === e.pointerId);
  if (idx !== -1) pointers.splice(idx, 1);

  if (pointers.length === 1) {
    startX = pointers[0].x;
    startY = pointers[0].y;
    lastPanX = panX;
    lastPanY = panY;
  }

  if (pointers.length === 0 && !isTransitioning) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const duration = Date.now() - startTime;

    if (isZoomed()) {
      // Panning ends
    } else {
      // Swiping logic
      if (Math.abs(dx) > GESTURES.SWIPE_COMMIT && swipeOffsetPrepared !== 0) {
        // Commit swipe
        animateTo(swipeOffsetPrepared);
      } else if (Math.abs(dx) > GESTURES.SWIPE_DEADZONE) {
        // Revert swipe
        layerTop.style.transition = `transform ${TIMING.SWIPE_ANIMATION}ms ${EASING.SWIPE}`;
        layerBottom.style.transition = `transform ${TIMING.SWIPE_ANIMATION}ms ${EASING.SWIPE}`;
        layerTop.style.transform = 'translateX(0)';
        layerBottom.style.transform = `translateX(${swipeOffsetPrepared > 0 ? window.innerWidth : -window.innerWidth}px)`;
        setTimeout(() => {
          layerTop.style.transition = 'none';
          layerBottom.style.transition = 'none';
        }, TIMING.SWIPE_ANIMATION);
      } else if (Math.abs(dx) <= GESTURES.TAP_THRESHOLD && Math.abs(dy) <= GESTURES.TAP_THRESHOLD && duration < GESTURES.TAP_DURATION) {
        // Tap detected
        handleTap(e.clientX, e.clientY);
      }
    }
    swipeOffsetPrepared = 0;
  }
}

mangaContainer.addEventListener('pointerup', handlePointerUp);
mangaContainer.addEventListener('pointercancel', handlePointerUp);

// ===== MOUSE WHEEL ZOOM =====
mangaContainer.addEventListener('wheel', (e) => {
  e.preventDefault();
  const zoomAmount = -e.deltaY * ZOOM.THRESHOLD;
  const newScale = Math.max(ZOOM.MIN, Math.min(scale + zoomAmount, ZOOM.MAX));
  const mouseX = e.clientX - window.innerWidth / 2;
  const mouseY = e.clientY - window.innerHeight / 2;
  panX = mouseX - (mouseX - panX) * (newScale / scale);
  panY = mouseY - (mouseY - panY) * (newScale / scale);
  scale = newScale;
  clampPan();
  applyTransform();
}, { passive: false });

// ===== TAP ZONES LOGIC =====
function handleTap(x, y) {
  const w = window.innerWidth;
  const h = window.innerHeight;

  if (y < h * UI_ZONES.TOP_HEIGHT) {
    flashElement('zone-top');
  } else if (y > h * (1 - UI_ZONES.BOTTOM_HEIGHT)) {
    flashElement('zone-bottom');
  } else {
    if (x < w * UI_ZONES.LEFT_THIRD) {
      flashElement('zone-left');
      gotoNext();
    } else if (x > w * UI_ZONES.RIGHT_THIRD) {
      flashElement('zone-right');
      gotoPrev();
    }
  }
}

// ===== BUTTON LISTENERS =====
btnFullscreen.addEventListener('pointerdown', (e) => e.stopPropagation());
btnFullscreen.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => { });
  } else {
    document.exitFullscreen().catch(() => { });
  }
});

btnRewind.addEventListener('pointerdown', (e) => e.stopPropagation());
btnRewind.addEventListener('click', jumpToStart);

document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) {
    iconFsEnter.classList.add('hidden');
    iconFsExit.classList.remove('hidden');
  } else {
    iconFsEnter.classList.remove('hidden');
    iconFsExit.classList.add('hidden');
  }
  setTimeout(updateContainerSizes, TIMING.FS_CHANGE_DELAY);
});

// ===== KEYBOARD CONTROLS =====
document.addEventListener('keydown', (e) => {
  if (isZoomed()) {
    if (e.key === 'ArrowLeft') panX += PAN_AMOUNT;
    else if (e.key === 'ArrowRight') panX -= PAN_AMOUNT;
    else if (e.key === 'ArrowUp') panY += PAN_AMOUNT;
    else if (e.key === 'ArrowDown') panY -= PAN_AMOUNT;
    clampPan();
    applyTransform();
  } else {
    if (e.key === 'ArrowLeft') gotoNext();
    else if (e.key === 'ArrowRight') gotoPrev();
  }
});

// ===== INITIALIZATION =====
updateContainerSizes();
showUI(); // Initial display of UI
renderCurrent(true);

// Hide onboarding if not first image
if (currentIndex !== 0) {
  onboardingAnim.style.display = 'none';
}
