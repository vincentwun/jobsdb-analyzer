import { useState, useEffect } from 'react';

/**
 * Custom hook for loading and managing result files
 */
export function useResultFiles(autoLoadFromUrl: boolean = false) {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Load file list from server
  const loadFileList = async () => {
    try {
      const res = await fetch('/results');
      if (!res.ok) throw new Error('Failed to fetch result list');
      const fileList: string[] = await res.json();
      setFiles(fileList);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Load specific file data
  const loadFileData = async (filename: string): Promise<any> => {
    if (!filename) {
      return null;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`/results/${encodeURIComponent(filename)}`);
      if (!res.ok) throw new Error('Failed to load result');

      const text = await res.text();
      const parsed = JSON.parse(text);
      return parsed;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFileList();

    // Auto-load file from URL if enabled
    if (autoLoadFromUrl) {
      const params = new URLSearchParams(window.location.search);
      const initialFile = params.get('file');
      if (initialFile) {
        setSelectedFile(initialFile);
      }
    }
  }, [autoLoadFromUrl]);

  return {
    files,
    selectedFile,
    setSelectedFile,
    isLoading,
    error,
    loadFileData,
    refreshFiles: loadFileList
  };
}
