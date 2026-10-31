import { expect, test } from "bun:test";
import { buildOverviewSvg, updateReadme } from "./build_readme";
import { buildRepositoryMarkup, validateRepositories } from "./readme_ui";

test("project rendering preserves the Hero, Overview, and surrounding content", async () => {
  const readme = await Bun.file(new URL("./README.md", import.meta.url)).text();
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
  expect(svg).toContain("0 · 0.0%");
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
