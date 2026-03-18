import React from 'react';
import { Box } from '@react-three/drei';

export const Goalpost: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  return (
    <group position={position}>
      {/* Main Post */}
      <Box args={[0.5, 6, 0.5]} position={[0, 3, 0]}>
        <meshStandardMaterial color="#ffff00" flatShading />
      </Box>
      {/* Crossbar */}
      <Box args={[0.5, 0.5, 8]} position={[0, 6, 0]}>
        <meshStandardMaterial color="#ffff00" flatShading />
      </Box>
      {/* Uprights */}
      <Box args={[0.5, 6, 0.5]} position={[0, 9, -4]}>
        <meshStandardMaterial color="#ffff00" flatShading />
      </Box>
      <Box args={[0.5, 6, 0.5]} position={[0, 9, 4]}>
        <meshStandardMaterial color="#ffff00" flatShading />
      </Box>
    </group>
  );
};
