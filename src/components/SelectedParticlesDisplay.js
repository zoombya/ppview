import React from "react";

function SelectedParticlesDisplay({ selectedParticles }) {
  return (
    <div className="selected-particles-display">
      <h3>Selected Particles</h3>
      <ul>
        {selectedParticles.map((id) => (
          <li key={id}>{id}</li>
        ))}
      </ul>
    </div>
  );
}

export default SelectedParticlesDisplay;
