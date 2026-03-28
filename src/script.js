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
const blobCacheLow = new Map();
const blobCacheHigh = new Map();
const decodedCacheLow = new Map();
const decodedCacheHigh = new Map();
const loadingPromisesLow = new Map();
const loadingPromisesHigh = new Map();
const imagePool = [];

// ===== FETCH QUEUE SYSTEM =====
const fetchQueueLow = [];
const fetchQueueHigh = [];
let activeFetches = 0;
const MAX_CONCURRENT_FETCHES = 2;

function getImagePath(index, type) {
  return `${type}-${String(index).padStart(3, '0')}.avif`;
}

async function doFetch(index, priority, type) {
  const blobCache = type === 'low' ? blobCacheLow : blobCacheHigh;
  try {
    const res = await fetch(getImagePath(index, type), { priority });
    if (!res.ok) {
      if (res.status === 404 && type === 'low') maxFoundIndex = Math.min(maxFoundIndex, index - 1);
      return;
    }
    const blob = await res.blob();
    blobCache.set(index, URL.createObjectURL(blob));
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

async function processFetchQueue() {
  while (activeFetches < MAX_CONCURRENT_FETCHES) {
    let item;
    let type;
    if (fetchQueueLow.length > 0) {
      item = fetchQueueLow.shift();
      type = 'low';
    } else if (fetchQueueHigh.length > 0) {
      item = fetchQueueHigh.shift();
      type = 'high';
    } else {
      break;
    }

    activeFetches++;
    const { index, priority, resolve } = item;
    const blobCache = type === 'low' ? blobCacheLow : blobCacheHigh;
    
    try {
      if (!blobCache.has(index)) {
        await doFetch(index, priority, type);
      }
    } finally {
      activeFetches--;
      resolve();
    }
  }
}

function queuedPreload(index, priority = "auto", type = "low") {
  const blobCache = type === 'low' ? blobCacheLow : blobCacheHigh;
  const loadingPromises = type === 'low' ? loadingPromisesLow : loadingPromisesHigh;
  const fetchQueue = type === 'low' ? fetchQueueLow : fetchQueueHigh;

  if (index > maxFoundIndex || blobCache.has(index)) return Promise.resolve();
  if (loadingPromises.has(index)) return loadingPromises.get(index);
  
  const promise = new Promise((resolve) => {
    const item = { index, priority, resolve };
    if (priority === "high") {
      fetchQueue.unshift(item); // prioritize within the same queue
    } else {
      fetchQueue.push(item);
    }
    processFetchQueue();
  });
  
  loadingPromises.set(index, promise);
  
  promise.finally(() => {
    if (loadingPromises.get(index) === promise) {
      loadingPromises.delete(index);
    }
    processFetchQueue();
  });
  
  return promise;
}

// Ensure critical images are loaded urgently
async function preloadCompressed(index, priority = "auto", type = "low") {
  return queuedPreload(index, priority, type);
}

async function getDecodedImage(index, type = "low") {
  if (index < 0 || index > maxFoundIndex) return null;
  const decodedCache = type === 'low' ? decodedCacheLow : decodedCacheHigh;
  if (decodedCache.has(index)) return decodedCache.get(index);

  const blobCache = type === 'low' ? blobCacheLow : blobCacheHigh;
  if (!blobCache.has(index)) {
    await queuedPreload(index, "high", type);
  }
  if (!blobCache.has(index)) return null;

  const img = imagePool.length > 0 ? imagePool.pop() : new Image();
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
  // 1. Prioritize current low
  await preloadCompressed(currentIndex, "high", "low");

  // 2. Prioritize immediate neighbors (Next, Prev) low
  if (currentIndex > 0) {
    const priority = [currentIndex + 1, currentIndex - 1];
    const neighborPromises = priority.map(idx => preloadCompressed(idx, "high", "low"));
    await Promise.all(neighborPromises);
  } else {
    await preloadCompressed(currentIndex + 1, "high", "low");
  }

  // Same for high resolution of current
  preloadCompressed(currentIndex, "auto", "high"); // queued via auto so it waits for all low

  // Clean up old compressed low
  for (const [idx, url] of blobCacheLow.entries()) {
    if (idx < currentIndex - CACHE.CLEANUP_BUFFER || idx > currentIndex + CACHE.MAX_READAHEAD_LOW + CACHE.CLEANUP_BUFFER) {
      URL.revokeObjectURL(url);
      blobCacheLow.delete(idx);
    }
  }
  // Clean up old compressed high
  for (const [idx, url] of blobCacheHigh.entries()) {
    if (idx < currentIndex - CACHE.CLEANUP_BUFFER || idx > currentIndex + CACHE.MAX_READAHEAD_HIGH + CACHE.CLEANUP_BUFFER) {
      URL.revokeObjectURL(url);
      blobCacheHigh.delete(idx);
    }
  }

  // Keep exactly current, prev, next decoded
  const needed = [currentIndex - 1, currentIndex, currentIndex + 1];
  for (const idx of needed) {
    if (idx >= 0 && idx <= maxFoundIndex) {
      getDecodedImage(idx, "low");
      // Pre-decode high in background too
      getDecodedImage(idx, "high");
    }
  }

  // Clean up old decoded low
  for (const [idx, img] of decodedCacheLow.entries()) {
    if (!needed.includes(idx)) {
      img.src = '';
      imagePool.push(img);
      decodedCacheLow.delete(idx);
    }
  }
  // Clean up old decoded high
  for (const [idx, img] of decodedCacheHigh.entries()) {
    if (!needed.includes(idx)) {
      img.src = '';
      imagePool.push(img);
      decodedCacheHigh.delete(idx);
    }
  }

  // Deep readahead
  setTimeout(() => {
    // Low goes first in priority
    for (let i = currentIndex + 2; i <= currentIndex + CACHE.MAX_READAHEAD_LOW; i++) {
      if (i <= maxFoundIndex) queuedPreload(i, "auto", "low");
    }
    // High waits for low queue automatically due to processFetchQueue logic
    for (let i = currentIndex + 1; i <= currentIndex + CACHE.MAX_READAHEAD_HIGH; i++) {
        if (i <= maxFoundIndex) queuedPreload(i, "auto", "high");
    }
  }, TIMING.DEEP_READAHEAD_DELAY);
}

// ===== DOM ELEMENTS =====
const layerTop = document.getElementById('layer-top');
const containerTop = document.getElementById('container-top');
const imgTopLow = document.getElementById('img-top-low');
const imgTopHigh = document.getElementById('img-top-high');

const containerBottom = document.getElementById('container-bottom');
const imgBottomLow = document.getElementById('img-bottom-low');
const imgBottomHigh = document.getElementById('img-bottom-high');

const btnFullscreen = document.getElementById('btn-fullscreen');
const btnMenu = document.getElementById('btn-menu');
const sideMenu = document.getElementById('side-menu');
const menuOverlay = document.getElementById('menu-overlay');
const btnCloseMenu = document.getElementById('btn-close-menu');
const chapterList = document.getElementById('chapter-list');
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
  containerTop.style.width = `${renderedWidth}px`;
  containerTop.style.height = `${renderedHeight}px`;
  containerBottom.style.width = `${renderedWidth}px`;
  containerBottom.style.height = `${renderedHeight}px`;
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
  btnMenu.classList.remove('opacity-0');
  btnMenu.classList.remove('pointer-events-none');
  btnMenu.classList.add('pointer-events-auto');
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
  btnMenu.classList.add('opacity-0');
  btnMenu.classList.remove('pointer-events-auto');
  btnMenu.classList.add('pointer-events-none');
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

async function transitionToHighWhenReady(index, lowImgEl, highImgEl) {
  const imgHigh = await getDecodedImage(index, "high");
  // Check if we are still on the same image
  if (lowImgEl.dataset.index !== String(index)) return;
  if (!imgHigh) return;

  highImgEl.src = imgHigh.src;
  
  // Wait a frame to ensure src applies before opacity transition
  requestAnimationFrame(() => {
    if (lowImgEl.dataset.index !== String(index)) return;
    highImgEl.style.transition = 'opacity 1s ease-in-out';
    highImgEl.style.opacity = '1';

    setTimeout(() => {
      if (lowImgEl.dataset.index !== String(index)) return;
      lowImgEl.style.display = 'none';
    }, 1000);
  });
}

// ===== DISPLAY LOGIC =====
async function renderCurrent() {
  updateCache();
  toggleLoading(true);

  let imgHigh = decodedCacheHigh.get(currentIndex);
  let imgLow = decodedCacheLow.get(currentIndex);

  if (!imgLow && !imgHigh) {
    imgLow = await getDecodedImage(currentIndex, "low");
  }
  if (!imgHigh) {
    imgHigh = decodedCacheHigh.get(currentIndex);
  }

  toggleLoading(false);

  if (!imgLow && !imgHigh) {
    return;
  }

  imgTopLow.dataset.index = currentIndex;
  imgTopHigh.style.transition = 'none';
  imgTopHigh.style.opacity = '0';
  imgTopLow.style.display = 'block';

  if (imgHigh) {
    imgTopHigh.src = imgHigh.src;
    imgTopHigh.style.opacity = '1';
    imgTopLow.style.display = 'none';
  } else {
    if (imgLow) imgTopLow.src = imgLow.src;
    transitionToHighWhenReady(currentIndex, imgTopLow, imgTopHigh);
  }

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

  let imgHigh = decodedCacheHigh.get(targetIdx);
  let imgLow = decodedCacheLow.get(targetIdx);

  if (!imgLow && !imgHigh) {
    toggleLoading(true);
    imgLow = await getDecodedImage(targetIdx, "low");
    toggleLoading(false);
  }

  if (!imgLow && !imgHigh) return false;

  imgBottomLow.dataset.index = targetIdx;
  imgBottomHigh.style.transition = 'none';
  imgBottomHigh.style.opacity = '0';
  imgBottomLow.style.display = 'block';

  if (imgHigh) {
    imgBottomHigh.src = imgHigh.src;
    imgBottomHigh.style.opacity = '1';
    imgBottomLow.style.display = 'none';
  } else {
    if (imgLow) imgBottomLow.src = imgLow.src;
    transitionToHighWhenReady(targetIdx, imgBottomLow, imgBottomHigh);
  }

  return true;
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
  // Next (offset +1): Swipe Right -> layerTop moves right (+100vw)
  // Prev (offset -1): Swipe Left -> layerTop moves left (-100vw)
  const dirX = offset > 0 ? window.innerWidth : -window.innerWidth;

  layerTop.style.transition = `transform ${TIMING.SWIPE_ANIMATION}ms ${EASING.SWIPE}`;
  layerTop.style.transform = `translateX(${dirX}px)`;

  setTimeout(() => {
    currentIndex = targetIdx;
    layerTop.style.transition = 'none';
    layerTop.style.transform = 'translateX(0)';
    resetZoom();
    renderCurrent();
    isTransitioning = false;
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

// ===== MENU LOGIC =====
let isMenuOpen = false;

function openMenu() {
  isMenuOpen = true;
  hideUI();
  sideMenu.classList.remove('-translate-x-full');
  menuOverlay.classList.remove('opacity-0', 'pointer-events-none');
  menuOverlay.classList.add('pointer-events-auto');
}

function closeMenu() {
  isMenuOpen = false;
  sideMenu.classList.add('-translate-x-full');
  menuOverlay.classList.remove('pointer-events-auto');
  menuOverlay.classList.add('opacity-0', 'pointer-events-none');
}

function jumpToPage(pageIndex) {
  if (isTransitioning || currentIndex === pageIndex) {
    if (isMenuOpen) closeMenu();
    return;
  }
  currentIndex = pageIndex;
  resetZoom();
  renderCurrent();
  closeMenu();
}

btnMenu.addEventListener('pointerdown', (e) => e.stopPropagation());
btnMenu.addEventListener('click', openMenu);
btnCloseMenu.addEventListener('pointerdown', (e) => e.stopPropagation());
btnCloseMenu.addEventListener('click', closeMenu);
menuOverlay.addEventListener('click', closeMenu);

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
    containerTop.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  } else {
    containerTop.style.transform = 'translate(0px, 0px) scale(1)';
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
  if (isMenuOpen) return;
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
    swipeOffsetPrepared = 0;
  }
});

mangaContainer.addEventListener('pointermove', async (e) => {
  if (e.pointerType === 'mouse' && pointers.length === 0) {
    showUI();
  }
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
          if (ready) swipeOffsetPrepared = offset;
          else swipeOffsetPrepared = 0; // Hit boundary
        }

        if (swipeOffsetPrepared !== 0) {
          layerTop.style.transform = `translateX(${dx}px)`;
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
        layerTop.style.transform = 'translateX(0)';
        setTimeout(() => layerTop.style.transition = 'none', TIMING.SWIPE_ANIMATION);
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
  if (isMenuOpen) return;
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
    } else {
      if (!isMenuOpen) showUI();
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
  if (isMenuOpen) {
    if (e.key === 'Escape') closeMenu();
    return;
  }
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
renderCurrent();

// Fetch chapters
fetch('./dist/index.json')
  .then(res => res.json())
  .then(chapters => {
    chapters.forEach(chapter => {
      const li = document.createElement('li');
      li.className = 'border-b border-white/5 last:border-0';
      const btn = document.createElement('button');
      btn.className = 'w-full text-left px-5 py-4 hover:bg-white/5 active:bg-white/10 transition-colors pointer-events-auto flex items-center justify-between text-white/90 hover:text-white';
      
      const titleSpan = document.createElement('span');
      titleSpan.textContent = chapter.name;
      titleSpan.className = 'font-medium truncate pr-4';
      
      const pgSpan = document.createElement('span');
      pgSpan.textContent = `p.${chapter.page}`;
      pgSpan.className = 'text-white/40 text-sm whitespace-nowrap';

      btn.appendChild(titleSpan);
      btn.appendChild(pgSpan);
      
      btn.addEventListener('click', () => jumpToPage(chapter.page));
      li.appendChild(btn);
      chapterList.appendChild(li);
    });
  })
  .catch(err => console.error('Failed to load chapters:', err));

// Hide onboarding if not first image
if (currentIndex !== 0) {
  onboardingAnim.style.display = 'none';
}
