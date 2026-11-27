"use strict";

const fs = require("fs");
const path = require("path");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const sass = require("sass");
const ejs = require("ejs");
const { ROOT_DIR } = require("./helpers/mock-hexo");

describe("Stylesheets & Templates Smoke Tests", () => {
  it("compiles linen.scss and linkcard.scss with zero Dart Sass warnings", () => {
    for (const rel of [
      "source/linen-theme/css/linen.scss",
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
          !res.css.includes("#raw-markdown-block.travel-post"),
          "linen.scss must not generate dead #raw-markdown-block.travel-post selectors",
        );
        assert.ok(
          !res.css.includes("#raw-markdown-block.layout-style-journal"),
          "linen.scss must not generate dead #raw-markdown-block.layout-style-journal selectors",
        );
        assert.ok(
          res.css.includes(".footnote-anchor-wrap.anchor-highlight .footnote-href"),
          "linen.scss should contain anchor highlight styles moved out of linen.js",
        );
        assert.ok(
          res.css.includes("U+2103") && !res.css.includes("U+0043"),
          "source-serif unicode-range should use U+2103 instead of redundant U+0043",
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
