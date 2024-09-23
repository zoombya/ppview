import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

function FileDropZone({ onFilesReceived }) {
  const onDrop = useCallback(
    (acceptedFiles) => {
      onFilesReceived(acceptedFiles);
    },
    [onFilesReceived]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div className="dropzone" {...getRootProps()}>
      <input {...getInputProps()} />
      {isDragActive ? (
        <p>Drop the files here ...</p>
      ) : (
        <p>Drag & drop your .top and traj.dat files here, or click to select files</p>
      )}
    </div>
  );
}

export default FileDropZone;