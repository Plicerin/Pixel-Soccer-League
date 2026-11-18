import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import CrashScreen from './components/CrashScreen';
import './index.css';
import { queryKeeperKickStats } from './telemetry/keeper-kicks';

// Embedded in a page (itch.io), arrow keys, Space and paging keys scroll the
// host page around the game while player 2 moves or anyone passes. The game's
// own listeners still see the event; only the browser default is dropped.
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'PageUp', 'PageDown', 'Home', 'End']);
window.addEventListener('keydown', (e) => {
  if (!SCROLL_KEYS.has(e.code)) return;
  const target = e.target as HTMLElement | null;
  const tag = target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
  // Space on a focused button is its click, not a scroll.
  if (tag === 'BUTTON' && e.code === 'Space') return;
  e.preventDefault();
}, { capture: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CrashScreen>
      <App />
    </CrashScreen>
  </StrictMode>,
);

// Expose keeper stats query to console
(window as any).getKeeperKickStats = async () => {
  const stats = await queryKeeperKickStats();
  console.log('=== Keeper Kick Statistics ===');
  console.log('Session:', stats?.sessionId);
  console.log('Total Kicks:', stats?.totalKicks);
  console.log('By Style:', stats?.byStyle);
  console.log('By Team:', stats?.byTeam);
  return stats;
};
