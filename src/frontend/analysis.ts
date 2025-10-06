// Frontend logic for analysis page with structured Gemini API integration
interface JobContentExtract {
  abstract: string;
  content: string;
}

interface AnalysisDataPoint {
  label: string;
  value: number;
  category: string;
}

interface GeminiAnalysisResponse {
  analysis_summary: string;
  data_points: AnalysisDataPoint[];
}

// Preset prompts configuration
const PRESET_PROMPTS = {
  skills: {
    title: 'Technical Skills Analysis',
    systemPrompt: `You are an expert HR and Technology Job Analyst. Analyze the provided job descriptions and extract the most common technical skills, programming languages, cloud platforms, and tools.

Focus on skills like: Python, Java, JavaScript, TypeScript, Go, C++, SQL, Docker, Kubernetes, AWS, Azure, GCP, Terraform, Jenkins, Git, React, Node.js, etc.

Group similar items (e.g., 'AWS', 'Amazon Web Services' → 'AWS'). Count frequency and return structured data.`,
    schema: {
      type: "OBJECT",
      properties: {
        analysis_summary: {
          type: "STRING",
          description: "Brief summary of findings"
        },
        data_points: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              label: { type: "STRING", description: "Skill name" },
              value: { type: "NUMBER", description: "Frequency count" },
              category: { type: "STRING", description: "Category (e.g., 'Programming Language', 'Cloud Platform', 'Tool')" }
            },
            required: ["label", "value", "category"]
          }
        }
      },
      required: ["analysis_summary", "data_points"]
    }
  },
  certs: {
    title: 'Certification Requirements Analysis',
    systemPrompt: `You are an expert HR and Technology Job Analyst. Analyze the provided job descriptions and extract required professional certifications and qualifications.

Focus on certifications like: AWS Certified Solutions Architect (SAA), Azure Administrator (AZ-104), Google Cloud Professional, CISSP, PMP, CKA (Certified Kubernetes Administrator), Terraform Associate, etc.

Group similar items and count frequency. Return structured data.`,
    schema: {
      type: "OBJECT",
      properties: {
        analysis_summary: {
          type: "STRING",
          description: "Brief summary of certification requirements"
        },
        data_points: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              label: { type: "STRING", description: "Certification name" },
              value: { type: "NUMBER", description: "Frequency count" },
              category: { type: "STRING", description: "Category (e.g., 'Cloud', 'Security', 'Project Management')" }
            },
            required: ["label", "value", "category"]
          }
        }
      },
      required: ["analysis_summary", "data_points"]
    }
  }
};

// Global chart instance
let currentChart: any = null;
let experienceChart: any = null;
let locationChart: any = null;

// DOM elements
let fileSelect: HTMLSelectElement;
let presetSelect: HTMLSelectElement;
let analyzeBtn: HTMLButtonElement;
let statusArea: HTMLElement;
let statusMessage: HTMLElement;
let resultsArea: HTMLElement;
let resultsSummary: HTMLElement;
let chartCanvas: HTMLCanvasElement;
let dataTableBody: HTMLTableSectionElement;
let experienceCanvas: HTMLCanvasElement;
let locationCanvas: HTMLCanvasElement;

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
  fileSelect = document.getElementById('fileSelector') as HTMLSelectElement;
  presetSelect = document.getElementById('presetSelector') as HTMLSelectElement;
  analyzeBtn = document.getElementById('analyzeBtn') as HTMLButtonElement;
  statusArea = document.getElementById('statusArea') as HTMLElement;
  statusMessage = document.getElementById('statusMessage') as HTMLElement;
  resultsArea = document.getElementById('resultsArea') as HTMLElement;
  resultsSummary = document.getElementById('resultsSummary') as HTMLElement;
  chartCanvas = document.getElementById('analysisChart') as HTMLCanvasElement;
  dataTableBody = document.getElementById('dataTableBody') as HTMLTableSectionElement;
  experienceCanvas = document.getElementById('experienceChart') as HTMLCanvasElement;
  locationCanvas = document.getElementById('locationChart') as HTMLCanvasElement;

  await loadResultFiles();
  analyzeBtn.addEventListener('click', handleAnalyze);

  // Enable analyze button when both file and preset are selected
  const checkEnableButton = () => {
    analyzeBtn.disabled = !(fileSelect.value && presetSelect.value);
  };

  fileSelect.addEventListener('change', checkEnableButton);
  presetSelect.addEventListener('change', checkEnableButton);

  // Initial check
  checkEnableButton();
});

async function loadResultFiles(): Promise<void> {
  try {
    const response = await fetch('/results');
    if (!response.ok) {
      throw new Error(`Failed to fetch result files: ${response.statusText}`);
    }
    
    const files: string[] = await response.json();
    
    fileSelect.innerHTML = '<option value="">-- Select a result file --</option>';
    files.forEach(file => {
      const option = document.createElement('option');
      option.value = file;
      option.textContent = file;
      fileSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading result files:', error);
    setStatus('Error loading result files. Please check server connection.', 'error');
  }
}

async function handleAnalyze(): Promise<void> {
  const selectedFile = fileSelect.value;
  const selectedPreset = presetSelect.value;

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

  resultsSummary.innerHTML = '';
  if (currentChart) {
    currentChart.destroy();
    currentChart = null;
  }

  setStatus('Loading job data...', 'loading');
  analyzeBtn.disabled = true;

  try {
    const jobData = await loadJobData(selectedFile);
    const jobContents = extractJobContents(jobData);

    if (jobContents.length === 0) {
      setStatus('No job data found in selected file.', 'error');
      analyzeBtn.disabled = false;
      return;
    }

    setStatus(`Analyzing ${jobContents.length} jobs with Gemini AI...`, 'loading');

    const analysisResult = await callGeminiStructured(apiKey, selectedPreset, jobContents);

    displayResults(analysisResult);
    setStatus('Analysis complete!', 'success');

    // Render additional charts (Experience & Location)
    renderExperienceChart(jobContents);
    renderLocationChart(jobData);

  } catch (error: any) {
    console.error('Analysis error:', error);
    setStatus(`Analysis failed: ${error.message}`, 'error');
  } finally {
    analyzeBtn.disabled = false;
  }
}

async function loadJobData(filename: string): Promise<any> {
  const response = await fetch(`/results/${encodeURIComponent(filename)}`);
  if (!response.ok) {
    throw new Error(`Failed to load file: ${response.statusText}`);
  }
  return await response.json();
}

function extractJobContents(jobData: any): JobContentExtract[] {
  const results: JobContentExtract[] = [];

  // Handle array of pages format
  if (Array.isArray(jobData)) {
    for (const pageData of jobData) {
      if (pageData.page && Array.isArray(pageData.page.jobs)) {
        for (const jobItem of pageData.page.jobs) {
          const job = jobItem.jobDetails?.job;
          if (job) {
            const abstract = job.abstract || '';
            const content = job.content || '';
            
            if (abstract || content) {
              results.push({ abstract, content });
            }
          }
        }
      }
    }
    return results;
  }

  // Fallback: Handle old format with jobsdb_scrape_results
  if (jobData.jobsdb_scrape_results && Array.isArray(jobData.jobsdb_scrape_results)) {
    for (const scrapeResult of jobData.jobsdb_scrape_results) {
      if (scrapeResult.job_list && Array.isArray(scrapeResult.job_list)) {
        for (const item of scrapeResult.job_list) {
          const abstract = item.abstract || '';
          const content = item.content || '';
          
          if (abstract || content) {
            results.push({ abstract, content });
          }
        }
      }
    }
  }

  return results;
}

async function callGeminiStructured(
  apiKey: string,
  presetKey: string,
  jobContents: JobContentExtract[]
): Promise<GeminiAnalysisResponse> {
  const preset = PRESET_PROMPTS[presetKey as keyof typeof PRESET_PROMPTS];
  
  const combinedText = jobContents
    .map((job, idx) => `Job ${idx + 1}:\nSummary: ${job.abstract}\nDetails: ${job.content}`)
    .join('\n\n');

  const requestBody = {
    contents: [{
      parts: [{
        text: `${preset.systemPrompt}\n\nJob Descriptions:\n${combinedText}`
      }]
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: preset.schema
    }
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error('Invalid response structure from Gemini API');
  }

  const textResponse = data.candidates[0].content.parts[0].text;
  const parsedResult: GeminiAnalysisResponse = JSON.parse(textResponse);

  return parsedResult;
}

function displayResults(result: GeminiAnalysisResponse): void {
  resultsSummary.innerHTML = `<p><strong>Analysis Summary:</strong> ${result.analysis_summary}</p>`;

  const topDataPoints = result.data_points
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  if (topDataPoints.length === 0) {
    resultsSummary.innerHTML += '<p>No data points found in analysis.</p>';
    return;
  }

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

  if (currentChart) {
    currentChart.destroy();
  }

  const ctx = chartCanvas.getContext('2d');
  if (!ctx) {
    console.error('Failed to get canvas context');
    return;
  }

  currentChart = new (window as any).Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Frequency',
        data: values,
        backgroundColor: backgroundColors,
        borderColor: backgroundColors.map(c => c),
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
            label: function(context: any) {
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
  
  // Show results area
  resultsArea.style.display = 'block';
  
  // Populate data table
  populateDataTable(topDataPoints);
}

function populateDataTable(dataPoints: AnalysisDataPoint[]): void {
  dataTableBody.innerHTML = '';
  
  const total = dataPoints.reduce((sum, dp) => sum + dp.value, 0);
  
  dataPoints.forEach(dp => {
    const row = dataTableBody.insertRow();
    const percentage = ((dp.value / total) * 100).toFixed(1);
    
    row.innerHTML = `
      <td style="padding:10px;border-bottom:1px solid #e5e7eb">${dp.label}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb">${dp.category}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${dp.value}</td>
      <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right">${percentage}%</td>
    `;
  });
}

function setStatus(message: string, type: 'loading' | 'success' | 'error'): void {
  statusArea.style.display = 'block';
  statusMessage.textContent = message;
  
  const colors = {
    loading: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
    success: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
    error: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' }
  };
  
  const color = colors[type];
  statusMessage.style.backgroundColor = color.bg;
  statusMessage.style.borderLeft = `4px solid ${color.border}`;
  statusMessage.style.color = color.text;
}

// ===============================================
// Experience Years Extraction (Regex-based)
// ===============================================

interface ExperienceRange {
  minYears: number;
  maxYears: number;
}

/**
 * Extract work experience years range using Regex patterns
 * Based on location_and_years.html implementation
 */
function extractExperienceManual(content: string): ExperienceRange {
  let min = 0;
  let max = 0;
  
  // Clean content: remove newlines and normalize spaces
  const cleanContent = content.toLowerCase().replace(/[\r\n]/g, ' ').replace(/\s+/g, ' ');

  // Pattern 1&2: Range expressions (N to M years, N-M years, Around N-M years)
  const regexRange = /(\d+)\s*(?:to|-)\s*(\d+)\s*years/i;
  const regexAroundRange = /around\s*(\d+)-(\d+)\s*years/i;

  let match = cleanContent.match(regexRange) || cleanContent.match(regexAroundRange);
  if (match) {
    min = parseInt(match[1]);
    max = parseInt(match[2]);
  }

  // Pattern 3: Minimum years (At least N year(s)) - only if no range found
  const regexAtLeast = /at\s*least\s*(\d+)\s*year/i;
  match = cleanContent.match(regexAtLeast);
  if (match && min === 0) {
    min = parseInt(match[1]);
    max = 20; // Set to max value to represent "or more"
  }

  // Pattern 4: N years or above - only if no range or "at least" found
  const regexOrAbove = /(\d+)\s*years?\s*or\s*above/i;
  match = cleanContent.match(regexOrAbove);
  if (match && min === 0) {
    min = parseInt(match[1]);
    max = 20;
  }

  // Swap if min > max (unless max is 20 representing "or more")
  if (min > max && max !== 20) {
    [min, max] = [max, min];
  }

  return { minYears: min, maxYears: max };
}

/**
 * Aggregate experience data into predefined year buckets
 */
function aggregateExperienceData(jobContents: JobContentExtract[]): Record<string, number> {
  const buckets: Record<string, number> = {
    '1-3 years': 0,
    '4-7 years': 0,
    '8-10 years': 0,
    '10+ years': 0,
  };

  for (const job of jobContents) {
    const combinedText = `${job.abstract} ${job.content}`;
    const { minYears } = extractExperienceManual(combinedText);

    if (minYears === 0) continue; // Skip if no experience data found

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
}

/**
 * Render Experience Years Bar Chart (Vertical)
 */
function renderExperienceChart(jobContents: JobContentExtract[]): void {
  const experienceCounts = aggregateExperienceData(jobContents);

  if (experienceChart) {
    experienceChart.destroy();
  }

  const ctx = experienceCanvas.getContext('2d');
  if (!ctx) {
    console.error('Failed to get experience chart context');
    return;
  }

  const labels = Object.keys(experienceCounts);
  const counts = Object.values(experienceCounts);

  // Generate gradient colors (green shades)
  const backgroundColors = labels.map((_, index) => {
    const lightness = 90 - (index * 12);
    return `hsl(142, 70%, ${lightness}%)`;
  });

  experienceChart = new (window as any).Chart(ctx, {
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
      indexAxis: 'x', // Vertical bars
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
}

// ===============================================
// Location Distribution
// ===============================================

/**
 * Extract and aggregate location data from job data
 */
function processLocationData(jobData: any): Record<string, number> {
  const locationCounts: Record<string, number> = {};

  // Handle array of pages format
  if (Array.isArray(jobData)) {
    for (const pageData of jobData) {
      if (pageData.page && Array.isArray(pageData.page.jobs)) {
        for (const jobItem of pageData.page.jobs) {
          const job = jobItem.jobDetails?.job;
          const locationLabel = job?.location?.label || job?.location;
          
          if (locationLabel) {
            // Normalize location (take first part before comma)
            const normalizedLocation = String(locationLabel).split(',')[0].trim();
            locationCounts[normalizedLocation] = (locationCounts[normalizedLocation] || 0) + 1;
          }
        }
      }
    }
  }

  // Fallback: Handle old format with jobsdb_scrape_results
  if (jobData.jobsdb_scrape_results && Array.isArray(jobData.jobsdb_scrape_results)) {
    for (const scrapeResult of jobData.jobsdb_scrape_results) {
      if (scrapeResult.job_list && Array.isArray(scrapeResult.job_list)) {
        for (const item of scrapeResult.job_list) {
          const locationLabel = item.location?.label || item.location;
          
          if (locationLabel) {
            const normalizedLocation = String(locationLabel).split(',')[0].trim();
            locationCounts[normalizedLocation] = (locationCounts[normalizedLocation] || 0) + 1;
          }
        }
      }
    }
  }

  return locationCounts;
}

/**
 * Render Location Distribution Bar Chart (Horizontal)
 */
function renderLocationChart(jobData: any): void {
  const locationCounts = processLocationData(jobData);

  if (locationChart) {
    locationChart.destroy();
  }

  const ctx = locationCanvas.getContext('2d');
  if (!ctx) {
    console.error('Failed to get location chart context');
    return;
  }

  // Sort by count (descending) and take top 10
  const sortedLocations = Object.entries(locationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const labels = sortedLocations.map(([location]) => location);
  const counts = sortedLocations.map(([, count]) => count);

  // Generate gradient colors (blue shades)
  const backgroundColors = labels.map((_, index) => {
    const lightness = 90 - (index * 8);
    return `hsl(217, 70%, ${lightness}%)`;
  });

  locationChart = new (window as any).Chart(ctx, {
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
      indexAxis: 'y', // Horizontal bars
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
}
