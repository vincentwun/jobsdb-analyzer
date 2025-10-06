// Inline parse_jobs functionality to avoid module import issues in browser
interface JobSummary {
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
  'dbt','r','go','php','.net','c#','c++','typescript','aws'
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

function parseJobsFromJson(jsonData: any): JobSummary[] {
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

function formatSummariesAsHtml(summaries: JobSummary[]): string {
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

async function load(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const initialFile = params.get('file');

  const jsonView = document.getElementById('jsonView');
  const meta = document.getElementById('meta');
  const fileTree = document.getElementById('fileTree');

  if (!jsonView || !meta || !fileTree) {
    console.error('Required elements not found');
    return;
  }

  // Populate file list
  let files: string[] = [];
  try {
    const listRes = await fetch('/results');
    if (!listRes.ok) {
      throw new Error('Failed to fetch result list');
    }
    files = await listRes.json();
    if (files.length === 0) {
      fileTree.innerHTML = '<div>(no results)</div>';
      const readable = document.getElementById('readableView');
      if(readable) readable.innerText = 'No result files available. Please run a scrape first.';
      meta!.innerText = '';
      return;
    }

    // Build a simple grouped tree by region prefix (jobsdb-<region>-...)
    const groups: Record<string, string[]> = {};
    for (const f of files) {
      const parts = f.split('-');
      const region = parts.length >= 2 ? parts[1] : 'other';
      if (!groups[region]) groups[region] = [];
      groups[region].push(f);
    }

    // render tree
    fileTree.innerHTML = '';
    for (const [region, flist] of Object.entries(groups)) {
      const section = document.createElement('div');
      const header = document.createElement('div');
      header.style.cursor = 'pointer';
      header.style.fontWeight = '600';
      header.style.margin = '6px 0';
      header.innerText = `${region} (${flist.length})`;
      const list = document.createElement('ul');
      list.style.listStyle = 'none';
      list.style.paddingLeft = '12px';
      list.style.marginTop = '4px';
      list.style.display = 'none';
      for (const f of flist) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#';
        a.innerText = f;
        a.style.display = 'inline-block';
        a.style.padding = '4px 6px';
        a.style.borderRadius = '4px';
        a.onclick = (ev) => {
          ev.preventDefault();
          loadFile(encodeURIComponent(f));
        };
        li.appendChild(a);
        list.appendChild(li);
      }
      header.onclick = () => {
        list.style.display = list.style.display === 'none' ? 'block' : 'none';
      };
      section.appendChild(header);
      section.appendChild(list);
      fileTree.appendChild(section);
    }
  } catch (e) {
    jsonView.innerText = 'Failed to load file list: ' + (e instanceof Error ? e.message : String(e));
    return;
  }

  async function loadFile(encodedFile: string | null) {
    if (!encodedFile) {
      jsonView!.innerText = 'No file specified';
      meta!.innerText = '';
      return;
    }
    try {
      const readable = document.getElementById('readableView');
      if (readable) readable.innerText = 'Loading...';

      const res = await fetch(`/results/${encodedFile}`);
      if (!res.ok) {
        jsonView!.innerText = 'Failed to load result';
        meta!.innerText = decodeURIComponent(encodedFile);
        return;
      }
      const text = await res.text();
      meta!.innerText = decodeURIComponent(encodedFile);

      // Try parse JSON and render human-readable output
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        // fallback: show raw text
        const readable = document.getElementById('readableView');
        if (readable) readable.innerText = 'Failed to parse JSON, showing raw output';
        jsonView!.innerText = text;
        jsonView!.style.display = 'block';
        return;
      }

      const summaries = parseJobsFromJson(parsed);
      // reuse readable variable
      const readable2 = document.getElementById('readableView');
      if (!summaries || summaries.length === 0) {
        if (readable2) readable2.innerText = '(no jobs found in this file)';
        jsonView!.innerText = text;
        jsonView!.style.display = 'block';
        return;
      }

      const html = formatSummariesAsHtml(summaries);
      if (readable2) {
        readable2.innerHTML = html;
        jsonView!.style.display = 'none';
      } else {
        jsonView!.innerText = text;
        jsonView!.style.display = 'block';
      }
    } catch (e) {
      jsonView!.innerText = 'Failed to load result: ' + (e instanceof Error ? e.message : String(e));
      meta!.innerText = decodeURIComponent(encodedFile);
    }
  }

  // initial load: if initialFile provided use it, otherwise do not load any file
  if (initialFile) {
    const initialEncoded = encodeURIComponent(initialFile);
    await loadFile(initialEncoded);
  }
}

load();
