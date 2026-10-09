// SPDX-License-Identifier: GPL-3.0-only
(() => {
  'use strict';
  const session = new URLSearchParams(location.search).get('session') || '';
  let disposed = false;
  const send = (type, extra = {}) => {
    if (!disposed && window.parent !== window)
      window.parent.postMessage({ source: 'playgarden-coil', session, type, ...extra }, location.origin);
  };
  const onSnapshot = (event) => send('snapshot', { state: event.detail });
  const onStatus = (event) => send('status', { message: event.detail });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    Coil.dispose();
    window.removeEventListener('message', receive);
    window.removeEventListener('coil-snapshot', onSnapshot);
    window.removeEventListener('coil-status', onStatus);
    window.removeEventListener('pagehide', pageHidden);
  };
  const pageHidden = (event) => { if (!event.persisted) dispose(); };
  const receive = (event) => {
    if (disposed || !session || event.origin !== location.origin || event.source !== window.parent ||
      event.data?.source !== 'playgarden-host' || event.data.session !== session) return;
    if (event.data.type === 'pause') Coil.setPaused(!!event.data.paused);
    else if (event.data.type === 'dispose') dispose();
    else if (event.data.type === 'hint') send('status', { message: '快速画一圈并穿过自己的光迹，圈住蓝球。快超时的蓝球会变黄；红色叉号是炸弹。连续捕获可提高倍率，最多 ×4。' });
  };
  window.addEventListener('message', receive);
  window.addEventListener('coil-snapshot', onSnapshot);
  window.addEventListener('coil-status', onStatus);
  window.addEventListener('pagehide', pageHidden);
  try {
    // Constructors and prototypes have all been defined by the preceding defer script.
    Coil.initialize();
    send('ready', { revision: 'coil-ea6fd3af-playgarden-1', endless: true });
  } catch (error) {
    document.querySelector('#feedback').textContent = '游戏载入失败，请使用上方“重来”。';
    send('error', { message: String(error?.message || error) });
    dispose();
  }
})();
