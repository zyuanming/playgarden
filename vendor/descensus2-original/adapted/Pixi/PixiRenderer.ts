const widthUnits = 16;
const heightUnits = 28;
const pixelsPerUnit = 64;
const width = widthUnits * pixelsPerUnit;
const height = heightUnits * pixelsPerUnit;

// Match the initial displayed pixel density instead of drawing a 1024px-wide
// surface that the browser immediately downsamples to roughly 320–390px.
// Keep the original logical world/menu coordinates; only the backing pixels vary.
// Resolution stays fixed for this renderer's lifetime, so Pixi's root target and
// InteractionManager use the same value. Resize/orientation still resize CSS.
const playfield = document.getElementById('playfield');
const fit = Math.min(playfield.clientWidth / width, playfield.clientHeight / height);
const backingWidth = Math.min(width, Math.max(4, Math.ceil(width * fit * (window.devicePixelRatio || 1) / 4) * 4));
const resolution = backingWidth / width;
const rendererOptions = { transparent: false, backgroundColor: 0x000000, resolution };
const renderer = new PIXI.WebGLRenderer(width, height, rendererOptions);

const view = renderer.view;
view.id = 'viewport';
view.dataset.logicalWidth = String(width);
view.dataset.logicalHeight = String(height);
view.dataset.renderResolution = String(resolution);
view.style.display = 'none';
view.style.marginLeft = 'auto';
view.style.marginRight = 'auto';

document.getElementById('playfield').appendChild(view);
view.addEventListener('webglcontextlost', (event) => { event.preventDefault(); (window as any).descensusFailure('图形上下文中断，请重试。'); });

function resizeView() { resize(renderer); }
window.addEventListener('resize', () => { resizeView(); });
window.addEventListener('orientationchange', () => { resizeView(); });
resizeView();

function resize(renderer: PIXI.WebGLRenderer): void {
  const windowWidth = document.getElementById('playfield').clientWidth;
  const windowHeight = document.getElementById('playfield').clientHeight;

  const view = renderer.view;
  const windowRatio = windowWidth / windowHeight;
  const pixiRatio = width / height;

  if (windowRatio > pixiRatio) {
    // Screen is wider than the renderer
    view.style.width = Math.floor(windowHeight * pixiRatio) + 'px';
    view.style.height = windowHeight + 'px';
  } else {
    // Screen is narrower
    view.style.width = windowWidth + 'px';
    view.style.height = Math.floor(windowWidth / pixiRatio) + 'px';
  }
}

export default renderer;
