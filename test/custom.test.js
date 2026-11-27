"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { createMockHexo, loadHexoScript } = require("./helpers/mock-hexo");

describe("scripts/custom.js & scripts/folded-code-block.js", () => {
  it("converts travel route list even when preceded by h2#to-page-top and is idempotent", () => {
    const hexo = createMockHexo();
    loadHexoScript("scripts/custom.js", hexo);

    const viewCtx = {
      theme: hexo.theme.config,
      config: hexo.config,
      page: { series: "旅行", language: "zh-CN" },
    };

    const html = `<h2 id="to-page-top" class="hidden">回到顶部</h2>
<p>前言</p>
<h2 id="路线"><a href="#路线" class="headerlink" title="路线"></a>路线</h2>
<ul>
<li>大阪 2 日（心斋桥）</li>
<li>京都 5 日</li>
<li>滋贺 1 日</li>
<li>宇治 0.5 日</li>
<li>奈良 1 日</li>
<li>神户 1 日</li>
<li>和歌山 1 日</li>
<li>临空城 0.5 日</li>
</ul>`;

    const rendered = hexo._helpers.renderTravelRoutes.call(
      viewCtx,
      html,
      viewCtx.page,
    );

    assert.ok(
      rendered.includes('<div class="travel-route-block has-bar" style="--route-cols:4;">'),
    );
    assert.ok(rendered.includes("8 站 · 共 12 日"));
    assert.ok(rendered.includes("心斋桥"));
    assert.equal(
      hexo._helpers.renderTravelRoutes.call(viewCtx, rendered, viewCtx.page),
      rendered,
      "Must be idempotent",
    );
  });

  it("skips nested lists without corrupting HTML", () => {
    const hexo = createMockHexo();
    loadHexoScript("scripts/custom.js", hexo);

    const viewCtx = {
      theme: hexo.theme.config,
      config: hexo.config,
      page: { series: "旅行", language: "zh-CN" },
    };
    const html = `<h2 id="路线">路线</h2><ul><li>大阪 2 日<ul><li>难波</li></ul></li><li>京都 3 日</li></ul>`;
    assert.equal(
      hexo._helpers.renderTravelRoutes.call(viewCtx, html, viewCtx.page),
      html,
    );
  });

  it("adds copy-btn and folded toggle only to figure.highlight blocks", () => {
    const hexo = createMockHexo();
    loadHexoScript("scripts/custom.js", hexo);
    loadHexoScript("scripts/folded-code-block.js", hexo);

    const data = {
      content: `<figure class="photo"><figcaption>folded photo</figcaption><img src="a.jpg"></figure>
<figure class="highlight js"><figcaption>app.js folded</figcaption><table><tr><td class="code">1</td></tr></table></figure>`,
    };

    for (const fn of hexo._filters.after_post_render) {
      fn.call(hexo, data);
    }

    assert.ok(!data.content.includes('class="photo folded"'));
    assert.ok(data.content.includes('class="highlight js folded"'));
    assert.ok(data.content.includes('<button type="button" class="fold-toggle"'));
    assert.ok(data.content.includes('<button type="button" class="copy-btn"'));
    assert.equal((data.content.match(/class="copy-btn"/g) || []).length, 1);
  });

  it("wraps standalone tables in .table-wrap while leaving highlight tables alone", () => {
    const hexo = createMockHexo();
    loadHexoScript("scripts/custom.js", hexo);

    const data = {
      content: `<figure class="highlight js"><table><tr><td>code</td></tr></table></figure><table><tr><td>cell</td></tr></table>`,
    };
    for (const fn of hexo._filters.after_post_render) {
      fn.call(hexo, data);
    }
    assert.equal((data.content.match(/class="table-wrap"/g) || []).length, 1);
  });

  it("injects gitalk-initiator only when comments are enabled and respects explicit zh language on Travel series", () => {
    const hexoNoComment = createMockHexo({ config: { language: "zh-CN" } });
    loadHexoScript("scripts/custom.js", hexoNoComment);
    const postNoComment = {
      series: "Travel",
      language: "zh-CN",
      content: `<h2>路线</h2><ul><li>大阪 2 日</li><li>京都 3 日</li></ul>`,
    };
    for (const fn of hexoNoComment._filters.after_post_render) {
      fn.call(hexoNoComment, postNoComment);
    }
    assert.ok(!postNoComment.content.includes("gitalk-initiator"));
    assert.ok(postNoComment.content.includes("2 站 · 共 5 日"));

    const hexoWithComment = createMockHexo({
      themeConfig: { comment: { client_id: "cid" } },
    });
    loadHexoScript("scripts/custom.js", hexoWithComment);
    const postWithComment = { content: "<p>Hello</p>" };
    const postCommentDisabled = { comment: false, content: "<p>Hello</p>" };
    for (const fn of hexoWithComment._filters.after_post_render) {
      fn.call(hexoWithComment, postWithComment);
      fn.call(hexoWithComment, postCommentDisabled);
    }
    assert.ok(postWithComment.content.includes('<div id="gitalk-initiator"></div>'));
    assert.ok(!postCommentDisabled.content.includes("gitalk-initiator"));

    // Opt-in mode: comment.enable === false allows per-post comment: true
    const hexoOptIn = createMockHexo({
      themeConfig: { comment: { enable: false, provider: "giscus", repo_id: "R1" } },
    });
    loadHexoScript("scripts/custom.js", hexoOptIn);
    const defaultOffPost = { content: "<p>Off</p>" };
    const optInPost = { comment: true, content: "<p>On</p>" };
    for (const fn of hexoOptIn._filters.after_post_render) {
      fn.call(hexoOptIn, defaultOffPost);
      fn.call(hexoOptIn, optInPost);
    }
    assert.ok(!defaultOffPost.content.includes("gitalk-initiator"));
    assert.ok(optInPost.content.includes('<div id="gitalk-initiator"></div>'));
  });
});
