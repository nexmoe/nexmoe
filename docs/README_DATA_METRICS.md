# README Data Guide

The biography, contact links, repository links, Stars, and descriptions are
native HTML text. They follow GitHub’s typography and natural line wrapping,
so they can be selected, copied, and resized without image scaling.

The Hero follows a resume-style layout without a layout table or borders.
A transparent identity SVG floats left using the supported `align="left"`
image attribute, while native links to the personal website and X align right.
The identity occupies 55% of the width and contains the name, role, and motto,
with equivalent image alternative text. The SVG has no `viewBox`, so its text
keeps its font size instead of scaling with the whole header. Internal media
queries use compact typography on narrow screens. `<br clear="all">` clears
the float before the About me section heading and native biography text.
Contact links use small decorative SVG icons from `assets/contact-icons/`,
with colors for light and dark themes; the labels remain ordinary links.
About me, Overview, Repositories, and Products use blue 24px SVG headings with a
horizontal rule extending to the right of each title. These SVGs have
percentage width, fixed 48px height,
and no `viewBox`: only the rule stretches as the container changes width;
the title text stays the same size.
The Overview uses a two-column grid: total Stars on the left, and followers,
forks, contributed repositories, and commits in a 2 × 2 grid on the right.
Star sources sit below the Stars and contributions below the activity metrics,
with right-aligned counts and percentages. Bars and the Stars figure use the
Overview heading's blue palette. The chart omits the timestamp and Top
Organizations section. Organization details and refresh time remain
available in the JSON snapshot; README shows no data-source appendix or
refresh-status footer.

## Choose repositories

The project list and order follow the GitHub profile's pinned repositories.
Each refresh queries GraphQL `user(login: GH_USERNAME).pinnedItems` with
`types: REPOSITORY`, retaining the returned order without sorting by stars.
`GH_USERNAME` defaults to `nexmoe`, independently of the token's owner.
Changing your GitHub pins takes effect on the next successful CI refresh.

Edit `repositories.json` to override project names, icons, descriptions, and screenshots.
Each entry contains `name`, `repository` (`owner/name`), and `description`.
An optional `icon` specifies an image in `./assets/` or an HTTPS image URL.
It appears beside the project name at 24 × 24 pixels; entries without an icon
keep the text-only heading. Icons are shared between both languages and are
preserved when matching presentation overrides to pins.
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
with local icons in `assets/icons/`, original screenshots stored in
`assets/products/`, and matching 200px-tall
scrollable galleries. Image links open the full-size originals on the official
product sites. This section does not depend on GitHub repository metadata. No language detection or
stored preference is needed.

The repository blocks between the `repositories` comment markers are generated.
Change pins on GitHub to select projects, or edit `repositories.json` to update
their presentation, then run the appropriate refresh or render command.

## Preview locally

[Grip](https://github.com/joeyespo/grip) uses GitHub's Markdown API and styles
for a local approximation. It is not a visual match for GitHub's repository
or profile pages: Grip supplies its own page template and cached styles, so
container widths, responsive behavior, theme settings, and image layout can
differ. Use it for quick content checks, not final layout validation.
With `uv` installed, run this from the repository root:

```bash
uvx grip README.zh-CN.md
```

Open `http://localhost:6419`. Changes to the README refresh automatically.
The language links work locally; alternatively, use `uvx grip README.md`
to start with English. Stop the preview with Ctrl+C. Grip requires network
access to GitHub for rendering.

For GitHub's own rendering, open a README in the
[GitHub file editor](https://docs.github.com/en/repositories/working-with-files/managing-files/editing-files)
and click Preview before committing. New local image assets must also be
available on the preview branch for relative image URLs to work. Validate the
final layout on the intended repository or profile page, using the same
README and assets revision; the editor preview can have a different width.

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

The custom section headings, Overview graphic, and small right-aligned date
labels use generated SVGs; product icons keep their original PNG or SVG format.
Exact statistics are available in the
JSON snapshot. README contains no Statistics & data sources section or detailed
tables. This separate guide contains implementation and data-source details.

## Generated files

- `README.md`, `README.zh-CN.md`: only their `repositories` comment blocks
- `assets/github-overview[.zh-CN].svg`: localized metrics, activity, and star sources
- `assets/about-heading[.zh-CN].svg`: blue About me heading and rule matching the other sections
- `assets/overview-heading[.zh-CN].svg`: responsive blue Overview heading and rule
- `assets/repositories-heading[.zh-CN].svg`: responsive blue Repositories heading and rule
- `assets/products-heading[.zh-CN].svg`: matching Products heading and rule
- `assets/repository-dates/*.svg`: small right-aligned date labels
- `assets/icons/*`: official project and product icons, copied unchanged from their sources
- `assets/contact-icons/*.svg`: decorative icons for the manually maintained Hero links
- `assets/hero-identity[.zh-CN].svg`: manually maintained borderless Hero typography
- `assets/metribee/*.webp`: original MetriBee screenshots, copied unchanged from its repository
- `assets/vidbee/*.webp`: original VidBee screenshots, copied unchanged from its repository
- `github_overview.json`: statistics snapshot, updated only by a GitHub refresh

The Hero and repository content use the same HTML at every width; only the
identity SVG adjusts its internal typography for narrow widths.

### Icon sources

These files are maintained locally, rather than fetched during README generation.
Products use the same 24px icon size and HTML attributes as repositories.
Empty icon `alt` text avoids repeating the adjacent linked product name.

| Icon | Official source |
| --- | --- |
| MetriBee | [`public/favicon.svg`](https://github.com/nexmoe/MetriBee/blob/main/public/favicon.svg) |
| Miko | [`apps/web/public/icon-192.png`](https://github.com/mikoagents/miko/blob/main/apps/web/public/icon-192.png) |
| VidBee | [`apps/desktop/resources/icon.png`](https://github.com/nexmoe/VidBee/blob/main/apps/desktop/resources/icon.png) |
| OpenTrends | [`apps/web/public/logo-mark.svg`](https://github.com/opentrends-io/opentrends/blob/HEAD/apps/web/public/logo-mark.svg) |
| DayBee | [`AppIcon.iconset/icon_128x128.png`](https://github.com/nexmoe/DayBee/blob/HEAD/AppIcon.iconset/icon_128x128.png) |
| VideoLingo | [`docs/logo.svg`](https://github.com/Huanshere/VideoLingo/blob/HEAD/docs/logo.svg) |
| Monitor Pro | [`assets/icon.png`](https://github.com/nexmoe/vscode-monitor-pro/blob/HEAD/assets/icon.png) |
| BoTab | [`logo.png`](https://botab.net/logo.png) |
| Viora | [`viora-app-icon.png`](https://viora.io/viora-app-icon.png) |

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
