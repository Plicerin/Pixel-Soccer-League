import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PLAYER_IDLE_PATTERNS, PLAYER_PATTERNS, TEAM_PALETTES, buildPlayerFrame } from '../gameEngine';

/** Render a single pattern from a given camera angle into a data-URL image,
 *  reusing a single shared WebGL renderer so we never exceed the context limit. */
function renderFrameToDataURL(
    renderer: THREE.WebGLRenderer,
    pattern: string[],
    cameraPos: THREE.Vector3,
): string {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeeeeee);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(1, 1, 1);
    scene.add(dir);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.copy(cameraPos);
    camera.lookAt(0, 0.8, 0);

    const palette = TEAM_PALETTES.teamA;
    const frame = buildPlayerFrame(pattern, palette);
    scene.add(frame);

    renderer.render(scene, camera);
    return renderer.domElement.toDataURL();
}

const FrameViewer: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const containerRefs = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(150, 150);

        const allPatterns = [...PLAYER_IDLE_PATTERNS, ...PLAYER_PATTERNS];
        const frontCam = new THREE.Vector3(0, 1.2, 3);
        const sideCam = new THREE.Vector3(3, 1.2, 0);

        allPatterns.forEach((pattern, index) => {
            const slots = [
                { ref: containerRefs.current[index * 2], cam: frontCam },
                { ref: containerRefs.current[index * 2 + 1], cam: sideCam },
            ];
            slots.forEach(({ ref, cam }) => {
                if (!ref) return;
                ref.innerHTML = '';
                const dataURL = renderFrameToDataURL(renderer, pattern, cam);
                const img = document.createElement('img');
                img.src = dataURL;
                img.width = 150;
                img.height = 150;
                ref.appendChild(img);
            });
        });

        renderer.dispose();

        return () => {
            // Images are plain DOM elements — no GPU cleanup needed.
        };
    }, []);

    return (
        <div className="p-4 grid grid-cols-2 gap-8">
            {[...PLAYER_IDLE_PATTERNS, ...PLAYER_PATTERNS].map((_, index) => (
                <div key={index} className="flex flex-col items-center border border-zinc-700 p-4 rounded-lg bg-zinc-900">
                    <p className="text-lg font-bold mb-4 text-white">{index < PLAYER_IDLE_PATTERNS.length ? `Idle ${index + 1}` : `Run Frame ${index - PLAYER_IDLE_PATTERNS.length + 1}`}</p>
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
            {children}
        </div>
    );
};

export default FrameViewer;
