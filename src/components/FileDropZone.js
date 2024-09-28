import React, { useRef } from 'react';

function FileDropZone({ onFilesReceived }) {
  const inputRef = useRef();

  const handleDrop = (event) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      onFilesReceived(files);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      onFilesReceived(files);
    }
  };

  return (
    <div
      className="dropzone"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => inputRef.current.click()}
    >
      <input
        ref={inputRef}
        type="file"
        style={{ display: 'none' }}
        multiple
        onChange={handleFileSelect}
      />
      <p>Drag and drop files here, or click to select files</p>
    </div>
  );
}

export default FileDropZone;