import React, { useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import Patches from "./Patches";
import { mutedParticleColors } from "../colors";

function Particles({
  positions,
  boxSize,
  selectedParticles,
  setSelectedParticles,
  onParticleDoubleClick, // Add this prop
}) {
  const meshRef = useRef();
  const count = positions.length;
  const { gl, camera } = useThree(); // For raycasting

  // Create geometry and material once
  const geometry = useMemo(() => new THREE.SphereGeometry(0.5, 16, 16), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        metalness: 0.5,
        roughness: 0.5,
      }),
    [],
  );

  // Create colors array for the particles
  const colors = useMemo(() => {
    const colorArray = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const colorIndex = positions[i].typeIndex % mutedParticleColors.length;
      const typeColor = new THREE.Color(mutedParticleColors[colorIndex]);
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
          pos.z - boxSize[2] / 2,
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }

      mesh.instanceMatrix.needsUpdate = true;

      // Set initial colors
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    }
  }, [positions, boxSize, count, colors]);

  // Raycaster for detecting clicks and double-clicks
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

        setSelectedParticles((prevSelected) => {
          if (event.ctrlKey || event.metaKey) {
            // If Ctrl or Command key is pressed, toggle selection of the particle
            if (prevSelected.includes(instanceId)) {
              // Deselect particle
              return prevSelected.filter((id) => id !== instanceId);
            } else {
              // Select particle
              return [...prevSelected, instanceId];
            }
          } else {
            // If Ctrl is not pressed, select only this particle
            return [instanceId];
          }
        });
      } else {
        if (!event.ctrlKey && !event.metaKey) {
          // If Ctrl is not pressed, clear selection
          setSelectedParticles([]);
        }
      }
    };

    const handleDoubleClick = (event) => {
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObject(meshRef.current);

      if (intersects.length > 0) {
        const instanceId = intersects[0].instanceId;
        const particle = positions[instanceId];

        // Calculate world position of the particle
        const particlePosition = new THREE.Vector3(
          particle.x - boxSize[0] / 2,
          particle.y - boxSize[1] / 2,
          particle.z - boxSize[2] / 2,
        );

        // Call the callback function
        if (onParticleDoubleClick) {
          onParticleDoubleClick(particlePosition);
        }
      }
    };

    gl.domElement.addEventListener("click", handleClick);
    gl.domElement.addEventListener("dblclick", handleDoubleClick);
    return () => {
      gl.domElement.removeEventListener("click", handleClick);
      gl.domElement.removeEventListener("dblclick", handleDoubleClick);
    };
  }, [
    gl,
    camera,
    setSelectedParticles,
    positions,
    boxSize,
    onParticleDoubleClick,
  ]);

  // Apply selection effect to selected particles
  useEffect(() => {
    if (meshRef.current) {
      const mesh = meshRef.current;

      for (let i = 0; i < count; i++) {
        const colorIndex = positions[i].typeIndex % mutedParticleColors.length;
        let typeColor = new THREE.Color(mutedParticleColors[colorIndex]);

        if (selectedParticles.includes(i)) {
          // Adjust the color to indicate selection
          typeColor = new THREE.Color("yellow");
        }

        mesh.setColorAt(i, typeColor);
      }

      mesh.instanceColor.needsUpdate = true;
    }
  }, [selectedParticles, count, positions]);

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

      {Array.from(particlesByType.values()).map(
        ({ particleType, particles }, idx) => {
          if (
            particleType.patchPositions &&
            particleType.patchPositions.length > 0
          ) {
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
        },
      )}
    </>
  );
}

export default Particles;
