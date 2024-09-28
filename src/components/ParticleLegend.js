import React from 'react';
import { mutedParticleColors } from '../colors'; 


function ParticleLegend({ particleTypes }) {
  return (
    <div className="particle-legend">
      <h3>Particle Color Legend</h3>
      <ul>
        {particleTypes.map((type, index) => (
          <li key={index}>
            <span
              className="color-box"
              style={{
                backgroundColor:
                  mutedParticleColors[type.typeIndex % mutedParticleColors.length],
              }}
            ></span>
            Particle Type {type.typeIndex}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ParticleLegend;