import React, { useState, useEffect, useCallback } from "react";
import * as THREE from "three";
import FileDropZone from "./components/FileDropZone";
import ParticleScene from "./components/ParticleScene";
import PatchLegend from "./components/PatchLegend";
import ParticleLegend from "./components/ParticleLegend";
import SelectedParticlesDisplay from "./components/SelectedParticlesDisplay"; // Import the new component

import "./styles.css";

function App() {
  const [positions, setPositions] = useState([]);
  const [currentBoxSize, setCurrentBoxSize] = useState([
    34.199520111084, 34.199520111084, 34.199520111084,
  ]);
  const [topData, setTopData] = useState(null);

  const [trajFile, setTrajFile] = useState(null);
  const [configIndex, setConfigIndex] = useState([]);
  const [currentConfigIndex, setCurrentConfigIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentEnergy, setCurrentEnergy] = useState([]);
  const [totalConfigs, setTotalConfigs] = useState(0);

  // State variables for toggling Patch legend visibility and loading
  const [showPatchLegend, setShowPatchLegend] = useState(false);
  const [filesDropped, setFilesDropped] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Loading state
  const [showParticleLegend, setShowParticleLegend] = useState(false);

  // New state for selected particles
  const [selectedParticles, setSelectedParticles] = useState([]);

  const handleFilesReceived = async (files) => {
    if (!files || files.length === 0) {
      // No files selected or operation cancelled
      return;
    }

    // Set filesDropped to true to hide the drop zone immediately
    setFilesDropped(true);

    // Set loading state to true before indexing
    setIsLoading(true);

    const fileMap = new Map();

    // Store all files in fileMap, normalizing file names
    files.forEach((file) => {
      fileMap.set(file.name.trim(), file);
    });

    console.log("Files received:", Array.from(fileMap.keys()));

    // Process .top file
    const topFile = files.find((file) => file.name.endsWith(".top"));
    if (topFile) {
      const topContent = await topFile.text();
      const parsedTopData = await parseTopFile(topContent, fileMap);
      setTopData(parsedTopData);
    } else {
      alert("Topology file (.top) is missing!");
      // Reset filesDropped and isLoading
      setFilesDropped(false);
      setIsLoading(false);
      return;
    }

    // Get trajectory file
    const trajectoryFile = files.find(
      (file) =>
        file.name.includes("traj") ||
        file.name.includes("conf") ||
        file.name.includes("last"),
    );
    if (trajectoryFile) {
      setTrajFile(trajectoryFile);
    } else {
      alert("Trajectory file (e.g., traj.dat) is missing!");
      // Reset filesDropped and isLoading
      setFilesDropped(false);
      setIsLoading(false);
      return;
    }

    // Build the index
    const index = await buildTrajIndex(trajectoryFile);
    setConfigIndex(index);
    setTotalConfigs(index.length);

    // Set loading state to false after indexing
    setIsLoading(false);
  };

  // Load configuration when topData, trajFile, and configIndex are available
  useEffect(() => {
    if (topData && trajFile && configIndex.length > 0) {
      loadConfiguration(trajFile, configIndex, currentConfigIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topData, trajFile, configIndex, currentConfigIndex]);

  // Build the trajectory index
  const buildTrajIndex = async (file) => {
    const decoder = new TextDecoder("utf-8");
    const reader = file.stream().getReader();
    let result;
    let offset = 0;
    let index = [];
    let partialLine = "";
    const decoderOptions = { stream: true };

    while (!(result = await reader.read()).done) {
      const chunk = result.value;
      const textChunk = decoder.decode(chunk, decoderOptions);
      const lines = (partialLine + textChunk).split(/\r?\n/);
      partialLine = lines.pop(); // Save the last line in case it's incomplete

      for (const line of lines) {
        if (line.startsWith("t =")) {
          index.push(offset);
        }
        offset += new TextEncoder().encode(line + "\n").length;
      }
    }

    // Handle the last partial line
    if (partialLine.startsWith("t =")) {
      index.push(offset);
    }

    return index;
  };

  const loadConfiguration = async (file, index, configNumber) => {
    if (configNumber < 0 || configNumber >= index.length) {
      alert("Configuration number out of range");
      return false;
    }

    // Ensure topData is available
    if (!topData) {
      alert("Topology data not available.");
      return false;
    }

    const start = index[configNumber];
    const end =
      configNumber + 1 < index.length ? index[configNumber + 1] : file.size;
    const slice = file.slice(start, end);

    const content = await slice.text();
    const lines = content.split(/\r?\n/);

    const config = parseConfiguration(lines);
    if (config) {
      // Apply periodic boundaries
      const adjustedPositions = applyPeriodicBoundary(
        config.positions,
        config.boxSize,
      );

      // Associate particle types and compute rotation matrices
      const positionsWithTypes = adjustedPositions.map((pos, index) => {
        const { typeIndex, particleType } = getParticleType(
          index,
          topData.particleTypes,
        );

        let rotationMatrix = null;
        if (pos.a1 && pos.a3) {
          // Compute a2 as cross product of a3 and a1
          const a1 = new THREE.Vector3(
            pos.a1.x,
            pos.a1.y,
            pos.a1.z,
          ).normalize();
          const a3 = new THREE.Vector3(
            pos.a3.x,
            pos.a3.y,
            pos.a3.z,
          ).normalize();
          const a2 = new THREE.Vector3().crossVectors(a3, a1).normalize();

          // Recompute a3 to ensure orthogonality
          a3.crossVectors(a1, a2).normalize();

          // Create the rotation matrix
          const matrix = new THREE.Matrix3().set(
            a1.x,
            a2.x,
            a3.x,
            a1.y,
            a2.y,
            a3.y,
            a1.z,
            a2.z,
            a3.z,
          );

          // Store matrix elements
          rotationMatrix = {
            elements: matrix.elements.slice(), // Clone the elements array
          };

          console.log(`Rotation Matrix for Particle ${index}:`, rotationMatrix);
        }

        return {
          ...pos,
          typeIndex,
          particleType,
          rotationMatrix,
        };
      });

      setPositions(positionsWithTypes);
      setCurrentBoxSize(config.boxSize);
      setCurrentTime(config.time);
      setCurrentEnergy(config.energy);
      return true;
    } else {
      alert("Failed to parse configuration");
      return false;
    }
  };

  // Function to parse a configuration from lines
  const parseConfiguration = (lines) => {
    let i = 0;
    const timeLine = lines[i++].trim();
    const time = parseFloat(timeLine.split("=")[1].trim());

    const bLine = lines[i++].trim();
    const bTokens = bLine.split("=");
    const boxSize = bTokens[1].trim().split(/\s+/).map(Number);

    const eLine = lines[i++].trim();
    const energyTokens = eLine.split("=");
    const energy = energyTokens[1].trim().split(/\s+/).map(Number);

    const positions = [];
    while (i < lines.length) {
      const line = lines[i++].trim();
      if (line === "") continue;
      const tokens = line.split(/\s+/).map(Number);

      // Updated to parse the additional columns
      if (tokens.length >= 9) {
        const [x, y, z, a1x, a1y, a1z, a3x, a3y, a3z, ...rest] = tokens;
        positions.push({
          x,
          y,
          z,
          a1: { x: a1x, y: a1y, z: a1z },
          a3: { x: a3x, y: a3y, z: a3z },
        });
      } else if (tokens.length >= 3) {
        // Handle case where orientation data is missing
        const [x, y, z] = tokens;
        positions.push({ x, y, z });
      }
    }

    return {
      time,
      boxSize,
      energy,
      positions,
    };
  };

  // Function to parse the .top file (supports both Lorenzo's and Flavio's formats)
  const parseTopFile = async (content, fileMap) => {
    const lines = content.trim().split("\n");

    // Determine if the format is Flavio's or Lorenzo's based on header and content
    let isFlavioFormat = !lines[1].includes(".");

    if (isFlavioFormat) {
      // Parse Flavio's topology
      return await parseFlavioTopology(content, fileMap);
    } else {
      // Parse Lorenzo's topology
      return await parseLorenzoTopology(lines, fileMap);
    }
  };

  // Function to parse Lorenzo's topology
  const parseLorenzoTopology = async (lines, fileMap) => {
    const headerTokens = lines[0].trim().split(/\s+/).map(Number);
    const totalParticles = headerTokens[0];
    const typeCount = headerTokens[1];
    const particleTypes = [];

    let cumulativeCount = 0;
    const patchFileCache = new Map();

    for (let i = 1; i <= typeCount; i++) {
      const line = lines[i];
      const tokens = line.trim().split(/\s+/);
      const count = Number(tokens[0]);
      const patchCount = Number(tokens[1]);
      const patches = tokens[2] ? tokens[2].split(",").map(Number) : [];
      const fileName = tokens[3] ? tokens[3].trim() : "";
      cumulativeCount += count;

      const particleType = {
        typeIndex: i - 1, // Assign typeIndex starting from 0
        count: count,
        cumulativeCount: cumulativeCount,
        patchCount: patchCount,
        patches: patches,
        fileName,
        patchPositions: [],
      };

      console.log(`Processing particle type ${i}:`, particleType);

      // Read the patch file if provided
      if (fileName) {
        if (patchFileCache.has(fileName)) {
          // Use cached patch positions
          particleType.patchPositions = patchFileCache.get(fileName);
        } else if (fileMap.has(fileName)) {
          const patchFile = fileMap.get(fileName);
          const patchContent = await patchFile.text();
          const patchPositions = parsePatchFile(patchContent);
          particleType.patchPositions = patchPositions;
          patchFileCache.set(fileName, patchPositions);
        } else {
          console.warn(
            `Patch file '${fileName}' not found for particle type ${i}`,
          );
          console.log("Available files:", Array.from(fileMap.keys()));
        }
      }

      particleTypes.push(particleType);
    }

    return { totalParticles, typeCount, particleTypes };
  };

  // Function to parse Flavio's topology
  const parseFlavioTopology = async (content, fileMap) => {
    const lines = content.trim().split("\n");
    const headerTokens = lines[0].trim().split(/\s+/).map(Number);
    const totalParticles = headerTokens[0];
    const typeCount = headerTokens[1];

    // Second line contains particle types per particle
    const typeLine = lines[1].trim();
    const particleTypesList = typeLine.split(/\s+/).map(Number);

    // Build particle types and counts
    const particleTypes = [];
    const typeCounts = {};

    particleTypesList.forEach((typeIndex) => {
      if (!typeCounts[typeIndex]) {
        typeCounts[typeIndex] = 0;
      }
      typeCounts[typeIndex]++;
    });

    let particlesData = null;
    let patchesData = null;

    // Check for particles.txt file
    const particleTxtFile = fileMap.get("particles.txt");
    if (particleTxtFile) {
      const particleTxtContent = await particleTxtFile.text();
      particlesData = parseParticleTxt(particleTxtContent);
    } else {
      console.warn("particles.txt file is missing for Flavio format.");
      // Proceed without particlesData
    }

    // Check for patches.txt file
    const patchesTxtFile = fileMap.get("patches.txt");
    if (patchesTxtFile) {
      const patchesTxtContent = await patchesTxtFile.text();
      patchesData = parsePatchesTxt(patchesTxtContent);
    } else {
      console.warn("patches.txt file is missing for Flavio format.");
      // Proceed without patchesData
    }

    // Build particle types array
    Object.keys(typeCounts).forEach((typeIndex) => {
      const count = typeCounts[typeIndex];
      let patches = [];
      let patchPositions = [];

      if (particlesData && patchesData) {
        const particlesOfType = particlesData.filter(
          (p) => p.type === Number(typeIndex),
        );

        // Collect patches associated with this type
        particlesOfType.forEach((p) => {
          patches.push(...p.patches);
        });

        patchPositions = patches
          .map((patchId) => patchesData[patchId]?.position)
          .filter(Boolean);
      }

      particleTypes.push({
        count,
        typeIndex: Number(typeIndex),
        patches,
        patchPositions,
      });
    });

    return { totalParticles, typeCount, particleTypes };
  };

  // Function to parse particle.txt
  const parseParticleTxt = (content) => {
    const lines = content.trim().split("\n");
    const particlesData = [];

    let currentParticle = null;

    lines.forEach((line) => {
      line = line.trim();
      if (line.startsWith("particle_")) {
        if (currentParticle) {
          particlesData.push(currentParticle);
        }
        currentParticle = { patches: [] };
      } else if (line.startsWith("type =")) {
        currentParticle.type = Number(line.split("=")[1].trim());
      } else if (line.startsWith("patches =")) {
        const patchesStr = line.split("=")[1].trim();
        currentParticle.patches = patchesStr.split(",").map(Number);
      }
    });

    if (currentParticle) {
      particlesData.push(currentParticle);
    }

    return particlesData;
  };

  // Function to parse patches.txt
  const parsePatchesTxt = (content) => {
    const lines = content.trim().split("\n");
    const patchesData = {};

    let currentPatch = null;
    lines.forEach((line) => {
      line = line.trim();
      if (line.startsWith("patch_")) {
        if (currentPatch) {
          patchesData[currentPatch.id] = currentPatch;
        }
        currentPatch = {};
      } else if (line.startsWith("id =")) {
        currentPatch.id = Number(line.split("=")[1].trim());
      } else if (line.startsWith("position =")) {
        const positionStr = line.split("=")[1].trim();
        const [x, y, z] = positionStr.split(",").map(Number);
        currentPatch.position = { x, y, z };
      } else if (line.startsWith("a1 =")) {
        const a1Str = line.split("=")[1].trim();
        const [x, y, z] = a1Str.split(",").map(Number);
        currentPatch.a1 = { x, y, z };
      } else if (line.startsWith("a2 =")) {
        const a2Str = line.split("=")[1].trim();
        const [x, y, z] = a2Str.split(",").map(Number);
        currentPatch.a2 = { x, y, z };
      }
    });

    if (currentPatch) {
      patchesData[currentPatch.id] = currentPatch;
    }

    return patchesData;
  };

  // Function to get particle type based on index
  const getParticleType = (particleIndex, particleTypes) => {
    let cumulativeCount = 0;
    for (let i = 0; i < particleTypes.length; i++) {
      cumulativeCount += particleTypes[i].count;
      if (particleIndex < cumulativeCount) {
        return {
          typeIndex: particleTypes[i].typeIndex, // Use the assigned typeIndex
          particleType: particleTypes[i],
        };
      }
    }

    // Default to the last type if not found
    const lastType = particleTypes[particleTypes.length - 1];
    return {
      typeIndex: lastType.typeIndex,
      particleType: lastType,
    };
  };

  // Function to parse patch files (for Lorenzo's format)
  const parsePatchFile = (content) => {
    const lines = content.trim().split("\n");
    const positions = lines.map((line) => {
      const tokens = line.trim().split(/\s+/).map(Number);
      const [x, y, z] = tokens;
      return { x, y, z };
    });
    return positions;
  };

  // Helper function to apply periodic boundary conditions
  const applyPeriodicBoundary = (positions, boxSize) => {
    return positions.map((pos) => {
      const { x, y, z, ...rest } = pos;
      return {
        x: ((x % boxSize[0]) + boxSize[0]) % boxSize[0],
        y: ((y % boxSize[1]) + boxSize[1]) % boxSize[1],
        z: ((z % boxSize[2]) + boxSize[2]) % boxSize[2],
        ...rest,
      };
    });
  };

  const handleSliderChange = (e) => {
    const newIndex = parseInt(e.target.value, 10);
    setCurrentConfigIndex(newIndex);
  };

  // Function to shift positions along an axis
  const shiftPositions = useCallback(
    (axis, delta) => {
      setPositions((prevPositions) => {
        const shiftedPositions = prevPositions.map((pos) => {
          const newPos = { ...pos };
          newPos[axis] = pos[axis] + delta;
          return newPos;
        });
        // Apply periodic boundaries
        const adjustedPositions = applyPeriodicBoundary(
          shiftedPositions,
          currentBoxSize,
        );
        return adjustedPositions;
      });
    },
    [currentBoxSize],
  );

  // useEffect to handle key presses
  useEffect(() => {
    const handleKeyDown = (event) => {
      switch (event.key) {
        case "q":
          shiftPositions("x", 1);
          break;
        case "a":
          shiftPositions("x", -1);
          break;
        case "w":
          shiftPositions("y", 1);
          break;
        case "s":
          shiftPositions("y", -1);
          break;
        case "e":
          shiftPositions("z", 1);
          break;
        case "d":
          shiftPositions("z", -1);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      // Cleanup event listener on unmount
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [shiftPositions]);

  return (
    <div className="App">
      {!filesDropped && <FileDropZone onFilesReceived={handleFilesReceived} />}
      {positions.length > 0 && (
        <ParticleScene
          positions={positions}
          boxSize={currentBoxSize}
          selectedParticles={selectedParticles} // Pass as prop
          setSelectedParticles={setSelectedParticles} // Pass as prop
        />
      )}
      {positions.length > 0 && !isLoading && (
        <div className="controls">
          <input
            type="range"
            min="0"
            max={totalConfigs - 1}
            value={currentConfigIndex}
            onChange={handleSliderChange}
          />
          <div>
            Configuration: {currentConfigIndex + 1} / {totalConfigs}
          </div>
          <div>Time: {currentTime.toLocaleString()}</div>
          {/* Checkbox to toggle Patch legend */}
          <label className="legend-toggle">
            <input
              type="checkbox"
              checked={showPatchLegend}
              onChange={(e) => setShowPatchLegend(e.target.checked)}
            />
            Show Patch Legend
          </label>
          {/* Checkbox to toggle Particle legend */}
          <label className="legend-toggle">
            <input
              type="checkbox"
              checked={showParticleLegend}
              onChange={(e) => setShowParticleLegend(e.target.checked)}
            />
            Show Particle Legend
          </label>
        </div>
      )}
      {/* Conditionally render the SelectedParticlesDisplay component */}
      {selectedParticles.length > 0 && (
        <SelectedParticlesDisplay selectedParticles={selectedParticles} />
      )}
      {/* Conditionally render the PatchLegend component */}
      {topData && showPatchLegend && !isLoading && (
        <PatchLegend
          patchIDs={topData.particleTypes.flatMap((type) => type.patches)}
        />
      )}
      {/* Conditionally render the ParticleLegend component */}
      {topData && showParticleLegend && !isLoading && (
        <ParticleLegend particleTypes={topData.particleTypes} />
      )}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p>Loading trajectory data...</p>
        </div>
      )}
    </div>
  );
}

export default App;
