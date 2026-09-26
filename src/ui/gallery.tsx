// Development only: every illustration on one page. `npm run dev`, then open /coldwake/gallery.html.
import { createRoot } from 'react-dom/client';
import { ROOMS } from '../game/content/rooms';
import { Art } from './art/Art';
import './styles.css';

const params = new URLSearchParams(location.search);
const only = params.get('only')?.split(',');
const extra = ['title', 'stalker', 'crawler', 'changed', 'drone', 'mimic', 'hull', 'box', 'speaker', 'light', 'photo', 'vent', 'eye', 'door', 'fire', 'dark', 'breach', 'pipe', 'body', 'wall', 'survivor', 'spores', 'room', 'wire', 'log', 'truth', 'panic', 'scan', 'infection', 'alarm', 'end-pods', 'end-shuttle', 'end-beacon', 'end-jump', 'end-burn', 'end-lost'];
const all = [...Object.keys(ROOMS), ...extra].filter((k) => !only || only.includes(k));
const w = Number(params.get('w') ?? 300);
const h = Number(params.get('h') ?? 300);

createRoot(document.getElementById('root')!).render(
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 6, background: '#000' }}>
    {all.map((k) => (
      <figure key={k} style={{ margin: 0, width: w }}>
        <Art art={k} className="g" />
        <figcaption style={{ color: '#aaa', font: '11px monospace' }}>{k}</figcaption>
        <style>{`.g{width:${w}px;height:${h}px;display:block}`}</style>
      </figure>
    ))}
  </div>,
);
