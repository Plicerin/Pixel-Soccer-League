import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  PLAYER_IDLE_PATTERNS, PLAYER_PATTERNS, TEAM_PALETTES, buildPlayerFrame,
  KEEPER_PATTERNS, KEEPER_IDLE_PATTERNS,
  KEEPER_DIVE_LEFT_PATTERNS, KEEPER_DIVE_RIGHT_PATTERNS,
  KEEPER_DIVE_UP_PATTERNS, KEEPER_DIVE_DOWN_PATTERNS,
} from '../gameEngine';

// All named frame groups
const FRAME_GROUPS: { label: string; frames: string[][] }[] = [
  { label: 'Player Idle', frames: PLAYER_IDLE_PATTERNS },
  { label: 'Player Run', frames: PLAYER_PATTERNS },
  { label: 'Keeper Idle', frames: KEEPER_IDLE_PATTERNS },
  { label: 'Keeper Run', frames: KEEPER_PATTERNS },
  { label: 'Dive Left', frames: KEEPER_DIVE_LEFT_PATTERNS },
  { label: 'Dive Right', frames: KEEPER_DIVE_RIGHT_PATTERNS },
  { label: 'Dive Up', frames: KEEPER_DIVE_UP_PATTERNS },
  { label: 'Dive Down', frames: KEEPER_DIVE_DOWN_PATTERNS },
];

let _sharedRenderer: THREE.WebGLRenderer | null = null;
function getSharedRenderer() {
  if (!_sharedRenderer) {
    _sharedRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    _sharedRenderer.setSize(150, 150);
  }
  return _sharedRenderer;
}

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

function frameToJSON(pattern: string[]): string {
  return JSON.stringify(pattern, null, 2);
}

function renderSlot(renderer: THREE.WebGLRenderer, el: HTMLDivElement, pattern: string[], cam: THREE.Vector3) {
  el.innerHTML = '';
  const dataURL = renderFrameToDataURL(renderer, pattern, cam);
  const img = document.createElement('img');
  img.src = dataURL;
  img.width = 120;
  img.height = 120;
  el.appendChild(img);
}

const FrameViewer: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const containerRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
    const [clipboard, setClipboard] = useState<string[] | null>(null);
    const [clipLabel, setClipLabel] = useState('');
    const [toast, setToast] = useState('');
    const [, forceUpdate] = useState(0);

    const showToast = useCallback((msg: string) => {
      setToast(msg);
      setTimeout(() => setToast(''), 2000);
    }, []);

    const handleCopy = useCallback((pattern: string[], label: string) => {
      setClipboard([...pattern]);
      setClipLabel(label);
      navigator.clipboard.writeText(frameToJSON(pattern)).catch(() => {});
      showToast(`Copied: ${label}`);
    }, [showToast]);

    const handlePaste = useCallback((group: { label: string; frames: string[][] }, fi: number) => {
      if (!clipboard) return;
      // Write clipboard data into the target frame slot
      const target = group.frames;
      for (let i = 0; i < clipboard.length; i++) {
        target[fi][i] = clipboard[i];
      }
      // Re-render the previews for this slot
      const key = `${group.label}-${fi}`;
      const renderer = getSharedRenderer();
      const frontCam = new THREE.Vector3(0, 1.2, 3);
      const sideCam = new THREE.Vector3(3, 1.2, 0);
      const frontEl = containerRefs.current.get(key + '-front');
      const sideEl = containerRefs.current.get(key + '-side');
      if (frontEl) renderSlot(renderer, frontEl, target[fi], frontCam);
      if (sideEl) renderSlot(renderer, sideEl, target[fi], sideCam);
      showToast(`Pasted ${clipLabel} → ${group.label} #${fi}`);
      forceUpdate(n => n + 1);
    }, [clipboard, clipLabel, showToast]);

    const handleCopyJSON = useCallback((pattern: string[], label: string) => {
      navigator.clipboard.writeText(frameToJSON(pattern)).catch(() => {});
      showToast(`JSON copied: ${label}`);
    }, [showToast]);

    useEffect(() => {
        const renderer = getSharedRenderer();

        const frontCam = new THREE.Vector3(0, 1.2, 3);
        const sideCam = new THREE.Vector3(3, 1.2, 0);

        FRAME_GROUPS.forEach((group) => {
          group.frames.forEach((pattern, fi) => {
            const key = `${group.label}-${fi}`;
            const frontEl = containerRefs.current.get(key + '-front');
            const sideEl = containerRefs.current.get(key + '-side');
            if (frontEl) renderSlot(renderer, frontEl, pattern, frontCam);
            if (sideEl) renderSlot(renderer, sideEl, pattern, sideCam);
          });
        });
    }, []);

    return (
        <div className="p-4 space-y-6 relative">
          {/* Toast */}
          {toast && (
            <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded shadow-lg text-sm font-medium animate-pulse">
              {toast}
            </div>
          )}

          {/* Clipboard indicator */}
          {clipboard && (
            <div className="sticky top-0 z-40 bg-yellow-600/90 text-white text-xs px-3 py-1.5 rounded mb-2 flex items-center gap-2">
              <span>📋 Clipboard: <strong>{clipLabel}</strong></span>
              <button
                className="ml-auto bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-xs"
                onClick={() => { setClipboard(null); setClipLabel(''); }}
              >Clear</button>
            </div>
          )}

          {FRAME_GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="text-white font-bold text-lg mb-2 border-b border-zinc-700 pb-1">
                {group.label}
                <span className="text-zinc-400 text-sm font-normal ml-2">({group.frames.length} frame{group.frames.length !== 1 ? 's' : ''})</span>
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {group.frames.map((pattern, fi) => {
                  const key = `${group.label}-${fi}`;
                  return (
                    <div key={key} className="flex flex-col items-center border border-zinc-700 p-3 rounded-lg bg-zinc-900">
                      <p className="text-sm font-bold mb-2 text-white">{group.label} #{fi}</p>
                      <div className="flex gap-4 mb-2">
                        <div className="flex flex-col items-center">
                          <div ref={el => { containerRefs.current.set(key + '-front', el); }} className="w-[120px] h-[120px]" />
                          <p className="text-xs mt-1 text-zinc-400">Front</p>
                        </div>
                        <div className="flex flex-col items-center">
                          <div ref={el => { containerRefs.current.set(key + '-side', el); }} className="w-[120px] h-[120px]" />
                          <p className="text-xs mt-1 text-zinc-400">Side</p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-1">
                        <button
                          className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1 rounded"
                          onClick={() => handleCopy(pattern, `${group.label} #${fi}`)}
                          title="Copy frame to clipboard"
                        >Copy</button>
                        {clipboard && (
                          <button
                            className="bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-1 rounded"
                            onClick={() => handlePaste(group, fi)}
                            title={`Paste ${clipLabel} into this slot`}
                          >Paste</button>
                        )}
                        <button
                          className="bg-zinc-600 hover:bg-zinc-500 text-white text-xs px-3 py-1 rounded"
                          onClick={() => handleCopyJSON(pattern, `${group.label} #${fi}`)}
                          title="Copy frame pattern as JSON to system clipboard"
                        >JSON</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {children}
        </div>
    );
};

export default FrameViewer;
