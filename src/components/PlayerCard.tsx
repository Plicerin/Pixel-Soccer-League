import React, { useState } from 'react';
import { COLORS } from '../constants';
import { StaticImageGenerator } from './StaticImageGenerator';

interface PlayerCardProps {
  player: any;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  return (
    <div className="w-40 aspect-[3/4] bg-gradient-to-br from-zinc-800 to-zinc-950 rounded-xl border-2 border-white/20 p-3 flex flex-col justify-between shadow-lg relative overflow-hidden">
      <StaticImageGenerator team={player.team === 'A' ? 'dolphins' : 'niners'} onImageGenerated={setImageUrl} />
      <div className="absolute inset-0 flex items-center justify-center opacity-80">
        {imageUrl && <img src={imageUrl} alt={player.name} className="w-full h-full object-contain" />}
      </div>
      <div className="relative z-10 flex justify-between items-start gap-2">
        <div className="text-[10px] font-bold uppercase text-white bg-black/50 px-2 py-0.5 rounded truncate max-w-[50%]">{player.role}</div>
        <div className="text-[10px] font-bold text-white bg-black/50 px-2 py-0.5 rounded truncate max-w-[40%]">{player.team}</div>
      </div>
      <div className="relative z-10 text-center">
        <div className="text-xs font-black uppercase text-white tracking-tighter truncate">{player.name}</div>
      </div>
      <div className="relative z-10 grid grid-cols-2 gap-2 text-[8px] text-white/80 bg-black/40 p-2 rounded">
        <div>SPD: {player.stats.speed.toFixed(1)}</div>
        <div>STR: {player.stats.strength.toFixed(1)}</div>
        <div>CAT: {player.stats.catching.toFixed(1)}</div>
        <div>TAK: {player.stats.tackle.toFixed(1)}</div>
      </div>
    </div>
  );
};

export default PlayerCard;
