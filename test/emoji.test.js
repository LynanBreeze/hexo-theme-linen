"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const emoji = require("../scripts/emoji");
const { createMockHexo } = require("./helpers/mock-hexo");

describe("scripts/emoji.js", () => {
  it("replaces body emojis, skips code/script tags, and respects text presentation selector", () => {
    const available = emoji.loadAvailableEmojis();
    assert.ok(available.size > 100, "Bundled emoji SVGs should be available");

    const html = `<!doctype html><html><head><title>🔥 Title</title></head><body><script>var s = "<code>🔥";</script><p>Hello 🔥 and ✨\uFE0E</p><pre><code>🔥</code></pre></body></html>`;
    const replacedCodes = new Set();
    const out = emoji.replaceEmojisInHtml(
      html,
      available,
      "/linen-theme/img/emoji/",
      (cp) => replacedCodes.add(cp),
    );

    assert.ok(out.includes("<title>🔥 Title</title>"), "Head title untouched");
    assert.ok(out.includes('<script>var s = "<code>🔥";</script>'), "Script with unclosed <code> string does not corrupt skipDepth");
    assert.ok(out.includes('<img class="linen-emoji" src="/linen-theme/img/emoji/1f525.svg"'));
    assert.ok(out.includes("✨\uFE0E"), "Text presentation selector respected");
    assert.ok(out.includes("<pre><code>🔥</code></pre>"), "Code block untouched");
    assert.ok(replacedCodes.has("1f525"));

    // theme.config.emoji.enable: true overrides config.theme_config.emoji.enable: false
    const overrideHexo = createMockHexo({
      config: { title: "Demo", description: "", theme_config: { emoji: { enable: false } } },
      themeConfig: { emoji: { enable: true } },
    });
    emoji(overrideHexo);
    const overrideAssets = overrideHexo._generators["linen-emoji-assets"]({
      posts: { toArray: () => [{ title: "Trip", content: "<p>Nice 🔥</p>" }] },
      pages: { toArray: () => [] },
    });
    assert.equal(overrideAssets.length, 1);
  });

  it("emits only used emoji SVGs via linen-emoji-assets generator", () => {
    const hexo = createMockHexo({ config: { title: "Demo", description: "" } });
    emoji(hexo);

    const assets = hexo._generators["linen-emoji-assets"]({
      posts: { toArray: () => [{ title: "Trip", content: "<p>Nice 🔥</p>" }] },
      pages: { toArray: () => [] },
    });

    assert.equal(assets.length, 1);
    assert.equal(assets[0].path, "linen-theme/img/emoji/1f525.svg");
  });
});
