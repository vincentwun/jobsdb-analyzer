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
      return fileList;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return [];
    }
  };

  // Load specific file data
  const loadFileData = async (filename: string): Promise<any> => {
    if (!filename) {
      return null;
    }

    // Don't attempt to load a file that we know isn't present
    if (files.length > 0 && !files.includes(filename)) {
      const msg = 'Selected file not found on server';
      setError(msg);
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
    // Load file list, then choose a selected file only if it exists
    (async () => {
      const fileList = await loadFileList();

      // Auto-load file from URL, localStorage, or both
      if (autoLoadFromUrl) {
        const params = new URLSearchParams(window.location.search);
        const urlFile = params.get('file');
        if (urlFile) {
          if (fileList.includes(urlFile)) {
            setSelectedFile(urlFile);
          } else {
            setError('Selected file not found (from URL)');
            setSelectedFile('');
          }
        } else {
          // Fallback to localStorage if no URL param
          const savedFile = getSelectedResultFile();
          if (savedFile) {
            if (fileList.includes(savedFile)) {
              setSelectedFile(savedFile);
            } else {
              setError('Previously selected file not found; please choose a file');
              setSelectedFile('');
            }
          }
        }
      } else {
        // Load from localStorage when not using URL
        const savedFile = getSelectedResultFile();
        if (savedFile) {
          if (fileList.includes(savedFile)) {
            setSelectedFile(savedFile);
          } else {
            setError('Previously selected file not found; please choose a file');
            setSelectedFile('');
          }
        }
      }
    })();
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
