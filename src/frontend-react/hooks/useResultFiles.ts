// Brief: Hook to load available result files and fetch selected file data
import { useState, useEffect } from 'react';
import { extractJobContents } from '../utils/jobParser';
import { getSelectedResultFile, saveSelectedResultFile } from '../utils/localStorage';

export function useResultFiles(autoLoadFromUrl: boolean = false) {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [jobCount, setJobCount] = useState<number>(0);

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

  // Auto-load job count when file is selected
  useEffect(() => {
    const loadJobCount = async () => {
      if (!selectedFile) {
        setJobCount(0);
        return;
      }

      try {
        const jobData = await loadFileData(selectedFile);
        if (jobData) {
          const jobContents = extractJobContents(jobData);
          setJobCount(jobContents.length);
        } else {
          setJobCount(0);
        }
      } catch (error) {
        console.error('Failed to load job count:', error);
        setJobCount(0);
      }
    };

    loadJobCount();
  }, [selectedFile]);

  useEffect(() => {
    loadFileList();

    // Auto-load file from URL, localStorage, or both
    if (autoLoadFromUrl) {
      const params = new URLSearchParams(window.location.search);
      const urlFile = params.get('file');
      if (urlFile) {
        setSelectedFile(urlFile);
      } else {
        // Fallback to localStorage if no URL param
        const savedFile = getSelectedResultFile();
        if (savedFile) {
          setSelectedFile(savedFile);
        }
      }
    } else {
      // Load from localStorage when not using URL
      const savedFile = getSelectedResultFile();
      if (savedFile) {
        setSelectedFile(savedFile);
      }
    }
  }, [autoLoadFromUrl]);

  // Save to localStorage when selectedFile changes
  useEffect(() => {
    if (selectedFile) {
      saveSelectedResultFile(selectedFile);
    }
  }, [selectedFile]);

  return {
    files,
    selectedFile,
    setSelectedFile,
    isLoading,
    error,
    jobCount,
    loadFileData,
    refreshFiles: loadFileList
  };
}
