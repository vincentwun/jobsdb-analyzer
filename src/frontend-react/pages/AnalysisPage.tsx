// Brief: Page that runs AI analyses on selected result files and shows charts
import React, { useState, useEffect } from 'react';
import { Chart, registerables } from 'chart.js';
import { useResultFiles } from '../hooks/useResultFiles';
import { extractJobContents } from '../utils/jobParser';
import { FileSelector } from '../components/FileSelector';
import { StatusMessage } from '../components/StatusMessage';
import { AnalysisSection } from '../components/AnalysisSection';
import { getGeminiApiKey, getGeminiModel } from '../utils/localStorage';
import { analysisRunner } from '../utils/analysisRunner';
import { AnalysisPresetKey, AnalysisSectionState } from '../utils/analysisTypes';
import { estimateTokenCount } from '../utils/langchain/langchainCoordinator';

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
  { key: 'location', title: 'Location Distribution', chartType: 'bar', parallel: false },
  { key: 'education', title: 'Education Requirements', chartType: 'bar', parallel: false }
];

export const AnalysisPage: React.FC = () => {
  const { files, selectedFile, setSelectedFile, jobCount, loadFileData } = useResultFiles(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'loading' | 'success' | 'error' } | null>(null);
  const [sectionsState, setSectionsState] = useState<Record<string, AnalysisSectionState>>({});
  const [selectedAnalysisTypes, setSelectedAnalysisTypes] = useState<Set<AnalysisPresetKey>>(new Set());
  const [estimatedTokens, setEstimatedTokens] = useState<number>(0);

  const setStatus = (text: string, type: 'loading' | 'success' | 'error') => {
    setStatusMessage({ text, type });
  };

  // Calculate estimated tokens when file or analysis types change
  useEffect(() => {
    const calculateTokens = async () => {
      if (!selectedFile || selectedAnalysisTypes.size === 0) {
        setEstimatedTokens(0);
        return;
      }

      try {
        const jobData = await loadFileData(selectedFile);
        if (!jobData) {
          setEstimatedTokens(0);
          return;
        }

        const jobContents = extractJobContents(jobData);
        if (jobContents.length === 0) {
          setEstimatedTokens(0);
          return;
        }

        // Only calculate tokens for AI-powered analysis (skills, certs)
        // Local analysis (experience, location, education) consume 0 tokens
        let totalTokens = 0;
        selectedAnalysisTypes.forEach(type => {
          if (type === 'skills' || type === 'certs') {
            const text = JSON.stringify(jobContents);
            totalTokens += estimateTokenCount(text);
          }
          // experience, location, education are processed locally - no tokens used
        });

        setEstimatedTokens(totalTokens);
      } catch (error) {
        console.error('Error calculating tokens:', error);
        setEstimatedTokens(0);
      }
    };

    calculateTokens();
  }, [selectedFile, selectedAnalysisTypes, loadFileData]);

  // Handle checkbox changes
  const handleCheckboxChange = (key: AnalysisPresetKey) => {
    setSelectedAnalysisTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Handle "All" checkbox
  const handleAllCheckbox = () => {
    if (selectedAnalysisTypes.size === ANALYSIS_SECTIONS.length) {
      setSelectedAnalysisTypes(new Set());
    } else {
      setSelectedAnalysisTypes(new Set(ANALYSIS_SECTIONS.map(s => s.key)));
    }
  };

  const handleAnalyzeAll = async () => {
    if (!selectedFile) {
      setStatus('Please select a result file.', 'error');
      return;
    }

    if (selectedAnalysisTypes.size === 0) {
      setStatus('Please select at least one analysis type.', 'error');
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

      // Filter sections based on user selection
      const selectedSections = ANALYSIS_SECTIONS.filter(s => selectedAnalysisTypes.has(s.key));

      // Initialize selected sections to loading state
      const initialState: Record<string, AnalysisSectionState> = {};
      selectedSections.forEach(section => {
        initialState[section.key] = { loading: true, result: null, error: null };
      });
      setSectionsState(initialState);

      setStatus(`Analyzing ${jobContents.length} jobs...`, 'loading');

      const model = getGeminiModel();

      // Group sections by parallel execution
      const parallelSections = selectedSections.filter(s => s.parallel);
      const sequentialSections = selectedSections.filter(s => !s.parallel);

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

      {/* Analysis Type Selection */}
      <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
        <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
          Select Analysis Types:
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {/* All checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={selectedAnalysisTypes.size === ANALYSIS_SECTIONS.length}
              onChange={handleAllCheckbox}
              style={{ marginRight: '6px', cursor: 'pointer' }}
            />
            <strong>All</strong>
          </label>

          <span style={{ color: '#d1d5db' }}>|</span>

          {/* Individual checkboxes */}
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={selectedAnalysisTypes.has('skills')}
              onChange={() => handleCheckboxChange('skills')}
              style={{ marginRight: '6px', cursor: 'pointer' }}
            />
            Skills
          </label>

          <span style={{ color: '#d1d5db' }}>|</span>

          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={selectedAnalysisTypes.has('certs')}
              onChange={() => handleCheckboxChange('certs')}
              style={{ marginRight: '6px', cursor: 'pointer' }}
            />
            Cert
          </label>

          <span style={{ color: '#d1d5db' }}>|</span>

          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={selectedAnalysisTypes.has('experience')}
              onChange={() => handleCheckboxChange('experience')}
              style={{ marginRight: '6px', cursor: 'pointer' }}
            />
            Experience
          </label>

          <span style={{ color: '#d1d5db' }}>|</span>

          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={selectedAnalysisTypes.has('location')}
              onChange={() => handleCheckboxChange('location')}
              style={{ marginRight: '6px', cursor: 'pointer' }}
            />
            Location
          </label>

          <span style={{ color: '#d1d5db' }}>|</span>

          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={selectedAnalysisTypes.has('education')}
              onChange={() => handleCheckboxChange('education')}
              style={{ marginRight: '6px', cursor: 'pointer' }}
            />
            Education
          </label>
        </div>

        {/* Token Estimate Display */}
        <div style={{ marginTop: '12px', fontSize: '13px', color: '#6b7280' }}>
          <strong>Estimate token:</strong>
          <span style={{ marginLeft: '6px', color: estimatedTokens > 0 ? '#059669' : '#9ca3af', fontWeight: '600' }}>
            {estimatedTokens.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="analysis-panel" style={{ marginTop: '20px' }}>
        <button
          className="btn-accent"
          onClick={handleAnalyzeAll}
          disabled={!selectedFile || selectedAnalysisTypes.size === 0}
          style={{ width: '100%', padding: '12px', fontSize: '16px' }}
        >
          <i className="fas fa-play" aria-hidden="true" style={{ marginRight: '8px' }}></i>
          Start Analysis
        </button>
      </div>

      {statusMessage && (
        <StatusMessage message={statusMessage.text} type={statusMessage.type} />
      )}

      {/* Render all analysis sections */}
      {ANALYSIS_SECTIONS.map(section => {
        const sectionState = sectionsState[section.key];
        // Only show sections that have been analyzed or are currently loading
        if (!sectionState) return null;

        return (
          <AnalysisSection
            key={section.key}
            id={section.key}
            title={section.title}
            result={sectionState.result}
            loading={sectionState.loading}
            error={sectionState.error}
            chartType={section.chartType}
          />
        );
      })}
    </section>
  );
};
