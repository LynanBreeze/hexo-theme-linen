# hexo-theme-linen

A clean, editorial Hexo theme focused on readability, photography, and minimal configuration.

![](https://github.com/LynanBreeze/hexo-theme-linen-doc/blob/main/source/img/preview-screenshot.jpg?raw=true)

## Features

- **Warm Linen Design & Dark Mode** — Light and warm dark color schemes powered by runtime `--linen-*` CSS variables (`colorScheme: auto | light | dark`)
- **Configurable Post Layouts** — Switch between `editorial` and `journal` typography styles globally, per series, or per post, plus optional full-bleed `editorialBreakout` for photos, grids, and wide embeds
- **Photography & Lightbox** — PhotoSwipe 5 lightbox with mobile frosted-glass captions, two-tier EXIF display, HDR toggle, Live Photos, lazy loading, and flexible `:::image-grid` containers (`scroll`, `switcher`, multi-column & ratio grids)
- **Rich Content Support** — KaTeX math rendering, footnotes, link cards, warm syntax highlighting, self-hosted Fluent Emoji SVGs, and interactive TOC
- **Taxonomies & Map Series** — Unified archives, tags, categories, and series pages, including optional MapLibre GL (with Leaflet fallback) map views for travel series
- **Responsive & Lightweight** — Mobile-first refinements, Gitalk comments, RSS/Atom feeds, and i18n (`en` / `zh-CN`)

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

post:
  # Default typography style: editorial | journal
  layoutStyle: editorial
  # Per-series layoutStyle overrides
  seriesLayoutStyle:
    Travel: journal
  # Constrain prose width while letting photos, grids, and tables break out full width
  editorialBreakout: false
  proseWidth: 720px
```

You can also override `layoutStyle` and `editorialBreakout` / `proseWidth` in an individual post's front-matter.

Then start Hexo:

```bash
hexo clean && hexo serve
```

## Documentation

Full documentation and examples:

[EN](https://lynanbreeze.github.io/hexo-theme-linen-doc/) | [中文](https://lynanbreeze.github.io/hexo-theme-linen-doc-zh-CN/)

## License

MIT
