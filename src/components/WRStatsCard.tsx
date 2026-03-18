import React, { useState } from 'react';
import { StaticImageGenerator } from './StaticImageGenerator';

interface WRStatsCardProps {
  player: any;
}

export const WRStatsCard: React.FC<WRStatsCardProps> = ({ player }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  return (
    <div className="w-64 bg-zinc-900 rounded-xl border border-zinc-700 p-4 shadow-xl">
      <StaticImageGenerator team={player.team === 'A' ? 'dolphins' : 'niners'} onImageGenerated={setImageUrl} />
      <div className="w-full aspect-square bg-zinc-800 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
        {imageUrl && <img src={imageUrl} alt={player.name} className="w-full h-full object-contain" />}
      </div>
      <h2 className="text-xl font-bold text-white mb-2">{player.name}</h2>
      <p className="text-zinc-400 mb-4">{player.role}</p>
      <div className="grid grid-cols-2 gap-2 text-sm text-zinc-300">
        <div>SPD: {player.stats.speed.toFixed(1)}</div>
        <div>STR: {player.stats.strength.toFixed(1)}</div>
        <div>CAT: {player.stats.catching.toFixed(1)}</div>
        <div>TAK: {player.stats.tackle.toFixed(1)}</div>
      </div>
    </div>
  );
};
