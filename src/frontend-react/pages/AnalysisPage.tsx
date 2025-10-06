import React, { useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { useResultFiles } from '../hooks/useResultFiles';
import { extractJobContents } from '../utils/jobParser';
import { FileSelector } from '../components/FileSelector';
import { StatusMessage } from '../components/StatusMessage';
import { AnalysisSection } from '../components/AnalysisSection';
import { getGeminiApiKey, getGeminiModel } from '../utils/localStorage';
import { analysisRunner } from '../utils/analysisRunner';
import { AnalysisPresetKey, AnalysisSectionState } from '../utils/analysisTypes';

// Register Chart.js components
Chart.register(...registerables);

// Define analysis sections configuration
const ANALYSIS_SECTIONS: Array<{
  key: AnalysisPresetKey;
  title: string;
  chartType: 'bar' | 'pie';
  parallel: boolean;
}> = [
  { key: 'skills', title: 'Most Required Skills', chartType: 'bar', parallel: true },
  { key: 'certs', title: 'Most Required Certifications', chartType: 'bar', parallel: true },
  { key: 'experience', title: 'Required Experience Years', chartType: 'bar', parallel: false },
  { key: 'location', title: 'Location Distribution', chartType: 'bar', parallel: false }
];

export const AnalysisPage: React.FC = () => {
  const { files, selectedFile, setSelectedFile, jobCount, loadFileData } = useResultFiles(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'loading' | 'success' | 'error' } | null>(null);
  const [sectionsState, setSectionsState] = useState<Record<string, AnalysisSectionState>>({});

  const setStatus = (text: string, type: 'loading' | 'success' | 'error') => {
    setStatusMessage({ text, type });
  };

  const handleAnalyzeAll = async () => {
    if (!selectedFile) {
      setStatus('Please select a result file.', 'error');
      return;
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      setStatus('Gemini API key not found. Please configure it in Settings.', 'error');
      return;
    }

    setStatus('Loading job data...', 'loading');

    try {
      const jobData = await loadFileData(selectedFile);
      if (!jobData) {
        setStatus('Failed to load job data.', 'error');
        return;
      }

      const jobContents = extractJobContents(jobData);

      if (jobContents.length === 0) {
        setStatus('No job data found in selected file.', 'error');
        return;
      }

      // Initialize all sections to loading state
      const initialState: Record<string, AnalysisSectionState> = {};
      ANALYSIS_SECTIONS.forEach(section => {
        initialState[section.key] = { loading: true, result: null, error: null };
      });
      setSectionsState(initialState);

      setStatus(`Analyzing ${jobContents.length} jobs...`, 'loading');

      const model = getGeminiModel();

      // Group sections by parallel execution
      const parallelSections = ANALYSIS_SECTIONS.filter(s => s.parallel);
      const sequentialSections = ANALYSIS_SECTIONS.filter(s => !s.parallel);

      // Run parallel sections (skills + certs) concurrently
      await Promise.allSettled(
        parallelSections.map(async (section) => {
          try {
            const result = await analysisRunner(
              apiKey,
              model,
              section.key,
              section.key === 'location' ? jobData : jobContents
            );
            setSectionsState(prev => ({
              ...prev,
              [section.key]: { loading: false, result, error: null }
            }));
          } catch (err: any) {
            setSectionsState(prev => ({
              ...prev,
              [section.key]: { loading: false, result: null, error: err.message || 'Analysis failed' }
            }));
          }
        })
      );

      // Run sequential sections (experience + location) one by one
      for (const section of sequentialSections) {
        try {
          const result = await analysisRunner(
            apiKey,
            model,
            section.key,
            section.key === 'location' ? jobData : jobContents
          );
          setSectionsState(prev => ({
            ...prev,
            [section.key]: { loading: false, result, error: null }
          }));
        } catch (err: any) {
          setSectionsState(prev => ({
            ...prev,
            [section.key]: { loading: false, result: null, error: err.message || 'Analysis failed' }
          }));
        }
      }

      setStatus('Analysis complete!', 'success');
    } catch (error: any) {
      console.error('Analysis error:', error);
      setStatus(`Analysis failed: ${error.message}`, 'error');
    }
  };

  return (
    <section className="panel">
      <h2>
        <i className="fas fa-chart-bar" aria-hidden="true" style={{ marginRight: '8px' }}></i>
        AI Analysis
      </h2>
      <p className="muted-note">Use Gemini AI to analyze job market trends and requirements</p>

      <FileSelector
        files={files}
        selectedFile={selectedFile}
        onFileChange={setSelectedFile}
        showIcon={false}
        jobCount={jobCount}
      />

      <div className="analysis-panel" style={{ marginTop: '20px' }}>
        <button
          className="btn-accent"
          onClick={handleAnalyzeAll}
          disabled={!selectedFile}
          style={{ width: '100%', padding: '12px', fontSize: '16px' }}
        >
          <i className="fas fa-play" aria-hidden="true" style={{ marginRight: '8px' }}></i>
          Start Analysis (All Sections)
        </button>
      </div>

      {statusMessage && (
        <StatusMessage message={statusMessage.text} type={statusMessage.type} />
      )}

      {/* Render all analysis sections */}
      {ANALYSIS_SECTIONS.map(section => (
        <AnalysisSection
          key={section.key}
          id={section.key}
          title={section.title}
          result={sectionsState[section.key]?.result || null}
          loading={sectionsState[section.key]?.loading || false}
          error={sectionsState[section.key]?.error}
          chartType={section.chartType}
        />
      ))}
    </section>
  );
};
