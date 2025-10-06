// Brief: Utilities to parse and extract job contents and summaries from scrape results
export interface JobSummary {
  id: string;
  title: string;
  company?: string;
  location?: string;
  salary?: string | null;
  skills: string[];
  snippet?: string;
}

export interface JobContentExtract {
  abstract: string;
  content: string;
}

const SKILL_KEYWORDS = [
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'linux', 'python', 'sql', 'spark',
  'hadoop', 'react', 'node', 'java', 'scala', 'etl', 'tableau', 'powerbi', 'snowflake',
  'dbt', 'r', 'go', 'php', '.net', 'c#', 'c++', 'typescript'
];

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSkillsFromText(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const kw of SKILL_KEYWORDS) {
    const esc = escapeForRegex(kw);
    const re = new RegExp(`\\b${esc}\\b`, 'i');
    if (re.test(lower)) found.add(kw);
  }
  return Array.from(found);
}

/**
 * Parse job summaries from JSON data (for ResultPage display)
 */
export function parseJobsFromJson(jsonData: any): JobSummary[] {
  const out: JobSummary[] = [];
  const pages = Array.isArray(jsonData) ? jsonData : (jsonData.page ? [jsonData] : []);
  
  for (const p of pages) {
    const jobsWrapper = p.page?.jobs ?? p.jobs ?? [];
    for (const entry of jobsWrapper) {
      const jd = entry.jobDetails?.job ?? entry.job ?? null;
      if (!jd) continue;
      
      const title = jd.title ?? 'No title';
      const id = jd.id ?? jd.jobId ?? String(Math.random()).slice(2, 8);
      const company = entry.jobDetails?.companyProfile?.name ?? entry.jobDetails?.advertiser?.name ?? undefined;
      const location = jd.location?.label ?? jd.location ?? undefined;
      const salary = jd.salary?.label ?? jd.salary ?? null;
      const textSrc = ((jd.abstract ?? '') + '\n' + (jd.content ?? '')).trim();
      const skills = extractSkillsFromText(textSrc);
      const snippet = (jd.abstract ?? '') || (jd.content ?? '').slice(0, 300);
      
      out.push({ id, title, company, location, salary, skills, snippet });
    }
  }
  return out;
}

/**
 * Extract job content (abstract + content) for analysis
 */
export function extractJobContents(jobData: any): JobContentExtract[] {
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

/**
 * Process location data from job data
 */
export function processLocationData(jobData: any): Record<string, number> {
  const locationCounts: Record<string, number> = {};

  if (Array.isArray(jobData)) {
    for (const pageData of jobData) {
      if (pageData.page && Array.isArray(pageData.page.jobs)) {
        for (const jobItem of pageData.page.jobs) {
          const job = jobItem.jobDetails?.job;
          const locationLabel = job?.location?.label || job?.location;

          if (locationLabel) {
            const normalizedLocation = String(locationLabel).split(',')[0].trim();
            locationCounts[normalizedLocation] = (locationCounts[normalizedLocation] || 0) + 1;
          }
        }
      }
    }
  }

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
