export type ReadmeLocale = "en" | "zh-CN";

export type CuratedRepository = {
  name: string;
  repository: string;
  description: string;
  description_zh?: string;
  images?: { src: string; alt: string; alt_zh?: string; href?: string }[];
};

const labels = {
  en: {
    overview: "Nexmoe open-source overview", totalStars: "Total stars", repositories: "repositories",
    followers: "Followers", forks: "Forks", contributedTo: "Contributed to", commits: "Commits",
    activity: "Contributions", prs: "Pull requests", issues: "Issues", starSources: "Star sources",
    owned: "Owned repositories", member: "Member / collaborator", organizations: "Organizations",
    created: "Created", dateUnavailable: "Creation date unavailable", unavailable: "Unavailable",
    galleryHint: "Scroll horizontally to explore all screenshots · Click any image to view it in full size",
  },
  "zh-CN": {
    overview: "Nexmoe 开源概览", totalStars: "Star 总数", repositories: "个仓库",
    followers: "关注者", forks: "复刻", contributedTo: "参与项目", commits: "提交",
    activity: "贡献分布", prs: "拉取请求", issues: "议题", starSources: "Star 来源",
    owned: "个人仓库", member: "成员 / 协作仓库", organizations: "组织仓库",
    created: "创建于", dateUnavailable: "暂无创建日期", unavailable: "暂无数据",
    galleryHint: "左右滑动或横向滚动，浏览全部功能截图 · 点击任意图片，即可查看原始尺寸的完整截图",
  },
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

// Bar segments take the heading palette in order, from navy to sky blue.
function breakdown(items: { label: string; value: number }[]) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let x = 0;
  return items.map((item, index) => {
    const width = total > 0 ? (item.value / total) * 400 : 0;
    const segment = { ...item, x, width, percent: total > 0 ? (item.value / total) * 100 : 0, tone: `tone${index % 3}` };
    x += width;
    return segment;
  });
}

export function buildOverviewSvg(input: OverviewInput, locale: ReadmeLocale = "en") {
  const text = labels[locale];
  const n = (value: number) => value.toLocaleString("en-US");
  const sourceLabels: Record<string, string> = {
    "Owned repositories": text.owned,
    "Member / collaborator": text.member,
    "Organizations": text.organizations,
  };
  const starSegments = breakdown(input.starSources.map(item => ({ ...item, label: sourceLabels[item.label] ?? item.label })));
  const activitySegments = breakdown([
    { label: text.commits, value: input.activity.commits },
    { label: text.prs, value: input.activity.prs },
    { label: text.issues, value: input.activity.issues },
  ]);
  // Both bands share one grid: columns start at x=0 and x=440, and the
  // star label shares its baseline (y=100) with the second metric row.
  const stat = (x: number, y: number, value: number, label: string) =>
    `<text class="stat" x="${x}" y="${y}">${n(value)}</text>\n<text class="label" x="${x}" y="${y + 18}">${label}</text>`;
  const chart = (x: number, title: string, segments: ReturnType<typeof breakdown>) => `<g transform="translate(${x}, 148)">
  <text class="title" x="0" y="0">${title}</text>
  <g transform="translate(0, 14)">
    <rect class="track" width="400" height="8" rx="4"/>
    <g clip-path="url(#bar)">${segments.map(s => `<rect class="${s.tone}" x="${s.x.toFixed(2)}" y="0" width="${s.width.toFixed(2)}" height="8"/>`).join("")}</g>
  </g>
  ${segments.map((s, i) => `<g transform="translate(0, ${48 + i * 26})">
    <circle class="${s.tone}" cx="4" cy="-5" r="4"/>
    <text class="body" x="16" y="0">${escapeXml(s.label)}</text>
    <text class="body" text-anchor="end" x="330" y="0">${n(s.value)}</text>
    <text class="value" text-anchor="end" x="400" y="0">${s.percent.toFixed(1)}%</text>
  </g>`).join("\n  ")}
</g>`;

  const description = locale === "zh-CN"
    ? `${n(input.stars)} 个 Star，${n(input.followers)} 位关注者，${n(input.forks)} 次复刻，${n(input.repositoryCount)} 个仓库，共 ${n(input.activity.commits)} 次提交`
    : `${n(input.stars)} stars, ${n(input.followers)} followers, ${n(input.forks)} forks, ${n(input.activity.commits)} commits across ${n(input.repositoryCount)} repositories`;

  return `<svg xmlns="http://www.w3.org/2000/svg" lang="${locale}" width="840" height="264" viewBox="0 0 840 264" role="img" aria-labelledby="overview-title overview-desc">
<title id="overview-title">${text.overview}</title>
<desc id="overview-desc">${description}</desc>
<defs><clipPath id="bar"><rect width="400" height="8" rx="4"/></clipPath></defs>
<style>
  text{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-variant-numeric:tabular-nums;fill:#1f2328}
  .hero{font-size:80px;font-weight:800;letter-spacing:-3px;fill:#2f5785}
  .stat{font-size:24px;font-weight:700;letter-spacing:-0.5px}
  .title{font-size:15px;font-weight:600}
  .label{font-size:13px;fill:#59636e}
  .body{font-size:14px}
  .value{font-size:14px;fill:#59636e}
  .track{fill:#eef3f9}
  .tone0{fill:#2f5785}
  .tone1{fill:#4e91e6}
  .tone2{fill:#a8c8ed}
  @media(prefers-color-scheme:dark){
    text{fill:#f0f6fc}
    .hero,.tone0{fill:#a8c8ed}
    .label,.value{fill:#9198a1}
    .track{fill:#1c2635}
    .tone2{fill:#34567f}
  }
</style>

<!-- Stars on the left; four supporting metrics in a 2 × 2 grid on the right -->
<text class="hero" x="0" y="68">${n(input.stars)}</text>
<text class="label" x="0" y="100">${text.totalStars} · ${n(input.repositoryCount)} ${text.repositories}</text>
${stat(440, 29, input.followers, text.followers)}
${stat(640, 29, input.forks, text.forks)}
${stat(440, 82, input.activity.contributed_to, text.contributedTo)}
${stat(640, 82, input.activity.commits, text.commits)}

<!-- Star sources sit under the stars, contributions under the activity metrics -->
${chart(0, text.starSources, starSegments)}
${chart(440, text.activity, activitySegments)}
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

function optionalTranslation(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid translation: ${field}.`);
  return value.trim();
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
    const description_zh = optionalTranslation(item.description_zh, `${item.repository}.description_zh`);
    let images: CuratedRepository["images"];
    if (item.images !== undefined) {
      if (!Array.isArray(item.images)) throw new Error(`Invalid images for ${item.repository}.`);
      images = item.images.map((image: unknown) => {
        if (!image || typeof image !== "object" || !("src" in image) || !isImageUrl(image.src) ||
            !("alt" in image) || typeof image.alt !== "string" || !image.alt.trim() ||
            ("href" in image && !isImageUrl(image.href))) {
          throw new Error(`Invalid image for ${item.repository}.`);
        }
        const alt_zh = optionalTranslation("alt_zh" in image ? image.alt_zh : undefined, `${item.repository}.alt_zh`);
        return { src: image.src, alt: image.alt.trim(), ...(alt_zh ? { alt_zh } : {}), ...("href" in image ? { href: image.href as string } : {}) };
      });
    }
    return { name: item.name.trim(), repository: item.repository, description: item.description.trim(), ...(description_zh ? { description_zh } : {}), ...(images ? { images } : {}) };
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

export function buildRepositoryMarkup(repos: CuratedRepository[], stars: Record<string, number> = {}, createdAt: Record<string, string> = {}, locale: ReadmeLocale = "en") {
  const text = labels[locale];
  return `<div>\n` + repos.map(repo => {
    const images = repo.images ?? [];
    const imageSize = images.length === 1 ? 'width="100%"' : 'height="200"';
    // GitHub removes custom layout CSS. Its native table styles provide a
    // contained scrollbar; nowrap keeps linked screenshots on a single line.
    // The hint also gives the cell an intrinsic minimum width, preventing
    // GitHub's max-width:100% image rule from squeezing these 200px-tall images.
    const gallery = images.length ? (images.length === 1 ? `\n<p>\n` : `\n<table>\n<tr><td nowrap>\n  <sub>${text.galleryHint}</sub><br>\n`) + images.map(image =>
      `  <a href="${escapeXml(image.href ?? image.src)}"><img src="${escapeXml(image.src)}" alt="${escapeXml(locale === "zh-CN" ? image.alt_zh ?? image.alt : image.alt)}" ${imageSize}></a>`
    ).join("\n") + (images.length === 1 ? `\n</p>` : `\n</td></tr>\n</table>`) : "";
    return `<p>
  <img align="right" src="./assets/repository-dates/${repositoryAssetName(repo)}.svg" alt="${escapeXml(createdAt[repo.repository] ? `${text.created} ${createdAt[repo.repository].slice(0, 10)}` : text.dateUnavailable)}" width="112" height="24">
  <strong><a href="https://github.com/${repo.repository}">${escapeXml(repo.name)}</a></strong> &nbsp; <span>★&nbsp;${stars[repo.repository]?.toLocaleString("en-US") ?? text.unavailable}</span><br>
  ${escapeXml(locale === "zh-CN" ? repo.description_zh ?? repo.description : repo.description)}
</p>${gallery}`;
  }).join("\n") + `\n</div>`;
}
