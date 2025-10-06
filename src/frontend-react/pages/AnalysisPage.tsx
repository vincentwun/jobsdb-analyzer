import React, { useState, useEffect, useRef } from 'react';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { GoogleGenAI, Type } from '@google/genai';
import { useResultFiles } from '../hooks/useResultFiles';
import { extractJobContents, processLocationData, JobContentExtract } from '../utils/jobParser';
import { FileSelector } from '../components/FileSelector';
import { StatusMessage } from '../components/StatusMessage';

// Register Chart.js components
Chart.register(...registerables);

interface AnalysisDataPoint {
  label: string;
  value: number;
  category: string;
}

interface GeminiAnalysisResponse {
  analysis_summary: string;
  data_points: AnalysisDataPoint[];
}

interface ExperienceRange {
  minYears: number;
  maxYears: number;
}

// Shared schema for analysis responses
const ANALYSIS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    analysis_summary: {
      type: Type.STRING,
      description: "Brief summary of findings"
    },
    data_points: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { 
            type: Type.STRING, 
            description: "Item name (skill, certification, etc.)" 
          },
          value: { 
            type: Type.INTEGER, 
            description: "Integer frequency count (how many times this item appears)" 
          },
          category: { 
            type: Type.STRING, 
            description: "Category classification" 
          }
        },
        required: ["label", "value", "category"],
        propertyOrdering: ["label", "value", "category"]
      }
    }
  },
  required: ["analysis_summary", "data_points"],
  propertyOrdering: ["analysis_summary", "data_points"]
};

const PRESET_PROMPTS = {
  skills: {
    title: 'Technical Skills Analysis',
    systemPrompt: `You are an expert HR and Technology Job Analyst. Analyze the provided job descriptions and extract the most common technical skills, programming languages, cloud platforms, and tools.

Focus on skills like: Python, Java, JavaScript, TypeScript, Go, C++, SQL, Docker, Kubernetes, AWS, Azure, GCP, Terraform, Jenkins, Git, React, Node.js, etc.

Group similar items (e.g., 'AWS', 'Amazon Web Services' → 'AWS'). 

CRITICAL INSTRUCTIONS:
- For each skill, count how many DIFFERENT job postings mention it
- The 'value' field MUST be a WHOLE NUMBER (integer) representing the actual count
- DO NOT use percentages, decimals, or ratios
- Example output format:
  {
    "analysis_summary": "Analysis of technical skills across job postings",
    "data_points": [
      {"label": "Python", "value": 15, "category": "Programming Language"},
      {"label": "Docker", "value": 12, "category": "Tool"},
      {"label": "AWS", "value": 10, "category": "Cloud Platform"}
    ]
  }

Note: The values 15, 12, 10 are integer counts, not 0.15, 0.12, 0.10.`,
    schema: ANALYSIS_RESPONSE_SCHEMA
  },
  certs: {
    title: 'Certification Requirements Analysis',
    systemPrompt: `You are an expert HR and Technology Job Analyst. Analyze the provided job descriptions and extract required professional certifications and qualifications.

Focus on certifications like: AWS Certified Solutions Architect (SAA), Azure Administrator (AZ-104), Google Cloud Professional, CISSP, PMP, CKA (Certified Kubernetes Administrator), Terraform Associate, etc.

Group similar items.

CRITICAL INSTRUCTIONS:
- For each certification, count how many DIFFERENT job postings require it
- The 'value' field MUST be a WHOLE NUMBER (integer) representing the actual count
- DO NOT use percentages, decimals, or ratios
- Example output format:
  {
    "analysis_summary": "Analysis of required certifications across job postings",
    "data_points": [
      {"label": "AWS Certified Solutions Architect", "value": 8, "category": "Cloud"},
      {"label": "CISSP", "value": 5, "category": "Security"},
      {"label": "PMP", "value": 3, "category": "Project Management"}
    ]
  }

Note: The values 8, 5, 3 are integer counts, not 0.8, 0.5, 0.3.`,
    schema: ANALYSIS_RESPONSE_SCHEMA
  }
};

export const AnalysisPage: React.FC = () => {
  const { files, selectedFile, setSelectedFile, loadFileData } = useResultFiles(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'loading' | 'success' | 'error' } | null>(null);
  const [analysisResult, setAnalysisResult] = useState<GeminiAnalysisResponse | null>(null);
  const [jobCount, setJobCount] = useState<number>(0);

  const mainChartRef = useRef<Chart | null>(null);
  const experienceChartRef = useRef<Chart | null>(null);
  const locationChartRef = useRef<Chart | null>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const experienceCanvasRef = useRef<HTMLCanvasElement>(null);
  const locationCanvasRef = useRef<HTMLCanvasElement>(null);

  const setStatus = (text: string, type: 'loading' | 'success' | 'error') => {
    setStatusMessage({ text, type });
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setStatus('Please select a result file.', 'error');
      return;
    }

    if (!selectedPreset) {
      setStatus('Please select an analysis preset.', 'error');
      return;
    }

    const apiKey = localStorage.getItem('GEMINI_API_KEY');
    if (!apiKey) {
      setStatus('Gemini API key not found. Please configure it in Settings.', 'error');
      return;
    }

    setAnalysisResult(null);
    setStatus('Loading job data...', 'loading');

    try {
      const jobData = await loadFileData(selectedFile);
      if (!jobData) {
        setStatus('Failed to load job data.', 'error');
        return;
      }

      const jobContents = extractJobContents(jobData);
      setJobCount(jobContents.length);

      if (jobContents.length === 0) {
        setStatus('No job data found in selected file.', 'error');
        return;
      }

      setStatus(`Analyzing ${jobContents.length} jobs with Gemini AI...`, 'loading');

      const result = await callGeminiStructured(apiKey, selectedPreset, jobContents);
      setAnalysisResult(result);
      setStatus('Analysis complete!', 'success');

      // Render charts after result is set
      setTimeout(() => {
        renderMainChart(result);
        renderExperienceChart(jobContents);
        renderLocationChart(jobData);
      }, 100);
    } catch (error: any) {
      console.error('Analysis error:', error);
      setStatus(`Analysis failed: ${error.message}`, 'error');
    }
  };

  const callGeminiStructured = async (
    apiKey: string,
    presetKey: string,
    jobContents: JobContentExtract[]
  ): Promise<GeminiAnalysisResponse> => {
    const preset = PRESET_PROMPTS[presetKey as keyof typeof PRESET_PROMPTS];
    const selectedModel = localStorage.getItem('GEMINI_MODEL') || 'gemini-2.5-flash-lite';

    const combinedText = jobContents
      .map((job, idx) => `Job ${idx + 1}:\nSummary: ${job.abstract}\nDetails: ${job.content}`)
      .join('\n\n');

    const promptText = `${preset.systemPrompt}\n\nJob Descriptions:\n${combinedText}`;

    // Initialize Gemini AI with API key
    const ai = new GoogleGenAI({ apiKey });

    try {
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: promptText,
        config: {
          responseMimeType: "application/json",
          responseSchema: preset.schema
        }
      });

      // Parse the response
      const resultText = response.text;
      
      if (!resultText) {
        throw new Error('Empty response from Gemini API');
      }

      const parsedResult: GeminiAnalysisResponse = JSON.parse(resultText);

      // Post-process: Ensure all values are integers and scale if needed
      // If values are decimals (like 0.2, 0.4), they might be normalized percentages
      const maxValue = Math.max(...parsedResult.data_points.map(dp => dp.value));
      const totalJobs = jobContents.length;
      
      // If max value is less than 1, assume these are percentages/ratios and scale up
      const scalingNeeded = maxValue < 1 && maxValue > 0;
      
      parsedResult.data_points = parsedResult.data_points.map(dp => ({
        ...dp,
        // If scaling needed, multiply by total jobs, otherwise just round
        value: Math.round(scalingNeeded ? dp.value * totalJobs : dp.value)
      }));

      return parsedResult;
    } catch (error: any) {
      console.error('Gemini API error:', error);
      throw new Error(`Gemini API error: ${error.message || String(error)}`);
    }
  };

  const renderMainChart = (result: GeminiAnalysisResponse) => {
    if (!mainCanvasRef.current) return;

    const topDataPoints = result.data_points
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);

    if (topDataPoints.length === 0) return;

    const labels = topDataPoints.map(dp => dp.label);
    const values = topDataPoints.map(dp => dp.value);

    const categoryColors: { [key: string]: string } = {};
    const colorPalette = [
      '#0ea5a4', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b',
      '#10b981', '#3b82f6', '#6366f1', '#14b8a6', '#f97316'
    ];
    let colorIndex = 0;

    const backgroundColors = topDataPoints.map(dp => {
      if (!categoryColors[dp.category]) {
        categoryColors[dp.category] = colorPalette[colorIndex % colorPalette.length];
        colorIndex++;
      }
      return categoryColors[dp.category];
    });

    if (mainChartRef.current) {
      mainChartRef.current.destroy();
    }

    const ctx = mainCanvasRef.current.getContext('2d');
    if (!ctx) return;

    mainChartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Frequency',
          data: values,
          backgroundColor: backgroundColors,
          borderColor: backgroundColors,
          borderWidth: 1
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Top 15 Items by Frequency',
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          tooltip: {
            callbacks: {
              label: function (context: any) {
                const dataPoint = topDataPoints[context.dataIndex];
                return `${dataPoint.label}: ${dataPoint.value} (${dataPoint.category})`;
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Frequency Count'
            }
          }
        }
      }
    });
  };

  const extractExperienceManual = (content: string): ExperienceRange => {
    let min = 0;
    let max = 0;

    const cleanContent = content.toLowerCase().replace(/[\r\n]/g, ' ').replace(/\s+/g, ' ');

    const regexRange = /(\d+)\s*(?:to|-)\s*(\d+)\s*years/i;
    const regexAroundRange = /around\s*(\d+)-(\d+)\s*years/i;

    let match = cleanContent.match(regexRange) || cleanContent.match(regexAroundRange);
    if (match) {
      min = parseInt(match[1]);
      max = parseInt(match[2]);
    }

    const regexAtLeast = /at\s*least\s*(\d+)\s*year/i;
    match = cleanContent.match(regexAtLeast);
    if (match && min === 0) {
      min = parseInt(match[1]);
      max = 20;
    }

    const regexOrAbove = /(\d+)\s*years?\s*or\s*above/i;
    match = cleanContent.match(regexOrAbove);
    if (match && min === 0) {
      min = parseInt(match[1]);
      max = 20;
    }

    if (min > max && max !== 20) {
      [min, max] = [max, min];
    }

    return { minYears: min, maxYears: max };
  };

  const aggregateExperienceData = (jobContents: JobContentExtract[]): Record<string, number> => {
    const buckets: Record<string, number> = {
      '1-3 years': 0,
      '4-7 years': 0,
      '8-10 years': 0,
      '10+ years': 0,
    };

    for (const job of jobContents) {
      const combinedText = `${job.abstract} ${job.content}`;
      const { minYears } = extractExperienceManual(combinedText);

      if (minYears === 0) continue;

      if (minYears >= 1 && minYears <= 3) {
        buckets['1-3 years']++;
      } else if (minYears >= 4 && minYears <= 7) {
        buckets['4-7 years']++;
      } else if (minYears >= 8 && minYears <= 10) {
        buckets['8-10 years']++;
      } else if (minYears > 10) {
        buckets['10+ years']++;
      }
    }

    return buckets;
  };

  const renderExperienceChart = (jobContents: JobContentExtract[]) => {
    if (!experienceCanvasRef.current) return;

    const experienceCounts = aggregateExperienceData(jobContents);

    if (experienceChartRef.current) {
      experienceChartRef.current.destroy();
    }

    const ctx = experienceCanvasRef.current.getContext('2d');
    if (!ctx) return;

    const labels = Object.keys(experienceCounts);
    const counts = Object.values(experienceCounts);

    const backgroundColors = labels.map((_, index) => {
      const lightness = 90 - (index * 12);
      return `hsl(142, 70%, ${lightness}%)`;
    });

    experienceChartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Job Count',
          data: counts,
          backgroundColor: backgroundColors,
          borderColor: '#10B981',
          borderWidth: 1,
          borderRadius: 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'x',
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Required Experience Years Distribution',
            font: {
              size: 14,
              weight: 'bold'
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Experience Range'
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Jobs'
            },
            ticks: {
              precision: 0
            }
          }
        }
      }
    });
  };

  const renderLocationChart = (jobData: any) => {
    if (!locationCanvasRef.current) return;

    const locationCounts = processLocationData(jobData);

    if (locationChartRef.current) {
      locationChartRef.current.destroy();
    }

    const ctx = locationCanvasRef.current.getContext('2d');
    if (!ctx) return;

    const sortedLocations = Object.entries(locationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const labels = sortedLocations.map(([location]) => location);
    const counts = sortedLocations.map(([, count]) => count);

    const backgroundColors = labels.map((_, index) => {
      const lightness = 90 - (index * 8);
      return `hsl(217, 70%, ${lightness}%)`;
    });

    locationChartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Job Count',
          data: counts,
          backgroundColor: backgroundColors,
          borderColor: '#3B82F6',
          borderWidth: 1,
          borderRadius: 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Top 10 Job Locations',
            font: {
              size: 14,
              weight: 'bold'
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Jobs'
            },
            ticks: {
              precision: 0
            }
          },
          y: {
            title: {
              display: true,
              text: 'Location'
            }
          }
        }
      }
    });
  };

  return (
    <section className="panel">
      <h2>
        <i className="fas fa-chart-line" aria-hidden="true" style={{ marginRight: '8px' }}></i>
        AI Analysis
      </h2>
      <p className="muted-note">Use Gemini AI to analyze job descriptions and extract structured insights</p>

      <FileSelector
        files={files}
        selectedFile={selectedFile}
        onFileChange={setSelectedFile}
        showIcon={false}
        jobCount={jobCount}
      />

      <div className="analysis-panel">
        <h3>Analysis Options</h3>

        <div className="form-group">
          <label>Preset Analysis:</label>
          <select
            id="presetSelector"
            className="form-select"
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(e.target.value)}
          >
            <option value="skills">Analyze Most Common Skills (Python, Docker, K8s, AWS, etc.)</option>
            <option value="certs">Analyze Required Certifications (AWS SAA, Azure AZ-104, etc.)</option>
          </select>
        </div>

        <div className="analysis-actions">
          <button
            id="analyzeBtn"
            disabled={!selectedFile || !selectedPreset}
            className="btn-accent"
            onClick={handleAnalyze}
          >
            Start Analysis
          </button>
        </div>
      </div>

      {statusMessage && (
        <StatusMessage message={statusMessage.text} type={statusMessage.type} />
      )}

      {analysisResult && (
        <div id="resultsArea" className="results-area">
          <h3 id="resultsTitle" className="results-title">Analysis Results</h3>
          <p id="resultsSummary" className="results-summary">
            <strong>Analysis Summary:</strong> {analysisResult.analysis_summary}
          </p>

          <div className="card panel-card">
            <canvas ref={mainCanvasRef} id="analysisChart"></canvas>
          </div>

          <div className="card panel-card table-card">
            <h4 className="table-title">Detailed Statistics</h4>
            <table id="dataTable">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th className="text-right">Count</th>
                  <th className="text-right">Percentage</th>
                </tr>
              </thead>
              <tbody id="dataTableBody">
                {analysisResult.data_points
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 15)
                  .map((dp, idx) => {
                    const total = analysisResult.data_points.reduce((sum, d) => sum + d.value, 0);
                    const percentage = ((dp.value / total) * 100).toFixed(1);
                    return (
                      <tr key={idx}>
                        <td style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>{dp.label}</td>
                        <td style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>{dp.category}</td>
                        <td style={{ padding: '10px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', fontWeight: 600 }}>
                          {dp.value}
                        </td>
                        <td style={{ padding: '10px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                          {percentage}%
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="card panel-card" style={{ marginTop: '24px' }}>
            <h4 className="table-title">
              <i className="fas fa-calendar-alt" aria-hidden="true" style={{ marginRight: '8px', color: 'var(--accent)' }}></i>
              Required Experience Years Distribution
            </h4>
            <div style={{ height: '450px', position: 'relative', padding: '16px 0' }}>
              <canvas ref={experienceCanvasRef} id="experienceChart"></canvas>
            </div>
          </div>

          <div className="card panel-card" style={{ marginTop: '24px' }}>
            <h4 className="table-title">
              <i className="fas fa-map-marker-alt" aria-hidden="true" style={{ marginRight: '8px', color: 'var(--accent)' }}></i>
              Job Location Distribution
            </h4>
            <div style={{ height: '450px', position: 'relative', padding: '16px 0' }}>
              <canvas ref={locationCanvasRef} id="locationChart"></canvas>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
