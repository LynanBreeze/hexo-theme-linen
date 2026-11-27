"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { ROOT_DIR, createMockHexo, loadHexoScript } = require("./helpers/mock-hexo");

describe("scripts/footnote.js", () => {
  it("localizes backref aria-label for zh and en posts", () => {
    const hexoZh = createMockHexo({ config: { language: "zh-CN" } });
    loadHexoScript("scripts/footnote.js", hexoZh);

    const zhPost = { content: "正文[^1]再次引用[^1]\n\n[^1]: 脚注说明" };
    hexoZh._filters.before_post_render[0](zhPost);
    assert.ok(zhPost.content.includes('id="fnref-1-1"'));
    assert.ok(zhPost.content.includes('id="fnref-1-2"'));
    assert.ok(zhPost.content.includes('aria-label="返回脚注引用"'));
    assert.ok(zhPost.content.includes('class="footnote-backref-index" aria-hidden="true">1<'));
    assert.ok(zhPost.content.includes('class="footnote-backref-index" aria-hidden="true">2<'));

    const enPost = {
      language: "en",
      content: "Body[^1]\n\n[^1]: Footnote text",
    };
    hexoZh._filters.before_post_render[0](enPost);
    assert.ok(enPost.content.includes('aria-label="Back to reference"'));
    assert.ok(!enPost.content.includes("footnote-backref-index"));
  });

  it("preserves prose after mid-document footnote definitions, skips code blocks/inline code, and escapes ids", () => {
    const hexo = createMockHexo({ config: { language: "en" } });
    loadHexoScript("scripts/footnote.js", hexo);

    const post = {
      content: [
        "Intro with ref[^1] and inline `code [^1] sample`.",
        "",
        "[^1]: Mid-document note",
        "    continued line",
        "",
        "Following paragraph must NOT be swallowed.",
        "",
        "```markdown",
        "Code block example[^1]",
        "",
        "[^fake]: Not a real footnote",
        "```",
        "",
        'Special id[^a"b]',
        "",
        '[^a"b]: Escaped note',
      ].join("\n"),
    };

    hexo._filters.before_post_render[0](post);
    assert.ok(post.content.includes("Following paragraph must NOT be swallowed."));
    assert.ok(post.content.includes("`code [^1] sample`"));
    assert.ok(post.content.includes("Code block example[^1]"));
    assert.ok(post.content.includes("[^fake]: Not a real footnote"));
    assert.ok(!post.content.includes('id="fn-fake"'));
    assert.ok(post.content.includes('id="fn-a&quot;b"'));
    assert.ok(post.content.includes('href="#fn-a&quot;b"'));
    assert.ok(post.content.includes("Mid-document note\ncontinued line"));
  });

  it("shows footnote popover on hover without blocking native anchor click navigation", () => {
    const linenJs = fs.readFileSync(
      path.join(ROOT_DIR, "source/linen-theme/js/linen.js"),
      "utf8",
    );
    const postJs = fs.readFileSync(
      path.join(ROOT_DIR, "source/linen-theme/js/post.js"),
      "utf8",
    );

    function createClassList(initial = []) {
      const set = new Set(initial);
      return {
        add: (...cls) => cls.forEach((c) => set.add(c)),
        remove: (...cls) => cls.forEach((c) => set.delete(c)),
        contains: (c) => set.has(c),
        toggle: (c, force) => {
          const next = force !== undefined ? Boolean(force) : !set.has(c);
          if (next) set.add(c);
          else set.delete(c);
          return next;
        },
      };
    }

    function createNode({
      tagName = "DIV",
      nodeType = 1,
      textContent = "",
      attrs = {},
      children = [],
      classes = [],
      rect = { top: 240, bottom: 256, left: 200, right: 212, width: 12, height: 16 },
    } = {}) {
      const listeners = {};
      const attrMap = { ...attrs };
      const styleProps = {};
      const node = {
        tagName,
        nodeType,
        parentNode: null,
        childNodes: [],
        classList: createClassList(classes),
        style: {
          setProperty: (k, v) => {
            styleProps[k] = v;
          },
          getPropertyValue: (k) => styleProps[k] || "",
        },
        offsetWidth: 220,
        offsetHeight: 60,
        get id() {
          return attrMap.id || "";
        },
        set id(v) {
          attrMap.id = v;
        },
        get firstChild() {
          return this.childNodes[0] || null;
        },
        get lastChild() {
          return this.childNodes[this.childNodes.length - 1] || null;
        },
        get textContent() {
          if (!this.childNodes.length) return textContent;
          return this.childNodes.map((c) => c.textContent).join("");
        },
        set textContent(val) {
          textContent = String(val ?? "");
          this.childNodes = [];
        },
        set innerHTML(val) {
          if (val === "") {
            this.childNodes = [];
            textContent = "";
          } else if (val.includes("footnote-popover-index")) {
            const indexEl = createNode({ tagName: "SPAN", classes: ["footnote-popover-index"] });
            const bodyEl = createNode({ tagName: "DIV", classes: ["footnote-popover-body"] });
            const inner = createNode({
              tagName: "DIV",
              classes: ["footnote-popover-inner"],
              children: [indexEl, bodyEl],
            });
            const arrow = createNode({ tagName: "SPAN", classes: ["footnote-popover-arrow"] });
            this.childNodes = [];
            this.appendChild(inner);
            this.appendChild(arrow);
          }
        },
        appendChild(child) {
          if (child.nodeType === 11) {
            while (child.childNodes.length) {
              this.appendChild(child.childNodes.shift());
            }
            return child;
          }
          if (child.parentNode) {
            child.parentNode.removeChild(child);
          }
          child.parentNode = this;
          this.childNodes.push(child);
          return child;
        },
        removeChild(child) {
          const idx = this.childNodes.indexOf(child);
          if (idx > -1) {
            this.childNodes.splice(idx, 1);
            child.parentNode = null;
          }
          return child;
        },
        getAttribute: (name) => (name in attrMap ? attrMap[name] : null),
        hasAttribute: (name) => name in attrMap,
        setAttribute: (name, val) => {
          attrMap[name] = String(val);
        },
        removeAttribute: (name) => {
          delete attrMap[name];
        },
        getBoundingClientRect: () => rect,
        addEventListener: (type, fn) => {
          (listeners[type] ||= []).push(fn);
        },
        dispatchEvent: (type, event = {}) => {
          (listeners[type] || []).forEach((fn) => fn(event));
        },
        contains(other) {
          if (other === this) return true;
          return this.childNodes.some((c) => c.contains && c.contains(other));
        },
        querySelector(sel) {
          return this.querySelectorAll(sel)[0] || null;
        },
        querySelectorAll(sel) {
          const results = [];
          const matchNode = (el) => {
            if (el.nodeType !== 1) return false;
            if (sel === ".footnote-backref") return el.classList.contains("footnote-backref");
            if (sel === "[id]") return Boolean(el.getAttribute("id"));
            if (sel === ".footnote-popover-index") return el.classList.contains("footnote-popover-index");
            if (sel === ".footnote-popover-body") return el.classList.contains("footnote-popover-body");
            return false;
          };
          const walk = (el) => {
            for (const child of el.childNodes) {
              if (matchNode(child)) results.push(child);
              walk(child);
            }
          };
          walk(this);
          return results;
        },
        cloneNode() {
          const cloned = createNode({
            tagName: this.tagName,
            nodeType: this.nodeType,
            textContent,
            attrs: { ...attrMap },
            classes: Array.from(classes),
            rect,
          });
          if (this.nodeType === 3) {
            cloned.nodeValue = this.nodeValue;
          }
          for (const child of this.childNodes) {
            cloned.appendChild(child.cloneNode(true));
          }
          return cloned;
        },
      };
      if (nodeType === 3) {
        node.nodeValue = textContent;
      }
      for (const child of children) {
        node.appendChild(child);
      }
      return node;
    }

    const footnoteText = createNode({ nodeType: 3, textContent: "这是脚注说明内容" });
    const innerSpan = createNode({
      tagName: "SPAN",
      attrs: { id: "nested-id" },
      textContent: "（附注）",
    });
    const backref = createNode({
      tagName: "A",
      classes: ["footnote-backref"],
      textContent: "↩",
    });
    const footnoteLi = createNode({
      tagName: "LI",
      attrs: { id: "fn-1" },
      children: [footnoteText, innerSpan, backref],
    });
    const anchor = createNode({
      tagName: "A",
      classes: ["footnote-href"],
      attrs: { href: "#fn-1" },
      textContent: "1",
    });
    const anchorWrap = createNode({
      tagName: "SUP",
      classes: ["footnote-anchor-wrap"],
      attrs: { id: "fnref-1-1" },
      children: [anchor],
    });
    const paragraph = createNode({
      tagName: "P",
      children: [anchorWrap],
    });
    const commentedSpan = createNode({
      tagName: "SPAN",
      classes: ["commented-text"],
      attrs: { "data-comment": "这是行内批注说明" },
      textContent: "批注词",
    });
    anchorWrap.closest = (sel) => (sel.includes("p") ? paragraph : null);
    backref.setAttribute("href", "#fnref-1-1");
    backref.closest = (sel) => (sel.includes("footnote-backref") ? backref : null);

    const body = createNode({ tagName: "BODY" });
    const head = createNode({ tagName: "HEAD" });
    const docListeners = {};
    const byId = { "fn-1": footnoteLi, "fnref-1-1": anchorWrap };

    const mockDocument = {
      readyState: "complete",
      body,
      head,
      documentElement: {
        clientWidth: 1280,
        clientHeight: 800,
        classList: createClassList(),
        getAttribute: () => null,
        setAttribute: () => {},
      },
      getElementById: (id) => {
        if (byId[id]) return byId[id];
        return (
          body.childNodes.find((n) => n.id === id) ||
          head.childNodes.find((n) => n.id === id) ||
          null
        );
      },
      querySelector: () => null,
      querySelectorAll: (sel) => {
        if (sel.includes("footnote-href")) return [anchor];
        if (sel.includes("commented-text")) return [commentedSpan];
        return [];
      },
      createElement: (tag) => createNode({ tagName: tag.toUpperCase() }),
      createDocumentFragment: () => createNode({ nodeType: 11, tagName: "#FRAGMENT" }),
      addEventListener: (type, fn) => {
        (docListeners[type] ||= []).push(fn);
      },
    };

    const mockWindow = {
      innerWidth: 1280,
      innerHeight: 800,
      scrollY: 0,
      navigator: { userAgent: "Mozilla/5.0" },
      location: { href: "https://example.com/post/", hash: "" },
      addEventListener: () => {},
      getComputedStyle: () => ({ position: "static" }),
      requestAnimationFrame: (cb) => {
        cb();
        return 1;
      },
      matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    };

    const sandbox = {
      window: mockWindow,
      document: mockDocument,
      location: mockWindow.location,
      history: { replaceState: () => {} },
      console,
      Date,
      setTimeout,
      clearTimeout,
      URL,
    };

    vm.runInNewContext(linenJs, sandbox, { filename: "linen.js" });
    vm.runInNewContext(postJs, sandbox, { filename: "post.js" });

    const popover = mockDocument.getElementById("footnote-popover");
    assert.ok(popover, "Footnote popover element should be created");
    assert.equal(popover.classList.contains("visible"), false);

    // Touch pointerenter should not open hover popover
    anchor.dispatchEvent("pointerenter", { pointerType: "touch" });
    assert.equal(popover.classList.contains("visible"), false);

    // Mouse pointerenter opens popover with cleaned footnote content
    anchor.dispatchEvent("pointerenter", { pointerType: "mouse" });
    assert.equal(popover.classList.contains("visible"), true);
    assert.equal(anchor.getAttribute("aria-describedby"), "footnote-popover");
    assert.equal(popover.querySelector(".footnote-popover-index").textContent, "1");
    const renderedBody = popover.querySelector(".footnote-popover-body");
    assert.equal(renderedBody.textContent, "这是脚注说明内容（附注）");
    assert.equal(renderedBody.querySelectorAll(".footnote-backref").length, 0);
    assert.equal(renderedBody.querySelectorAll("[id]").length, 0);

    // Click does NOT preventDefault and immediately closes popover
    let prevented = false;
    anchor.dispatchEvent("click", {
      preventDefault: () => {
        prevented = true;
      },
    });
    assert.equal(prevented, false, "Click must preserve native anchor navigation");
    assert.equal(popover.classList.contains("visible"), false);

    // Escape closes active footnote popover
    anchor.dispatchEvent("pointerenter", { pointerType: "mouse" });
    assert.equal(popover.classList.contains("visible"), true);
    (docListeners.keydown || []).forEach((fn) => fn({ key: "Escape" }));
    assert.equal(popover.classList.contains("visible"), false);

    // linen.js is wrapped in an IIFE (no leaked globals) and relies on SCSS instead of runtime <style> injection
    assert.equal(mockDocument.getElementById("anchor-highlight-style"), null);
    assert.equal(sandbox.previousScrollY, undefined);
    assert.equal(sandbox.handleClick, undefined);
    assert.equal(typeof mockWindow.setBodyScrollLocked, "function");

    // Clicking an SVG element (where className is an SVGAnimatedString, not a string) must not throw
    const svgTarget = {
      nodeType: 1,
      tagName: "svg",
      id: "",
      className: { baseVal: "icon-sun", animVal: "icon-sun" },
      classList: createClassList(["icon-sun"]),
      closest: () => null,
      parentElement: body,
    };
    assert.doesNotThrow(() => {
      (docListeners.click || []).forEach((fn) => fn({ target: svgTarget }));
    });

    mockWindow.location.hash = "#fnref-1-1";
    assert.equal(anchorWrap.classList.contains("anchor-highlight"), false);
    (docListeners.click || []).forEach((fn) => fn({ target: backref }));
    assert.equal(
      anchorWrap.classList.contains("anchor-highlight"),
      true,
      "Clicking backref with same hash should still trigger anchor highlight",
    );
    assert.equal(
      paragraph.classList.contains("footnote-context-highlight"),
      true,
      "Containing paragraph should also receive subtle context highlight",
    );

    // Inline customComments (.commented-text) shares popover with compact comment styling
    assert.equal(commentedSpan.getAttribute("tabindex"), "0");
    commentedSpan.dispatchEvent("pointerenter", { pointerType: "mouse" });
    assert.equal(popover.classList.contains("visible"), true);
    assert.equal(popover.classList.contains("is-comment"), true);
    assert.equal(popover.querySelector(".footnote-popover-index").style.display, "none");
    assert.equal(popover.querySelector(".footnote-popover-body").textContent, "这是行内批注说明");
    assert.equal(commentedSpan.getAttribute("aria-describedby"), "footnote-popover");

    // Touch tap toggles commented-text popover
    (docListeners.touchstart || []).forEach((fn) => fn({}));
    commentedSpan.dispatchEvent("click", {});
    assert.equal(popover.classList.contains("visible"), false);
    commentedSpan.dispatchEvent("click", {});
    assert.equal(popover.classList.contains("visible"), true);
    assert.equal(popover.classList.contains("is-comment"), true);

    // Clicking or drag-selecting text inside popover keeps it open for copying
    assert.equal(popover.getAttribute("tabindex"), "-1");
    popover.dispatchEvent("pointerenter", { pointerType: "mouse" });
    popover.dispatchEvent("pointerdown", { pointerType: "mouse" });
    // Even if anchor blurs with null relatedTarget while interacting with popover, stay open
    commentedSpan.dispatchEvent("focusout", { relatedTarget: null });
    assert.equal(popover.classList.contains("visible"), true);

    // Dragging past popover edge and releasing outside should not dismiss popover
    let activeSelection = {
      isCollapsed: false,
      anchorNode: popover.querySelector(".footnote-popover-body"),
      focusNode: popover.querySelector(".footnote-popover-body"),
      toString: () => "行内批注",
    };
    mockWindow.getSelection = () => activeSelection;
    popover.dispatchEvent("pointerleave", { pointerType: "mouse" });
    (docListeners.pointerup || []).forEach((fn) => fn({}));
    (docListeners.click || []).forEach((fn) => fn({ target: body }));
    assert.equal(
      popover.classList.contains("visible"),
      true,
      "Drag-selecting past popover edge must not close popover on mouseup click",
    );

    // Clicking outside after selection is cleared closes popover cleanly
    activeSelection = { isCollapsed: true, toString: () => "" };
    // Simulate a later outside click (not from the drag-release pointerup)
    const origDateNow = Date.now;
    Date.now = () => origDateNow() + 500;
    try {
      (docListeners.click || []).forEach((fn) => fn({ target: body }));
    } finally {
      Date.now = origDateNow;
    }
    assert.equal(popover.classList.contains("visible"), false);
  });
});
