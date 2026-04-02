import React, { useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Center } from '@react-three/drei';
import * as THREE from 'three';
import { ChevronLeft, ChevronRight, Download, Eraser } from 'lucide-react';
import { PLAYER_PATTERNS, TEAM_PALETTES, PlayerPalette } from '../gameEngine';

const VoxelPlayer: React.FC<{
    frameIndex: number;
    team: 'teamA' | 'teamB';
    isRotating: boolean;
    patterns: string[][];
    showGrid: boolean;
    onVoxelClick: (r: number, c: number) => void;
}> = ({ frameIndex, team, isRotating, patterns, showGrid, onVoxelClick }) => {
    const pattern = patterns[frameIndex];
    const palette = TEAM_PALETTES[team];
    const voxelSize = 0.1152;

    const boxGeo = useMemo(() => new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize * 4.2), []);
    const ghostMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, wireframe: true }), []);

    const voxels = useMemo(() => {
        const result: React.ReactNode[] = [];
        const rows = pattern.length;
        const cols = pattern[0].length;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const char = pattern[r][c];

                if (char === '0') {
                    if (showGrid) {
                        result.push(
                            <mesh
                                key={`ghost-${r}-${c}`}
                                geometry={boxGeo}
                                material={ghostMat}
                                position={[
                                    (c - cols / 2) * voxelSize,
                                    (rows / 2 - r) * voxelSize,
                                    0
                                ]}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onVoxelClick(r, c);
                                }}
                            />
                        );
                    }
                    continue;
                }

                let mat = palette.shirt;
                if (char === 'H') mat = palette.hair;
                else if (char === 'V') mat = palette.visor;
                else if (char === 'S') mat = palette.shirt;
                else if (char === 'P') mat = palette.pants;
                else if (char === '1') {
                    if (r < 2) mat = palette.hair;
                    else if (r === 2 && c > 10 && c < 15) mat = palette.visor;
                    else if (r > 9) mat = palette.pants;
                }

                result.push(
                    <mesh
                        key={`${r}-${c}`}
                        geometry={boxGeo}
                        material={mat}
                        position={[
                            (c - cols / 2) * voxelSize,
                            (rows / 2 - r) * voxelSize,
                            0
                        ]}
                        onClick={(e) => {
                            e.stopPropagation();
                            onVoxelClick(r, c);
                        }}
                    />
                );
            }
        }
        return result;
    }, [pattern, palette, boxGeo, ghostMat, showGrid, onVoxelClick]);

    const groupRef = React.useRef<THREE.Group>(null);
    useFrame((_, delta) => {
        if (groupRef.current && isRotating) {
            groupRef.current.rotation.y += delta * 0.5;
        }
    });

    return <group ref={groupRef}>{voxels}</group>;
};

const AnimationInspector: React.FC<{ onClose?: () => void; embedded?: boolean }> = ({ onClose, embedded }) => {
    const [patterns, setPatterns] = useState<string[][]>(PLAYER_PATTERNS);
    const [currentFrame, setCurrentFrame] = useState(0);
    const [team, setTeam] = useState<'teamA' | 'teamB'>('teamA');
    const [selectedChar, setSelectedChar] = useState<string>('S');
    const [isRotating, setIsRotating] = useState(true);
    const [isAnimating, setIsAnimating] = useState(true);
    const [showGrid, setShowGrid] = useState(true);

    useEffect(() => {
        if (!isAnimating) return;
        const interval = setInterval(() => {
            setCurrentFrame((prev) => (prev + 1) % patterns.length);
        }, 100);
        return () => clearInterval(interval);
    }, [isAnimating, patterns.length]);

    const handlePrevFrame = () => {
        setIsAnimating(false);
        setCurrentFrame((prev) => (prev - 1 + patterns.length) % patterns.length);
    };

    const handleNextFrame = () => {
        setIsAnimating(false);
        setCurrentFrame((prev) => (prev + 1) % patterns.length);
    };

    const handleAddFrame = () => {
        setIsAnimating(false);
        const newFrame = [...patterns[currentFrame]];
        const newPatterns = [...patterns];
        newPatterns.splice(currentFrame + 1, 0, newFrame);
        setPatterns(newPatterns);
        setCurrentFrame(currentFrame + 1);
    };

    const handleDeleteFrame = () => {
        if (patterns.length <= 1) return;
        setIsAnimating(false);
        const newPatterns = patterns.filter((_, i) => i !== currentFrame);
        setPatterns(newPatterns);
        setCurrentFrame(Math.max(0, currentFrame - 1));
    };

    const handleVoxelClick = (r: number, c: number) => {
        const newPatterns = [...patterns];
        const frame = [...newPatterns[currentFrame]];
        const row = frame[r].split('');
        row[c] = selectedChar;
        frame[r] = row.join('');
        newPatterns[currentFrame] = frame;
        setPatterns(newPatterns);
    };

    const exportPatterns = () => {
        console.log("EXPORTED PATTERNS:");
        console.log(JSON.stringify(patterns, null, 2));
        alert("Patterns exported to console! (F12 to view)");
    };

    const currentPalette = TEAM_PALETTES[team];

    return (
        <div className={embedded ? "bg-zinc-900 p-6 rounded-2xl border border-white/10 shadow-2xl flex flex-col gap-6 overflow-auto" : "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-900 p-6 rounded-2xl border border-white/10 shadow-2xl z-[100] flex flex-col gap-6 max-w-[90vw] max-h-[90vh] overflow-auto"}>
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <h3 className="text-white font-bold text-lg tracking-tight">Voxel Editor</h3>
                    <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
                        <button
                            onClick={() => setTeam('teamA')}
                            className={`px-3 py-1 text-[10px] rounded-md uppercase font-bold transition-all ${team === 'teamA' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'}`}
                        >
                            Team A
                        </button>
                        <button
                            onClick={() => setTeam('teamB')}
                            className={`px-3 py-1 text-[10px] rounded-md uppercase font-bold transition-all ${team === 'teamB' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'}`}
                        >
                            Team B
                        </button>
                    </div>
                </div>
                {!embedded && onClose && <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all">{'✕'}</button>}
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* 3D Viewport */}
                <div className="w-[400px] h-[400px] bg-zinc-200 rounded-2xl border border-white/5 overflow-hidden relative shadow-inner">
                    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                        <button
                            onClick={() => setIsRotating(!isRotating)}
                            className="px-3 py-2 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-white transition-all text-xs flex items-center gap-2 shadow-lg"
                        >
                            {isRotating ? '⏸ Rotation' : '▶ Rotation'}
                        </button>
                        <button
                            onClick={() => setIsAnimating(!isAnimating)}
                            className="px-3 py-2 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-white transition-all text-xs flex items-center gap-2 shadow-lg"
                        >
                            {isAnimating ? '⏸ Animation' : '▶ Animation'}
                        </button>
                        <button
                            onClick={() => setShowGrid(!showGrid)}
                            className={`px-3 py-2 rounded-lg ${showGrid ? 'bg-white text-black' : 'bg-black/70 text-white'} backdrop-blur-md border border-white/10 transition-all text-xs flex items-center gap-2 shadow-lg`}
                        >
                            {showGrid ? 'Hide Grid' : 'Show Grid'}
                        </button>
                    </div>

                    <Canvas camera={{ position: [4, 3, 4], fov: 40 }}>
                        <color attach="background" args={['#e5e7eb']} />
                        <ambientLight intensity={0.8} />
                        <pointLight position={[10, 10, 10]} intensity={1.2} />
                        <Center>
                            <VoxelPlayer
                                frameIndex={currentFrame}
                                team={team}
                                isRotating={isRotating}
                                patterns={patterns}
                                showGrid={showGrid}
                                onVoxelClick={handleVoxelClick}
                            />
                        </Center>
                        <OrbitControls makeDefault />
                    </Canvas>
                </div>

                {/* Controls Panel */}
                <div className="flex flex-col gap-6 min-w-[240px]">
                    {/* Brush Selector */}
                    <div className="space-y-3">
                        <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Brush Tool</label>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { char: 'H', label: 'Hair', color: (currentPalette.hair as any).color.getStyle() },
                                { char: 'V', label: 'Visor', color: (currentPalette.visor as any).color.getStyle() },
                                { char: 'S', label: 'Shirt', color: (currentPalette.shirt as any).color.getStyle() },
                                { char: 'P', label: 'Pants', color: (currentPalette.pants as any).color.getStyle() },
                                { char: '0', label: 'Eraser', color: 'transparent', icon: <Eraser size={14} /> },
                            ].map((brush) => (
                                <button
                                    key={brush.char}
                                    onClick={() => setSelectedChar(brush.char)}
                                    className={`flex items-center gap-3 p-2 rounded-xl border transition-all ${selectedChar === brush.char ? 'bg-white/10 border-white/40' : 'bg-black/20 border-white/5 hover:bg-black/40'}`}
                                >
                                    <div
                                        className="w-6 h-6 rounded-md border border-white/10 flex items-center justify-center overflow-hidden"
                                        style={{ backgroundColor: brush.color }}
                                    >
                                        {'icon' in brush ? brush.icon : null}
                                    </div>
                                    <span className={`text-xs font-medium ${selectedChar === brush.char ? 'text-white' : 'text-white/40'}`}>{brush.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-auto pt-6 border-t border-white/5 flex flex-col gap-3">
                        <button
                            onClick={exportPatterns}
                            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg"
                        >
                            <Download size={14} /> Export Patterns
                        </button>
                        <p className="text-[9px] text-white/30 text-center italic">Enable Grid to add voxels to empty space</p>
                    </div>
                </div>
            </div>

            {/* Timeline */}
            <div className="mt-4 p-4 bg-black/40 rounded-2xl border border-white/5 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrevFrame}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-white font-mono text-xs min-w-[80px] text-center">
                                Frame {currentFrame + 1} / {patterns.length}
                            </span>
                            <button
                                onClick={handleNextFrame}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                        <div className="h-4 w-px bg-white/10 mx-2" />
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleAddFrame}
                                className="px-3 py-1 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all text-[10px] font-bold uppercase tracking-tighter"
                            >
                                + Add Frame
                            </button>
                            <button
                                onClick={handleDeleteFrame}
                                className="px-3 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all text-[10px] font-bold uppercase tracking-tighter"
                            >
                                - Delete Frame
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {patterns.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => { setIsAnimating(false); setCurrentFrame(i); }}
                                className={`w-3 h-3 rounded-full transition-all ${i === currentFrame ? 'bg-white scale-125 shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'bg-white/10 hover:bg-white/30'}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnimationInspector;
