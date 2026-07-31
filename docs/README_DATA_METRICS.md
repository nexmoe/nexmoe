# README Data Guide

`build_readme.ts` generates a visual GitHub profile overview while preserving
the complete underlying data.

## Generated files

- `README.md`: visual overview, accessible metric tables, and the full repository list
- `assets/github-overview.svg`: core metrics, activity mix, star sources, and organization breakdown
- `assets/repository-bars/*.svg`: one linear Star progress bar per ranked repository
- `github_overview.json`: complete machine-readable data

The workflow refreshes all four outputs together, so the SVGs and text always
use the same snapshot.

## Information shown

The overview contains:

- followers, stars, forks, and tracked repository count
- commits, pull requests, issues, and repositories contributed to
- stars from owned, member/collaborator, and organization repositories
- individual organization star totals

The repository section displays every eligible repository directly in one
compact sequence of GitHub-compatible HTML blocks with:

- full repository name, URL, and complete description grouped as one item
- stars and relative progress combined in one right-aligned SVG

Each progress bar uses a linear scale relative to the most-starred repository.
Exact Star counts and percentages are rendered inside the same compact SVG,
which keeps every repository item consistent. The SVGs contain their own
light/dark CSS; the surrounding README uses only HTML attributes supported by
GitHub's sanitizer.

Scope and per-repository Fork counts remain available in
`github_overview.json`, but are intentionally omitted from the README.

## Repository scope

The script combines owned repositories, member/collaborator repositories,
GitHub organizations, and optional organizations listed in `GH_EXTRA_ORGS`.
Forks are excluded and repositories are deduplicated by `owner/name`.

Repositories need at least 50 stars to appear in the repository section.
All tracked repositories still contribute to aggregate totals.

## Visual conventions

- the palette uses Apple-style system blue in three restrained tonal steps
- stronger blue represents owned repositories / commits
- mid blue represents member repositories / pull requests
- light blue represents organization repositories / issues
- repository bar lengths use a linear scale; exact values are printed
- SVG typography uses the platform system font
- colors and contrast adapt to GitHub light and dark themes

## Run locally

```bash
export GH_TOKEN=your_github_token
export GH_USERNAME=nexmoe
export GH_EXTRA_ORGS=theme-nexmoe
bun run build_readme.ts
```

`.github/workflows/build.yml` runs on pushes, manual dispatches, and every six
hours. The repository must provide a `GH_TOKEN` Actions secret.
