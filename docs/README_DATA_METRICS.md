# README Data Guide

The Hero, repository links, Stars, and descriptions are
native HTML text. They follow GitHub’s typography and natural line wrapping,
so they can be selected, copied, and resized without image scaling.

The Hero uses `<h1>` and paragraphs, with no separate mobile assets.
Second-level section headings keep the custom blue 24px text with a centered
horizontal rule. These small SVGs have percentage width, fixed 48px height,
and no `viewBox`: only the rule stretches as the container changes width;
the title text stays the same size.
The Overview uses a two-column grid: total Stars on the left, and followers,
forks, contributed repositories, and commits in a 2 × 2 grid on the right.
Star sources sit below the Stars and contributions below the activity metrics,
with right-aligned counts and percentages. Bars and the Stars figure use the
section headings' blue palette. The chart omits the timestamp and Top
Organizations section. Organization details and refresh time remain
available in the JSON snapshot; README shows no data-source appendix or
refresh-status footer.

## Choose repositories

The project list and order follow the GitHub profile's pinned repositories.
Each refresh queries GraphQL `user(login: GH_USERNAME).pinnedItems` with
`types: REPOSITORY`, retaining the returned order without sorting by stars.
`GH_USERNAME` defaults to `nexmoe`, independently of the token's owner.
Changing your GitHub pins takes effect on the next successful CI refresh.

Edit `repositories.json` to override project names, descriptions, and screenshots.
Each entry contains `name`, `repository` (`owner/name`), and `description`.
An optional `images` array adds a thumbnail gallery below the description;
each image has `src`, `alt`, and an optional full-size `href`.
Use `description_zh` and image `alt_zh` for Simplified Chinese translations.
Missing translations fall back to the English text; both languages always
share the same repository selection, order, counts, dates, and screenshots.
Matching uses `owner/name` without case sensitivity. New pins without an override
use their GitHub name and description in both languages. Repositories with no
description simply omit that line. Unpinned overrides are kept for reuse but
are not displayed.

Each project shows its linked name and Star count on the left, and its GitHub
creation date (`YYYY-MM-DD`, UTC) on the right. The name is a native HTML link
using GitHub’s link appearance. Descriptions remain ordinary paragraphs.

Star counts and creation dates are read from GitHub for the selected repositories
and cached in `github_overview.json` as `curated_repository_stars` and
`curated_repository_created_at`. Failed refreshes retain saved values.
`--render` uses these saved values without network access.
If an organization rejects the configured token for a selected public
repository, metadata refresh retries without authentication before keeping
the cached Star count and creation date.

The last successful pin response, including repository metadata, is cached as
`pinned_repositories` in `github_overview.json`. API, network, or permission
failures keep that selection; before the first successful sync, the original
`repositories.json` list is used as a fallback. A successful empty pin list
clears the generated repository block. Offline `--render` uses the cached pins
and current overrides without accessing GitHub.

Regenerate the README and its images from the saved statistics, without
accessing GitHub:

```bash
bun run build_readme.ts --render
```

Both the offline render and scheduled refresh update `README.md` (English)
and `README.zh-CN.md` (Simplified Chinese), plus their localized Overview and
section-heading SVGs. Each README has a direct link to the other language.
The Hero, navigation, and Products section are edited manually in each file
and preserved by the generator. Products links directly to BoTab and Viora,
with original screenshots stored in `assets/products/` and matching 200px-tall
scrollable galleries. Image links open the full-size originals on the official
product sites. This section does not depend on GitHub repository metadata. No language detection or
stored preference is needed.

The repository blocks between the `repositories` comment markers are generated.
Change pins on GitHub to select projects, or edit `repositories.json` to update
their presentation, then run the appropriate refresh or render command.

## Rendering

Repository entries use ordinary HTML paragraphs, links, and text. Only the
project name is a link; descriptions can be selected and copied. There are
no list bullets, hard-coded text widths, or manually wrapped lines.
The browser reflows content at any container width without separate mobile
repository text images or viewport breakpoints. Multi-image galleries use a
single non-wrapping table cell with 200px-tall native HTML images. GitHub’s
table styles provide horizontal scrolling within the README width, including
on mobile, without custom CSS. Screenshots preserve their aspect ratios and
link to full-size images in the source repository. A single image instead
scales to the container width.
The non-wrapping scroll hint also keeps the gallery cell wide enough for the
current screenshots, so GitHub's `max-width: 100%` image rule does not squeeze
them on narrow screens.

GitHub strips layout CSS from README HTML. To keep the date aligned on the
right without adding a table, it is a small fixed-size SVG using the supported
`align="right"` image attribute. The SVG contains only the date and has an
accessible text label. The name and Stars naturally wrap if space is tight;
the full-width description follows on the next line.

Only the custom section headings, Overview graphic, and small
right-aligned date labels use SVGs. Exact statistics are available in the
JSON snapshot. README contains no Statistics & data sources section or detailed
tables. The Hero's Data notes link opens this separate guide.

## Generated files

- `README.md`, `README.zh-CN.md`: only their `repositories` comment blocks
- `assets/github-overview[.zh-CN].svg`: localized metrics, activity, and star sources
- `assets/overview-heading[.zh-CN].svg`: responsive blue Overview heading and rule
- `assets/repositories-heading[.zh-CN].svg`: responsive blue Repositories heading and rule
- `assets/products-heading[.zh-CN].svg`: matching Products heading and rule
- `assets/repository-dates/*.svg`: small right-aligned date labels
- `assets/metribee/*.webp`: original MetriBee screenshots, copied unchanged from its repository
- `assets/vidbee/*.webp`: original VidBee screenshots, copied unchanged from its repository
- `github_overview.json`: statistics snapshot, updated only by a GitHub refresh

The Hero and repository content use the same HTML at every width.

## Statistics scope

The overview counts followers, stars, forks, tracked repositories, commits,
pull requests, issues, and repositories contributed to. Star sources distinguish
owned repositories, member/collaborator repositories, and organizations.

The script combines owned repositories, member/collaborator repositories,
GitHub organizations, and optional organizations listed in `GH_EXTRA_ORGS`.
Forks are excluded and repositories are deduplicated by `owner/name`.

All tracked repositories contribute to aggregate totals. The repository data
in `github_overview.json` retains the existing threshold of at least 50 stars
and is sorted by stars. This data does not select or reorder pinned projects.

## Refresh statistics

```bash
export GH_TOKEN=your_github_token
export GH_USERNAME=nexmoe
export GH_EXTRA_ORGS=theme-nexmoe
bun run build_readme.ts
```

`.github/workflows/build.yml` runs this refresh on pushes, manual dispatches,
and every six hours. The repository must provide a `GH_TOKEN` Actions secret.
The token must support GitHub GraphQL reads for the public profile and its
pinned repositories. The README statistics and SVGs use the same snapshot.
Repository selection follows GitHub pins; presentation overrides come from
`repositories.json`.

Run the regression checks with `bun test`.
