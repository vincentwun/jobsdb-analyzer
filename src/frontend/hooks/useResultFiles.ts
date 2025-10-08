// Summary: Manage list of result files, selected file state, and loading of file contents.
import { useState, useEffect } from 'react';
import { extractJobContents } from '../utils/jobParser';
import { getSelectedResultFile, saveSelectedResultFile } from '../utils/localStorage';

// useResultFiles: returns available files, selected file, loading state and helpers
export function useResultFiles(autoLoadFromUrl: boolean = false) {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [jobCount, setJobCount] = useState<number>(0);

  // loadFileList: fetch list of saved result filenames from the server
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

  // loadFileData: fetch and parse one result file by name
  const loadFileData = async (filename: string): Promise<any> => {
    if (!filename) return null;

    // If we have a cached file list, avoid requesting a missing file
    if (files.length > 0 && !files.includes(filename)) {
      setError('Selected file not found on server');
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

  // Update jobCount whenever selectedFile changes by extracting parsed job items
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

  // On mount: load file list and pick a selected file from URL or localStorage if available
  useEffect(() => {
    (async () => {
      const fileList = await loadFileList();

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

  // Persist selected file to localStorage
  useEffect(() => {
    if (selectedFile) saveSelectedResultFile(selectedFile);
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
