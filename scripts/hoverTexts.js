"use strict";

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtmlAttr(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function process(data) {
  if (!Array.isArray(data?.customComments) || typeof data?.content !== "string") {
    return data?.content;
  }

  let res = data.content;
  data.customComments.forEach((item) => {
    if (!item || typeof item.text !== "string" || !item.text) {
      return;
    }
    const targetIndex = Number.isInteger(item.index) ? item.index : 0;
    const safeComment = escapeHtmlAttr(item.comment);
    let count = 0;
    const regex = new RegExp(escapeRegExp(item.text), "g");
    res = res.replace(regex, (str) => {
      if (count === targetIndex) {
        count++;
        return `<span class="commented-text" data-comment="${safeComment}">${str}</span>`;
      }
      count++;
      return str;
    });
  });
  return res;
}

hexo.extend.filter.register(
  "before_post_render",
  function (data) {
    data.content = process.call(this, data);
    return data;
  },
  2,
);
