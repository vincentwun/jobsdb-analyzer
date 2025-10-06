import React, { useState, useEffect } from 'react';
import { useResultFiles } from '../hooks/useResultFiles';
import { parseJobsFromJson, JobSummary } from '../utils/jobParser';
import { FileSelector } from '../components/FileSelector';

export const ResultPage: React.FC = () => {
  const { files, selectedFile, setSelectedFile, isLoading, error, jobCount, loadFileData } = useResultFiles(true);
  const [jobSummaries, setJobSummaries] = useState<JobSummary[]>([]);

  useEffect(() => {
    if (selectedFile) {
      loadFile(selectedFile);
    } else {
      setJobSummaries([]);
    }
  }, [selectedFile]);

  const loadFile = async (filename: string) => {
    const data = await loadFileData(filename);
    if (data) {
      const summaries = parseJobsFromJson(data);
      setJobSummaries(summaries);
    } else {
      setJobSummaries([]);
    }
  };

  return (
    <section className="panel">
      <h2>Scrape Results</h2>
      <div className="result-wrapper">
        <FileSelector
          files={files}
          selectedFile={selectedFile}
          onFileChange={setSelectedFile}
          jobCount={jobCount}
        />

        {isLoading && <div className="readable-view">Loading...</div>}
        {error && <div className="readable-view" style={{ color: 'red' }}>Error: {error}</div>}

        {!isLoading && !error && jobSummaries.length === 0 && selectedFile && (
          <div className="readable-view">(no jobs found in this file)</div>
        )}

        {!isLoading && !error && jobSummaries.length === 0 && !selectedFile && (
          <div className="readable-view">Select a file from the list to view a human-readable summary.</div>
        )}

        {!isLoading && !error && jobSummaries.length > 0 && (
          <div id="readableView" className="readable-view">
            <ol className="job-summary-list" style={{ paddingLeft: '16px', margin: 0 }}>
              {jobSummaries.map((job) => (
                <li
                  key={job.id}
                  className="job-summary"
                  style={{
                    marginBottom: '12px',
                    padding: '10px',
                    borderRadius: '8px',
                    background: 'var(--card)',
                    boxShadow: '0 1px 0 rgba(0,0,0,0.04)'
                  }}
                >
                  <div className="job-row" style={{ fontSize: '14px', marginBottom: '6px' }}>
                    <strong>{job.title}</strong>
                    <span className="meta" style={{ color: 'var(--muted)', marginLeft: '8px' }}>
                      | {job.company ?? 'Unknown'}
                    </span>
                  </div>
                  <div className="job-meta" style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '6px' }}>
                    {job.location ?? ''}
                    {job.salary ? ` | ${job.salary}` : ''}
                  </div>
                  <div className="job-skills" style={{ marginBottom: '6px' }}>
                    Skills:{' '}
                    {job.skills.length > 0 ? (
                      job.skills.map(skill => (
                        <span key={skill} className="skill">{skill}</span>
                      ))
                    ) : (
                      <span className="skill muted">none</span>
                    )}
                  </div>
                  <div className="job-snippet" style={{ color: '#444', fontSize: '13px' }}>
                    {job.snippet?.slice(0, 300)}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
};
