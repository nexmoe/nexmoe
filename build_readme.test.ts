import { expect, spyOn, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildOverviewSvg, fetchPinnedRepositories, fetchRepositoryMetadata,
  refreshPinnedRepositories, selectPinnedRepositories, updateReadme, type PinnedRepository,
} from "./build_readme";
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

test("repository overrides validate identities and render in the supplied order", async () => {
  const config = await Bun.file(new URL("./repositories.json", import.meta.url)).json();
  const repositories = validateRepositories(config);
  const markup = buildRepositoryMarkup(repositories);
  const links = [...markup.matchAll(/<strong><a href="https:\/\/github.com\/([^"]+)">/g)].map(match => match[1]);
  expect(links).toEqual(config.map((repo: { repository: string }) => repo.repository));
  expect(() => validateRepositories([{ name: "Bad", repository: "javascript:alert(1)", description: "Bad URL" }])).toThrow();
  expect(() => validateRepositories([...config, config[0]])).toThrow("Duplicate repository");
});

const pinnedRepository: PinnedRepository = {
  name: "New project",
  nameWithOwner: "owner/new",
  description: "GitHub description",
  stargazerCount: 17,
  createdAt: "2026-10-24T03:40:50Z",
};

test("pins control additions, removals, and order while retaining localized overrides and screenshots", () => {
  const overrides = validateRepositories([
    { name: "Unpinned", repository: "owner/old", description: "No longer selected" },
    { name: "Custom name", repository: "OWNER/Existing", description: "Custom description", description_zh: "中文介绍",
      images: [{ src: "./assets/example.webp", alt: "Screenshot", alt_zh: "截图" }] },
  ]);
  const pins = [pinnedRepository, { ...pinnedRepository, nameWithOwner: "owner/existing" }];
  const selected = selectPinnedRepositories(overrides, pins);
  expect(selected.map(repo => repo.repository)).toEqual(["owner/new", "owner/existing"]);
  expect(selected[0]).toEqual({ name: "New project", repository: "owner/new", description: "GitHub description" });
  expect(selected[1]).toMatchObject({ name: "Custom name", description: "Custom description", description_zh: "中文介绍", images: overrides[1]!.images });
  const chinese = buildRepositoryMarkup(selected, {}, {}, "zh-CN");
  expect(chinese).toContain("GitHub description");
  expect(chinese).toContain("中文介绍");
  expect(chinese).toContain('alt="截图"');
  expect(chinese).not.toContain("owner/old");
  expect(selectPinnedRepositories(overrides, [...pins].reverse()).map(repo => repo.repository))
    .toEqual(["owner/existing", "owner/new"]);
});

test("an empty pin list clears projects, and only a missing snapshot uses the original configuration", () => {
  const overrides = [{ name: "Old", repository: "owner/old", description: "Fallback" }];
  expect(selectPinnedRepositories(overrides, [])).toEqual([]);
  expect(selectPinnedRepositories(overrides)).toEqual(overrides);
  const noDescription = selectPinnedRepositories([], [{ ...pinnedRepository, description: null }]);
  expect(buildRepositoryMarkup(noDescription)).toContain("New project");
  expect(buildRepositoryMarkup(noDescription)).not.toMatch(/null|undefined|<br>/);
});

test("pin requests target the configured profile and preserve GitHub's order", async () => {
  const pins = [pinnedRepository, { ...pinnedRepository, nameWithOwner: "owner/second" }];
  const fetchMock = spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ data: { user: { pinnedItems: { nodes: pins } } } }));
  try {
    expect(await fetchPinnedRepositories("chosen-profile")).toEqual(pins);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.github.com/graphql");
    const body = JSON.parse(options!.body as string);
    expect(body.variables).toEqual({ login: "chosen-profile" });
    expect(body.query).toContain("types: REPOSITORY");
    expect(body.query).not.toContain("viewer");
  } finally {
    fetchMock.mockRestore();
  }
});

test("pin failures retain the last successful selection, including an empty selection", async () => {
  const responses = [
    Response.json({ message: "Bad credentials" }, { status: 401 }),
    Response.json({ errors: [{ message: "Rate limit" }], data: { user: { pinnedItems: { nodes: [] } } } }),
    Response.json({ data: { user: null } }),
    Response.json({ data: { user: { pinnedItems: { nodes: [null] } } } }),
  ];
  const fetchMock = spyOn(globalThis, "fetch");
  const errorMock = spyOn(console, "error").mockImplementation(() => {});
  try {
    for (const response of responses) {
      fetchMock.mockResolvedValueOnce(response);
      expect(await refreshPinnedRepositories("nexmoe", [pinnedRepository])).toEqual([pinnedRepository]);
    }
    fetchMock.mockRejectedValueOnce(new Error("Network unavailable"));
    expect(await refreshPinnedRepositories("nexmoe", [])).toEqual([]);
    fetchMock.mockRejectedValueOnce(new Error("Network unavailable"));
    expect(await refreshPinnedRepositories("nexmoe")).toBeUndefined();
    fetchMock.mockResolvedValueOnce(Response.json({ data: { user: { pinnedItems: { nodes: [] } } } }));
    expect(await refreshPinnedRepositories("nexmoe", [pinnedRepository])).toEqual([]);
  } finally {
    fetchMock.mockRestore();
    errorMock.mockRestore();
  }
});

test("refresh persists pin metadata for offline rendering in both READMEs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "readme-pins-"));
  try {
    for (const file of ["build_readme.ts", "readme_ui.ts", "repositories.json", "README.md", "README.zh-CN.md"]) {
      await Bun.write(join(directory, file), Bun.file(new URL(`./${file}`, import.meta.url)));
    }
    const saved = await Bun.file(new URL("./github_overview.json", import.meta.url)).json();
    delete saved.pinned_repositories;
    await Bun.write(join(directory, "github_overview.json"), JSON.stringify(saved));
    const pins = [pinnedRepository, { ...pinnedRepository, name: "VidBee", nameWithOwner: "nexmoe/VidBee" }];
    await Bun.write(join(directory, "mock-github.ts"), `
      globalThis.fetch = async (url, options) => {
        if (url === "https://api.github.com/graphql") {
          if (JSON.parse(options.body).variables.login !== "nexmoe") throw new Error("Wrong profile");
          return Response.json({ data: { user: { pinnedItems: { nodes: ${JSON.stringify(pins)} } } } });
        }
        if (url === "https://api.github.com/user") return Response.json({ login: "token-owner", followers: 1, created_at: "2026-11-01T00:00:00Z" });
        if (/\\/(?:user\\/repos|user\\/orgs|users\\/token-owner\\/orgs)\\?/.test(url)) return Response.json([]);
        throw new Error("Unexpected GitHub request: " + url);
      };
    `);
    const refresh = Bun.spawn([Bun.which("bun")!, "run", "--preload", "./mock-github.ts", "build_readme.ts"], {
      cwd: directory, stdout: "pipe", stderr: "pipe", env: { ...Bun.env, GH_TOKEN: "", GH_USERNAME: "nexmoe" },
    });
    const refreshErrors = await new Response(refresh.stderr).text();
    expect(await refresh.exited, refreshErrors).toBe(0);
    expect(refreshErrors).toBe("");
    const refreshed = await Bun.file(join(directory, "github_overview.json")).json();
    expect(refreshed.pinned_repositories).toEqual(pins);
    expect(refreshed.curated_repository_stars["owner/new"]).toBe(17);
    expect(refreshed.curated_repository_created_at["owner/new"]).toBe(pinnedRepository.createdAt);
    await Bun.write(join(directory, "no-network.ts"), 'globalThis.fetch = () => { throw new Error("Offline render must not access GitHub"); };');
    const render = Bun.spawn([Bun.which("bun")!, "run", "--preload", "./no-network.ts", "build_readme.ts", "--render"], { cwd: directory, stdout: "pipe", stderr: "pipe" });
    const stderr = await new Response(render.stderr).text();
    expect(await render.exited, stderr).toBe(0);
    for (const file of ["README.md", "README.zh-CN.md"]) {
      const content = await Bun.file(join(directory, file)).text();
      const links = [...content.matchAll(/<strong><a href="https:\/\/github.com\/([^"]+)">/g)].map(match => match[1]);
      expect(links).toEqual(["owner/new", "nexmoe/VidBee"]);
      expect(content).toContain("★&nbsp;17");
      expect(content).toContain("./assets/vidbee/transcript-framed.webp");
    }
    expect(await Bun.file(join(directory, "assets/repository-dates/owner-new.svg")).text()).toContain("2026-10-24");
    expect(await Bun.file(join(directory, "github_overview.json")).json()).toEqual(refreshed);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
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
  const vidbee = config.filter(repo => repo.repository === "nexmoe/VidBee");
  expect([...buildRepositoryMarkup(vidbee, stars, dates, "zh-CN").matchAll(/height="200"/g)]).toHaveLength(6);
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
