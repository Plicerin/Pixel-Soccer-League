import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PLAYER_PATTERNS, PLAYER_IDLE_PATTERNS, TEAM_PALETTES, buildPlayerFrame } from '../gameEngine';

interface StaticImageGeneratorProps {
  team: 'dolphins' | 'niners';
  onImageGenerated: (dataUrl: string) => void;
}

export const StaticImageGenerator: React.FC<StaticImageGeneratorProps> = ({ team, onImageGenerated }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const palette = TEAM_PALETTES[team];
    const patterns = Math.random() > 0.5 ? PLAYER_PATTERNS : PLAYER_IDLE_PATTERNS;
    const frameIndex = Math.floor(Math.random() * patterns.length);
    const frame = buildPlayerFrame(patterns[frameIndex], palette);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff); // White background
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(2, 2, 2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true });
    renderer.setSize(256, 256);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    scene.add(frame);

    renderer.render(scene, camera);
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onImageGenerated(dataUrl);

    // Cleanup
    renderer.dispose();
    scene.clear();
  }, [team, onImageGenerated]);

  return <canvas ref={canvasRef} style={{ display: 'none' }} />;
};
