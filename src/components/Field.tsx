import React from 'react';

const FIELD_WIDTH = 100;
const FIELD_HEIGHT = 60;
const ENDZONE_WIDTH = 10;

export const Field: React.FC = () => {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* Main Grass */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[FIELD_WIDTH, FIELD_HEIGHT]} />
        <meshStandardMaterial color="#00aa00" flatShading />
      </mesh>

      {/* Yard Lines */}
      {Array.from({ length: 11 }).map((_, i) => {
        const x = -FIELD_WIDTH / 2 + ENDZONE_WIDTH + (i * (FIELD_WIDTH - 2 * ENDZONE_WIDTH) / 10);
        return (
          <mesh key={i} position={[x, 0, 0.01]}>
            <planeGeometry args={[0.5, FIELD_HEIGHT]} />
            <meshBasicMaterial color="white" />
          </mesh>
        );
      })}
      
      {/* Endzones */}
      <mesh position={[-FIELD_WIDTH / 2 + ENDZONE_WIDTH / 2, 0, 0.02]}>
        <planeGeometry args={[ENDZONE_WIDTH, FIELD_HEIGHT]} />
        <meshStandardMaterial color="#ff0000" flatShading />
      </mesh>
      <mesh position={[FIELD_WIDTH / 2 - ENDZONE_WIDTH / 2, 0, 0.02]}>
        <planeGeometry args={[ENDZONE_WIDTH, FIELD_HEIGHT]} />
        <meshStandardMaterial color="#ff0000" flatShading />
      </mesh>
    </group>
  );
};
