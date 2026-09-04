import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// A new version never interrupts a run: it asks, and only on the next launch.
const updateSW = registerSW({
  onNeedRefresh() {
    const banner = document.createElement('button');
    banner.className = 'cmd primary';
    banner.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;z-index:99;background:var(--void);max-width:520px;margin:0 auto;';
    banner.textContent = 'NEW VERSION AVAILABLE — TAP TO UPDATE';
    banner.onclick = () => void updateSW(true);
    document.body.appendChild(banner);
  },
});
