import React from 'react';
import { getColorForPatchID } from '../utils/colorUtils';
import './PatchLegend.css'; // Create corresponding CSS

function PatchLegend({ patchIDs }) {
  // Remove duplicates
  const uniquePatchIDs = [...new Set(patchIDs)];

  return (
    <div className="patch-legend">
      <h3>Patch Legend</h3>
      <ul>
        {uniquePatchIDs.map((id) => (
          <li key={id}>
            <span
              className="color-box"
              style={{ backgroundColor: getColorForPatchID(id).getStyle() }}
            ></span>
            <span>Patch ID: {id}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PatchLegend;