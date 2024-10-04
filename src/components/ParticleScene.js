// src/components/ParticleScene.js

// src/components/ParticleScene.js

import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Stats } from "@react-three/drei";
import Particles from "./Particles";
import { EffectComposer, SSAO } from "@react-three/postprocessing";

function ParticleScene({
  positions,
  boxSize,
  selectedParticles,
  setSelectedParticles,
}) {
  return (
    <Canvas camera={{ position: [0, 0, Math.max(...boxSize) * 1.5], fov: 75 }}>
      <OrbitControls />
      <ambientLight intensity={0.5} />
      <Environment preset="sunset" />

      {/* Render the simulation box */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={boxSize} />
        <meshBasicMaterial color="gray" wireframe />
      </mesh>

      <Particles
        positions={positions}
        boxSize={boxSize}
        selectedParticles={selectedParticles} // Pass as prop
        setSelectedParticles={setSelectedParticles} // Pass as prop
      />

      {/* Add SSAO for ambient occlusion effect */}
      <EffectComposer enableNormalPass>
        <SSAO
          samples={31} // Increase for smoother occlusion (performance cost)
          radius={0.5} // Adjust based on scene scale
          intensity={20} // Increase for stronger shadows
          luminanceInfluence={0.9} // Adjust based on material brightness
          color="#000000" // Shadow color
        />
      </EffectComposer>

      {/* Add Stats component for performance monitoring */}
      <Stats />
    </Canvas>
  );
}

export default ParticleScene;
