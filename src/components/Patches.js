// src/components/Patches.js

import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { getColorForPatchID } from '../utils/colorUtils';

function Patches({ particles, patchPositions, patchIDs, boxSize }) {
  const meshRef = useRef();
  const totalPatches = particles.length * patchPositions.length;

  // Adjust patch radius as needed
  const patchRadius = 0.3;

  // Create geometry and material for patches
  const geometry = useMemo(() => new THREE.SphereGeometry(patchRadius, 8, 8), [patchRadius]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: 'white' }), []);

  useEffect(() => {
    if (meshRef.current) {
      const mesh = meshRef.current;
      const dummy = new THREE.Object3D();
      const colors = [];

      let index = 0;

      for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        const particlePosition = new THREE.Vector3(
          particle.x - boxSize[0] / 2,
          particle.y - boxSize[1] / 2,
          particle.z - boxSize[2] / 2
        );

        // Use the rotation matrix if available
        let rotationMatrix = null;
        if (particle.rotationMatrix) {
          rotationMatrix = new THREE.Matrix3().fromArray(particle.rotationMatrix.elements);
        }

        for (let j = 0; j < patchPositions.length; j++) {
          const patchOffset = patchPositions[j];
          const patchID = patchIDs[j]; // Get patch ID

          // Compute the patch position
          const localPatchPosition = new THREE.Vector3(
            patchOffset.x,
            patchOffset.y,
            patchOffset.z
          ).multiplyScalar(0.5); // Adjust scalar based on particle radius if necessary

          // Rotate the local patch position using the rotation matrix
          let rotatedPatchPosition = localPatchPosition;
          if (rotationMatrix) {
            rotatedPatchPosition = localPatchPosition.applyMatrix3(rotationMatrix);
          }

          // Translate to the particle's global position
          const patchPosition = rotatedPatchPosition.add(particlePosition);

          dummy.position.copy(patchPosition);
          dummy.updateMatrix();
          mesh.setMatrixAt(index, dummy.matrix);

          // Assign color based on patch ID
          const color = getColorForPatchID(patchID);
          colors.push(color.r, color.g, color.b);

          // Debugging logs
          console.log(`Processing Patch ${index}:`);
          console.log(`Patch ID: ${patchID}, Color: ${color.getStyle()}`);
          console.log(`Patch Position: ${patchPosition.toArray()}`);
          console.log(`Rotation Matrix:`, rotationMatrix);

          index++;
        }
      }

      mesh.instanceMatrix.needsUpdate = true;

      // Assign or update the instanceColor attribute
      if (!mesh.geometry.attributes.instanceColor) {
        const colorArray = new Float32Array(colors);
        mesh.geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colorArray, 3));
      } else {
        mesh.geometry.attributes.instanceColor.array.set(colors);
        mesh.geometry.attributes.instanceColor.needsUpdate = true;
      }

      // Update material to use instanceColor
      if (!mesh.material.userData.instanceColorInjected) {
        mesh.material.userData.instanceColorInjected = true;

        mesh.material.onBeforeCompile = (shader) => {
          shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `
            #include <common>
            attribute vec3 instanceColor;
            varying vec3 vInstanceColor;
            `
          ).replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            vInstanceColor = instanceColor;
            `
          );

          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `
            #include <common>
            varying vec3 vInstanceColor;
            `
          ).replace(
            'vec4 diffuseColor = vec4( diffuse, opacity );',
            'vec4 diffuseColor = vec4( vInstanceColor, opacity );'
          );
        };
        mesh.material.needsUpdate = true;
      }
    }
  }, [particles, patchPositions, patchIDs, boxSize, patchRadius]);

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, totalPatches]} />
  );
}

export default Patches;