import React, { useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import FileDropZone from './components/FileDropZone';
import ParticleScene from './components/ParticleScene';
import PatchLegend from './components/PatchLegend'; // Optional: For displaying color legend
import './styles.css';

function App() {
  const [positions, setPositions] = useState([]);
  const [currentBoxSize, setCurrentBoxSize] = useState([34.199520111084, 34.199520111084, 34.199520111084]); // Updated default value based on example
  const [topData, setTopData] = useState(null);

  const [trajFile, setTrajFile] = useState(null);
  const [configIndex, setConfigIndex] = useState([]);
  const [currentConfigIndex, setCurrentConfigIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentEnergy, setCurrentEnergy] = useState([]);
  const [totalConfigs, setTotalConfigs] = useState(0);

  const handleFilesReceived = async (files) => {
    const fileMap = new Map();

    // Store all files in fileMap, normalizing file names
    files.forEach((file) => {
      fileMap.set(file.name.trim(), file);
    });

    console.log('Files received:', Array.from(fileMap.keys()));

    // Process .top file
    const topFile = files.find((file) => file.name.endsWith('.top'));
    if (topFile) {
      const topContent = await topFile.text();
      const parsedTopData = await parseTopFile(topContent, fileMap);
      setTopData(parsedTopData);
    } else {
      alert('Topology file (.top) is missing!');
      return;
    }

    // Get trajectory file
    const trajectoryFile = files.find((file) => file.name === 'traj.dat');
    if (trajectoryFile) {
      setTrajFile(trajectoryFile);
    } else {
      alert('Trajectory file (traj.dat) is missing!');
      return;
    }

    // Build the index
    const index = await buildTrajIndex(trajectoryFile);
    setConfigIndex(index);
    setTotalConfigs(index.length);
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
    const decoder = new TextDecoder('utf-8');
    const reader = file.stream().getReader();
    let result;
    let offset = 0;
    let index = [];
    let partialLine = '';
    const decoderOptions = { stream: true };

    while (!(result = await reader.read()).done) {
      const chunk = result.value;
      const textChunk = decoder.decode(chunk, decoderOptions);
      const lines = (partialLine + textChunk).split(/\r?\n/);
      partialLine = lines.pop(); // Save the last line in case it's incomplete

      for (const line of lines) {
        if (line.startsWith('t =')) {
          index.push(offset);
        }
        offset += new TextEncoder().encode(line + '\n').length;
      }
    }

    // Handle the last partial line
    if (partialLine.startsWith('t =')) {
      index.push(offset);
    }

    return index;
  };

  const loadConfiguration = async (file, index, configNumber) => {
    if (configNumber < 0 || configNumber >= index.length) {
      alert('Configuration number out of range');
      return false;
    }

    // Ensure topData is available
    if (!topData) {
      alert('Topology data not available.');
      return false;
    }

    const start = index[configNumber];
    const end = configNumber + 1 < index.length ? index[configNumber + 1] : file.size;
    const slice = file.slice(start, end);

    const content = await slice.text();
    const lines = content.split(/\r?\n/);

    const config = parseConfiguration(lines);
    if (config) {
      // Apply periodic boundaries
      const adjustedPositions = applyPeriodicBoundary(config.positions, config.boxSize);

      // Associate particle types and compute rotation matrices
      const positionsWithTypes = adjustedPositions.map((pos, index) => {
        const { typeIndex, particleType } = getParticleType(index, topData.particleTypes);

        let rotationMatrix = null;
        if (pos.a1 && pos.a3) {
          // Compute a2 as cross product of a3 and a1
          const a1 = new THREE.Vector3(pos.a1.x, pos.a1.y, pos.a1.z).normalize();
          const a3 = new THREE.Vector3(pos.a3.x, pos.a3.y, pos.a3.z).normalize();
          const a2 = new THREE.Vector3().crossVectors(a3, a1).normalize();

          // Recompute a3 to ensure orthogonality
          a3.crossVectors(a1, a2).normalize();

          // Create the rotation matrix
          const matrix = new THREE.Matrix3().set(
            a1.x, a2.x, a3.x,
            a1.y, a2.y, a3.y,
            a1.z, a2.z, a3.z
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
      alert('Failed to parse configuration');
      return false;
    }
  };

  // Function to parse a configuration from lines
  const parseConfiguration = (lines) => {
    let i = 0;
    const timeLine = lines[i++].trim();
    const time = parseFloat(timeLine.split('=')[1].trim());

    const bLine = lines[i++].trim();
    const bTokens = bLine.split('=');
    const boxSize = bTokens[1].trim().split(/\s+/).map(Number);

    const eLine = lines[i++].trim();
    const energyTokens = eLine.split('=');
    const energy = energyTokens[1].trim().split(/\s+/).map(Number);

    const positions = [];
    while (i < lines.length) {
      const line = lines[i++].trim();
      if (line === '') continue;
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

  // Function to parse the .top file
  const parseTopFile = async (content, fileMap) => {
    const lines = content.trim().split('\n');
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
      const patches = tokens[2] ? tokens[2].split(',').map(Number) : [];
      const fileName = tokens[3] ? tokens[3].trim() : '';
      cumulativeCount += count;

      const particleType = {
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
          console.warn(`Patch file '${fileName}' not found for particle type ${i}`);
          console.log('Available files:', Array.from(fileMap.keys()));
        }
      }

      particleTypes.push(particleType);
    }

    return { totalParticles, typeCount, particleTypes };
  };

  // Function to parse patch files
  const parsePatchFile = (content) => {
    const lines = content.trim().split('\n');
    const positions = lines.map((line) => {
      const tokens = line.trim().split(/\s+/).map(Number);
      const [x, y, z] = tokens;
      return { x, y, z };
    });
    return positions;
  };

  // Helper function to determine particle type based on index
  const getParticleType = (particleIndex, particleTypes) => {
    for (let i = 0; i < particleTypes.length; i++) {
      if (particleIndex < particleTypes[i].cumulativeCount) {
        return { typeIndex: i, particleType: particleTypes[i] };
      }
    }
    return { typeIndex: -1, particleType: null };
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

  return (
    <div className="App">
      <h1>Patchy Particle Viewer</h1>
      <FileDropZone onFilesReceived={handleFilesReceived} />
      {positions.length > 0 && (
        <ParticleScene positions={positions} boxSize={currentBoxSize} />
      )}
      {positions.length > 0 && (
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
        </div>
      )}
      {topData && (
        <PatchLegend
          patchIDs={topData.particleTypes.flatMap((type) => type.patches)}
        />
      )}
    </div>
  );
}

export default App;