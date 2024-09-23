import React, { useRef, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import Patches from './Patches';

function Particles({ positions, boxSize }) {
  const meshRef = useRef();
  const count = positions.length;
  const { gl, camera } = useThree(); // For raycasting
  const [selectedParticle, setSelectedParticle] = useState(null); // Track selected particle

  // Create geometry and material once
  const geometry = useMemo(() => new THREE.SphereGeometry(0.5, 16, 16), []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 'white', metalness: 0.5, roughness: 0.5 }),
    []
  );

// Muted color palette for particles
const mutedParticleColors = [
  '#8B0000', // Dark Red for Particle Type 0
  '#2F4F4F', // Dark Slate Gray for Particle Type 1
  '#556B2F', // Dark Olive Green for Particle Type 2
  '#9932CC', // Dark Orchid for Particle Type 3
  '#8B008B', // Dark Magenta for Particle Type 4
  '#FF4500', // Orange Red for Particle Type 5
  '#00CED1', // Dark Turquoise for Particle Type 6
  '#9400D3', // Dark Violet for Particle Type 7
  '#FF1493', // Deep Pink for Particle Type 8
  '#1E90FF', // Dodger Blue for Particle Type 9
  // Add more muted colors as needed
];
  
  // Create colors array for the particles
  const colors = useMemo(() => {

    const colorArray = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const typeColor = new THREE.Color(mutedParticleColors[positions[i].typeIndex % mutedParticleColors.length]);
      //const typeColor = new THREE.Color(`hsl(${(positions[i].typeIndex * 60) % 360}, 100%, 50%)`);
      //console.log("typeIndex",positions[i].typeIndex );
      colorArray.set([typeColor.r, typeColor.g, typeColor.b], i * 3);
    }
    return colorArray;
  }, [positions, count]);

  useEffect(() => {
    if (meshRef.current && positions.length > 0) {
      const mesh = meshRef.current;
      const dummy = new THREE.Object3D();

      for (let i = 0; i < count; i++) {
        const pos = positions[i];

        // Set position, adjusting for box centering
        dummy.position.set(
          pos.x - boxSize[0] / 2,
          pos.y - boxSize[1] / 2,
          pos.z - boxSize[2] / 2
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }

      mesh.instanceMatrix.needsUpdate = true;

      // Assign or update the instanceColor attribute
      if (!mesh.geometry.attributes.instanceColor) {
        mesh.geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colors, 3));
      }
    }
  }, [positions, boxSize, count, colors]);

  // Raycaster for detecting clicks
  useEffect(() => {
    const handleClick = (event) => {
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObject(meshRef.current);

      if (intersects.length > 0) {
        const instanceId = intersects[0].instanceId;
        setSelectedParticle(instanceId); // Set selected particle ID
        console.log(`Selected Particle ID: ${instanceId}`); // Log the selected particle ID
      } else {
        setSelectedParticle(null); // Reset if no particle is selected
      }
    };

    gl.domElement.addEventListener('click', handleClick);
    return () => {
      gl.domElement.removeEventListener('click', handleClick);
    };
  }, [gl, camera]);

  // Apply glow effect to selected particle
  useEffect(() => {
    if (meshRef.current) {
      const mesh = meshRef.current;

      if (selectedParticle !== null) {
        // Change the color of the selected particle to yellow
        const selectedColor = new THREE.Color('yellow');
        mesh.setColorAt(selectedParticle, selectedColor);
      }

      // Reset color for non-selected particles
      for (let i = 0; i < count; i++) {
        if (i !== selectedParticle) {
          const typeColor = new THREE.Color(`hsl(${(positions[i].typeIndex * 60) % 360}, 100%, 50%)`);
          mesh.setColorAt(i, typeColor);
        }
      }

      mesh.instanceColor.needsUpdate = true;
    }
  }, [selectedParticle, count, positions]);

  // Group particles by type
  const particlesByType = useMemo(() => {
    const map = new Map();
    positions.forEach((pos) => {
      const typeIndex = pos.typeIndex;
      if (!map.has(typeIndex)) {
        map.set(typeIndex, { particleType: pos.particleType, particles: [] });
      }
      map.get(typeIndex).particles.push(pos);
    });
    return map;
  }, [positions]);

  return (
    <>
      <instancedMesh ref={meshRef} args={[geometry, material, count]}>
        {/* This instancedMesh renders the particles */}
      </instancedMesh>

      {Array.from(particlesByType.values()).map(({ particleType, particles }, idx) => {
        if (particleType.patchPositions && particleType.patchPositions.length > 0) {
          return (
            <Patches
              key={idx}
              particles={particles}
              patchPositions={particleType.patchPositions}
              patchIDs={particleType.patches}
              boxSize={boxSize}
            />
          );
        } else {
          return null;
        }
      })}
    </>
  );
}

export default Particles;