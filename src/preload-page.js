const { ipcRenderer } = require('electron');

function collect() {
  const found = new Set();
  for (const video of document.querySelectorAll('video')) {
    if (video.currentSrc) found.add(video.currentSrc);
    if (video.src) found.add(video.src);
    for (const source of video.querySelectorAll('source[src]')) found.add(source.src);
  }
  for (const media of document.querySelectorAll('source[src], audio[src], track[src], link[href][as="video"], link[href][as="audio"]')) found.add(media.src || media.href);
  for (const entry of performance.getEntriesByType('resource')) found.add(entry.name);
  ipcRenderer.send('media-found', [...found]);
}

new MutationObserver(collect).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
document.addEventListener('loadedmetadata', collect, true);
document.addEventListener('play', collect, true);
window.addEventListener('load', () => { collect(); setInterval(collect, 2500); });
ipcRenderer.on('collect-media', collect);
