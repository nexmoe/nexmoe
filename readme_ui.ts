import { inflateSync } from "node:zlib";

export type ReadmeLocale = "en" | "zh-CN";

export type CuratedImage = {
  src: string;
  alt: string;
  alt_zh?: string;
  href?: string;
};

export type CuratedRepository = {
  name: string;
  repository: string;
  url?: string;
  description: string;
  description_zh?: string;
  icon?: string;
  features?: string[];
  features_zh?: string[];
  images?: CuratedImage[];
};

export type CuratedProduct = {
  id: string;
  name: string;
  url: string;
  created_at: string;
  meta?: string;
  meta_zh?: string;
  icon?: string;
  description: string;
  description_zh?: string;
  features?: string[];
  features_zh?: string[];
  images?: CuratedImage[];
};

export type LogoPalette = {
  primary: string;
  secondary: string;
};

export type CardPreviewImage = {
  href: string;
  width: number;
  height: number;
  alt?: string;
};

export type ProductCardInput = {
  name: string;
  url: string;
  meta: string;
  description: string;
  iconHref?: string;
  iconMode?: "full" | "squircle" | "inset";
  glowPrimary: string;
  glowSecondary: string;
  previews: CardPreviewImage[];
  totalFrames?: number;
  repoSlug?: string;
  stats?: {
    stars?: number;
    forks?: number;
    createdAt?: string;
  };
  features?: string[];
  locale?: ReadmeLocale;
};

const labels = {
  en: {
    overview: "Nexmoe open-source overview", totalStars: "Total stars", repositories: "repositories",
    followers: "Followers", forks: "Forks", contributedTo: "Contributed to", commits: "Commits",
    activity: "Contributions", prs: "Pull requests", issues: "Issues", starSources: "Star sources",
    owned: "Owned repositories", member: "Member / collaborator", organizations: "Organizations",
    created: "Created", dateUnavailable: "Creation date unavailable", unavailable: "Unavailable",
    galleryHint: "Scroll horizontally to explore all screenshots · Click any image to view it in full size",
    frames: "frames", openSource: "Open Source", starsLabel: "STARS", forksLabel: "FORKS",
    sinceLabel: "SINCE", overviewTab: "Overview", ownerLabel: "OWNER",
  },
  "zh-CN": {
    overview: "Nexmoe 开源概览", totalStars: "Star 总数", repositories: "个仓库",
    followers: "关注者", forks: "复刻", contributedTo: "参与项目", commits: "提交",
    activity: "贡献分布", prs: "拉取请求", issues: "议题", starSources: "Star 来源",
    owned: "个人仓库", member: "成员 / 协作仓库", organizations: "组织仓库",
    created: "创建于", dateUnavailable: "暂无创建日期", unavailable: "暂无数据",
    galleryHint: "左右滑动或横向滚动，浏览全部功能截图 · 点击任意图片，即可查看原始尺寸的完整截图",
    frames: "张预览", openSource: "开源项目", starsLabel: "STARS", forksLabel: "FORKS",
    sinceLabel: "创建于", overviewTab: "项目概览", ownerLabel: "归属",
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

// Generated SVGs provide custom heading rules and right-aligned dates.
const styles = `
  text{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:16px}
  .section{font-size:24px;font-weight:700;fill:#171717}
  .rule{stroke:#d4d4d4;stroke-width:1}
  .meta{font-style:italic;fill:#737373}
  @media(prefers-color-scheme:dark){.section{fill:#fafafa}.rule{stroke:#404040}.meta{fill:#a3a3a3}}`;

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
  // The transparent canvas adds 8px above and below the heading. Without a
  // viewBox, the 24px text stays fixed and only the rule stretches.
  return svg("100%", 64, title,
    `<line class="rule" x1="${lineStart}" y1="32" x2="100%" y2="32"/>
<text class="section" x="0" y="40">${escapeXml(title)}</text>`);
}

// Bar segments use three distinct gray tones, inverted for the dark theme.
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
  text{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-variant-numeric:tabular-nums;fill:#171717}
  .hero{font-size:80px;font-weight:800;letter-spacing:-3px;fill:#171717}
  .stat{font-size:24px;font-weight:700;letter-spacing:-0.5px}
  .title{font-size:15px;font-weight:600}
  .label{font-size:13px;fill:#737373}
  .body{font-size:14px}
  .value{font-size:14px;fill:#737373}
  .track{fill:#f5f5f5}
  .tone0{fill:#171717}
  .tone1{fill:#737373}
  .tone2{fill:#d4d4d4}
  @media(prefers-color-scheme:dark){
    text{fill:#fafafa}
    .hero,.tone0{fill:#fafafa}
    .label,.value,.tone1{fill:#a3a3a3}
    .track{fill:#262626}
    .tone2{fill:#525252}
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

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
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

function optionalStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some(item => typeof item !== "string" || !item.trim())) {
    throw new Error(`Invalid list: ${field}.`);
  }
  return value.map(item => item.trim());
}

function validateImages(rawImages: unknown, ownerLabel: string): CuratedImage[] | undefined {
  if (rawImages === undefined) return undefined;
  if (!Array.isArray(rawImages)) throw new Error(`Invalid images for ${ownerLabel}.`);
  return rawImages.map((image: unknown) => {
    if (!image || typeof image !== "object" || !("src" in image) || !isImageUrl(image.src) ||
        !("alt" in image) || typeof image.alt !== "string" || !image.alt.trim() ||
        ("href" in image && !isImageUrl(image.href))) {
      throw new Error(`Invalid image for ${ownerLabel}.`);
    }
    const alt_zh = optionalTranslation("alt_zh" in image ? image.alt_zh : undefined, `${ownerLabel}.alt_zh`);
    return {
      src: image.src,
      alt: image.alt.trim(),
      ...(alt_zh ? { alt_zh } : {}),
      ...("href" in image ? { href: image.href as string } : {}),
    };
  });
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
    if (item.url !== undefined && !isHttpsUrl(item.url)) {
      throw new Error(`Invalid website for ${item.repository}.`);
    }
    if (item.icon !== undefined && !isImageUrl(item.icon)) {
      throw new Error(`Invalid icon for ${item.repository}.`);
    }
    const features = optionalStringArray(item.features, `${item.repository}.features`);
    const features_zh = optionalStringArray(item.features_zh, `${item.repository}.features_zh`);
    const images = validateImages(item.images, item.repository);
    return {
      name: item.name.trim(),
      repository: item.repository,
      ...(item.url ? { url: item.url } : {}),
      description: item.description.trim(),
      ...(description_zh ? { description_zh } : {}),
      ...(item.icon ? { icon: item.icon } : {}),
      ...(features ? { features } : {}),
      ...(features_zh ? { features_zh } : {}),
      ...(images ? { images } : {}),
    };
  });
}

export function validateProducts(value: unknown): CuratedProduct[] {
  if (!Array.isArray(value)) throw new Error("products.json must contain an array.");
  const seen = new Set<string>();
  return value.map((item, index) => {
    if (!item || typeof item.id !== "string" || !/^[a-z0-9-]+$/i.test(item.id) ||
        typeof item.name !== "string" || !item.name.trim() ||
        typeof item.description !== "string" || !item.description.trim() ||
        !isHttpsUrl(item.url)) {
      throw new Error(`Invalid product entry at index ${index}.`);
    }
    const key = item.id.toLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate product: ${item.id}`);
    seen.add(key);
    if (typeof item.created_at !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.created_at) ||
        Number.isNaN(Date.parse(item.created_at)) ||
        new Date(item.created_at).toISOString().slice(0, 10) !== item.created_at) {
      throw new Error(`Invalid creation date for ${item.id}; use YYYY-MM-DD.`);
    }
    const meta = optionalTranslation(item.meta, `${item.id}.meta`);
    const meta_zh = optionalTranslation(item.meta_zh, `${item.id}.meta_zh`);
    const description_zh = optionalTranslation(item.description_zh, `${item.id}.description_zh`);
    if (item.icon !== undefined && !isImageUrl(item.icon)) {
      throw new Error(`Invalid icon for ${item.id}.`);
    }
    const features = optionalStringArray(item.features, `${item.id}.features`);
    const features_zh = optionalStringArray(item.features_zh, `${item.id}.features_zh`);
    const images = validateImages(item.images, item.id);
    return {
      id: item.id.toLowerCase(),
      name: item.name.trim(),
      url: item.url,
      created_at: item.created_at,
      ...(meta ? { meta } : {}),
      ...(meta_zh ? { meta_zh } : {}),
      description: item.description.trim(),
      ...(description_zh ? { description_zh } : {}),
      ...(item.icon ? { icon: item.icon } : {}),
      ...(features ? { features } : {}),
      ...(features_zh ? { features_zh } : {}),
      ...(images ? { images } : {}),
    };
  });
}

export function repositoryAssetName(repo: CuratedRepository) {
  return repo.repository.toLowerCase().replace("/", "-");
}

export function productAssetName(product: CuratedProduct) {
  return product.id.toLowerCase();
}

export function cardSvgFilename(slug: string, locale: ReadmeLocale = "en") {
  return locale === "zh-CN" ? `${slug}.zh-CN.svg` : `${slug}.svg`;
}

export function buildRepositoryDateSvg(createdAt?: string) {
  const date = createdAt?.slice(0, 10) ?? "—";
  return svg(112, 24, createdAt ? `Created ${date}` : "Creation date unavailable",
    `<text class="meta" text-anchor="end" x="110" y="18">${escapeXml(date)}</text>`);
}

// --- Pure-TS PNG / WebP Dimension & Color Extraction ---

function readUint32BE(bytes: Uint8Array, offset: number) {
  return ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0;
}

function readUint16LE(bytes: Uint8Array, offset: number) {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readUint24LE(bytes: Uint8Array, offset: number) {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

export function getImageDimensions(bytes: Uint8Array, mimeType: string): { width: number; height: number } | null {
  if (mimeType === "image/png" && bytes.length >= 24 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { width: readUint32BE(bytes, 16), height: readUint32BE(bytes, 20) };
  }
  if (mimeType === "image/webp" && bytes.length >= 30 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    const chunk = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
    if (chunk === "VP8 " && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return { width: readUint16LE(bytes, 26) & 0x3fff, height: readUint16LE(bytes, 28) & 0x3fff };
    }
    if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
      const b0 = bytes[21]!, b1 = bytes[22]!, b2 = bytes[23]!, b3 = bytes[24]!;
      return { width: (b0 | ((b1 & 0x3f) << 8)) + 1, height: ((b1 >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10)) + 1 };
    }
    if (chunk === "VP8X" && bytes.length >= 30) {
      return { width: readUint24LE(bytes, 24) + 1, height: readUint24LE(bytes, 27) + 1 };
    }
  }
  return null;
}

function paethPredictor(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export type DecodedPng = {
  width: number;
  height: number;
  rgba: Uint8Array;
};

export function extractPngPixels(bytes: Uint8Array): DecodedPng | null {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
    return null;
  }
  let offset = 8;
  let width = 0, height = 0, bitDepth = 8, colorType = 6, interlace = 0;
  let palette: Uint8Array | null = null;
  let trns: Uint8Array | null = null;
  const idatChunks: Uint8Array[] = [];

  while (offset + 8 <= bytes.length) {
    const length = readUint32BE(bytes, offset);
    const type = String.fromCharCode(bytes[offset + 4]!, bytes[offset + 5]!, bytes[offset + 6]!, bytes[offset + 7]!);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) break;
    const chunk = bytes.subarray(dataStart, dataEnd);
    if (type === "IHDR" && length >= 13) {
      width = readUint32BE(chunk, 0);
      height = readUint32BE(chunk, 4);
      bitDepth = chunk[8]!;
      colorType = chunk[9]!;
      interlace = chunk[12]!;
    } else if (type === "PLTE") {
      palette = chunk;
    } else if (type === "tRNS") {
      trns = chunk;
    } else if (type === "IDAT") {
      idatChunks.push(chunk);
    } else if (type === "IEND") {
      break;
    }
    offset = dataEnd + 4;
  }

  if (!width || !height || interlace !== 0 || (bitDepth !== 8 && bitDepth !== 16) || !idatChunks.length) {
    return null;
  }

  const totalIdat = idatChunks.reduce((sum, c) => sum + c.length, 0);
  const compressed = new Uint8Array(totalIdat);
  let pos = 0;
  for (const c of idatChunks) {
    compressed.set(c, pos);
    pos += c.length;
  }
  const raw = new Uint8Array(inflateSync(compressed));
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
  const bytesPerSample = bitDepth === 16 ? 2 : 1;
  const bpp = channels * bytesPerSample;
  const stride = width * bpp;
  if (raw.length < height * (stride + 1)) return null;

  const rgba = new Uint8Array(width * height * 4);
  const prev = new Uint8Array(stride);
  const curr = new Uint8Array(stride);

  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filter = raw[rowStart]!;
    for (let i = 0; i < stride; i++) {
      const x = raw[rowStart + 1 + i]!;
      const a = i >= bpp ? curr[i - bpp]! : 0;
      const b = prev[i]!;
      const c = i >= bpp ? prev[i - bpp]! : 0;
      let val = x;
      if (filter === 1) val = (x + a) & 0xff;
      else if (filter === 2) val = (x + b) & 0xff;
      else if (filter === 3) val = (x + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) val = (x + paethPredictor(a, b, c)) & 0xff;
      curr[i] = val;
    }

    for (let x = 0; x < width; x++) {
      const dst = (y * width + x) * 4;
      const src = x * bpp;
      if (colorType === 6) {
        rgba[dst] = curr[src]!;
        rgba[dst + 1] = curr[src + bytesPerSample]!;
        rgba[dst + 2] = curr[src + bytesPerSample * 2]!;
        rgba[dst + 3] = curr[src + bytesPerSample * 3]!;
      } else if (colorType === 2) {
        rgba[dst] = curr[src]!;
        rgba[dst + 1] = curr[src + bytesPerSample]!;
        rgba[dst + 2] = curr[src + bytesPerSample * 2]!;
        rgba[dst + 3] = 255;
      } else if (colorType === 4) {
        const v = curr[src]!;
        rgba[dst] = v; rgba[dst + 1] = v; rgba[dst + 2] = v;
        rgba[dst + 3] = curr[src + bytesPerSample]!;
      } else if (colorType === 3 && palette) {
        const idx = curr[src]!;
        rgba[dst] = palette[idx * 3] ?? 0;
        rgba[dst + 1] = palette[idx * 3 + 1] ?? 0;
        rgba[dst + 2] = palette[idx * 3 + 2] ?? 0;
        rgba[dst + 3] = trns && idx < trns.length ? trns[idx]! : 255;
      } else {
        const v = curr[src]!;
        rgba[dst] = v; rgba[dst + 1] = v; rgba[dst + 2] = v; rgba[dst + 3] = 255;
      }
    }
    prev.set(curr);
  }
  return { width, height, rgba };
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number) {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const hex = (v: number) => Math.round(Math.max(0, Math.min(255, v * 255))).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function boostForGlow(r: number, g: number, b: number) {
  const [h, s, l] = rgbToHsl(r, g, b);
  const targetL = Math.max(0.48, Math.min(0.70, l));
  const targetS = s > 0.10 ? Math.max(0.46, Math.min(0.92, s)) : s;
  return hslToHex(h, targetS, targetL);
}

function paletteFromRgbaSamples(samples: [number, number, number, number][]): LogoPalette {
  type Bucket = { weight: number; r: number; g: number; b: number };
  const chromatic = new Map<string, Bucket>();
  const neutral = new Map<string, Bucket>();

  for (const [r, g, b, a] of samples) {
    if (a < 128) continue;
    const [, s, l] = rgbToHsl(r, g, b);
    const key = `${r >> 4},${g >> 4},${b >> 4}`;
    if (s >= 0.14 && l >= 0.08 && l <= 0.88) {
      const w = (a / 255) * Math.pow(s, 1.4) * (0.35 + (1 - Math.abs(l - 0.50)));
      const bucket = chromatic.get(key) ?? { weight: 0, r: 0, g: 0, b: 0 };
      bucket.weight += w; bucket.r += r * w; bucket.g += g * w; bucket.b += b * w;
      chromatic.set(key, bucket);
    } else if (l >= 0.15 && l <= 0.82) {
      const w = (a / 255) * (1 - Math.abs(l - 0.50));
      const bucket = neutral.get(key) ?? { weight: 0, r: 0, g: 0, b: 0 };
      bucket.weight += w; bucket.r += r * w; bucket.g += g * w; bucket.b += b * w;
      neutral.set(key, bucket);
    }
  }

  const source = chromatic.size > 0 ? chromatic : neutral;
  if (source.size === 0) return { primary: "#7c8aa5", secondary: "#9aa8c2" };
  const ranked = [...source.values()].sort((a, b) => b.weight - a.weight);
  const top = ranked[0]!;
  const pRgb: [number, number, number] = [Math.round(top.r / top.weight), Math.round(top.g / top.weight), Math.round(top.b / top.weight)];
  const [ph, ps, pl] = rgbToHsl(...pRgb);

  let sRgb: [number, number, number] | null = null;
  for (const entry of ranked.slice(1)) {
    const rgb: [number, number, number] = [Math.round(entry.r / entry.weight), Math.round(entry.g / entry.weight), Math.round(entry.b / entry.weight)];
    const [ch] = rgbToHsl(...rgb);
    const dh = Math.min(Math.abs(ph - ch), 1 - Math.abs(ph - ch));
    if (dh >= 0.08 && entry.weight >= top.weight * 0.08) {
      sRgb = rgb;
      break;
    }
  }

  const primary = boostForGlow(...pRgb);
  const secondary = sRgb
    ? boostForGlow(...sRgb)
    : hslToHex((ph + 0.06) % 1, ps > 0.1 ? Math.max(0.46, Math.min(0.92, ps)) : ps, Math.max(0.54, Math.min(0.76, pl + 0.08)));
  return { primary, secondary };
}

function parseHexColor(hex: string): [number, number, number] | null {
  const clean = hex.replace(/^#/, "");
  if (clean.length === 3) {
    return [parseInt(clean[0]! + clean[0]!, 16), parseInt(clean[1]! + clean[1]!, 16), parseInt(clean[2]! + clean[2]!, 16)];
  }
  if (clean.length === 6) {
    return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
  }
  return null;
}

export function extractLogoPalette(bytes: Uint8Array, mimeType: string): { palette: LogoPalette; iconMode: "full" | "squircle" | "inset" } {
  if (mimeType === "image/png") {
    const png = extractPngPixels(bytes);
    if (!png) return { palette: { primary: "#7c8aa5", secondary: "#9aa8c2" }, iconMode: "full" };
    const stepX = Math.max(1, Math.floor(png.width / 64));
    const stepY = Math.max(1, Math.floor(png.height / 64));
    const samples: [number, number, number, number][] = [];
    for (let y = 0; y < png.height; y += stepY) {
      for (let x = 0; x < png.width; x += stepX) {
        const idx = (y * png.width + x) * 4;
        samples.push([png.rgba[idx]!, png.rgba[idx + 1]!, png.rgba[idx + 2]!, png.rgba[idx + 3]!]);
      }
    }
    const alphaAt = (x: number, y: number) => png.rgba[(Math.min(png.height - 1, Math.max(0, y)) * png.width + Math.min(png.width - 1, Math.max(0, x))) * 4 + 3]!;
    const leftEdge = alphaAt(2, png.height >> 1);
    const rightEdge = alphaAt(png.width - 3, png.height >> 1);
    const topEdge = alphaAt(png.width >> 1, 2);
    const bottomEdge = alphaAt(png.width >> 1, png.height - 3);
    const allEdgesTransparent = leftEdge < 40 && rightEdge < 40 && topEdge < 40 && bottomEdge < 40;
    const sideEdgesTransparent = leftEdge < 40 && rightEdge < 40;
    const iconMode: "full" | "squircle" | "inset" = allEdgesTransparent ? "squircle" : sideEdgesTransparent ? "inset" : "full";
    return { palette: paletteFromRgbaSamples(samples), iconMode };
  }

  if (mimeType === "image/svg+xml") {
    const text = new TextDecoder().decode(bytes);
    const embeddedPng = text.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
    if (embeddedPng) {
      const pngBytes = Uint8Array.from(Buffer.from(embeddedPng[1]!, "base64"));
      return extractLogoPalette(pngBytes, "image/png");
    }
    const colorMatches = [...text.matchAll(/(?:fill|stop-color|stroke)\s*=\s*["'](#[0-9a-fA-F]{3,6})["']/g)];
    const samples: [number, number, number, number][] = [];
    for (const match of colorMatches) {
      const rgb = parseHexColor(match[1]!);
      if (rgb) samples.push([rgb[0], rgb[1], rgb[2], 255]);
    }
    const hasFullBgRect = /<rect[^>]*\bwidth=["'](?:100%|\d{3,4})["'][^>]*\bheight=["'](?:100%|\d{3,4})["']/i.test(text);
    return {
      palette: paletteFromRgbaSamples(samples),
      iconMode: hasFullBgRect ? "full" : "inset",
    };
  }

  return { palette: { primary: "#7c8aa5", secondary: "#9aa8c2" }, iconMode: "full" };
}

// --- Text Measurement & Wrapping for Native SVG Text ---

function measureCharWidth(char: string, fontSize: number) {
  if (/[\u2e80-\uffff]/u.test(char)) return fontSize * 1.0;
  if (/[ilI.,:;'!|()[\]]/.test(char)) return fontSize * 0.30;
  if (/[MW@%#&]/.test(char)) return fontSize * 0.90;
  if (/\s/.test(char)) return fontSize * 0.30;
  if (/[A-Z0-9]/.test(char)) return fontSize * 0.64;
  return fontSize * 0.54;
}

export function measureSvgTextWidth(text: string, fontSize: number) {
  let width = 0;
  for (const char of text) width += measureCharWidth(char, fontSize);
  return width;
}

export function wrapSvgText(text: string, maxWidth: number, fontSize: number, maxLines = 5): string[] {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return [];
  // Tokenize so CJK characters wrap individually and Latin words stay together.
  const tokens = trimmed.match(/[\u2e80-\uffff][.,!?;:，。！？；：、]?|\S+\s*|\s+/gu) ?? [trimmed];
  const lines: string[] = [];
  let current = "";
  let currentWidth = 0;

  for (const token of tokens) {
    const cleanToken = current === "" ? token.trimStart() : token;
    if (!cleanToken) continue;
    const tokenWidth = measureSvgTextWidth(cleanToken, fontSize);
    if (current && currentWidth + tokenWidth > maxWidth) {
      lines.push(current.trimEnd());
      if (lines.length === maxLines) {
        const last = lines[maxLines - 1]!;
        lines[maxLines - 1] = last.length > 1 ? `${last.slice(0, -1).trimEnd()}…` : `${last}…`;
        return lines;
      }
      current = cleanToken.trimStart();
      currentWidth = measureSvgTextWidth(current, fontSize);
    } else {
      current += cleanToken;
      currentWidth += tokenWidth;
    }
  }
  if (current.trim()) lines.push(current.trimEnd());
  return lines.slice(0, maxLines);
}

function deterministicSeed(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// --- Generic Product Showcase Card SVG ---

export function buildProductCardSvg(card: ProductCardInput): string {
  const locale = card.locale ?? "en";
  const text = labels[locale];
  const W = 840;
  const H = 288;
  const cardRx = 20;
  const previewX = 272;
  const previewY = 20;
  const previewH = 246;
  const previewRx = 12;
  const previewGap = 16;
  const seed = deterministicSeed(`${card.url}|${card.name}|${locale}`);
  const pfx = `c${seed.toString(36)}_`;

  // Subtle background ambient glows driven by the extracted logo palette.
  const defs: string[] = [
    `<clipPath id="${pfx}card-clip"><rect width="${W}" height="${H}" rx="${cardRx}"/></clipPath>`,
    `<filter id="${pfx}frame-shadow" x="-8%" y="-8%" width="116%" height="124%">
      <feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#000000" flood-opacity="0.28"/>
    </filter>`,
    `<radialGradient id="${pfx}glow-primary" cx="0.15" cy="0.30" r="0.56" fx="0.11" fy="0.24">
      <stop offset="0%" stop-color="${escapeXml(card.glowPrimary)}" stop-opacity="0.15"/>
      <stop offset="48%" stop-color="${escapeXml(card.glowPrimary)}" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="${escapeXml(card.glowPrimary)}" stop-opacity="0"/>
    </radialGradient>`,
    `<radialGradient id="${pfx}glow-secondary" cx="0.58" cy="0.88" r="0.54">
      <stop offset="0%" stop-color="${escapeXml(card.glowSecondary)}" stop-opacity="0.07"/>
      <stop offset="55%" stop-color="${escapeXml(card.glowSecondary)}" stop-opacity="0.02"/>
      <stop offset="100%" stop-color="${escapeXml(card.glowSecondary)}" stop-opacity="0"/>
    </radialGradient>`,
    `<linearGradient id="${pfx}border-sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${escapeXml(card.glowPrimary)}" stop-opacity="0.18"/>
      <stop offset="38%" stop-color="#ffffff" stop-opacity="0.09"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.06"/>
    </linearGradient>`,
    `<radialGradient id="${pfx}icon-halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="${escapeXml(card.glowPrimary)}" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="${escapeXml(card.glowPrimary)}" stop-opacity="0"/>
    </radialGradient>`,
  ];

  // Left logo rendering
  let iconMarkup = "";
  if (card.iconHref) {
    if (card.iconMode === "inset") {
      iconMarkup = `<circle cx="52" cy="50" r="38" fill="url(#${pfx}icon-halo)"/>
  <rect x="28" y="26" width="48" height="48" rx="12" fill="#17171c"/>
  <rect x="28" y="26" width="48" height="48" rx="12" fill="${escapeXml(card.glowPrimary)}" fill-opacity="0.10" stroke="rgba(255,255,255,0.14)" stroke-width="1"/>
  <image href="${escapeXml(card.iconHref)}" x="35" y="33" width="34" height="34" preserveAspectRatio="xMidYMid meet"/>`;
    } else if (card.iconMode === "squircle") {
      iconMarkup = `<circle cx="52" cy="50" r="38" fill="url(#${pfx}icon-halo)"/>
  <image href="${escapeXml(card.iconHref)}" x="26" y="24" width="52" height="52" preserveAspectRatio="xMidYMid meet"/>`;
    } else {
      defs.push(`<clipPath id="${pfx}icon-clip"><rect x="28" y="26" width="48" height="48" rx="12"/></clipPath>`);
      iconMarkup = `<circle cx="52" cy="50" r="38" fill="url(#${pfx}icon-halo)"/>
  <image href="${escapeXml(card.iconHref)}" x="28" y="26" width="48" height="48" preserveAspectRatio="xMidYMid slice" clip-path="url(#${pfx}icon-clip)"/>
  <rect x="28.5" y="26.5" width="47" height="47" rx="11.5" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="1"/>`;
    }
  } else {
    const initial = escapeXml(card.name.slice(0, 1).toUpperCase());
    iconMarkup = `<circle cx="52" cy="50" r="38" fill="url(#${pfx}icon-halo)"/>
  <rect x="28" y="26" width="48" height="48" rx="12" fill="#17171c"/>
  <rect x="28" y="26" width="48" height="48" rx="12" fill="${escapeXml(card.glowPrimary)}" fill-opacity="0.16" stroke="rgba(255,255,255,0.16)" stroke-width="1"/>
  <text x="52" y="58" text-anchor="middle" font-size="22" font-weight="700" fill="#fafafa">${initial}</text>`;
  }

  // Left text block
  const descriptionLines = wrapSvgText(card.description, 220, 12.5, 6);
  const descriptionSvg = descriptionLines.map((line, i) =>
    `<tspan x="28" dy="${i === 0 ? 0 : 17}">${escapeXml(line)}</tspan>`
  ).join("");

  // Right preview frames & left indicator pills (synchronized dynamic carousel)
  type CarouselFrame = { width: number; content: string };
  const carouselFrames: CarouselFrame[] = [];

  if (card.previews.length > 0) {
    for (let i = 0; i < card.previews.length; i++) {
      const p = card.previews[i]!;
      const ratio = p.width > 0 && p.height > 0 ? p.width / p.height : 1.6;
      const pw = Math.round(previewH * ratio);
      const clipId = `${pfx}preview-clip-${i}`;
      defs.push(`<clipPath id="${clipId}"><rect x="0" y="${previewY}" width="${pw}" height="${previewH}" rx="${previewRx}"/></clipPath>`);
      carouselFrames.push({
        width: pw,
        content: `<g filter="url(#${pfx}frame-shadow)">
      <rect x="0" y="${previewY}" width="${pw}" height="${previewH}" rx="${previewRx}" fill="#17171c"/>
    </g>
    <image href="${escapeXml(p.href)}" x="0" y="${previewY}" width="${pw}" height="${previewH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>
    <rect x="0.5" y="${previewY + 0.5}" width="${pw - 1}" height="${previewH - 1}" rx="${previewRx - 0.5}" fill="none" stroke="rgba(255,255,255,0.11)" stroke-width="1"/>`,
      });
    }
  } else {
    // Two-frame preview visualization for repositories without screenshots
    const frameW = 388;
    const vizSeed = deterministicSeed(card.repoSlug ?? card.name);

    defs.push(`<linearGradient id="${pfx}win-glow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${escapeXml(card.glowPrimary)}" stop-opacity="0.09"/>
      <stop offset="55%" stop-color="${escapeXml(card.glowSecondary)}" stop-opacity="0.03"/>
      <stop offset="100%" stop-color="#14151a" stop-opacity="0"/>
    </linearGradient>`);
    defs.push(`<linearGradient id="${pfx}wave-stroke" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${escapeXml(card.glowPrimary)}"/>
      <stop offset="100%" stop-color="${escapeXml(card.glowSecondary)}"/>
    </linearGradient>`);
    defs.push(`<linearGradient id="${pfx}wave-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${escapeXml(card.glowPrimary)}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${escapeXml(card.glowPrimary)}" stop-opacity="0"/>
    </linearGradient>`);

    const chartX = 18;
    const chartW = frameW - 36;
    const chartTop = previewY + 114;
    const chartBottom = previewY + 182;
    const pointsCount = 7;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < pointsCount; i++) {
      const t = i / (pointsCount - 1);
      const jitter = ((vizSeed >> (i * 4)) & 0xf) / 15;
      const trend = 0.25 + 0.55 * t;
      const normY = Math.max(0.12, Math.min(0.92, trend * 0.55 + jitter * 0.45));
      pts.push({
        x: Math.round(chartX + t * chartW),
        y: Math.round(chartBottom - normY * (chartBottom - chartTop)),
      });
    }
    let lineD = `M ${pts[0]!.x} ${pts[0]!.y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1]!;
      const curr = pts[i]!;
      const cx = ((prev.x + curr.x) / 2).toFixed(1);
      lineD += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    const areaD = `${lineD} L ${pts[pts.length - 1]!.x} ${chartBottom} L ${pts[0]!.x} ${chartBottom} Z`;
    const peak = pts[pts.length - 2]!;

    const slugText = card.repoSlug ?? card.name;
    const owner = card.repoSlug?.split("/")[0] ?? card.name;
    const secondVal = card.stats?.forks !== undefined ? card.stats.forks.toLocaleString("en-US") : owner;
    const secondLbl = card.stats?.forks !== undefined ? text.forksLabel : text.ownerLabel;
    const sinceVal = card.stats?.createdAt ? card.stats.createdAt.slice(0, 7) : "—";
    const tiles = [
      { label: text.starsLabel, value: card.stats?.stars !== undefined ? card.stats.stars.toLocaleString("en-US") : "—", isStar: true },
      { label: secondLbl, value: secondVal, isStar: false },
      { label: text.sinceLabel, value: sinceVal, isStar: false },
    ];
    const tileW = Math.floor((chartW - 20) / 3);
    const tilesSvg = tiles.map((tile, i) => {
      const tx = chartX + i * (tileW + 10);
      const textOffset = tile.isStar ? 27 : 12;
      const maxTextW = tileW - (textOffset + 10);
      let valSize = 14;
      while (valSize > 10.5 && measureSvgTextWidth(tile.value, valSize) > maxTextW) {
        valSize -= 0.5;
      }
      const starGlyph = tile.isStar
        ? `<path transform="translate(${tx + 12}, ${previewY + 73.2})" d="M5.71 0L7.31 3.8L11.41 4.15L8.29 6.84L9.23 10.85L5.71 8.72L2.18 10.85L3.12 6.84L0 4.15L4.11 3.8Z" fill="#fafafa" fill-opacity="0.9"/>\n      `
        : "";
      return `<rect x="${tx}" y="${previewY + 48}" width="${tileW}" height="48" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <text x="${tx + 12}" y="${previewY + 65}" font-size="9.5" font-weight="600" letter-spacing="0.6" fill="rgba(255,255,255,0.45)">${escapeXml(tile.label)}</text>
      ${starGlyph}<text x="${tx + textOffset}" y="${previewY + 84}" font-size="${valSize}" font-weight="700" fill="#fafafa">${escapeXml(tile.value)}</text>`;
    }).join("\n    ");

    const chips = (card.features && card.features.length > 0
      ? card.features
      : [owner, text.openSource, sinceVal]
    ).slice(0, 3);
    let chipX = chartX;
    const chipsSvg = chips.map(chip => {
      const cw = Math.min(152, Math.max(66, Math.round(measureSvgTextWidth(chip, 11) + 32)));
      if (chipX + cw > frameW - 14) return "";
      const el = `<rect x="${chipX}" y="${previewY + 200}" width="${cw}" height="26" rx="13" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.11)" stroke-width="1"/>
      <circle cx="${chipX + 12}" cy="${previewY + 213}" r="3" fill="${escapeXml(card.glowPrimary)}"/>
      <text x="${chipX + 20}" y="${previewY + 217}" font-size="11" font-weight="500" fill="rgba(255,255,255,0.82)">${escapeXml(chip)}</text>`;
      chipX += cw + 8;
      return el;
    }).join("\n    ");

    carouselFrames.push({
      width: frameW,
      content: `<g filter="url(#${pfx}frame-shadow)">
      <rect x="0" y="${previewY}" width="${frameW}" height="${previewH}" rx="${previewRx}" fill="#15161b"/>
    </g>
    <rect x="0" y="${previewY}" width="${frameW}" height="${previewH}" rx="${previewRx}" fill="#15161b" fill-opacity="0.88"/>
    <rect x="0" y="${previewY}" width="${frameW}" height="${previewH}" rx="${previewRx}" fill="url(#${pfx}win-glow)"/>
    <rect x="0.5" y="${previewY + 0.5}" width="${frameW - 1}" height="${previewH - 1}" rx="${previewRx - 0.5}" fill="none" stroke="rgba(255,255,255,0.11)" stroke-width="1"/>
    <line x1="0" y1="${previewY + 34}" x2="${frameW}" y2="${previewY + 34}" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
    <circle cx="16" cy="${previewY + 17}" r="4" fill="#ff5f57" fill-opacity="0.72"/>
    <circle cx="29" cy="${previewY + 17}" r="4" fill="#febc2e" fill-opacity="0.72"/>
    <circle cx="42" cy="${previewY + 17}" r="4" fill="#28c840" fill-opacity="0.72"/>
    <text class="mono" x="58" y="${previewY + 21}" font-size="11" fill="rgba(255,255,255,0.55)">${escapeXml(slugText)}</text>
    <circle cx="${frameW - 18}" cy="${previewY + 17}" r="3.5" fill="${escapeXml(card.glowPrimary)}"/>
    ${tilesSvg}
    <line x1="${chartX}" y1="${chartTop + 16}" x2="${chartX + chartW}" y2="${chartTop + 16}" stroke="rgba(255,255,255,0.05)" stroke-dasharray="3 4"/>
    <line x1="${chartX}" y1="${chartTop + 42}" x2="${chartX + chartW}" y2="${chartTop + 42}" stroke="rgba(255,255,255,0.05)" stroke-dasharray="3 4"/>
    <line x1="${chartX}" y1="${chartBottom}" x2="${chartX + chartW}" y2="${chartBottom}" stroke="rgba(255,255,255,0.08)"/>
    <path d="${areaD}" fill="url(#${pfx}wave-fill)"/>
    <path d="${lineD}" fill="none" stroke="url(#${pfx}wave-stroke)" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="${peak.x}" cy="${peak.y}" r="7" fill="${escapeXml(card.glowPrimary)}" fill-opacity="0.25"/>
    <circle cx="${peak.x}" cy="${peak.y}" r="3.2" fill="#fafafa" stroke="${escapeXml(card.glowPrimary)}" stroke-width="1.5"/>
    ${chipsSvg}`,
    });

    // Second frame: capabilities & overview bars (clean both peeking and when active)
    const overviewRows = (card.features && card.features.length > 0
      ? card.features
      : [owner, text.openSource, sinceVal]
    ).slice(0, 3);
    const barTrackW = frameW - 36;
    const overviewCardsSvg = overviewRows.map((row, i) => {
      const ry = previewY + 52 + i * 58;
      const ratio = 0.56 + (((vizSeed >> (i * 5)) & 0x7) / 7) * 0.34;
      const fillW = Math.round((barTrackW - 24) * ratio);
      const barColor = i % 2 === 0 ? card.glowPrimary : card.glowSecondary;
      return `<rect x="18" y="${ry}" width="${barTrackW}" height="46" rx="8" fill="rgba(255,255,255,0.035)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <circle cx="32" cy="${ry + 17}" r="3.2" fill="${escapeXml(barColor)}"/>
      <text x="42" y="${ry + 21}" font-size="11.5" font-weight="600" fill="rgba(255,255,255,0.86)">${escapeXml(row)}</text>
      <rect x="30" y="${ry + 31}" width="${barTrackW - 24}" height="5" rx="2.5" fill="rgba(255,255,255,0.07)"/>
      <rect x="30" y="${ry + 31}" width="${fillW}" height="5" rx="2.5" fill="${escapeXml(barColor)}" fill-opacity="0.78"/>`;
    }).join("\n    ");

    carouselFrames.push({
      width: frameW,
      content: `<g filter="url(#${pfx}frame-shadow)">
      <rect x="0" y="${previewY}" width="${frameW}" height="${previewH}" rx="${previewRx}" fill="#15161b"/>
    </g>
    <rect x="0" y="${previewY}" width="${frameW}" height="${previewH}" rx="${previewRx}" fill="#15161b" fill-opacity="0.84"/>
    <rect x="0.5" y="${previewY + 0.5}" width="${frameW - 1}" height="${previewH - 1}" rx="${previewRx - 0.5}" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="1"/>
    <line x1="0" y1="${previewY + 34}" x2="${frameW}" y2="${previewY + 34}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <circle cx="16" cy="${previewY + 17}" r="4" fill="#ff5f57" fill-opacity="0.55"/>
    <circle cx="29" cy="${previewY + 17}" r="4" fill="#febc2e" fill-opacity="0.55"/>
    <circle cx="42" cy="${previewY + 17}" r="4" fill="#28c840" fill-opacity="0.55"/>
    <text x="58" y="${previewY + 21}" font-size="11" font-weight="600" fill="rgba(255,255,255,0.58)">${escapeXml(text.overviewTab)}</text>
    ${overviewCardsSvg}`,
    });
  }

  // Build reusable frame symbols & compute horizontal offsets
  const frameCount = carouselFrames.length;
  const offsets: number[] = [];
  let accX = 0;
  for (let i = 0; i < frameCount; i++) {
    offsets.push(accX);
    defs.push(`<g id="${pfx}frame-${i}">\n    ${carouselFrames[i]!.content}\n  </g>`);
    accX += carouselFrames[i]!.width + previewGap;
  }
  const totalTrackWidth = accX;

  defs.push(`<clipPath id="${pfx}preview-viewport"><rect x="${previewX - 4}" y="0" width="${W - previewX + 4}" height="${H}"/></clipPath>`);

  const trackUses: string[] = [];
  for (let i = 0; i < frameCount; i++) {
    trackUses.push(`<use href="#${pfx}frame-${i}" x="${previewX + offsets[i]!}" y="0"/>`);
  }
  if (frameCount > 1) {
    trackUses.push(`<use href="#${pfx}frame-0" x="${previewX + totalTrackWidth}" y="0"/>`);
    trackUses.push(`<use href="#${pfx}frame-1" x="${previewX + totalTrackWidth + carouselFrames[0]!.width + previewGap}" y="0"/>`);
  }

  // Left indicator pills (active long capsule + inactive small dots, synced with carousel)
  const pillCount = Math.min(6, Math.max(1, card.totalFrames && card.totalFrames > 0 ? card.totalFrames : frameCount));
  const pillBaseX = 28;
  const pillCy = 254;
  const dotRadius = 3;
  const capsuleW = 18;
  const dotStep = 12; // 6px dot + 6px gap

  const dotsSvg = Array.from({ length: pillCount }, (_, j) => {
    const cx = pillBaseX + dotRadius + j * dotStep;
    return `<circle class="${pfx}dot ${pfx}dot-${j}" cx="${cx}" cy="${pillCy}" r="${dotRadius}" fill="${escapeXml(card.glowPrimary)}" fill-opacity="0.48"/>`;
  }).join("\n  ");

  const capsuleSvg = `<rect class="${pfx}capsule" x="${pillBaseX}" y="${pillCy - dotRadius}" width="${capsuleW}" height="${dotRadius * 2}" rx="${dotRadius}" fill="#fafafa" fill-opacity="0.94"/>`;
  const pillsSvg = `${dotsSvg}\n  ${capsuleSvg}`;

  // Synchronized CSS keyframes for right carousel + left capsule/dots indicator
  let animationCss = "";
  if (frameCount > 1) {
    const stepSeconds = 3.6;
    const totalDuration = +(frameCount * stepSeconds).toFixed(2);
    const slot = 100 / frameCount;
    const fmt = (p: number) => `${Math.max(0, Math.min(100, p)).toFixed(2)}%`;

    const trackKeyframes: string[] = [];
    const capsuleKeyframes: string[] = [];
    for (let i = 0; i < frameCount; i++) {
      const holdEnd = (i + 0.78) * slot;
      const slideEnd = (i + 1) * slot;
      const curOffset = -offsets[i]!;
      const nextOffset = i + 1 < frameCount ? -offsets[i + 1]! : -totalTrackWidth;
      const capIndex = i % pillCount;
      const nextCapIndex = i + 1 < frameCount ? (i + 1) % pillCount : 0;
      const curCapX = capIndex * dotStep;
      const nextCapX = nextCapIndex * dotStep;

      if (i === 0) {
        trackKeyframes.push(`0%{transform:translateX(0px)}`);
        capsuleKeyframes.push(`0%{transform:translateX(0px)}`);
      }
      trackKeyframes.push(`${fmt(holdEnd)}{transform:translateX(${curOffset}px);animation-timing-function:cubic-bezier(0.22,1,0.36,1)}`);
      trackKeyframes.push(`${fmt(slideEnd)}{transform:translateX(${nextOffset}px)}`);
      capsuleKeyframes.push(`${fmt(holdEnd)}{transform:translateX(${curCapX}px);animation-timing-function:cubic-bezier(0.22,1,0.36,1)}`);
      capsuleKeyframes.push(`${fmt(slideEnd)}{transform:translateX(${nextCapX}px)}`);
    }

    const activeDotsCount = Math.min(pillCount, frameCount);
    const dotAnimations = Array.from({ length: activeDotsCount }, (_, j) => {
      if (j === 0) {
        return `.${pfx}dot-0{transform:translateX(0px)}`;
      }
      const swapStart = (j - 0.22) * slot;
      const swapEnd = j * slot;
      const wrapStart = (frameCount - 0.22) * slot;
      const kf = `0%,${fmt(swapStart)}{transform:translateX(12px);animation-timing-function:cubic-bezier(0.22,1,0.36,1)}${fmt(swapEnd)},${fmt(wrapStart)}{transform:translateX(0px);animation-timing-function:cubic-bezier(0.22,1,0.36,1)}100%{transform:translateX(12px)}`;
      return `@keyframes ${pfx}dot-shift-${j}{${kf}}\n  .${pfx}dot-${j}{transform:translateX(12px);animation:${pfx}dot-shift-${j} ${totalDuration}s linear infinite}`;
    }).join("\n  ");

    animationCss = `
  @keyframes ${pfx}track-slide{${trackKeyframes.join("")}}
  .${pfx}carousel-track{animation:${pfx}track-slide ${totalDuration}s linear infinite;will-change:transform}
  @keyframes ${pfx}capsule-slide{${capsuleKeyframes.join("")}}
  .${pfx}capsule{transform:translateX(0px);animation:${pfx}capsule-slide ${totalDuration}s linear infinite;will-change:transform}
  ${dotAnimations}
  @media(prefers-reduced-motion:reduce){.${pfx}carousel-track,.${pfx}capsule,.${pfx}dot{animation:none!important}}`;
  } else {
    const staticShift = Array.from({ length: pillCount }, (_, j) =>
      j === 0 ? "" : `.${pfx}dot-${j}{transform:translateX(12px)}`
    ).filter(Boolean).join("\n  ");
    if (staticShift) animationCss = `\n  ${staticShift}`;
  }

  const rightPreviewSvg = `<g clip-path="url(#${pfx}preview-viewport)">
    <g class="${pfx}carousel-track">
      ${trackUses.join("\n      ")}
    </g>
  </g>`;

  const hasLeadingStar = card.meta.startsWith("★ ");
  const metaText = hasLeadingStar ? card.meta.slice(2) : card.meta;
  const metaSvg = hasLeadingStar
    ? `<path transform="translate(28, 110.6)" d="M4.99 0L6.39 3.32L9.99 3.63L7.26 5.99L8.08 9.5L4.99 7.63L1.91 9.5L2.73 5.99L0 3.63L3.59 3.32Z" fill="rgba(255,255,255,0.62)"/>
  <text x="41" y="120" font-size="12" font-weight="500" fill="rgba(255,255,255,0.56)">${escapeXml(metaText)}</text>`
    : `<text x="28" y="120" font-size="12" font-weight="500" fill="rgba(255,255,255,0.56)">${escapeXml(metaText)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" lang="${locale}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${pfx}title ${pfx}desc">
<title id="${pfx}title">${escapeXml(card.name)}</title>
<desc id="${pfx}desc">${escapeXml(card.description)}</desc>
<defs>
  ${defs.join("\n  ")}
</defs>
<style>
  text{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-variant-numeric:tabular-nums}
  .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}${animationCss}
</style>
<g clip-path="url(#${pfx}card-clip)">
  <rect width="${W}" height="${H}" fill="#111114"/>
  <rect width="${W}" height="${H}" fill="url(#${pfx}glow-primary)"/>
  <rect width="${W}" height="${H}" fill="url(#${pfx}glow-secondary)"/>

  <!-- Left product introduction -->
  ${iconMarkup}
  <text x="28" y="99" font-size="21" font-weight="700" letter-spacing="-0.4" fill="#fafafa">${escapeXml(card.name)}</text>
  ${metaSvg}
  <text x="28" y="142" font-size="12.5" fill="rgba(255,255,255,0.74)">${descriptionSvg}</text>
  ${pillsSvg}

  <!-- Right showcase preview -->
  ${rightPreviewSvg}
</g>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${cardRx - 0.5}" fill="none" stroke="url(#${pfx}border-sheen)" stroke-width="1"/>
</svg>\n`;
}

// --- Markdown/HTML Section Markup Builders ---

export function buildRepositoryMarkup(
  repos: CuratedRepository[],
  stars: Record<string, number> = {},
  createdAt: Record<string, string> = {},
  locale: ReadmeLocale = "en",
) {
  const text = labels[locale];
  return `<div>\n` + repos.map(repo => {
    const description = locale === "zh-CN" ? repo.description_zh ?? repo.description : repo.description;
    const slug = repositoryAssetName(repo);
    const cardFile = cardSvgFilename(slug, locale);
    const starText = stars[repo.repository]?.toLocaleString("en-US") ?? text.unavailable;
    const dateText = createdAt[repo.repository]?.slice(0, 10) ?? text.dateUnavailable;
    const alt = `${repo.name} (★ ${starText}, ${dateText})${description ? ` — ${description}` : ""}`;
    return `<p>\n  <a href="${escapeXml(repo.url ?? `https://github.com/${repo.repository}`)}"><img src="./assets/cards/${escapeXml(cardFile)}" alt="${escapeXml(alt)}" width="100%"></a>\n</p>`;
  }).join("\n") + `\n</div>`;
}

export function buildProductMarkup(products: CuratedProduct[], locale: ReadmeLocale = "en") {
  return `<div>\n` + products.map(product => {
    const description = locale === "zh-CN" ? product.description_zh ?? product.description : product.description;
    const slug = productAssetName(product);
    const cardFile = cardSvgFilename(slug, locale);
    const alt = `${product.name} (${product.created_at}) — ${description}`;
    return `<p>\n  <a href="${escapeXml(product.url)}"><img src="./assets/cards/${escapeXml(cardFile)}" alt="${escapeXml(alt)}" width="100%"></a>\n</p>`;
  }).join("\n") + `\n</div>`;
}
