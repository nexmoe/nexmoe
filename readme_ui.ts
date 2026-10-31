export type CuratedRepository = {
  name: string;
  repository: string;
  description: string;
  images?: { src: string; alt: string; href?: string }[];
};

export type OverviewInput = {
  followers: number;
  stars: number;
  forks: number;
  repositoryCount: number;
  activity: { commits: number; prs: number; issues: number; total: number; contributed_to: number };
  starSources: { label: string; value: number }[];
  organizationSources: { label: string; value: number }[];
  lastUpdated: string;
};

export function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// SVG is reserved for custom heading rules and right-aligned dates.
const styles = `
  text{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:16px}
  .section{font-size:24px;font-weight:700;fill:#2f5785}
  .rule{stroke:#d2deec;stroke-width:1}
  .meta{font-style:italic;fill:#4e91e6}
  @media(prefers-color-scheme:dark){.section{fill:#a8c8ed}.rule{stroke:#34465c}.meta{fill:#7db0f2}}`;

function svg(width: number | "100%", height: number, title: string, body: string, description = title) {
  const viewBox = typeof width === "number" ? ` viewBox="0 0 ${width} ${height}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"${viewBox} role="img" aria-labelledby="title description">
<title id="title">${escapeXml(title)}</title>
<desc id="description">${escapeXml(description)}</desc>
<style>${styles}</style>
${body}
</svg>\n`;
}

export function buildSectionHeadingSvg(title: string) {
  const textWidth = [...title].reduce((width, char) => width + (
    /[\u2e80-\uffff]/u.test(char) ? 1 :
    /[ilI.,:;'!|]/.test(char) ? .3 :
    /[MW@%]/.test(char) ? .95 :
    /\s/.test(char) ? .32 :
    /[A-Z0-9]/.test(char) ? .66 : .57
  ) * 24, 0);
  const lineStart = Math.ceil(textWidth * 1.06 + 24);
  // Without a viewBox, the 24px text stays fixed and only the rule stretches.
  return svg("100%", 48, title,
    `<line class="rule" x1="${lineStart}" y1="24" x2="100%" y2="24"/>
<text class="section" x="0" y="32">${escapeXml(title)}</text>`);
}

export function buildOverviewSvg(input: OverviewInput) {
  const activityTotal = input.activity.commits + input.activity.prs + input.activity.issues;
  const activityCommitsWidth = activityTotal > 0 ? (input.activity.commits / activityTotal) * 380 : 0;
  const activityPrsWidth = activityTotal > 0 ? (input.activity.prs / activityTotal) * 380 : 0;
  const activityIssuesWidth = activityTotal > 0 ? (input.activity.issues / activityTotal) * 380 : 0;
  const activityCommitsPercent = activityTotal > 0 ? (input.activity.commits / activityTotal) * 100 : 0;
  const activityPrsPercent = activityTotal > 0 ? (input.activity.prs / activityTotal) * 100 : 0;
  const activityIssuesPercent = activityTotal > 0 ? (input.activity.issues / activityTotal) * 100 : 0;

  const starTotal = input.starSources.reduce((sum, item) => sum + item.value, 0);
  const starSourcesData = input.starSources.map(item => ({
    ...item,
    width: starTotal > 0 ? (item.value / starTotal) * 380 : 0,
    percent: starTotal > 0 ? (item.value / starTotal) * 100 : 0,
  }));
  let starX = 0;
  const starBars = starSourcesData.map(item => {
    const rect = `<rect class="${item.label === 'Owned repositories' ? 'owned' : item.label === 'Member / collaborator' ? 'collab' : 'orgs'}" x="${starX.toFixed(2)}" y="0" width="${item.width.toFixed(2)}" height="12"/>`;
    starX += item.width;
    return rect;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="360" viewBox="0 0 900 360" role="img" aria-labelledby="overview-title overview-desc">
<title id="overview-title">Nexmoe open-source overview</title>
<desc id="overview-desc">${input.stars.toLocaleString()} stars, ${input.followers.toLocaleString()} followers, ${input.forks.toLocaleString()} forks, ${input.activity.commits.toLocaleString()} commits across ${input.repositoryCount} repositories</desc>
<defs>
  <clipPath id="activity"><rect x="0" y="0" width="380" height="12" rx="6"/></clipPath>
  <clipPath id="sources"><rect x="0" y="0" width="380" height="12" rx="6"/></clipPath>
</defs>
<style>
  text{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif;font-variant-numeric:tabular-nums}
  .hero{font-size:80px;font-weight:800;letter-spacing:-3.5px;fill:#1d1d1f}
  .large{font-size:40px;font-weight:700;letter-spacing:-1.5px;fill:#1d1d1f}
  .metric{font-size:24px;font-weight:600;letter-spacing:-0.8px;fill:#1d1d1f}
  .section{font-size:15px;font-weight:600;fill:#1d1d1f}
  .label{font-size:11px;font-weight:600;letter-spacing:0.3px;text-transform:uppercase;fill:#8e8e93}
  .body{font-size:13px;font-weight:500;fill:#3c3c43}
  .value{font-size:12px;font-weight:500;fill:#8e8e93}
  .track{fill:#f0f0f5}
  .commits{fill:#007aff}
  .prs{fill:#34c759}
  .issues{fill:#ff9500}
  .owned{fill:#5856d6}
  .collab{fill:#af52de}
  .orgs{fill:#ff2d55}
  @media (prefers-color-scheme:dark){
    .hero,.large,.metric,.section,.body{fill:#f5f5f7}
    .label,.value{fill:#98989d}
    .track{fill:#2c2c2e}
  }
</style>

<!-- Main metric -->
<text class="hero" x="0" y="70">${input.stars.toLocaleString()}</text>
<text class="label" x="0" y="90">Total Stars · ${input.repositoryCount} Repositories</text>

<!-- Key metrics grid -->
<g transform="translate(0, 140)">
  <text class="large" x="0" y="0">${input.followers.toLocaleString()}</text>
  <text class="label" x="0" y="18">Followers</text>
</g>
<g transform="translate(200, 140)">
  <text class="large" x="0" y="0">${input.forks.toLocaleString()}</text>
  <text class="label" x="0" y="18">Forks</text>
</g>
<g transform="translate(420, 140)">
  <text class="large" x="0" y="0">${input.activity.contributed_to.toLocaleString()}</text>
  <text class="label" x="0" y="18">Contributed To</text>
</g>
<g transform="translate(640, 140)">
  <text class="large" x="0" y="0">${input.activity.commits.toLocaleString()}</text>
  <text class="label" x="0" y="18">Commits</text>
</g>

<!-- Activity breakdown -->
<g transform="translate(0, 240)">
  <text class="section" x="0" y="0">Activity Distribution</text>
  <g transform="translate(0, 20)">
    <rect class="track" width="380" height="12" rx="6"/>
    <g clip-path="url(#activity)">
      <rect class="commits" x="0" y="0" width="${activityCommitsWidth.toFixed(2)}" height="12"/>
      <rect class="prs" x="${activityCommitsWidth.toFixed(2)}" y="0" width="${activityPrsWidth.toFixed(2)}" height="12"/>
      <rect class="issues" x="${(activityCommitsWidth + activityPrsWidth).toFixed(2)}" y="0" width="${activityIssuesWidth.toFixed(2)}" height="12"/>
    </g>
  </g>
  <g transform="translate(0, 48)">
    <circle class="commits" cx="6" cy="0" r="4"/>
    <text class="body" x="18" y="4">Commits</text>
    <text class="value" x="240" y="4">${input.activity.commits.toLocaleString()} · ${activityCommitsPercent.toFixed(1)}%</text>
  </g>
  <g transform="translate(0, 72)">
    <circle class="prs" cx="6" cy="0" r="4"/>
    <text class="body" x="18" y="4">Pull requests</text>
    <text class="value" x="240" y="4">${input.activity.prs.toLocaleString()} · ${activityPrsPercent.toFixed(1)}%</text>
  </g>
  <g transform="translate(0, 96)">
    <circle class="issues" cx="6" cy="0" r="4"/>
    <text class="body" x="18" y="4">Issues</text>
    <text class="value" x="240" y="4">${input.activity.issues.toLocaleString()} · ${activityIssuesPercent.toFixed(1)}%</text>
  </g>
</g>

<!-- Star sources -->
<g transform="translate(460, 240)">
  <text class="section" x="0" y="0">Star Sources</text>
  <g transform="translate(0, 20)">
    <rect class="track" width="380" height="12" rx="6"/>
    <g clip-path="url(#sources)">
      ${starBars}
    </g>
  </g>
  ${starSourcesData.map((item, i) => `<g transform="translate(0, ${48 + i * 24})">
    <circle class="${item.label === 'Owned repositories' ? 'owned' : item.label === 'Member / collaborator' ? 'collab' : 'orgs'}" cx="6" cy="0" r="4"/>
    <text class="body" x="18" y="4">${escapeXml(item.label)}</text>
    <text class="value" x="240" y="4">${item.value.toLocaleString()} · ${item.percent.toFixed(1)}%</text>
  </g>`).join('\n  ')}
</g>

</svg>`;
}

function isImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (/^\.\/assets\/(?:[a-z0-9_-]+\/)*[a-z0-9._-]+\.(?:webp|png|jpe?g|gif|svg)$/i.test(value)) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function validateRepositories(value: unknown): CuratedRepository[] {
  if (!Array.isArray(value)) throw new Error("repositories.json must contain an array.");
  const seen = new Set<string>();
  return value.map((item, index) => {
    if (!item || typeof item.name !== "string" || !item.name.trim() ||
        typeof item.description !== "string" || !item.description.trim() ||
        typeof item.repository !== "string" ||
        !/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(item.repository)) {
      throw new Error(`Invalid repository entry at index ${index}.`);
    }
    const key = item.repository.toLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate repository: ${item.repository}`);
    seen.add(key);
    let images: CuratedRepository["images"];
    if (item.images !== undefined) {
      if (!Array.isArray(item.images)) throw new Error(`Invalid images for ${item.repository}.`);
      images = item.images.map((image: unknown) => {
        if (!image || typeof image !== "object" || !("src" in image) || !isImageUrl(image.src) ||
            !("alt" in image) || typeof image.alt !== "string" || !image.alt.trim() ||
            ("href" in image && !isImageUrl(image.href))) {
          throw new Error(`Invalid image for ${item.repository}.`);
        }
        return { src: image.src, alt: image.alt.trim(), ...("href" in image ? { href: image.href as string } : {}) };
      });
    }
    return { name: item.name.trim(), repository: item.repository, description: item.description.trim(), ...(images ? { images } : {}) };
  });
}

export function repositoryAssetName(repo: CuratedRepository) {
  return repo.repository.toLowerCase().replace("/", "-");
}

export function buildRepositoryDateSvg(createdAt?: string) {
  const date = createdAt?.slice(0, 10) ?? "—";
  return svg(112, 24, createdAt ? `Created ${date}` : "Creation date unavailable",
    `<text class="meta" text-anchor="end" x="110" y="18">${escapeXml(date)}</text>`);
}

export function buildRepositoryMarkup(repos: CuratedRepository[], stars: Record<string, number> = {}, createdAt: Record<string, string> = {}) {
  return `<div>\n` + repos.map(repo => {
    const images = repo.images ?? [];
    const imageSize = images.length === 1 ? 'width="100%"' : 'height="200"';
    // GitHub removes custom layout CSS. Its native table styles provide a
    // contained scrollbar; nowrap keeps linked screenshots on a single line.
    // The hint also gives the cell an intrinsic minimum width, preventing
    // GitHub's max-width:100% image rule from squeezing these 200px-tall images.
    const gallery = images.length ? (images.length === 1 ? `\n<p>\n` : `\n<table>\n<tr><td nowrap>\n  <sub>Scroll horizontally to explore all screenshots · Click any image to view it in full size</sub><br>\n`) + images.map(image =>
      `  <a href="${escapeXml(image.href ?? image.src)}"><img src="${escapeXml(image.src)}" alt="${escapeXml(image.alt)}" ${imageSize}></a>`
    ).join("\n") + (images.length === 1 ? `\n</p>` : `\n</td></tr>\n</table>`) : "";
    return `<p>
  <img align="right" src="./assets/repository-dates/${repositoryAssetName(repo)}.svg" alt="${escapeXml(createdAt[repo.repository] ? `Created ${createdAt[repo.repository].slice(0, 10)}` : "Creation date unavailable")}" width="112" height="24">
  <strong><a href="https://github.com/${repo.repository}">${escapeXml(repo.name)}</a></strong> &nbsp; <span>★&nbsp;${stars[repo.repository]?.toLocaleString("en-US") ?? "Unavailable"}</span><br>
  ${escapeXml(repo.description)}
</p>${gallery}`;
  }).join("\n") + `\n</div>`;
}
