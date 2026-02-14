# README Data Guide

This document explains what the numbers in `README.md` mean and how to use this project.

## What This Script Does

Run `build_readme.ts` and it will update:

- `README.md` (stats, releases, top repositories, update time)
- `github_overview.json` (same data in JSON format)
- README chart blocks (`github_charts` marker)

## What Each Number Means

### Basic Stats

- `followers`: your current GitHub follower count
- `stars`: total stars of repositories included in this project
- `forks`: total forks of repositories included in this project

### Activity Stats

- `commits`: your commit count (hybrid calculation to avoid obvious undercount)
- `PRs`: pull requests created by you
- `issues`: issues created by you
- `repos contributed`: how many repositories you contributed to

### Charts in README

- `Activity Mix` (inline bars): split of commits / PRs / issues
- `Star Sources`:
  - `Owned`: owned repos star total
  - `Member only`: member repos that are not owned
  - `Org: <org>`: organization repos by org name (from membership + `GH_EXTRA_ORGS`) that are not owned/member

Note:

- These are profile-level overview numbers, not a perfect audit report.
- Different GitHub APIs have different counting rules, so script uses a combined strategy for better accuracy.

### Releases

- Shows latest releases from your owned repositories
- Displays only the latest one per repository
- Maximum 3 items in README

### Top Repositories

- Sorted by stars (high to low)
- Shows only repositories with `stars >= 50`
- Rendered as a markdown list (not a table)
- Each repo line starts with an inline star progress bar (normalized to max star in list)

## Which Repositories Are Included

The script merges repositories from:

- your owned repositories
- repositories where you are member/collaborator
- repositories in organizations you belong to
- optional extra organizations from `GH_EXTRA_ORGS`

Then it:

- removes fork repositories
- deduplicates by `owner/repo`

## Quick Start

1. Prepare `.env`

```env
GH_TOKEN=your_github_token
GH_USERNAME=nexmoe
GH_EXTRA_ORGS=theme-nexmoe
```

2. Run script

```bash
export $(cat .env)
bun run build_readme.ts
```

3. Check outputs

- `README.md` updated
- `github_overview.json` regenerated

## GitHub Actions

Workflow file: `.github/workflows/build.yml`

Current behavior:

- triggers on push / manual run / every 6 hours
- runs `bun run build_readme.ts`
- commits changes automatically

Required secret:

- `GH_TOKEN`

## Common Issues

- Missing organization repos:
  - add org names in `GH_EXTRA_ORGS`
  - check token permission or org security policy
- Numbers look too small:
  - confirm `GH_TOKEN` is valid and loaded in runtime
- README not updating:
  - make sure README markers are still present (`github_stats`, `github_charts`, `recent_releases`, `repo_rankings`, `last_updated`)
