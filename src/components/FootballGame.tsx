import React, { useEffect, useRef, useState } from 'react';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  FIELD_COLOR, 
  LINE_COLOR, 
  ENDZONE_COLOR, 
  PLAYER_SIZE, 
  PLAYER_SPEED, 
  DEFENDER_SPEED,
  YARD_LINE_SPACING,
  COLORS
} from '../constants';
import { Entity, GameState } from '../types';

const FootballGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState | 'GAME_OVER'>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  const playerRef = useRef<Entity>({
    id: 'player',
    x: 100,
    y: CANVAS_HEIGHT / 2,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    color: COLORS.PLAYER,
    type: 'player',
    speed: PLAYER_SPEED,
    vx: 0,
    vy: 0,
  });

  const defendersRef = useRef<Entity[]>([]);
  const teammatesRef = useRef<Entity[]>([]);
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  const initGame = () => {
    playerRef.current = {
      ...playerRef.current,
      x: 100,
      y: CANVAS_HEIGHT / 2,
    };

    const defenders: Entity[] = [];
    for (let i = 0; i < 5; i++) {
      defenders.push({
        id: `defender-${i}`,
        x: 400 + Math.random() * 300,
        y: Math.random() * (CANVAS_HEIGHT - PLAYER_SIZE),
        width: PLAYER_SIZE,
        height: PLAYER_SIZE,
        color: COLORS.DEFENDER,
        type: 'defender',
        speed: DEFENDER_SPEED + Math.random() * 0.5,
        vx: 0,
        vy: 0,
      });
    }
    defendersRef.current = defenders;

    const teammates: Entity[] = [];
    for (let i = 0; i < 3; i++) {
      teammates.push({
        id: `teammate-${i}`,
        x: 150 + Math.random() * 100,
        y: Math.random() * (CANVAS_HEIGHT - PLAYER_SIZE),
        width: PLAYER_SIZE,
        height: PLAYER_SIZE,
        color: COLORS.TEAMMATE,
        type: 'teammate',
        speed: PLAYER_SPEED * 0.8,
        vx: 0,
        vy: 0,
      });
    }
    teammatesRef.current = teammates;
  };

  // Handler for ending the game (full time or user action)
  const handleGameOver = () => {
    setGameState('GAME_OVER');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = true;
      if (gameState === 'START' || gameState === 'TOUCHDOWN') {
        if (e.key === 'Enter' || e.key === ' ') {
          initGame();
          setGameState('PLAYING');
        }
      } else if (gameState === 'GAME_OVER') {
        if (e.key === 'Enter' || e.key === ' ') {
          setGameState('START');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const drawPlayer = (entity: Entity) => {
      ctx.fillStyle = entity.color;
      
      // Simple pixelated character drawing
      const s = entity.width / 8;
      
      // Head
      ctx.fillRect(entity.x + 2*s, entity.y, 4*s, 2*s);
      // Body
      ctx.fillRect(entity.x + s, entity.y + 2*s, 6*s, 4*s);
      // Arms
      ctx.fillRect(entity.x, entity.y + 2*s, s, 3*s);
      ctx.fillRect(entity.x + 7*s, entity.y + 2*s, s, 3*s);
      // Legs
      ctx.fillRect(entity.x + s, entity.y + 6*s, 2*s, 2*s);
      ctx.fillRect(entity.x + 5*s, entity.y + 6*s, 2*s, 2*s);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(entity.x, entity.y + entity.height, entity.width, 4);
    };

    const drawField = () => {
      // Grass
      ctx.fillStyle = FIELD_COLOR;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Endzone
      ctx.fillStyle = ENDZONE_COLOR;
      ctx.fillRect(0, 0, 80, CANVAS_HEIGHT);
      ctx.fillRect(CANVAS_WIDTH - 80, 0, 80, CANVAS_HEIGHT);

      // Yard lines
      ctx.strokeStyle = LINE_COLOR;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      
      for (let x = 80; x <= CANVAS_WIDTH - 80; x += YARD_LINE_SPACING) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();

        // Numbers removed
      }
      ctx.setLineDash([]);

      // Goalposts (left)
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(20, CANVAS_HEIGHT / 2 - 40);
      ctx.lineTo(20, CANVAS_HEIGHT / 2 + 40);
      ctx.moveTo(20, CANVAS_HEIGHT / 2);
      ctx.lineTo(5, CANVAS_HEIGHT / 2);
      ctx.stroke();
    };

    const update = () => {
      if (gameState !== 'PLAYING') return;

      const player = playerRef.current;
      // Player movement
      player.vx = 0;
      player.vy = 0;
      if (keysPressed.current['ArrowUp'] || keysPressed.current['w']) player.vy = -player.speed;
      if (keysPressed.current['ArrowDown'] || keysPressed.current['s']) player.vy = player.speed;
      if (keysPressed.current['ArrowLeft'] || keysPressed.current['a']) player.vx = -player.speed;
      if (keysPressed.current['ArrowRight'] || keysPressed.current['d']) player.vx = player.speed;

      player.x += player.vx;
      player.y += player.vy;

      // Boundaries
      player.x = Math.max(0, Math.min(CANVAS_WIDTH - player.width, player.x));
      player.y = Math.max(0, Math.min(CANVAS_HEIGHT - player.height, player.y));

      // Update teammates (just move forward slightly)
      teammatesRef.current.forEach(tm => {
        tm.x += tm.speed * 0.2;
        tm.y += (Math.random() - 0.5) * 2;
      });

      // Check for touchdown
      if (player.x > CANVAS_WIDTH - 80) {
        setScore(s => {
          const newScore = s + 7;
          if (newScore > highScore) setHighScore(newScore);
          return newScore;
        });
        setGameState('TOUCHDOWN');
        setTimeout(() => handleGameOver(), 2000);
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawField();
      
      teammatesRef.current.forEach(drawPlayer);
      drawPlayer(playerRef.current);

      if (gameState === 'START') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#ffffff';
        ctx.font = '40px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PIXEL SOCCER LEAGUE', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
        ctx.font = '20px monospace';

        ctx.fillText('USE ARROWS OR WASD TO MOVE', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
      } else if (gameState === 'TOUCHDOWN') {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#ffff00';
        ctx.font = '60px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('TOUCHDOWN!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px monospace';
        ctx.fillText('PRESS SPACE FOR NEXT DRIVE', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
      }
      if (gameState === 'GAME_OVER') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#ff4444';
        ctx.font = '72px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      }
    };

    const loop = () => {
      update();
      render();
      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameState, highScore]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 text-white font-mono p-4">
      <div className="mb-6 text-center">
        <h1 className="text-4xl font-bold tracking-tighter mb-2 italic">PIXEL SOCCER LEAGUE</h1>
        <div className="flex gap-8 justify-center text-xl">
          <div className="flex flex-col">
            <span className="text-xs opacity-50 uppercase">Score</span>
            <span className="text-emerald-400">{score.toString().padStart(3, '0')}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs opacity-50 uppercase">High Score</span>
            <span className="text-amber-400">{highScore.toString().padStart(3, '0')}</span>
          </div>
        </div>
      </div>

      <div className="relative border-4 border-zinc-700 rounded-lg overflow-hidden shadow-2xl">
        <canvas 
          ref={canvasRef} 
          width={CANVAS_WIDTH} 
          height={CANVAS_HEIGHT}
          className="block bg-emerald-800"
        />
        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 z-20">
            <div className="text-6xl font-extrabold text-red-400 mb-8 animate-pulse drop-shadow-lg">GAME OVER</div>
            <button
              className="px-8 py-4 text-2xl font-bold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg transition"
              onClick={() => setGameState('START')}
            >
              Main Menu / Start New Game
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-8 max-w-2xl w-full">
        <div className="p-4 border border-zinc-800 rounded-xl bg-zinc-800/50">
          <h3 className="text-sm font-bold uppercase mb-2 text-zinc-400">Controls</h3>
          <ul className="text-sm space-y-1">
            <li><span className="text-emerald-400">ARROWS / WASD</span> - Move Player</li>
            <li><span className="text-emerald-400">SPACE / ENTER</span> - Start / Restart</li>
          </ul>
        </div>
        <div className="p-4 border border-zinc-800 rounded-xl bg-zinc-800/50">
          <h3 className="text-sm font-bold uppercase mb-2 text-zinc-400">Objective</h3>
          <p className="text-sm leading-relaxed">
            Reach the right endzone for a touchdown!
          </p>
        </div>
      </div>
    </div>
  );
};

export default FootballGame;
