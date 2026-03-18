import React from 'react';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';

export const Ball: React.FC<{ position: THREE.Vector3 }> = ({ position }) => {
  return (
    <Sphere args={[0.3, 16, 16]} position={position}>
      <meshStandardMaterial color="#8b4513" />
    </Sphere>
  );
};
