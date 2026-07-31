import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";

type Repo = {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  fork: boolean;
  stargazers_count: number;
  forks_count: number;
};

type RepoStats = {
  stars: number;
  forks: number;
};

type RankedRepo = Pick<
  Repo,
  "name" | "full_name" | "html_url" | "description" | "stargazers_count" | "forks_count"
>;

type ActivityStats = {
  commits: number;
  prs: number;
  issues: number;
  total: number;
  contributed_to: number;
};

type CurrentUserInfo = {
  login: string;
  followers: number;
  createdAt: Date;
};

type ChartItem = {
  label: string;
  value: number;
};

type OutputPayload = {
  generated_at: string;
  last_updated: string;
  totals: {
    followers: number;
    stars: number;
    forks: number;
  };
  scopes: {
    owned: RepoStats & { count: number; repos: RankedRepo[] };
    member: RepoStats & { count: number; repos: RankedRepo[] };
    merged: RepoStats & { count: number; repos: RankedRepo[] };
  };
  activity: ActivityStats;
  star_sources: {
    owned: number;
    member: number;
    organization: number;
    organizations: Record<string, number>;
  };
  markdown: {
    github_stats: string;
    rankings: string;
  };
};

const root = dirname(fileURLToPath(import.meta.url));
const readmePath = join(root, "README.md");
const jsonPath = join(root, "github_overview.json");
const assetsDir = join(root, "assets");
const overviewSvgPath = join(assetsDir, "github-overview.svg");
const repositoryBarsDir = join(assetsDir, "repository-bars");
const token = process.env.GH_TOKEN ?? "";

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "bun-readme-builder",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

function replaceChunk(content: string, marker: string, chunk: string, inline = false) {
  const pattern = new RegExp(`<!-- ${marker} starts -->[\\s\\S]*<!-- ${marker} ends -->`, "g");
  let body = chunk;
  if (!inline) {
    body = `\n${chunk}\n`;
  }
  return content.replace(pattern, `<!-- ${marker} starts -->${body}<!-- ${marker} ends -->`);
}

function formatLastUpdated(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Shanghai",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});

  return `${parts.day} ${parts.month} ${parts.year} · ${parts.hour}:${parts.minute} UTC+8`;
}

async function ghFetch<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(`GitHub API error (${res.status} ${res.statusText}) for ${path}: ${message}`);
  }
  return (await res.json()) as T;
}

async function ghFetchPublic<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: headers.Accept,
      "User-Agent": headers["User-Agent"],
    },
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(`GitHub public API error (${res.status} ${res.statusText}) for ${path}: ${message}`);
  }
  return (await res.json()) as T;
}

function extractCurrentStats(readmeContent: string) {
  const legacyMatch = readmeContent.match(
    /(\d{1,3}(?:,\d{3})*) followers\s*(?:,|·)\s*(\d{1,3}(?:,\d{3})*) stars\s*(?:,|·)\s*(\d{1,3}(?:,\d{3})*) forks/,
  );
  if (legacyMatch) {
    return {
      followers: Number(legacyMatch[1].replace(/,/g, "")),
      stars: Number(legacyMatch[2].replace(/,/g, "")),
      forks: Number(legacyMatch[3].replace(/,/g, "")),
    };
  }

  const readInlineMetric = (label: string) => {
    const match = readmeContent.match(
      new RegExp(`\\*\\*([\\d,]+)\\s+${label}\\*\\*`, "i"),
    );
    return match ? Number(match[1].replace(/,/g, "")) : null;
  };
  const readCardMetric = (label: string) => {
    const match = readmeContent.match(
      new RegExp(`<strong>([\\d,]+)</strong><br>\\s*<sub>${label}</sub>`, "i"),
    );
    return match ? Number(match[1].replace(/,/g, "")) : null;
  };
  const readTableMetric = (label: string) => {
    const match = readmeContent.match(
      new RegExp(`\\|\\s*${label}\\s*\\|\\s*([\\d,]+)\\s*\\|`, "i"),
    );
    return match ? Number(match[1].replace(/,/g, "")) : null;
  };
  const followers =
    readInlineMetric("followers") ?? readCardMetric("Followers") ?? readTableMetric("Followers");
  const stars = readInlineMetric("stars") ?? readCardMetric("Stars") ?? readTableMetric("Stars");
  const forks = readInlineMetric("forks") ?? readCardMetric("Forks") ?? readTableMetric("Forks");
  if (followers !== null && stars !== null && forks !== null) {
    return { followers, stars, forks };
  }

  return { followers: 6000, stars: 62000, forks: 10000 };
}

async function fetchReposByQuery(query: string): Promise<Repo[]> {
  const repos: Repo[] = [];
  let page = 1;
  while (true) {
    const batch = await ghFetch<Repo[]>(`/user/repos?${query}&per_page=100&page=${page}`);
    repos.push(...batch.filter((repo) => !repo.fork));
    if (batch.length < 100) break;
    page += 1;
  }
  return repos;
}

async function fetchOwnedRepos(): Promise<Repo[]> {
  return fetchReposByQuery("type=owner");
}

async function fetchMemberRepos(): Promise<Repo[]> {
  return fetchReposByQuery("affiliation=collaborator,organization_member");
}

function parseRepoListEnv(key: string): string[] {
  return (process.env[key] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

type Org = {
  login: string;
};

async function fetchUserOrganizations(login: string) {
  const orgs = new Set<string>();

  let page = 1;
  while (true) {
    let batch: Org[] = [];
    try {
      batch = await ghFetch<Org[]>(`/user/orgs?per_page=100&page=${page}`);
    } catch (error) {
      console.error("Error fetching organizations from /user/orgs:", error);
      break;
    }
    for (const org of batch) {
      orgs.add(org.login);
    }
    if (batch.length < 100) break;
    page += 1;
  }

  page = 1;
  const encodedLogin = encodeURIComponent(login);
  while (true) {
    let batch: Org[] = [];
    try {
      batch = await ghFetch<Org[]>(`/users/${encodedLogin}/orgs?per_page=100&page=${page}`);
    } catch (error) {
      console.error(`Error fetching organizations from /users/${login}/orgs:`, error);
      break;
    }
    for (const org of batch) {
      orgs.add(org.login);
    }
    if (batch.length < 100) break;
    page += 1;
  }

  return [...orgs];
}

async function fetchOrgRepos(org: string): Promise<Repo[]> {
  const repos: Repo[] = [];
  let page = 1;
  const encodedOrg = encodeURIComponent(org);
  while (true) {
    const path = `/orgs/${encodedOrg}/repos?type=all&per_page=100&page=${page}`;
    let batch: Repo[];
    try {
      batch = await ghFetch<Repo[]>(path);
    } catch (error) {
      if (token) {
        try {
          batch = await ghFetchPublic<Repo[]>(path);
        } catch (fallbackError) {
          throw error;
        }
      } else {
        throw error;
      }
    }
    repos.push(...batch.filter((repo) => !repo.fork));
    if (batch.length < 100) break;
    page += 1;
  }
  return repos;
}

function repoStatsFromRepos(repos: Repo[]): RepoStats {
  let stars = 0;
  let forks = 0;
  for (const repo of repos) {
    stars += repo.stargazers_count;
    forks += repo.forks_count;
  }
  return { stars, forks };
}

async function fetchCurrentUserInfo(currentFollowers: number): Promise<CurrentUserInfo> {
  const fallbackLogin = (process.env.GH_USERNAME ?? "nexmoe").trim() || "nexmoe";
  try {
    const user = await ghFetch<{ login: string; followers: number; created_at: string }>("/user");
    return {
      login: user.login || fallbackLogin,
      followers: user.followers,
      createdAt: new Date(user.created_at),
    };
  } catch (error) {
    console.error("Error fetching current user info:", error);
    return {
      login: fallbackLogin,
      followers: currentFollowers,
      createdAt: new Date(),
    };
  }
}

type YearlyActivity = {
  commits: number;
  prs: number;
  issues: number;
  calendarTotal: number;
  reviews: number;
  repoCreates: number;
  contributedRepos: Set<string>;
};

type RepoContributionItem = {
  repository: {
    nameWithOwner: string;
  };
  contributions?: {
    totalCount?: number;
  };
};

type SearchCountResponse = {
  total_count: number;
  incomplete_results?: boolean;
};

async function fetchSearchCount(path: string): Promise<number> {
  const data = await ghFetch<SearchCountResponse>(path);
  return data.total_count ?? 0;
}

async function fetchActivityStats(login: string, createdAt: Date): Promise<ActivityStats> {
  if (!token) {
    return {
      commits: 0,
      prs: 0,
      issues: 0,
      total: 0,
      contributed_to: 0,
    };
  }

  const query = `
    query($from: DateTime!, $to: DateTime!) {
      viewer {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
          }
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
          totalPullRequestReviewContributions
          totalRepositoryContributions
          commitContributionsByRepository(maxRepositories: 100) {
            repository {
              nameWithOwner
            }
            contributions(first: 1) {
              totalCount
            }
          }
          pullRequestContributionsByRepository(maxRepositories: 100) {
            repository {
              nameWithOwner
            }
            contributions(first: 1) {
              totalCount
            }
          }
          issueContributionsByRepository(maxRepositories: 100) {
            repository {
              nameWithOwner
            }
            contributions(first: 1) {
              totalCount
            }
          }
        }
      }
    }
  `;

  const addRepos = (items: RepoContributionItem[], target: YearlyActivity) => {
    for (const item of items) {
      const totalCount = item.contributions?.totalCount ?? 0;
      if (totalCount > 0) {
        target.contributedRepos.add(item.repository.nameWithOwner);
      }
    }
  };

  const fetchOneYear = async (fromDate: Date, toDate: Date): Promise<YearlyActivity> => {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        },
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`GitHub GraphQL error (${response.status} ${response.statusText}): ${message}`);
    }

    const payload = await response.json() as {
      errors?: Array<{ message: string }>;
      data?: {
        viewer?: {
          contributionsCollection?: {
            contributionCalendar?: {
              totalContributions: number;
            };
            totalCommitContributions: number;
            totalPullRequestContributions: number;
            totalIssueContributions: number;
            totalPullRequestReviewContributions: number;
            totalRepositoryContributions: number;
            commitContributionsByRepository: Array<{
              repository: { nameWithOwner: string };
              contributions: { totalCount: number };
            }>;
            pullRequestContributionsByRepository: Array<{
              repository: { nameWithOwner: string };
              contributions: { totalCount: number };
            }>;
            issueContributionsByRepository: Array<{
              repository: { nameWithOwner: string };
              contributions: { totalCount: number };
            }>;
          };
        };
      };
    };

    if (payload.errors?.length) {
      throw new Error(payload.errors.map((item) => item.message).join("; "));
    }

    const collection = payload.data?.viewer?.contributionsCollection;
    if (!collection) {
      return {
        commits: 0,
        prs: 0,
        issues: 0,
        calendarTotal: 0,
        reviews: 0,
        repoCreates: 0,
        contributedRepos: new Set<string>(),
      };
    }

    const result: YearlyActivity = {
      commits: collection.totalCommitContributions ?? 0,
      prs: collection.totalPullRequestContributions ?? 0,
      issues: collection.totalIssueContributions ?? 0,
      calendarTotal: collection.contributionCalendar?.totalContributions ?? 0,
      reviews: collection.totalPullRequestReviewContributions ?? 0,
      repoCreates: collection.totalRepositoryContributions ?? 0,
      contributedRepos: new Set<string>(),
    };

    addRepos(collection.commitContributionsByRepository, result);
    addRepos(collection.issueContributionsByRepository, result);
    addRepos(collection.pullRequestContributionsByRepository, result);
    return result;
  };

  const now = new Date();
  let cursor = new Date(createdAt);
  const merged = {
    commits: 0,
    prs: 0,
    issues: 0,
    calendarTotal: 0,
    reviews: 0,
    repoCreates: 0,
    contributedRepos: new Set<string>(),
  };

  while (cursor < now) {
    const windowStart = new Date(cursor);
    const windowEnd = new Date(windowStart);
    windowEnd.setFullYear(windowEnd.getFullYear() + 1);
    if (windowEnd > now) {
      windowEnd.setTime(now.getTime());
    }

    try {
      const oneYear = await fetchOneYear(windowStart, windowEnd);
      merged.commits += oneYear.commits;
      merged.prs += oneYear.prs;
      merged.issues += oneYear.issues;
      merged.calendarTotal += oneYear.calendarTotal;
      merged.reviews += oneYear.reviews;
      merged.repoCreates += oneYear.repoCreates;
      for (const repoName of oneYear.contributedRepos) {
        merged.contributedRepos.add(repoName);
      }
    } catch (error) {
      console.error("Error fetching yearly activity:", error);
      break;
    }

    cursor = windowEnd;
  }

  let searchCommitCount = 0;
  let searchPrCount = 0;
  let searchIssueCount = 0;

  // Search API can capture activity that contribution graph omits.
  try {
    const encodedLogin = encodeURIComponent(login);
    const [commitCount, prCount, issueCount] = await Promise.all([
      fetchSearchCount(`/search/commits?q=author:${encodedLogin}&per_page=1`),
      fetchSearchCount(`/search/issues?q=author:${encodedLogin}+is:pr&per_page=1`),
      fetchSearchCount(`/search/issues?q=author:${encodedLogin}+is:issue&per_page=1`),
    ]);
    searchCommitCount = commitCount;
    searchPrCount = prCount;
    searchIssueCount = issueCount;
  } catch (error) {
    console.error("Error fetching activity from Search API:", error);
  }

  // Derive commit-like contributions from calendar total to avoid undercount
  // when restricted/private contributions cannot be typed by the API.
  const calendarDerivedCommits = Math.max(
    0,
    merged.calendarTotal - merged.prs - merged.issues - merged.reviews - merged.repoCreates,
  );
  const commits = Math.max(merged.commits, searchCommitCount, calendarDerivedCommits);
  const prs = Math.max(merged.prs, searchPrCount);
  const issues = Math.max(merged.issues, searchIssueCount);

  return {
    commits,
    prs,
    issues,
    total: commits + prs + issues,
    contributed_to: merged.contributedRepos.size,
  };
}

function sortReposByStars(repos: Repo[]) {
  return [...repos]
    .filter((repo) => repo.stargazers_count >= 50)
    .sort((a, b) => b.stargazers_count - a.stargazers_count);
}

function escapeMarkdownTable(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function repositoryBarFilename(fullName: string) {
  return `${fullName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-")}.svg`;
}

function buildRepositoryBarSvg(value: number, maximum: number) {
  const ratio = maximum > 0 ? Math.min(1, Math.max(0, value / maximum)) : 0;
  const width = value > 0 ? Math.max(1, ratio * 152) : 0;
  const percent = ratio * 100;
  const count = value.toLocaleString("en-US");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="152" height="30" viewBox="0 0 152 30" role="img" aria-label="${count} stars, ${percent.toFixed(1)} percent of the top repository">
<title>${count} stars · ${percent.toFixed(1)}% of the top repository</title>
<style>
  .count{fill:#1d1d1f;font:600 11px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .percent{fill:#6e6e73;font:500 10px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .track{fill:#e5e5ea}.fill{fill:#0071e3}
  @media (prefers-color-scheme:dark){.count{fill:#f5f5f7}.percent{fill:#a1a1a6}.track{fill:#3a3a3c}.fill{fill:#2997ff}}
</style>
<text class="count" x="0" y="12">${count} stars</text>
<text class="percent" x="152" y="12" text-anchor="end">${percent.toFixed(1)}%</text>
<rect class="track" y="21" width="152" height="6" rx="3"/>
<rect class="fill" y="21" width="${width.toFixed(2)}" height="6" rx="3"/>
</svg>`;
}

function buildRepoRankingMarkdown(repos: Repo[]) {
  const ranked = sortReposByStars(repos);
  const maximum = Math.max(1, ...ranked.map((repo) => repo.stargazers_count));
  const rows = ranked.map((repo) => {
    const description = repo.description
      ? escapeXml(repo.description).replace(/\s+/g, " ").trim()
      : "No description";
    const percent = (repo.stargazers_count / maximum) * 100;
    const barPath = `./assets/repository-bars/${repositoryBarFilename(repo.full_name)}`;
    const stars = repo.stargazers_count.toLocaleString("en-US");
    const alt = `${stars} stars · ${percent.toFixed(1)}% of the top repository`;
    return `<p>
  <a href="${escapeXml(repo.html_url)}"><strong>${escapeXml(repo.full_name)}</strong></a>
  <img src="${barPath}" alt="${alt}" width="152" height="30" align="right">
  <br>
  <sub>${description}</sub>
</p>`;
  });

  return rows.join("\n");
}

function buildRankedRepos(repos: Repo[]): RankedRepo[] {
  return sortReposByStars(repos).map((repo) => ({
    name: repo.name,
    full_name: repo.full_name,
    html_url: repo.html_url,
    description: repo.description,
    stargazers_count: repo.stargazers_count,
    forks_count: repo.forks_count,
  }));
}

function dedupeReposByFullName(repos: Repo[]) {
  return repos.filter(
    (repo, index, list) => index === list.findIndex((item) => item.full_name === repo.full_name),
  );
}

function buildGitHubStatsMarkdown(input: {
  followers: number;
  stars: number;
  forks: number;
  repositoryCount: number;
  activity: ActivityStats;
  starSources: ChartItem[];
  organizationSources: ChartItem[];
}) {
  const coreRows = [
    ["Followers", input.followers],
    ["Stars", input.stars],
    ["Forks", input.forks],
    ["Tracked repositories", input.repositoryCount],
    ["Commits", input.activity.commits],
    ["Pull requests", input.activity.prs],
    ["Issues", input.activity.issues],
    ["Repositories contributed to", input.activity.contributed_to],
  ].map(([label, value]) => `| ${label} | ${Number(value).toLocaleString()} |`);
  const sourceRows = input.starSources.map(
    (item) => `| ${escapeMarkdownTable(item.label)} | ${item.value.toLocaleString()} |`,
  );
  const organizationRows = input.organizationSources.map(
    (item) => `| ${escapeMarkdownTable(item.label)} | ${item.value.toLocaleString()} |`,
  );

  return [
    "### Core metrics",
    "",
    "| Metric | Value |",
    "|:--|--:|",
    ...coreRows,
    "",
    "### Star sources",
    "",
    "| Source | Stars |",
    "|:--|--:|",
    ...sourceRows,
    ...(organizationRows.length > 0
      ? [
          "",
          "### Organizations",
          "",
          "| Organization | Stars |",
          "|:--|--:|",
          ...organizationRows,
        ]
      : []),
  ].join("\n");
}

const chartClasses = ["primary", "secondary", "tertiary"];

function buildStackedBar(
  items: ChartItem[],
  x: number,
  y: number,
  width: number,
  height: number,
  clipId: string,
) {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  let offset = 0;
  const segments = items.map((item, index) => {
    const segmentWidth =
      index === items.length - 1
        ? Math.max(0, width - offset)
        : total > 0
          ? (Math.max(0, item.value) / total) * width
          : 0;
    const segment = `<rect class="${chartClasses[index % chartClasses.length]}" x="${(x + offset).toFixed(2)}" y="${y}" width="${segmentWidth.toFixed(2)}" height="${height}"/>`;
    offset += segmentWidth;
    return segment;
  });
  return `<g clip-path="url(#${clipId})">${segments.join("")}</g>`;
}

function buildLegendRows(items: ChartItem[], x: number, y: number, valueX: number) {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  return items
    .map((item, index) => {
      const rowY = y + index * 26;
      const share = total > 0 ? (item.value / total) * 100 : 0;
      return [
        `<circle class="${chartClasses[index % chartClasses.length]}" cx="${x + 4.5}" cy="${rowY - 4}" r="4.5"/>`,
        `<text class="body" x="${x + 17}" y="${rowY}">${escapeXml(item.label)}</text>`,
        `<text class="value" x="${valueX}" y="${rowY}">${item.value.toLocaleString()} · ${share.toFixed(1)}%</text>`,
      ].join("");
    })
    .join("");
}

function buildOverviewSvg(input: {
  followers: number;
  stars: number;
  forks: number;
  repositoryCount: number;
  activity: ActivityStats;
  starSources: ChartItem[];
  organizationSources: ChartItem[];
  lastUpdated: string;
}) {
  const activityItems: ChartItem[] = [
    { label: "Commits", value: input.activity.commits },
    { label: "Pull requests", value: input.activity.prs },
    { label: "Issues", value: input.activity.issues },
  ];
  const organizationItems = input.organizationSources.slice(0, 6);
  const organizationMax = Math.max(1, ...organizationItems.map((item) => item.value));
  const organizationBars = organizationItems
    .map((item, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = 40 + column * 280;
      const labelY = 456 + row * 60;
      const barY = labelY + 11;
      const barWidth = (item.value / organizationMax) * 238;
      return [
        `<text class="body" x="${x}" y="${labelY}">${escapeXml(item.label)}</text>`,
        `<text class="value" x="${x + 180}" y="${labelY}">${item.value.toLocaleString()}</text>`,
        `<rect class="track" x="${x}" y="${barY}" width="238" height="7" rx="3.5"/>`,
        `<rect class="primary" x="${x}" y="${barY}" width="${barWidth.toFixed(2)}" height="7" rx="3.5"/>`,
      ].join("");
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="590" viewBox="0 0 900 590" role="img" aria-labelledby="overview-title overview-desc">
<title id="overview-title">Nexmoe open-source overview</title>
<desc id="overview-desc">${input.stars.toLocaleString()} stars, ${input.followers.toLocaleString()} followers, ${input.forks.toLocaleString()} forks, ${input.activity.commits.toLocaleString()} commits, ${input.activity.prs.toLocaleString()} pull requests, ${input.activity.issues.toLocaleString()} issues, and ${input.activity.contributed_to.toLocaleString()} repositories contributed to.</desc>
<style>
  .surface{fill:#f5f5f7}.frame{fill:none;stroke:#d2d2d7;stroke-width:1}.rule{stroke:#d2d2d7;stroke-width:1}
  .track{fill:#e5e5ea}.primary{fill:#0071e3}.secondary{fill:#64a8f4}.tertiary{fill:#a7cef8}
  text{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif;font-variant-numeric:tabular-nums}
  .title{font-size:15px;font-weight:600;letter-spacing:-.15px;fill:#1d1d1f}.eyebrow{font-size:11px;font-weight:500;letter-spacing:.1px;fill:#6e6e73}
  .hero{font-size:52px;font-weight:600;letter-spacing:-1.8px;fill:#0071e3}.metric{font-size:31px;font-weight:600;letter-spacing:-.7px;fill:#1d1d1f}
  .section{font-size:13px;font-weight:600;letter-spacing:-.1px;fill:#1d1d1f}.body{font-size:13px;font-weight:500;fill:#1d1d1f}.value{font-size:12px;font-weight:500;fill:#6e6e73}.note{font-size:11px;font-weight:400;fill:#6e6e73}
  @media (prefers-color-scheme:dark){.surface{fill:#1c1c1e}.frame,.rule{stroke:#3a3a3c}.track{fill:#3a3a3c}.title,.metric,.section,.body{fill:#f5f5f7}.eyebrow,.value,.note{fill:#a1a1a6}.primary,.hero{fill:#2997ff}.secondary{fill:#64a8f4}.tertiary{fill:#9ac8f5}}
</style>
<rect class="surface" x="0.5" y="0.5" width="899" height="589" rx="22"/>
<rect class="frame" x="0.5" y="0.5" width="899" height="589" rx="22"/>
<defs>
  <clipPath id="activity-bar"><rect x="40" y="274" width="380" height="14" rx="7"/></clipPath>
  <clipPath id="source-bar"><rect x="480" y="274" width="380" height="14" rx="7"/></clipPath>
</defs>
<text class="title" x="40" y="39">Nexmoe</text>
<text class="note" x="105" y="39">Open-source overview</text>
<text class="note" x="700" y="39">${escapeXml(input.lastUpdated)}</text>
<line class="rule" x1="40" y1="59" x2="860" y2="59"/>
<text class="eyebrow" x="40" y="102">Total stars</text>
<text class="hero" x="40" y="166">${input.stars.toLocaleString()}</text>
<text class="value" x="42" y="194">across ${input.repositoryCount.toLocaleString()} tracked repositories</text>
<text class="eyebrow" x="480" y="108">Followers</text>
<text class="metric" x="480" y="151">${input.followers.toLocaleString()}</text>
<text class="eyebrow" x="625" y="108">Forks</text>
<text class="metric" x="625" y="151">${input.forks.toLocaleString()}</text>
<text class="eyebrow" x="745" y="108">Contributed to</text>
<text class="metric" x="745" y="151">${input.activity.contributed_to.toLocaleString()}</text>
<line class="rule" x1="40" y1="222" x2="860" y2="222"/>
<text class="section" x="40" y="252">Activity</text>
<text class="section" x="480" y="252">Star sources</text>
<rect class="track" x="40" y="274" width="380" height="14" rx="7"/>
${buildStackedBar(activityItems, 40, 274, 380, 14, "activity-bar")}
<rect class="track" x="480" y="274" width="380" height="14" rx="7"/>
${buildStackedBar(input.starSources, 480, 274, 380, 14, "source-bar")}
${buildLegendRows(activityItems, 40, 316, 300)}
${buildLegendRows(input.starSources, 480, 316, 740)}
<line class="rule" x1="40" y1="394" x2="860" y2="394"/>
<text class="section" x="40" y="425">Organization breakdown</text>
${organizationBars || '<text class="note" x="40" y="456">No organization data available.</text>'}
<text class="note" x="680" y="567">Generated from GitHub API data</text>
</svg>`;
}

async function main() {
  const now = new Date();
  const lastUpdated = formatLastUpdated(now);
  const readmeContents = await Bun.file(readmePath).text();
  const currentStats = extractCurrentStats(readmeContents);

  let ownedRepos: Repo[] = [];
  try {
    ownedRepos = await fetchOwnedRepos();
  } catch (error) {
    console.error("Error fetching owned repositories:", error);
  }

  let rewritten = readmeContents;

  let memberRepos: Repo[] = [];
  try {
    memberRepos = await fetchMemberRepos();
  } catch (error) {
    console.error("Error fetching member repositories:", error);
  }

  const userInfo = await fetchCurrentUserInfo(currentStats.followers);

  let extraOrgRepos: Repo[] = [];
  const manualOrgs = parseRepoListEnv("GH_EXTRA_ORGS");
  const extraOrgs = [
    ...manualOrgs,
    ...(await fetchUserOrganizations(userInfo.login).catch((error) => {
      console.error("Error fetching user organizations:", error);
      return [];
    })),
  ];
  const dedupedExtraOrgs = [...new Set(extraOrgs.map((org) => org.trim()).filter(Boolean))];
  for (const org of dedupedExtraOrgs) {
    try {
      const extraRepos = await fetchOrgRepos(org);
      extraOrgRepos = extraOrgRepos.concat(extraRepos);
    } catch (error) {
      console.error(`Error fetching organization repositories for ${org}:`, error);
    }
  }

  const ownedStats = repoStatsFromRepos(ownedRepos);
  const ownedRepoSet = new Set(ownedRepos.map((repo) => repo.full_name));
  const memberRepoSet = new Set(memberRepos.map((repo) => repo.full_name));
  const memberOnlyRepos = dedupeReposByFullName(
    memberRepos.filter((repo) => !ownedRepoSet.has(repo.full_name)),
  );
  const memberStats = repoStatsFromRepos(memberOnlyRepos);
  const organizationBuckets = new Map<string, Repo[]>();
  for (const repo of dedupeReposByFullName(extraOrgRepos)) {
    if (ownedRepoSet.has(repo.full_name) || memberRepoSet.has(repo.full_name)) continue;
    const organization = repo.full_name.split("/")[0];
    const bucket = organizationBuckets.get(organization) ?? [];
    bucket.push(repo);
    organizationBuckets.set(organization, bucket);
  }
  const organizationSources = [...organizationBuckets.entries()]
    .map(([label, repos]) => ({ label, value: repoStatsFromRepos(repos).stars }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
  const organizationStars = organizationSources.reduce((sum, item) => sum + item.value, 0);
  const starSources: ChartItem[] = [
    { label: "Owned repositories", value: ownedStats.stars },
    { label: "Member / collaborator", value: memberStats.stars },
    { label: "Organizations", value: organizationStars },
  ];
  const followers = userInfo.followers;
  const activity = await fetchActivityStats(userInfo.login, userInfo.createdAt);

  const mergedRepos = dedupeReposByFullName([...ownedRepos, ...memberRepos, ...extraOrgRepos]);
  const mergedStats = repoStatsFromRepos(mergedRepos);
  const totalStars = mergedStats.stars;
  const totalForks = mergedStats.forks;

  const mergedRankingText = buildRepoRankingMarkdown(mergedRepos);
  const githubStatsText = buildGitHubStatsMarkdown({
    followers,
    stars: totalStars,
    forks: totalForks,
    repositoryCount: mergedRepos.length,
    activity,
    starSources,
    organizationSources,
  });
  const overviewSvg = buildOverviewSvg({
    followers,
    stars: totalStars,
    forks: totalForks,
    repositoryCount: mergedRepos.length,
    activity,
    starSources,
    organizationSources,
    lastUpdated,
  });
  const rankedRepos = sortReposByStars(mergedRepos);
  const maximumRepoStars = Math.max(1, ...rankedRepos.map((repo) => repo.stargazers_count));

  rewritten = replaceChunk(rewritten, "github_stats", githubStatsText);
  rewritten = replaceChunk(rewritten, "repo_rankings", mergedRankingText);
  rewritten = replaceChunk(rewritten, "last_updated", lastUpdated, true);

  await mkdir(assetsDir, { recursive: true });
  await mkdir(repositoryBarsDir, { recursive: true });
  await Promise.all([
    Bun.write(overviewSvgPath, overviewSvg),
    ...rankedRepos.map((repo) =>
      Bun.write(
        join(repositoryBarsDir, repositoryBarFilename(repo.full_name)),
        buildRepositoryBarSvg(repo.stargazers_count, maximumRepoStars),
      ),
    ),
  ]);
  await Bun.write(
    jsonPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        totals: {
          followers,
          stars: totalStars,
          forks: totalForks,
        },
        scopes: {
          owned: {
            ...ownedStats,
            count: ownedRepos.length,
            repos: buildRankedRepos(ownedRepos),
          },
          member: {
            ...memberStats,
            count: memberRepos.length,
            repos: buildRankedRepos(memberRepos),
          },
          merged: {
            ...mergedStats,
            count: mergedRepos.length,
            repos: buildRankedRepos(mergedRepos),
          },
        },
        activity,
        star_sources: {
          owned: ownedStats.stars,
          member: memberStats.stars,
          organization: organizationStars,
          organizations: Object.fromEntries(
            organizationSources.map((item) => [item.label, item.value]),
          ),
        },
        last_updated: lastUpdated,
        markdown: {
          github_stats: githubStatsText,
          rankings: mergedRankingText,
        },
      } satisfies OutputPayload,
      null,
      2,
    ),
  );
  await Bun.write(readmePath, rewritten);
}

await main();
