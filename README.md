# hexo-theme-linen

A clean, editorial Hexo theme focused on readability, photography, and minimal configuration.

![](https://github.com/LynanBreeze/hexo-theme-linen-doc/blob/main/source/img/preview-screenshot.jpg?raw=true)

## Features

- **Warm Linen Design & Dark Mode** — Light and warm dark color schemes powered by runtime `--linen-*` CSS variables (`colorScheme: auto | light | dark`) with a zero-FOUC header theme toggle (`themeToggle: true`) and light-normalized `@media print` output
- **Configurable Post Layouts** — Switch between `editorial` and `journal` typography styles globally, per series, or per post, plus optional full-bleed `editorialBreakout` for photos, grids, and wide embeds
- **Photography & Lightbox** — PhotoSwipe 5 lightbox with mobile frosted-glass captions, two-tier EXIF display, HDR toggle, Live Photos, lazy loading, and flexible `:::image-grid` containers (`scroll`, `switcher`, multi-column & ratio grids)
- **Rich Content Support** — KaTeX math rendering, footnotes, link cards, warm syntax highlighting, on-demand self-hosted Fluent Emoji SVGs, and interactive TOC
- **Taxonomies, Map Series & 404** — Unified archives, tags, categories, standalone pages, 404 layout, and series pages with MapLibre GL (with Leaflet fallback and live dark-mode styling) for travel series
- **Opt-in Local Search & Linen RSS/Atom** — Optional zero-dependency client-side search (`⌘K` / `Ctrl+K`), built-in RSS generator with Linen-styled XSL stylesheets, Gitalk comments, and i18n (`en` / `zh-CN`)

## Installation

```bash
pnpm add hexo-theme-linen
# or
npm install hexo-theme-linen
```

## Usage

Edit your Hexo `_config.yml`:

```yaml
theme: linen
```

Create `_config.linen.yml` in your Hexo root to customize options (all settings are optional):

```yaml
# Color scheme: auto (follows prefers-color-scheme) | light | dark
colorScheme: auto
# Show light/dark theme toggle button in the header
themeToggle: true

# Opt-in client-side local search (generates linen-theme/search-index.json)
search:
  enable: false
  path: linen-theme/search-index.json
  content: true

post:
  # Default typography style: editorial | journal
  layoutStyle: editorial
  # Per-series layoutStyle overrides
  seriesLayoutStyle:
    Travel: journal
  # Constrain prose width while letting photos, grids, and tables break out full width
  editorialBreakout: false
  proseWidth: 720px

# Optional custom footer logo (set to false to hide)
# footer:
#   logo: /img/custom-logo.svg
```

You can also override `layoutStyle` and `editorialBreakout` / `proseWidth` in an individual post's front-matter, or create `source/404.md` with `layout: 404` and `permalink: /404.html` to enable the built-in 404 page.

Then start Hexo:

```bash
hexo clean && hexo serve
```

## Development & Tests

```bash
npm test
```

## Documentation

Full documentation and examples:

[EN](https://lynanbreeze.github.io/hexo-theme-linen-doc/) | [中文](https://lynanbreeze.github.io/hexo-theme-linen-doc-zh-CN/)

## License

MIT
