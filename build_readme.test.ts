import { expect, spyOn, test } from "bun:test";
import { buildOverviewSvg, fetchRepositoryMetadata, updateReadme } from "./build_readme";
import { buildRepositoryMarkup, validateRepositories } from "./readme_ui";

for (const file of ["README.md", "README.zh-CN.md"]) {
test(`${file} rendering preserves the Hero, Overview, and surrounding content`, async () => {
  const readme = await Bun.file(new URL(`./${file}`, import.meta.url)).text();
  const startMarker = "<!-- repositories starts -->";
  const endMarker = "<!-- repositories ends -->";
  const start = readme.indexOf(startMarker);
  const end = readme.indexOf(endMarker);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const replacement = "<p>Selected project</p>";
  const updated = updateReadme(readme, replacement);

  expect(updated.slice(0, start)).toBe(readme.slice(0, start));
  expect(updated.slice(updated.indexOf(endMarker))).toBe(readme.slice(end));
  expect(updated).toContain(`${startMarker}\n${replacement}\n${endMarker}`);
  expect(updateReadme(updated, replacement)).toBe(updated);
});
}

const emptyOverview = {
  followers: 0,
  stars: 0,
  forks: 0,
  repositoryCount: 0,
  activity: { commits: 0, prs: 0, issues: 0, total: 0, contributed_to: 0 },
  starSources: [
    { label: "Owned repositories", value: 0 },
    { label: "Member / collaborator", value: 0 },
    { label: "Organizations", value: 0 },
  ],
  organizationSources: [],
  lastUpdated: "31 Oct 2026",
};

test("zero activity and stars render valid statistics", () => {
  const svg = buildOverviewSvg(emptyOverview);
  expect(svg).not.toMatch(/NaN|Infinity/);
  expect(svg).toContain("0 stars, 0 followers, 0 forks, 0 commits across 0 repositories");
  expect(svg).toContain(">0.0%</text>");
});

test("SVG escapes star source labels", () => {
  const svg = buildOverviewSvg({
    ...emptyOverview,
    starSources: [{ label: "Tools & <friends>", value: 1234 }],
  });
  expect(svg).toContain("Tools &amp; &lt;friends&gt;");
  expect(svg).toContain("1,234");
});

test("curated repositories keep the exact configured order", async () => {
  const config = await Bun.file(new URL("./repositories.json", import.meta.url)).json();
  const repositories = validateRepositories(config);
  const markup = buildRepositoryMarkup(repositories);
  const links = [...markup.matchAll(/<strong><a href="https:\/\/github.com\/([^"]+)">/g)].map(match => match[1]);
  expect(links).toEqual(config.map((repo: { repository: string }) => repo.repository));
  expect(() => validateRepositories([{ name: "Bad", repository: "javascript:alert(1)", description: "Bad URL" }])).toThrow();
  expect(() => validateRepositories([...config, config[0]])).toThrow("Duplicate repository");
});

test("Chinese renders translated text with the same projects, counts, and gallery", async () => {
  const config = validateRepositories(await Bun.file(new URL("./repositories.json", import.meta.url)).json());
  const stars = { "nexmoe/VidBee": 11025 };
  const dates = { "nexmoe/VidBee": "2025-10-22T13:43:42Z" };
  const english = buildRepositoryMarkup(config, stars, dates);
  const chinese = buildRepositoryMarkup(config, stars, dates, "zh-CN");
  for (const repo of config) {
    expect(repo.description_zh).toBeTruthy();
    expect(chinese).toContain(repo.description_zh!);
    expect(chinese).not.toContain(repo.description);
  }
  expect(chinese).toContain("★&nbsp;11,025");
  expect(chinese).toContain("创建于 2025-10-22");
  expect([...chinese.matchAll(/href="([^"]+)"/g)].map(match => match[1]))
    .toEqual([...english.matchAll(/href="([^"]+)"/g)].map(match => match[1]));
  expect([...chinese.matchAll(/height="200"/g)]).toHaveLength(6);
  expect(chinese).toContain("VidBee RSS 订阅与自动下载");
});

test("missing translations fall back to English and translated HTML stays escaped", () => {
  const repo = { name: "Tool", repository: "owner/tool", description: "English fallback" };
  expect(buildRepositoryMarkup([repo], {}, {}, "zh-CN")).toContain("English fallback");
  const translated = validateRepositories([{ ...repo, description_zh: "工具 & <script>" }]);
  expect(buildRepositoryMarkup(translated, {}, {}, "zh-CN")).toContain("工具 &amp; &lt;script&gt;");
  expect(() => validateRepositories([{ ...repo, description_zh: 123 }])).toThrow("Invalid translation");
});

test("Chinese overview translates labels without changing the statistics or chart colors", () => {
  const chinese = buildOverviewSvg(emptyOverview, "zh-CN");
  const english = buildOverviewSvg(emptyOverview);
  expect(chinese).toContain("贡献分布");
  expect(chinese).toContain("成员 / 协作仓库");
  expect(chinese).not.toContain(">Activity Distribution<");
  expect(chinese).toContain("0 个 Star，0 位关注者");
  expect(chinese.match(/<rect\b[^>]+>/g)).toEqual(english.match(/<rect\b[^>]+>/g));
});

test("public repository metadata refreshes when organization token policy returns 403", async () => {
  const metadata = { stargazers_count: 67, created_at: "2026-05-10T02:57:55Z" };
  const fetchMock = spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(Response.json({ message: "Organization forbids this token's lifetime" }, { status: 403 }))
    .mockResolvedValueOnce(Response.json(metadata));
  try {
    expect(await fetchRepositoryMetadata("opentrends-io/opentrends")).toEqual(metadata);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const fallbackHeaders = fetchMock.mock.calls[1]?.[1]?.headers;
    expect(new Headers(fallbackHeaders).has("Authorization")).toBe(false);
  } finally {
    fetchMock.mockRestore();
  }
});

test("metadata refresh still fails if the public fallback cannot access the repository", async () => {
  const fetchMock = spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(Response.json({ message: "Forbidden" }, { status: 403 }))
    .mockResolvedValueOnce(Response.json({ message: "Not Found" }, { status: 404 }));
  try {
    await expect(fetchRepositoryMetadata("owner/unavailable")).rejects.toThrow("GitHub public API error (404");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  } finally {
    fetchMock.mockRestore();
  }
});
