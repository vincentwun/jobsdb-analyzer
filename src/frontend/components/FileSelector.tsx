import React from 'react';

// Brief: File selector UI for choosing scraped result files
interface FileSelectorProps {
  files: string[];
  selectedFile: string;
  onFileChange: (file: string) => void;
  label?: string;
  showIcon?: boolean;
  jobCount?: number;
}
export const FileSelector: React.FC<FileSelectorProps> = ({
  files,
  selectedFile,
  onFileChange,
  label = 'Select source file:',
  showIcon = true,
  jobCount
}) => {
  return (
    <div className="file-selection">
      <div className="file-selection-row">
        <label className="file-selection-label">
          {showIcon && <i className="fas fa-folder-open" aria-hidden="true"></i>}
          {label}
        </label>
        <select
          className="file-select"
          value={selectedFile}
          onChange={(e) => onFileChange(e.target.value)}
        >
          <option value="">-- Select a result file --</option>
          {files.map(file => (
            <option key={file} value={file}>{file}</option>
          ))}
        </select>
      </div>
      
      {selectedFile && (
        <div className="file-info">
          <div className="file-info-line">
            <strong>Loaded:</strong> <span>{selectedFile}</span>
          </div>
          {jobCount !== undefined && (
            <div className="file-info-line">
              <strong>Jobs:</strong> <span>{jobCount}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
