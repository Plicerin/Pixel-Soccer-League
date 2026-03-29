import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PLAYER_IDLE_PATTERNS, PLAYER_PATTERNS, TEAM_PALETTES, buildPlayerFrame } from '../gameEngine';

const FrameViewer: React.FC = () => {
    const containerRefs = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        const renderers: THREE.WebGLRenderer[] = [];
        const allPatterns = [...PLAYER_IDLE_PATTERNS, ...PLAYER_PATTERNS];

        allPatterns.forEach((pattern, index) => {
            const views = [
                { ref: containerRefs.current[index * 2], cameraPos: new THREE.Vector3(0, 1.2, 3), label: 'Front' },
                { ref: containerRefs.current[index * 2 + 1], cameraPos: new THREE.Vector3(3, 1.2, 0), label: 'Side' }
            ];

            views.forEach(view => {
                if (!view.ref) return;

                const scene = new THREE.Scene();
                scene.background = new THREE.Color(0xeeeeee);
                
                const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
                scene.add(ambientLight);
                
                const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
                directionalLight.position.set(1, 1, 1);
                scene.add(directionalLight);

                const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
                camera.position.copy(view.cameraPos);
                camera.lookAt(0, 0.8, 0);

                const palette = TEAM_PALETTES.teamA;
                const frame = buildPlayerFrame(pattern, palette);
                scene.add(frame);

                const renderer = new THREE.WebGLRenderer({ antialias: true });
                renderer.setSize(150, 150);
                view.ref.appendChild(renderer.domElement);
                renderer.render(scene, camera);
                
                renderers.push(renderer);
            });
        });

        return () => {
            renderers.forEach(r => r.dispose());
        };
    }, []);

    return (
        <div className="p-4 grid grid-cols-2 gap-8">
            {[...PLAYER_IDLE_PATTERNS, ...PLAYER_PATTERNS].map((_, index) => (
                <div key={index} className="flex flex-col items-center border border-zinc-700 p-4 rounded-lg bg-zinc-900">
                    <p className="text-lg font-bold mb-4 text-white">{index === 0 ? 'Idle' : `Run Frame ${index}`}</p>
                    <div className="flex gap-8">
                        <div className="flex flex-col items-center">
                            <div ref={el => { containerRefs.current[index * 2] = el; }} className="w-[150px] h-[150px]" />
                            <p className="text-sm mt-2 text-zinc-300">Front</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <div ref={el => { containerRefs.current[index * 2 + 1] = el; }} className="w-[150px] h-[150px]" />
                            <p className="text-sm mt-2 text-zinc-300">Side</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default FrameViewer;
