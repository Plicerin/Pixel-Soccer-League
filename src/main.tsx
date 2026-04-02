import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { queryKeeperKickStats } from './telemetry/keeper-kicks';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
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
