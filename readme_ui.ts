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
    overview: "Nexmoe open-source overview", totalStars: "Total Stars", repositories: "Repositories",
    followers: "Followers", forks: "Forks", contributedTo: "Contributed To", commits: "Commits",
    activity: "Activity Distribution", prs: "Pull requests", issues: "Issues", starSources: "Star Sources",
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

export function buildOverviewSvg(input: OverviewInput, locale: ReadmeLocale = "en") {
  const text = labels[locale];
  const sourceLabels: Record<string, string> = {
    "Owned repositories": text.owned,
    "Member / collaborator": text.member,
    "Organizations": text.organizations,
  };
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

  const description = locale === "zh-CN"
    ? `${input.stars.toLocaleString()} 个 Star，${input.followers.toLocaleString()} 位关注者，${input.forks.toLocaleString()} 次复刻，${input.repositoryCount} 个仓库，共 ${input.activity.commits.toLocaleString()} 次提交`
    : `${input.stars.toLocaleString()} stars, ${input.followers.toLocaleString()} followers, ${input.forks.toLocaleString()} forks, ${input.activity.commits.toLocaleString()} commits across ${input.repositoryCount} repositories`;
  return `<svg xmlns="http://www.w3.org/2000/svg" lang="${locale}" width="900" height="360" viewBox="0 0 900 360" role="img" aria-labelledby="overview-title overview-desc">
<title id="overview-title">${text.overview}</title>
<desc id="overview-desc">${description}</desc>
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
<text class="label" x="0" y="90">${text.totalStars} · ${input.repositoryCount} ${text.repositories}</text>

<!-- Key metrics grid -->
<g transform="translate(0, 140)">
  <text class="large" x="0" y="0">${input.followers.toLocaleString()}</text>
  <text class="label" x="0" y="18">${text.followers}</text>
</g>
<g transform="translate(200, 140)">
  <text class="large" x="0" y="0">${input.forks.toLocaleString()}</text>
  <text class="label" x="0" y="18">${text.forks}</text>
</g>
<g transform="translate(420, 140)">
  <text class="large" x="0" y="0">${input.activity.contributed_to.toLocaleString()}</text>
  <text class="label" x="0" y="18">${text.contributedTo}</text>
</g>
<g transform="translate(640, 140)">
  <text class="large" x="0" y="0">${input.activity.commits.toLocaleString()}</text>
  <text class="label" x="0" y="18">${text.commits}</text>
</g>

<!-- Activity breakdown -->
<g transform="translate(0, 240)">
  <text class="section" x="0" y="0">${text.activity}</text>
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
    <text class="body" x="18" y="4">${text.commits}</text>
    <text class="value" x="240" y="4">${input.activity.commits.toLocaleString()} · ${activityCommitsPercent.toFixed(1)}%</text>
  </g>
  <g transform="translate(0, 72)">
    <circle class="prs" cx="6" cy="0" r="4"/>
    <text class="body" x="18" y="4">${text.prs}</text>
    <text class="value" x="240" y="4">${input.activity.prs.toLocaleString()} · ${activityPrsPercent.toFixed(1)}%</text>
  </g>
  <g transform="translate(0, 96)">
    <circle class="issues" cx="6" cy="0" r="4"/>
    <text class="body" x="18" y="4">${text.issues}</text>
    <text class="value" x="240" y="4">${input.activity.issues.toLocaleString()} · ${activityIssuesPercent.toFixed(1)}%</text>
  </g>
</g>

<!-- Star sources -->
<g transform="translate(460, 240)">
  <text class="section" x="0" y="0">${text.starSources}</text>
  <g transform="translate(0, 20)">
    <rect class="track" width="380" height="12" rx="6"/>
    <g clip-path="url(#sources)">
      ${starBars}
    </g>
  </g>
  ${starSourcesData.map((item, i) => `<g transform="translate(0, ${48 + i * 24})">
    <circle class="${item.label === 'Owned repositories' ? 'owned' : item.label === 'Member / collaborator' ? 'collab' : 'orgs'}" cx="6" cy="0" r="4"/>
    <text class="body" x="18" y="4">${escapeXml(sourceLabels[item.label] ?? item.label)}</text>
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
