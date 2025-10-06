export interface JobSummary {
  id: string;
  title: string;
  company?: string;
  location?: string;
  salary?: string | null;
  skills: string[];
  snippet?: string;
}

const SKILL_KEYWORDS = [
  'aws','azure','gcp','docker','kubernetes','linux','python','sql','spark',
  'hadoop','react','node','java','scala','etl','tableau','powerbi','snowflake',
  'dbt','r','go','php','.net','c#','c++','typescript','typescript','aws'
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

export function parseJobsFromJson(jsonData: any): JobSummary[] {
  const out: JobSummary[] = [];

  const pages = Array.isArray(jsonData) ? jsonData : (jsonData.page ? [jsonData] : []);
  for (const p of pages) {
    const jobsWrapper = p.page?.jobs ?? p.jobs ?? [];
    for (const entry of jobsWrapper) {
      const jd = entry.jobDetails?.job ?? entry.job ?? null;
      if (!jd) continue;
      const title = jd.title ?? 'No title';
      const id = jd.id ?? jd.jobId ?? String(Math.random()).slice(2,8);
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

function escapeHtml(str: string): string {
  return String(str).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as any)[c]);
}

export function formatSummariesAsHtml(summaries: JobSummary[]): string {
  if (!summaries || summaries.length === 0) return '<div>(no jobs found)</div>';
  let html = '<ol class="job-summary-list" style="padding-left:16px;margin:0">';
  for (const s of summaries) {
    const skillText = s.skills.length ? s.skills.map(k => `<span class="skill">${escapeHtml(k)}</span>`).join(' ') : '<span class="skill muted">none</span>';
    html += `<li class="job-summary" style="margin-bottom:12px;padding:10px;border-radius:8px;background:var(--card);box-shadow:0 1px 0 rgba(0,0,0,0.04)">
      <div class="job-row" style="font-size:14px;margin-bottom:6px"><strong>${escapeHtml(s.title)}</strong> <span class="meta" style="color:var(--muted);margin-left:8px">| ${escapeHtml(s.company ?? 'Unknown')}</span></div>
      <div class="job-meta" style="color:var(--muted);font-size:13px;margin-bottom:6px">${escapeHtml(s.location ?? '')}${s.salary ? ' | ' + escapeHtml(String(s.salary)) : ''}</div>
      <div class="job-skills" style="margin-bottom:6px">Skills: ${skillText}</div>
      <div class="job-snippet" style="color:#444;font-size:13px">${escapeHtml((s.snippet ?? '').slice(0,300))}</div>
    </li>`;
  }
  html += '</ol>';
  return html;
}
