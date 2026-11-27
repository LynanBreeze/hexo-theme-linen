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

function matchFencedCodeStart(src, lineStartIndex) {
  const lineEnd = src.indexOf("\n", lineStartIndex);
  const end = lineEnd === -1 ? src.length : lineEnd;
  const line = src.slice(lineStartIndex, end).replace(/\r$/, "");
  const match = line.match(/^(?:[ \t]*>[ \t]?)*[ \t]*([`~]{3,})(.*)$/);
  if (!match) return null;
  const fence = match[1];
  const fenceChar = fence[0];
  if (fenceChar === "`" && match[2].includes("`")) return null;
  return {
    fenceChar,
    fenceLen: fence.length,
    nextLineStart: lineEnd === -1 ? src.length : lineEnd + 1,
  };
}

function findFencedCodeEnd(src, startIndex, fenceChar, fenceLen) {
  let pos = startIndex;
  const len = src.length;
  const closeRegex = new RegExp(
    `^(?:[ \\t]*>[ \\t]?)*[ \\t]*\\${fenceChar}{${fenceLen},}[ \\t]*$`,
  );
  while (pos < len) {
    const lineEnd = src.indexOf("\n", pos);
    const end = lineEnd === -1 ? len : lineEnd;
    const line = src.slice(pos, end).replace(/\r$/, "");
    const nextPos = lineEnd === -1 ? len : lineEnd + 1;
    if (closeRegex.test(line)) {
      return nextPos;
    }
    pos = nextPos;
  }
  return len;
}

function findInlineCodeEnd(src, startIndex) {
  const len = src.length;
  let tickLen = 0;
  while (startIndex + tickLen < len && src[startIndex + tickLen] === "`") {
    tickLen++;
  }
  let j = startIndex + tickLen;
  while (j < len) {
    if (src[j] === "`") {
      let run = 0;
      while (j + run < len && src[j + run] === "`") run++;
      if (run === tickLen) return j + run;
      j += run;
    } else {
      j++;
    }
  }
  return -1;
}

function findBalancedParenEnd(src, openParenIndex) {
  const len = src.length;
  let depth = 0;
  for (let i = openParenIndex; i < len; i++) {
    const ch = src[i];
    if (ch === "\\" && i + 1 < len) {
      i++;
      continue;
    }
    if (ch === "\n") return -1;
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function tokenizeProtectedSegments(src) {
  const segments = [];
  const len = src.length;
  let i = 0;
  let textStart = 0;
  let atLineStart = true;

  const pushText = (end) => {
    if (end > textStart) {
      segments.push({ protected: false, text: src.slice(textStart, end) });
    }
  };

  while (i < len) {
    // 1. Fenced code blocks
    if (atLineStart) {
      const fence = matchFencedCodeStart(src, i);
      if (fence) {
        pushText(i);
        const end = findFencedCodeEnd(
          src,
          fence.nextLineStart,
          fence.fenceChar,
          fence.fenceLen,
        );
        segments.push({ protected: true, text: src.slice(i, end) });
        i = end;
        textStart = i;
        atLineStart = true;
        continue;
      }
    }

    const ch = src[i];

    // 2. Inline code spans
    if (ch === "`") {
      const end = findInlineCodeEnd(src, i);
      if (end !== -1) {
        pushText(i);
        segments.push({ protected: true, text: src.slice(i, end) });
        i = end;
        textStart = i;
        atLineStart = src[i - 1] === "\n";
        continue;
      }
    }

    // 3. Markdown images ![alt](url)
    if (ch === "!" && src[i + 1] === "[") {
      const closeBracket = src.indexOf("]", i + 2);
      if (
        closeBracket !== -1 &&
        !src.slice(i + 2, closeBracket).includes("\n") &&
        src[closeBracket + 1] === "("
      ) {
        const end = findBalancedParenEnd(src, closeBracket + 1);
        if (end !== -1) {
          pushText(i);
          segments.push({ protected: true, text: src.slice(i, end) });
          i = end;
          textStart = i;
          atLineStart = false;
          continue;
        }
      }
    }

    // 4. Markdown link destinations ](url)
    if (ch === "]" && src[i + 1] === "(") {
      const end = findBalancedParenEnd(src, i + 1);
      if (end !== -1) {
        pushText(i);
        segments.push({ protected: true, text: src.slice(i, end) });
        i = end;
        textStart = i;
        atLineStart = false;
        continue;
      }
    }

    // 5. HTML comments and tags (including <pre>/<code>/<script>/<style>)
    if (ch === "<") {
      const rest = src.slice(i);
      const commentMatch = /^<!--[\s\S]*?-->/.exec(rest);
      if (commentMatch) {
        pushText(i);
        const end = i + commentMatch[0].length;
        segments.push({ protected: true, text: src.slice(i, end) });
        i = end;
        textStart = i;
        atLineStart = src[i - 1] === "\n";
        continue;
      }

      const rawTagMatch = /^<(script|style|pre|code)(?=[\s>/])[^>]*>[\s\S]*?<\/\1\s*>/i.exec(rest);
      if (rawTagMatch) {
        pushText(i);
        const end = i + rawTagMatch[0].length;
        segments.push({ protected: true, text: src.slice(i, end) });
        i = end;
        textStart = i;
        atLineStart = src[i - 1] === "\n";
        continue;
      }

      const tagMatch = /^<\/?[a-zA-Z][^>]*>/.exec(rest);
      if (tagMatch) {
        pushText(i);
        const end = i + tagMatch[0].length;
        segments.push({ protected: true, text: src.slice(i, end) });
        i = end;
        textStart = i;
        atLineStart = src[i - 1] === "\n";
        continue;
      }
    }

    atLineStart = ch === "\n";
    i++;
  }

  pushText(len);
  return segments;
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
    const segments = tokenizeProtectedSegments(res);
    res = segments
      .map((seg) => {
        if (seg.protected) return seg.text;
        return seg.text.replace(regex, (str) => {
          if (count === targetIndex) {
            count++;
            return `<span class="commented-text" data-comment="${safeComment}">${str}</span>`;
          }
          count++;
          return str;
        });
      })
      .join("");
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
