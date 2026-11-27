"use strict";

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[ch]);
}

function matchFenceOpen(line) {
  const match = line.match(/^(?:[ \t]*>[ \t]?)*[ \t]*([`~]{3,})(.*)$/);
  if (!match) return null;
  const fence = match[1];
  const fenceChar = fence[0];
  const info = match[2];
  if (fenceChar === "`" && info.includes("`")) {
    return null;
  }
  return { fenceChar, fenceLen: fence.length };
}

function isFenceClose(line, fence) {
  const closeRegex = new RegExp(
    `^(?:[ \\t]*>[ \\t]?)*[ \\t]*\\${fence.fenceChar}{${fence.fenceLen},}[ \\t]*$`,
  );
  return closeRegex.test(line);
}

function replaceRefsOutsideInlineCode(line, replacer) {
  const refRegex = /\[\^(.+?)\]/g;
  if (!line.includes("`")) {
    return line.replace(refRegex, replacer);
  }

  let out = "";
  let i = 0;
  let segmentStart = 0;
  const len = line.length;

  while (i < len) {
    if (line[i] === "`") {
      let tickLen = 0;
      while (i + tickLen < len && line[i + tickLen] === "`") {
        tickLen++;
      }

      let j = i + tickLen;
      let closeEnd = -1;
      while (j < len) {
        if (line[j] === "`") {
          let run = 0;
          while (j + run < len && line[j + run] === "`") {
            run++;
          }
          if (run === tickLen) {
            closeEnd = j + run;
            break;
          }
          j += run;
        } else {
          j++;
        }
      }

      if (closeEnd !== -1) {
        if (i > segmentStart) {
          out += line.slice(segmentStart, i).replace(refRegex, replacer);
        }
        out += line.slice(i, closeEnd);
        i = closeEnd;
        segmentStart = i;
        continue;
      }

      i += tickLen;
      continue;
    }
    i++;
  }

  if (segmentStart < len) {
    out += line.slice(segmentStart).replace(refRegex, replacer);
  }
  return out;
}

hexo.extend.filter.register("before_post_render", function (data) {
  if (!data || typeof data.content !== "string" || !data.content.includes("[^")) {
    return data;
  }

  const lines = data.content.split("\n");
  const footnotes = {};
  const defStartRegex = /^\[\^(.+?)\]:\s*(.*)$/;
  const keptLines = [];

  let i = 0;
  let activeFence = null;

  while (i < lines.length) {
    const line = lines[i];
    const cleanLine = line.replace(/\r$/, "");

    if (activeFence) {
      keptLines.push(line);
      if (isFenceClose(cleanLine, activeFence)) {
        activeFence = null;
      }
      i++;
      continue;
    }

    const fenceOpen = matchFenceOpen(cleanLine);
    if (fenceOpen) {
      activeFence = fenceOpen;
      keptLines.push(line);
      i++;
      continue;
    }

    const defMatch = cleanLine.match(defStartRegex);
    if (defMatch) {
      const id = defMatch[1];
      const firstLine = defMatch[2] || "";
      const blocks = [];

      if (firstLine.trim()) {
        blocks.push(firstLine);
      }

      i++;
      let pendingBlankLines = [];

      while (i < lines.length) {
        const next = lines[i];
        const cleanNext = next.replace(/\r$/, "");

        if (defStartRegex.test(cleanNext)) break;

        if (/^(?: {4}|\t)/.test(cleanNext)) {
          if (pendingBlankLines.length) {
            blocks.push(...pendingBlankLines);
            pendingBlankLines = [];
          }
          blocks.push(cleanNext.replace(/^(?: {4}|\t)/, ""));
          i++;
          continue;
        }

        if (cleanNext.trim() === "") {
          pendingBlankLines.push("");
          i++;
          continue;
        }

        break;
      }

      if (pendingBlankLines.length && i < lines.length && keptLines.length > 0) {
        keptLines.push("");
      }

      footnotes[id] = blocks.join("\n");
      continue;
    }

    keptLines.push(line);
    i++;
  }

  const keys = Object.keys(footnotes);
  if (keys.length === 0) {
    return data;
  }

  const refCount = {};
  const replaceRef = (m, id) => {
    if (!Object.prototype.hasOwnProperty.call(footnotes, id)) return m;

    refCount[id] = (refCount[id] || 0) + 1;
    const n = refCount[id];
    const safeId = escapeHtml(id);

    return `<sup class="footnote-anchor-wrap" id="fnref-${safeId}-${n}"><a class="footnote-href" href="#fn-${safeId}">${safeId}</a></sup>`;
  };

  activeFence = null;
  const processedLines = keptLines.map((line) => {
    const cleanLine = line.replace(/\r$/, "");
    if (activeFence) {
      if (isFenceClose(cleanLine, activeFence)) {
        activeFence = null;
      }
      return line;
    }
    const fenceOpen = matchFenceOpen(cleanLine);
    if (fenceOpen) {
      activeFence = fenceOpen;
      return line;
    }
    if (!line.includes("[^")) {
      return line;
    }
    return replaceRefsOutsideInlineCode(line, replaceRef);
  });

  data.content = processedLines.join("\n");

  const lang = String(
    data.language || data.lang || hexo?.config?.language || "",
  );
  const backrefLabel = /^zh/i.test(lang)
    ? "返回脚注引用"
    : "Back to reference";

  const list = keys
    .map((id) => {
      const safeId = escapeHtml(id);
      const html = footnotes[id]
        .split("\n")
        .map((p) => (p.trim() ? p : ""))
        .join("\n");

      const totalRefs = refCount[id] || 0;
      const backrefs = Array.from({ length: totalRefs }, (_, idx) => {
        const n = idx + 1;
        const indexBadge =
          totalRefs > 1
            ? `<span class="footnote-backref-index" aria-hidden="true">${n}</span>`
            : "";
        return `<a href="#fnref-${safeId}-${n}" class="footnote-backref" aria-label="${backrefLabel}" title="${backrefLabel}"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 12.5h4.25a3.25 3.25 0 0 0 3.25-3.25V3.5" /><path d="M7.75 6.25 10.5 3.5l2.75 2.75" /></svg>${indexBadge}</a>`;
      }).join("");

      return `<li id="fn-${safeId}">${html}${backrefs}</li>`;
    })
    .join("\n");

  data.content += `
<hr class="footnotes-sep">
<section class="footnotes">
  <ol>
    ${list}
  </ol>
</section>
`;

  return data;
});
