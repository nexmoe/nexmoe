import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import {
  buildOverviewSvg, buildSectionHeadingSvg,
  buildRepositoryDateSvg, buildRepositoryMarkup, repositoryAssetName,
  validateRepositories, type OverviewInput,
} from "./readme_ui";
export { buildOverviewSvg } from "./readme_ui";

type Repo = {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  fork: boolean;
  stargazers_count: number;
  forks_count: number;
  created_at?: string;
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
  curated_repository_stars: Record<string, number>;
  curated_repository_created_at: Record<string, string>;
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
};

const root = dirname(fileURLToPath(import.meta.url));
const readmePath = join(root, "README.md");
const jsonPath = join(root, "github_overview.json");
const assetsDir = join(root, "assets");
const token = process.env.GH_TOKEN ?? "";

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "bun-readme-builder",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

// Only the rendered project block is replaced; the Hero and Overview stay manual.
export function updateReadme(content: string, repositories: string) {
  const pattern = /<!-- repositories starts -->[\s\S]*<!-- repositories ends -->/g;
  return content.replace(pattern, () => `<!-- repositories starts -->\n${repositories}\n<!-- repositories ends -->`);
}

async function renderReadmeVisuals(input: OverviewInput, repositoryStars: Record<string, number>, repositoryCreatedAt: Record<string, string>) {
  // Never derive this list from API results, stars, activity, or GitHub pins.
  const repositories = validateRepositories(await Bun.file(join(root, "repositories.json")).json());
  await mkdir(join(assetsDir, "repository-dates"), { recursive: true });
  const writes: Promise<number>[] = [];
  writes.push(...repositories.map(repo => Bun.write(
    join(assetsDir, "repository-dates", `${repositoryAssetName(repo)}.svg`),
    buildRepositoryDateSvg(repositoryCreatedAt[repo.repository]),
  )));
  const versions = [
    { locale: "en", file: "README.md", suffix: "", overview: "Overview", repositories: "Repositories", products: "Products" },
    { locale: "zh-CN", file: "README.zh-CN.md", suffix: ".zh-CN", overview: "开源概览", repositories: "项目", products: "产品" },
  ] as const;
  for (const version of versions) {
    const path = join(root, version.file);
    const content = await Bun.file(path).text();
    writes.push(Bun.write(path, updateReadme(content,
      buildRepositoryMarkup(repositories, repositoryStars, repositoryCreatedAt, version.locale))));
    writes.push(Bun.write(join(assetsDir, `overview-heading${version.suffix}.svg`), buildSectionHeadingSvg(version.overview)));
    writes.push(Bun.write(join(assetsDir, `repositories-heading${version.suffix}.svg`), buildSectionHeadingSvg(version.repositories)));
    writes.push(Bun.write(join(assetsDir, `products-heading${version.suffix}.svg`), buildSectionHeadingSvg(version.products)));
    writes.push(Bun.write(join(assetsDir, `github-overview${version.suffix}.svg`), buildOverviewSvg(input, version.locale)));
  }
  await Promise.all(writes);
}

async function renderSavedSnapshot() {
  const data = await Bun.file(jsonPath).json() as OutputPayload;
  const input: OverviewInput = {
    ...data.totals,
    repositoryCount: data.scopes.merged.count,
    activity: data.activity,
    starSources: [
      { label: "Owned repositories", value: data.star_sources.owned },
      { label: "Member / collaborator", value: data.star_sources.member },
      { label: "Organizations", value: data.star_sources.organization },
    ],
    organizationSources: Object.entries(data.star_sources.organizations)
      .map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    lastUpdated: data.last_updated,
  };
  await renderReadmeVisuals(input, data.curated_repository_stars ?? {}, data.curated_repository_created_at ?? {});
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

async function fetchCuratedRepositoryMetadata(knownRepos: Repo[]) {
  const selected = validateRepositories(await Bun.file(join(root, "repositories.json")).json());
  const saved = await Bun.file(jsonPath).json().catch(() => null) as OutputPayload | null;
  const counts: Record<string, number> = {};
  const dates: Record<string, string> = {};
  const known = new Map(knownRepos.map(repo => [repo.full_name.toLowerCase(), repo]));
  await Promise.all(selected.map(async repo => {
    const cached = saved?.curated_repository_stars?.[repo.repository];
    if (cached !== undefined) counts[repo.repository] = cached;
    const cachedDate = saved?.curated_repository_created_at?.[repo.repository];
    if (cachedDate !== undefined) dates[repo.repository] = cachedDate;
    try {
      const knownRepo = known.get(repo.repository.toLowerCase());
      const fetched = knownRepo && (knownRepo.created_at || cachedDate) ? undefined :
        await ghFetch<{ stargazers_count: number; created_at: string }>(`/repos/${repo.repository}`);
      const stars = knownRepo?.stargazers_count ?? fetched?.stargazers_count;
      if (typeof stars !== "number" || !Number.isSafeInteger(stars) || stars < 0) throw new Error("Invalid star count");
      counts[repo.repository] = stars;
      const createdAt = knownRepo?.created_at ?? fetched?.created_at ?? cachedDate;
      if (createdAt && !Number.isNaN(Date.parse(createdAt))) dates[repo.repository] = createdAt;
    } catch (error) {
      console.error(`Error refreshing metadata for ${repo.repository}; keeping saved values:`, error);
    }
  }));
  return { stars: counts, createdAt: dates };
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


async function main() {
  const now = new Date();
  const lastUpdated = formatLastUpdated(now);
  const readmeContents = await Bun.file(readmePath).text();
  const savedStats = await Bun.file(jsonPath).json().catch(() => null) as OutputPayload | null;
  const currentStats = savedStats?.totals ?? extractCurrentStats(readmeContents);

  let ownedRepos: Repo[] = [];
  try {
    ownedRepos = await fetchOwnedRepos();
  } catch (error) {
    console.error("Error fetching owned repositories:", error);
  }

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
  const { stars: curatedRepositoryStars, createdAt: curatedRepositoryCreatedAt } = await fetchCuratedRepositoryMetadata(mergedRepos);
  const mergedStats = repoStatsFromRepos(mergedRepos);
  const totalStars = mergedStats.stars;
  const totalForks = mergedStats.forks;

  await renderReadmeVisuals({
    followers,
    stars: totalStars,
    forks: totalForks,
    repositoryCount: mergedRepos.length,
    activity,
    starSources,
    organizationSources,
    lastUpdated,
  }, curatedRepositoryStars, curatedRepositoryCreatedAt);
  await Bun.write(
    jsonPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        curated_repository_stars: curatedRepositoryStars,
        curated_repository_created_at: curatedRepositoryCreatedAt,
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
      } satisfies OutputPayload,
      null,
      2,
    ),
  );
}

if (import.meta.main) {
  if (process.argv.includes("--render")) await renderSavedSnapshot();
  else await main();
}
