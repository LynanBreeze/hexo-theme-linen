"use strict";

const fs = require("fs");
const path = require("path");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const sass = require("sass");
const ejs = require("ejs");
const { ROOT_DIR } = require("./helpers/mock-hexo");

describe("Stylesheets & Templates Smoke Tests", () => {
  it("compiles linen.scss, post.scss, series.scss, and linkcard.scss with zero Dart Sass warnings", () => {
    for (const rel of [
      "source/linen-theme/css/linen.scss",
      "source/linen-theme/css/post.scss",
      "source/linen-theme/css/series.scss",
      "source/linen-theme/css/linkcard.scss",
    ]) {
      const warnings = [];
      const res = sass.compile(path.join(ROOT_DIR, rel), {
        style: "compressed",
        logger: {
          warn(msg) {
            warnings.push(msg);
          },
          debug() {},
        },
      });
      assert.ok(res.css.length > 0);
      assert.deepEqual(warnings, [], `Unexpected Sass warnings in ${rel}`);
      if (rel.endsWith("linen.scss")) {
        assert.ok(
          res.css.includes("U+2103") && !res.css.includes("U+0043"),
          "source-serif unicode-range should use U+2103 instead of redundant U+0043",
        );
        assert.ok(
          res.css.includes(".skip-to-content"),
          "linen.scss should include skip-to-content accessibility styles",
        );
        assert.ok(
          !res.css.includes(".gt-comment"),
          "linen.scss must not bundle Gitalk .gt-comment styles",
        );
        assert.ok(
          !res.css.includes("#page-donates{") && !res.css.includes("#giscus-container{"),
          "linen.scss must not bundle post-only widget styles",
        );
        assert.ok(
          res.css.includes('html[lang^=en]') && !res.css.includes('html[lang=en]'),
          "linen.scss should match English language tags with html[lang^=en]",
        );
        assert.ok(
          res.css.includes(".post-item:has(.title:active) .item-body") &&
            (res.css.includes("-webkit-tap-highlight-color:transparent") ||
              res.css.includes("-webkit-tap-highlight-color:rgba(0,0,0,0)")),
          "linen.scss should apply unified whole-item active feedback and suppress disjointed title tap highlight",
        );
      }
      if (rel.endsWith("post.scss")) {
        assert.ok(
          !res.css.includes("#raw-markdown-block.travel-post"),
          "post.scss must not generate dead #raw-markdown-block.travel-post selectors",
        );
        assert.ok(
          !res.css.includes("#raw-markdown-block.layout-style-journal"),
          "post.scss must not generate dead #raw-markdown-block.layout-style-journal selectors",
        );
        assert.ok(
          res.css.includes(".footnote-anchor-wrap.anchor-highlight .footnote-href"),
          "post.scss should contain anchor highlight styles moved out of JS",
        );
        assert.ok(
          res.css.includes("#toc{") &&
            res.css.includes(".post-series{") &&
            res.css.includes("#giscus-container") &&
            res.css.includes("#gitalk-container"),
          "post.scss should include post widgets and comment placeholders",
        );
        assert.ok(
          !res.css.includes(".gt-comment"),
          "post.scss must not bundle Gitalk .gt-comment overrides (loaded on demand with gitalk.css)",
        );
        assert.ok(
          res.css.includes('html[lang^=en]') &&
            res.css.includes('font-size:20px') &&
            res.css.includes('font-size:18px'),
          "post.scss should include optimized English prose typography (20px desktop / 18px mobile) under html[lang^=en]",
        );
      }
      if (rel.endsWith("series.scss")) {
        assert.ok(
          res.css.includes(".travel-map-copy h1"),
          "series.scss should style .travel-map-copy h1",
        );
        assert.ok(
          res.css.includes(".travel-place-card:has(.travel-place-title:active)"),
          "series.scss should apply unified active feedback to travel-place-card",
        );
      }
    }
  });

  it("compiles all EJS templates cleanly", () => {
    const collectEjs = (dir) => {
      let files = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files = files.concat(collectEjs(full));
        } else if (entry.name.endsWith(".ejs")) {
          files.push(full);
        }
      }
      return files;
    };

    const templates = collectEjs(path.join(ROOT_DIR, "layout"));
    assert.ok(templates.length >= 15);
    for (const tpl of templates) {
      ejs.compile(fs.readFileSync(tpl, "utf8"), { filename: tpl });
    }
  });
});
