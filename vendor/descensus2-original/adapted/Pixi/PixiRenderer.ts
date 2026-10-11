const widthUnits = 16;
const heightUnits = 28;
const pixelsPerUnit = 64;
const width = widthUnits * pixelsPerUnit;
const height = heightUnits * pixelsPerUnit;

const rendererOptions = { transparent: false, backgroundColor: 0x000000 };
const renderer = new PIXI.WebGLRenderer(width, height, rendererOptions);

const view = renderer.view;
view.id = 'viewport';
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
  const pixiRatio = renderer.width / renderer.height;

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