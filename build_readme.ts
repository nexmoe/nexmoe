import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

type Repo = {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  fork: boolean;
  stargazers_count: number;
  forks_count: number;
};

type Release = {
  name?: string | null;
  tag_name?: string | null;
  published_at?: string | null;
  html_url: string;
};

type Scope = "owned" | "member";

type RepoStats = {
  stars: number;
  forks: number;
};

type ReleaseItem = {
  repo: string;
  repo_url: string;
  description: string;
  release: string;
  published_at: string;
  url: string;
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
  recent_releases: ReleaseItem[];
  markdown: {
    recent_releases: string;
    github_stats: string;
    charts: string;
    rankings: string;
  };
};

const root = dirname(fileURLToPath(import.meta.url));
const readmePath = join(root, "README.md");
const jsonPath = join(root, "github_overview.json");
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
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Shanghai",
  }).format(date);
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
  const match = readmeContent.match(
    /(\d{1,3}(?:,\d{3})*) followers\s*(?:,|·)\s*(\d{1,3}(?:,\d{3})*) stars\s*(?:,|·)\s*(\d{1,3}(?:,\d{3})*) forks/,
  );
  if (match) {
    return {
      followers: Number(match[1].replace(/,/g, "")),
      stars: Number(match[2].replace(/,/g, "")),
      forks: Number(match[3].replace(/,/g, "")),
    };
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

async function fetchReleases(repos: Repo[]) {
  const releases: ReleaseItem[] = [];
  for (const repo of repos) {
    try {
      const repoReleases = await ghFetch<Release[]>(
        `/repos/${repo.full_name}/releases?per_page=10&page=1`,
      );
      for (const release of repoReleases.slice(0, 10)) {
        if (!release.published_at) continue;
        const title = (release.name ?? release.tag_name ?? "").replace(repo.name, "").trim();
        releases.push({
          repo: repo.name,
          repo_url: repo.html_url,
          description: repo.description ?? "",
          release: title,
          published_at: release.published_at.slice(0, 10),
          url: release.html_url,
        });
      }
    } catch (error) {
      console.error(`Error fetching releases for ${repo.name}:`, error);
    }
  }
  return releases;
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

function buildAsciiBar(value: number, maxValue: number, width = 18) {
  if (maxValue <= 0 || value <= 0) {
    return "░".repeat(width);
  }
  const ratio = Math.min(1, value / maxValue);
  const filled = Math.max(1, Math.round(ratio * width));
  return `${"█".repeat(filled)}${"░".repeat(Math.max(0, width - filled))}`;
}

function buildRepoRankingMarkdown(repos: Repo[]) {
  const ranked = sortReposByStars(repos);
  const maxStars = ranked.reduce((max, repo) => Math.max(max, repo.stargazers_count), 0);
  return ranked
    .map((repo) => {
      return `• \`${buildAsciiBar(repo.stargazers_count, maxStars)}\` [${repo.name}](${repo.html_url}) ⭐ ${repo.stargazers_count.toLocaleString()}${repo.description ? ` - ${repo.description}` : ""}`;
    })
    .join("<br>");
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

type ChartItem = {
  label: string;
  value: number;
};

function sanitizeChartItems(items: ChartItem[]) {
  const normalized = items.map((item) => ({
    label: item.label,
    value: Number.isFinite(item.value) ? Math.max(0, Math.round(item.value)) : 0,
  }));

  if (normalized.some((item) => item.value > 0)) {
    return normalized;
  }

  return normalized.map((item, index) => ({
    label: item.label,
    value: index === 0 ? 1 : 0,
  }));
}

function buildInlineBarList(items: ChartItem[], width = 18) {
  const normalized = sanitizeChartItems(items);
  const maxValue = normalized.reduce((max, item) => Math.max(max, item.value), 0);
  return normalized
    .map(
      (item) =>
        `\`${buildAsciiBar(item.value, maxValue, width)}\` ${item.label}: ${item.value.toLocaleString()}`,
    )
    .join("<br>\n");
}

function buildChartsMarkdown(input: {
  starSources: ChartItem[];
  activity: ActivityStats;
}) {
  const activityItems: ChartItem[] = [
    { label: "Commits", value: input.activity.commits },
    { label: "PRs", value: input.activity.prs },
    { label: "Issues", value: input.activity.issues },
  ];

  const starSourceItems = input.starSources;

  return [
    "#### Activity Mix",
    buildInlineBarList(activityItems),
    "",
    "#### Star Sources",
    buildInlineBarList(starSourceItems),
  ].join("\n");
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

  let releases: ReleaseItem[] = [];
  try {
    releases = await fetchReleases(ownedRepos);
  } catch (error) {
    console.error("Error fetching releases:", error);
  }

  releases.sort((a, b) => (a.published_at < b.published_at ? 1 : -1));
  const seenRepos = new Set<string>();
  const uniqueReleases = releases.filter((release) => {
    if (seenRepos.has(release.repo)) return false;
    seenRepos.add(release.repo);
    return true;
  });

  const recentReleasesText = uniqueReleases
    .slice(0, 3)
    .map((release) => `• [${release.repo} ${release.release}](${release.url}) - ${release.published_at}`)
    .join("<br>");
  let rewritten = replaceChunk(readmeContents, "recent_releases", recentReleasesText);

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
  const dedupedExtraOrgRepos = dedupeReposByFullName(extraOrgRepos);
  const orgBuckets = new Map<string, Repo[]>();
  for (const repo of dedupedExtraOrgRepos) {
    if (ownedRepoSet.has(repo.full_name) || memberRepoSet.has(repo.full_name)) {
      continue;
    }
    const org = repo.full_name.split("/")[0];
    const bucket = orgBuckets.get(org) ?? [];
    bucket.push(repo);
    orgBuckets.set(org, bucket);
  }
  const orgSourceItems = [...orgBuckets.entries()]
    .map(([org, repos]) => ({ label: `Org ${org}`, value: repoStatsFromRepos(repos).stars }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
  const followers = userInfo.followers;
  const activity = await fetchActivityStats(userInfo.login, userInfo.createdAt);

  const mergedRepos = dedupeReposByFullName([...ownedRepos, ...memberRepos, ...extraOrgRepos]);
  const mergedStats = repoStatsFromRepos(mergedRepos);
  const totalStars = mergedStats.stars;
  const totalForks = mergedStats.forks;

  const mergedRankingText = buildRepoRankingMarkdown(mergedRepos);
  const baseStatsText =
    `👥 ${followers.toLocaleString()} followers · ⭐ ${totalStars.toLocaleString()} stars · 🍴 ${totalForks.toLocaleString()} forks`;
  const activityText =
    `💻 ${activity.commits.toLocaleString()} commits · 🔀 ${activity.prs.toLocaleString()} PRs · 🐛 ${activity.issues.toLocaleString()} issues · 👤 ${activity.contributed_to.toLocaleString()} repos contributed`;
  const githubStatsText = `${baseStatsText}<br>${activityText}`;
  const chartsMarkdown = buildChartsMarkdown({
    starSources: [
      { label: "Owned", value: ownedStats.stars },
      { label: "Member", value: memberStats.stars },
      ...(orgSourceItems.length > 0
        ? [{ label: "Org", value: orgSourceItems.reduce((sum, item) => sum + item.value, 0) }]
        : []),
      ...orgSourceItems,
    ],
    activity,
  });

  rewritten = replaceChunk(rewritten, "github_stats", githubStatsText, true);
  rewritten = replaceChunk(rewritten, "github_charts", chartsMarkdown);
  rewritten = replaceChunk(rewritten, "repo_rankings", mergedRankingText);
  rewritten = replaceChunk(rewritten, "last_updated", lastUpdated, true);

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
        recent_releases: uniqueReleases.slice(0, 3),
        last_updated: lastUpdated,
        markdown: {
          recent_releases: recentReleasesText,
          github_stats: githubStatsText,
          charts: chartsMarkdown,
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
