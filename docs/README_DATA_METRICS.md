# README Data Guide

The Hero, repository links, Stars, and descriptions are
native HTML text. They follow GitHub’s typography and natural line wrapping,
so they can be selected, copied, and resized without image scaling.

The Hero uses `<h1>` and paragraphs, with no separate mobile assets.
Second-level section headings keep the custom blue 24px text with a centered
horizontal rule. These small SVGs have percentage width, fixed 48px height,
and no `viewBox`: only the rule stretches as the container changes width;
the title text stays the same size.
The Overview keeps its original metrics, typography, and colors. Its chart
omits the timestamp and Top Organizations section, with the canvas shortened
to remove their unused space. Organization details and refresh time remain
available in the JSON snapshot; README shows no data-source appendix or
refresh-status footer.

## Choose repositories

Edit `repositories.json` to choose projects, descriptions, and their order.
Each entry contains `name`, `repository` (`owner/name`), and `description`.
An optional `images` array adds a thumbnail gallery below the description;
each image has `src`, `alt`, and an optional full-size `href`.
Use `description_zh` and image `alt_zh` for Simplified Chinese translations.
Missing translations fall back to the English text; both languages always
share the same repository selection, order, counts, dates, and screenshots.
The initial six projects follow the pinned repositories on the GitHub profile.

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

The list is always read from this file. GitHub API responses, stars, activity,
and future pin changes never add, remove, reorder, or rewrite these projects.

Regenerate the README and its images from the saved statistics, without
accessing GitHub:

```bash
bun run build_readme.ts --render
```

Both the offline render and scheduled refresh update `README.md` (English)
and `README.zh-CN.md` (Simplified Chinese), plus their localized Overview and
section-heading SVGs. Each README has a direct link to the other language.
The Hero, navigation, and Products section are edited manually in each file
and preserved by the generator. Products links directly to BoTab and Viora
and does not depend on GitHub repository metadata. No language detection or
stored preference is needed.

The repository blocks between the `repositories` comment markers are generated.
Edit their source in `repositories.json`, then run the command above.

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
and is sorted by stars. This data does not select or reorder curated projects.

## Refresh statistics

```bash
export GH_TOKEN=your_github_token
export GH_USERNAME=nexmoe
export GH_EXTRA_ORGS=theme-nexmoe
bun run build_readme.ts
```

`.github/workflows/build.yml` runs this refresh on pushes, manual dispatches,
and every six hours. The repository must provide a `GH_TOKEN` Actions secret.
The README statistics and SVGs use the same snapshot. Repository selection
and descriptions still come exclusively from `repositories.json`.

Run the regression checks with `bun test`.
