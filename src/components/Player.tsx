import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Retro Sprite Data (Atari style)
const SPRITE_FRAMES = [
  // Frame 1: Mid-stride
  [
    [0,0,0,1,1,1,0],
    [0,0,0,1,1,1,0],
    [0,1,1,1,1,0,0],
    [1,1,1,1,1,0,0],
    [1,1,1,1,1,0,0],
    [0,1,1,1,1,0,0],
    [0,0,1,1,0,0,0],
    [0,0,1,1,0,0,0],
    [0,1,1,0,0,0,0],
    [1,1,0,0,0,0,0],
  ],
  // Frame 2: Full-stride
  [
    [0,0,0,1,1,1,0],
    [0,0,0,1,1,1,0],
    [0,1,1,1,1,0,0],
    [1,1,1,1,1,0,0],
    [1,1,1,1,1,0,0],
    [0,1,1,1,1,0,0],
    [0,0,1,1,0,0,0],
    [0,1,1,0,0,0,0],
    [1,1,0,0,0,0,0],
    [0,0,0,0,0,1,1],
  ]
];

export const Player: React.FC<{ 
  position: THREE.Vector3; 
  color: string; 
  isMain?: boolean;
}> = ({ position, color, isMain }) => {
  const groupRef = useRef<THREE.Group>(null);
  const prevPos = useRef(new THREE.Vector3());
  const isMovingRef = useRef(false);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.copy(position);
      
      // Movement detection
      const dist = position.distanceTo(prevPos.current);
      const moving = dist > 0.01;
      isMovingRef.current = moving;
      prevPos.current.copy(position);

      // Animation logic
      if (moving) {
        // Tilt forward when moving
        groupRef.current.rotation.z = -0.2;
      } else {
        groupRef.current.rotation.z = 0;
      }

      // Always face "forward" (right side of screen / positive X)
      groupRef.current.rotation.y = Math.PI / 2;
    }
  });

  const [displayFrame, setDisplayFrame] = useState(0);
  useFrame((state) => {
    const animSpeed = isMain ? 12 : 10;
    const newFrame = isMovingRef.current ? Math.floor(state.clock.elapsedTime * animSpeed) % 2 : 0;
    if (newFrame !== displayFrame) setDisplayFrame(newFrame);
  });

  const currentSprite = SPRITE_FRAMES[displayFrame];
  const pixelSize = 0.25;

  return (
    <group ref={groupRef}>
      <group position={[0, 2.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {currentSprite.map((row, y) => 
          row.map((pixel, x) => {
            if (pixel === 0) return null;
            return (
              <mesh 
                key={`${x}-${y}`} 
                position={[
                  (x - 3) * pixelSize, 
                  (currentSprite.length - y - 1) * pixelSize, 
                  0
                ]}
              >
                <boxGeometry args={[pixelSize, pixelSize, pixelSize * 1.5]} />
                <meshStandardMaterial color={color} flatShading />
              </mesh>
            );
          })
        )}
      </group>
      
      {/* Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[1.5, 1.0]} />
        <meshBasicMaterial color="black" transparent opacity={0.3} />
      </mesh>
    </group>
  );
};
