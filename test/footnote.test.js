"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { createMockHexo, loadHexoScript } = require("./helpers/mock-hexo");

describe("scripts/footnote.js", () => {
  it("localizes backref aria-label for zh and en posts", () => {
    const hexoZh = createMockHexo({ config: { language: "zh-CN" } });
    loadHexoScript("scripts/footnote.js", hexoZh);

    const zhPost = { content: "正文[^1]再次引用[^1]\n\n[^1]: 脚注说明" };
    hexoZh._filters.before_post_render[0](zhPost);
    assert.ok(zhPost.content.includes('id="fnref-1-1"'));
    assert.ok(zhPost.content.includes('id="fnref-1-2"'));
    assert.ok(zhPost.content.includes('aria-label="返回脚注引用"'));

    const enPost = {
      language: "en",
      content: "Body[^1]\n\n[^1]: Footnote text",
    };
    hexoZh._filters.before_post_render[0](enPost);
    assert.ok(enPost.content.includes('aria-label="Back to reference"'));
  });
});
