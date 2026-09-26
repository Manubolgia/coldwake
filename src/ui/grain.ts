// Film grain for the scenes: a tile of noise drawn once at start-up and used
// as a CSS background, so it costs nothing per frame.

export function installGrain(): void {
  try {
    const c = document.createElement('canvas');
    c.width = 180;
    c.height = 180;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(c.width, c.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    document.documentElement.style.setProperty('--grain', `url(${c.toDataURL('image/png')})`);
  } catch {
    /* no canvas: no grain */
  }
}
