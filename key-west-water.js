// The source is the original Key West clip. The vector water layer supplies
// the coastline, so transport, buildings, map text and land stay on top.
const waterImage = 'in-a-pinch-key-west-water';
const tileSize = 256;

export function attachKeyWestWater(gl, map) {
  const video = document.querySelector('.ocean-footage video');
  if (!gl || !video || typeof gl.addImage !== 'function' || typeof gl.hasImage !== 'function') return () => {};
  const poster = new Image();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = tileSize;
  const context = canvas.getContext('2d', {willReadFrequently:true});
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedData = window.matchMedia('(prefers-reduced-data: reduce)');
  const connection = window.navigator?.connection;
  let timer, disposed = false, failed = !context, installed = false;
  let previousTime = -1, paintingPoster = false;

  function surface(value) {
    if (document.body.dataset.waterSurface === value) return;
    document.body.dataset.waterSurface = value;
    document.dispatchEvent(new CustomEvent('keywestsurfacechange'));
  }
  function eligible() {
    return !disposed && document.body.dataset.city === 'key-west' && document.body.dataset.mapRenderer === 'vector';
  }
  function moving() {
    return !motion.matches && !reducedData.matches && !connection?.saveData && !document.hidden &&
      !video.paused && !video.hidden && video.readyState >= 2;
  }
  function clearPattern() {
    if (installed && gl.getLayer('water')) gl.setPaintProperty('water', 'fill-pattern', undefined);
    installed = false;
    previousTime = -1;
    paintingPoster = false;
  }
  function paint(image) {
    // Mirror a square crop at its edges to avoid sharp tile seams. This one
    // texture is reused by the renderer across all visible water polygons.
    const w = image.videoWidth || image.naturalWidth;
    const h = image.videoHeight || image.naturalHeight;
    const side = Math.min(w, h), half = tileSize / 2;
    if (!side) return false;
    const sx = (w - side) / 2, sy = (h - side) / 2;
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        context.setTransform(x ? -1 : 1, 0, 0, y ? -1 : 1, x ? tileSize : 0, y ? tileSize : 0);
        context.drawImage(image, sx, sy, side, side, 0, 0, half, half);
      }
    }
    const data = context.getImageData(0, 0, tileSize, tileSize);
    if (gl.hasImage(waterImage)) gl.updateImage(waterImage, data);
    else gl.addImage(waterImage, data, {pixelRatio:1});
    if (!installed || gl.getPaintProperty('water', 'fill-pattern') !== waterImage) {
      gl.setPaintProperty('water', 'fill-pattern', waterImage);
    }
    installed = true;
    return true;
  }
  function sync() {
    clearTimeout(timer);
    if (!eligible()) {
      clearPattern();
      if (!disposed && document.body.dataset.city !== 'key-west') surface('none');
      return;
    }
    if (failed) { surface('coastline'); return; }
    if (!gl.getLayer('water')) return;
    if (!poster.getAttribute('src')) poster.src = video.poster;
    const animate = moving();
    const image = animate ? video : poster.complete && poster.naturalWidth ? poster : null;
    if (image && (!installed || !gl.hasImage(waterImage) || (animate ? paintingPoster || video.currentTime !== previousTime : !paintingPoster))) {
      try {
        if (paint(image)) {
          previousTime = video.currentTime;
          paintingPoster = !animate;
          surface('vector');
        }
      } catch {
        // Some file:// browsers restrict drawing local video into a canvas.
        // The geographic image/video overlay uses ordinary DOM media instead.
        failed = true;
        clearPattern();
        surface('coastline');
        return;
      }
    }
    if (animate) timer = setTimeout(sync, 100);
  }
  function reset() { installed = false; sync(); }
  const docEvents = ['visibilitychange','areathemechange','citychange','mapstylechange','oceanplaybackchange'];
  const videoEvents = ['playing','pause','loadeddata','emptied'];
  for (const type of docEvents) document.addEventListener(type, sync);
  for (const type of videoEvents) video.addEventListener(type, sync);
  poster.addEventListener('load', sync);
  poster.addEventListener('error', sync);
  motion.addEventListener('change', sync);
  reducedData.addEventListener('change', sync);
  connection?.addEventListener?.('change', sync);
  gl.on('style.load', reset);
  sync();
  return () => {
    disposed = true;
    clearTimeout(timer);
    for (const type of docEvents) document.removeEventListener(type, sync);
    for (const type of videoEvents) video.removeEventListener(type, sync);
    poster.removeEventListener('load', sync);
    poster.removeEventListener('error', sync);
    motion.removeEventListener('change', sync);
    reducedData.removeEventListener('change', sync);
    connection?.removeEventListener?.('change', sync);
    gl.off('style.load', reset);
    if (document.body.dataset.city === 'key-west') surface('coastline');
  };
}
