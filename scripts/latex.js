"use strict";

const fs = require("fs");
const path = require("path");
const katex = require("katex");
const { url_for } = require("hexo-util");

const katexPkg = require("katex/package.json");
const katexDistDir = path.dirname(require.resolve("katex/dist/katex.min.css"));

const DEFAULT_CSS_PATH = "linen-theme/katex/katex.min.css";
const DEFAULT_FONTS_DIR = "linen-theme/katex/fonts";

const renderStore = new WeakMap();
let nonceCounter = 0;

function getThemeLatexConfig(hexo) {
  const raw =
    hexo?.theme?.config?.latex ?? hexo?.config?.theme_config?.latex;
  if (raw === true) {
    return { enable: true, css: "", options: {} };
  }
  if (raw && typeof raw === "object") {
    return {
      enable: raw.enable === true,
      css: typeof raw.css === "string" ? raw.css.trim() : "",
      options:
        raw.options && typeof raw.options === "object" ? raw.options : {},
    };
  }
  return { enable: false, css: "", options: {} };
}

function isLatexEnabled(data, hexo) {
  if (!data) return false;

  if (data.latex === false || data.math === false) {
    return false;
  }

  if (data.latex === true || data.math === true) {
    return true;
  }

  if (data.latex && typeof data.latex === "object") {
    return data.latex.enable !== false;
  }

  if (data.math && typeof data.math === "object") {
    return data.math.enable !== false;
  }

  return getThemeLatexConfig(hexo).enable === true;
}

function getPageLatexOptions(data, hexo) {
  const globalOpts = getThemeLatexConfig(hexo).options || {};
  const pageConfig =
    (data?.latex && typeof data.latex === "object" ? data.latex : null) ||
    (data?.math && typeof data.math === "object" ? data.math : null) ||
    {};
  const pageOpts =
    pageConfig.options && typeof pageConfig.options === "object"
      ? pageConfig.options
      : pageConfig;

  const merged = {
    throwOnError: false,
    strict: "ignore",
    ...globalOpts,
    ...pageOpts,
  };

  delete merged.enable;
  delete merged.css;
  delete merged.options;

  if (globalOpts.macros || pageOpts.macros) {
    merged.macros = {
      ...(globalOpts.macros || {}),
      ...(pageOpts.macros || {}),
    };
  }

  return merged;
}

function stripLegacyFontFormats(css) {
  return css.replace(
    /,url\([^)]+\.(?:woff|ttf)\)\s*format\(["'](?:woff|truetype)["']\)/g,
    "",
  );
}

function hasKatexMarkup(text) {
  return typeof text === "string" && text.includes('class="katex"');
}

function createNonce(source) {
  let nonce = `N${(++nonceCounter).toString(36)}`;
  while (source.includes(`LINENKATEX${nonce}`)) {
    nonce = `N${(++nonceCounter).toString(36)}`;
  }
  return nonce;
}

function extractBlockquotePrefix(linePrefix) {
  if (!linePrefix.includes(">")) return "";
  return linePrefix;
}

function stripBlockquotePrefix(expr, linePrefix) {
  const quoteCount = (linePrefix.match(/>/g) || []).length;
  if (quoteCount === 0 || !expr.includes("\n")) return expr;

  const prefixRegex = new RegExp(`^(?:[ \\t]*>[ \\t]?){1,${quoteCount}}`);
  return expr
    .split("\n")
    .map((line, index) => (index === 0 ? line : line.replace(prefixRegex, "")))
    .join("\n");
}

function matchFencedCodeStart(src, lineStartIndex) {
  const lineEnd = src.indexOf("\n", lineStartIndex);
  const end = lineEnd === -1 ? src.length : lineEnd;
  const line = src.slice(lineStartIndex, end).replace(/\r$/, "");

  const match = line.match(/^((?:[ \t]*>[ \t]?)*[ \t]*)([`~]{3,})(.*)$/);
  if (!match) return null;

  const fence = match[2];
  const fenceChar = fence[0];
  const info = match[3];

  // CommonMark: backtick fence info string cannot contain backticks
  if (fenceChar === "`" && info.includes("`")) {
    return null;
  }

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
      while (j + run < len && src[j + run] === "`") {
        run++;
      }
      if (run === tickLen) {
        return j + run;
      }
      j += run;
    } else {
      j++;
    }
  }

  return -1;
}

function findHtmlSkipBlockEnd(src, startIndex) {
  const slice = src.slice(startIndex);
  const openMatch = slice.match(/^<(pre|code|script|style)(?=[\s>/])/i);
  if (!openMatch) return -1;

  const tagName = openMatch[1];
  const openTagEnd = slice.indexOf(">");
  if (openTagEnd === -1) return -1;

  // Self-closing tag
  if (slice[openTagEnd - 1] === "/") {
    return startIndex + openTagEnd + 1;
  }

  const closeRegex = new RegExp(`</${tagName}\\s*>`, "i");
  const closeMatch = closeRegex.exec(src.slice(startIndex + openTagEnd + 1));
  if (!closeMatch) return src.length;

  return startIndex + openTagEnd + 1 + closeMatch.index + closeMatch[0].length;
}

function findHexoTagSkipBlockEnd(src, startIndex) {
  const slice = src.slice(startIndex);
  const openMatch = slice.match(/^\{%\s*(codeblock|raw)\b[\s\S]*?%\}/i);
  if (!openMatch) return -1;

  const tagName = openMatch[1];
  const closeRegex = new RegExp(`\\{%\\s*end${tagName}\\s*%\\}`, "i");
  const afterOpen = startIndex + openMatch[0].length;
  const closeMatch = closeRegex.exec(src.slice(afterOpen));
  if (!closeMatch) return src.length;

  return afterOpen + closeMatch.index + closeMatch[0].length;
}

function renderLatexPlaceholders(source, katexOptions = {}) {
  if (typeof source !== "string" || !source.includes("$")) {
    return { content: source, placeholders: [], nonce: "" };
  }

  const nonce = createNonce(source);
  const placeholders = [];
  const len = source.length;
  let out = "";
  let i = 0;
  let atLineStart = true;

  while (i < len) {
    // 1. Fenced code blocks
    if (atLineStart) {
      const fenceInfo = matchFencedCodeStart(source, i);
      if (fenceInfo) {
        const end = findFencedCodeEnd(
          source,
          fenceInfo.nextLineStart,
          fenceInfo.fenceChar,
          fenceInfo.fenceLen,
        );
        out += source.slice(i, end);
        i = end;
        atLineStart = true;
        continue;
      }
    }

    const ch = source[i];

    // 2. Inline code spans
    if (ch === "`") {
      const end = findInlineCodeEnd(source, i);
      if (end !== -1) {
        out += source.slice(i, end);
        i = end;
        atLineStart = source[i - 1] === "\n";
        continue;
      }
      let run = 0;
      while (i + run < len && source[i + run] === "`") run++;
      out += source.slice(i, i + run);
      i += run;
      atLineStart = false;
      continue;
    }

    // 3. Raw HTML pre/code/script/style blocks
    if (ch === "<") {
      const end = findHtmlSkipBlockEnd(source, i);
      if (end !== -1) {
        out += source.slice(i, end);
        i = end;
        atLineStart = source[i - 1] === "\n";
        continue;
      }
    }

    // 4. Hexo {% codeblock %} / {% raw %} tags
    if (ch === "{" && source[i + 1] === "%") {
      const end = findHexoTagSkipBlockEnd(source, i);
      if (end !== -1) {
        out += source.slice(i, end);
        i = end;
        atLineStart = source[i - 1] === "\n";
        continue;
      }
    }

    // 5. Backslash escapes (\\ and \$)
    if (ch === "\\" && i + 1 < len) {
      const next = source[i + 1];
      if (next === "\\" || next === "$") {
        out += source.slice(i, i + 2);
        i += 2;
        atLineStart = false;
        continue;
      }
    }

    // 6. Display math $$...$$
    if (ch === "$" && source[i + 1] === "$") {
      let j = i + 2;
      let closeIdx = -1;

      while (j < len) {
        if (source[j] === "\\" && j + 1 < len) {
          j += 2;
          continue;
        }
        if (source[j] === "$" && source[j + 1] === "$") {
          closeIdx = j;
          break;
        }
        j++;
      }

      if (closeIdx !== -1) {
        const lineStart = source.lastIndexOf("\n", i - 1) + 1;
        const beforeOnLine = source.slice(lineStart, i);
        const afterEnd = source.indexOf("\n", closeIdx + 2);
        const afterOnLine = source.slice(
          closeIdx + 2,
          afterEnd === -1 ? len : afterEnd,
        );

        const isBlankBefore = /^(?:[ \t]*>[ \t]?)*[ \t]*$/.test(beforeOnLine);
        const isBlankAfter = /^[ \t]*\r?$/.test(afterOnLine);

        const rawExpr = source.slice(i + 2, closeIdx);
        const cleanedExpr = isBlankBefore
          ? stripBlockquotePrefix(rawExpr, extractBlockquotePrefix(beforeOnLine))
          : rawExpr;
        const expr = cleanedExpr.trim();

        if (expr.length > 0) {
          const html = katex.renderToString(expr, {
            ...katexOptions,
            displayMode: true,
          });
          const idx = placeholders.length;
          const isStandalone = isBlankBefore && isBlankAfter;
          placeholders.push({ html, block: isStandalone });
          out += isStandalone
            ? `LINENKATEX${nonce}B${idx}END`
            : `LINENKATEX${nonce}I${idx}END`;
          i = closeIdx + 2;
          atLineStart = false;
          continue;
        }
      }

      out += "$$";
      i += 2;
      atLineStart = false;
      continue;
    }

    // 7. Inline math $...$ (single-line only)
    if (ch === "$" && source[i + 1] !== "$") {
      const validOpen =
        i + 1 < len &&
        !/\s/.test(source[i + 1]) &&
        !(i > 0 && /[0-9]/.test(source[i - 1]));

      if (validOpen) {
        let j = i + 1;
        let matched = false;

        while (j < len) {
          if (source[j] === "\\" && j + 1 < len) {
            j += 2;
            continue;
          }
          // Inline math cannot cross line breaks
          if (source[j] === "\n" || source[j] === "\r") {
            break;
          }
          if (source[j] === "$") {
            const validClose =
              j > i + 1 &&
              source[j + 1] !== "$" &&
              !/\s/.test(source[j - 1]) &&
              !(j + 1 < len && /[0-9]/.test(source[j + 1]));

            if (validClose) {
              const expr = source.slice(i + 1, j);
              const html = katex.renderToString(expr, {
                ...katexOptions,
                displayMode: false,
              });
              const idx = placeholders.length;
              placeholders.push({ html, block: false });
              out += `LINENKATEX${nonce}I${idx}END`;
              i = j + 1;
              atLineStart = false;
              matched = true;
            }
            break;
          }
          j++;
        }

        if (matched) {
          continue;
        }
      }
    }

    out += ch;
    atLineStart = ch === "\n";
    i++;
  }

  return { content: out, placeholders, nonce };
}

function restoreLatexPlaceholders(html, state) {
  if (!state || !state.placeholders.length || typeof html !== "string") {
    return html;
  }

  const { placeholders, nonce } = state;

  // Unwrap standalone display equations wrapped in <p>...</p> by Markdown
  const blockInP = new RegExp(
    `<p>\\s*LINENKATEX${nonce}B(\\d+)END\\s*</p>`,
    "g",
  );
  let result = html.replace(
    blockInP,
    (_, idx) => placeholders[Number(idx)]?.html ?? "",
  );

  // Restore any remaining block placeholders (e.g. inside lists or blockquotes)
  const blockToken = new RegExp(`LINENKATEX${nonce}B(\\d+)END`, "g");
  result = result.replace(
    blockToken,
    (_, idx) => placeholders[Number(idx)]?.html ?? "",
  );

  // Restore inline placeholders
  const inlineToken = new RegExp(`LINENKATEX${nonce}I(\\d+)END`, "g");
  result = result.replace(
    inlineToken,
    (_, idx) => placeholders[Number(idx)]?.html ?? "",
  );

  return result;
}

function register(hexo) {
  hexo.extend.filter.register(
    "before_post_render",
    function (data) {
      if (!isLatexEnabled(data, hexo)) {
        return data;
      }

      const options = getPageLatexOptions(data, hexo);
      const result = renderLatexPlaceholders(data.content, options);
      if (result.placeholders.length > 0) {
        data.content = result.content;
        renderStore.set(data, result);
      }
      return data;
    },
    0,
  );

  hexo.extend.filter.register(
    "after_post_render",
    function (data) {
      const state = renderStore.get(data);
      if (!state) return data;

      renderStore.delete(data);
      data.content = restoreLatexPlaceholders(data.content, state);
      return data;
    },
    1,
  );

  hexo.extend.helper.register("getLatexCssUrl", function (body) {
    if (!hasKatexMarkup(body)) {
      return "";
    }

    const { css } = getThemeLatexConfig(hexo);
    if (css) {
      if (/^(https?:)?\/\//i.test(css)) {
        return css;
      }
      return url_for.call(hexo, css);
    }

    return url_for.call(hexo, `/${DEFAULT_CSS_PATH}?v=${katexPkg.version}`);
  });

  hexo.extend.generator.register("linen-latex-assets", function (locals) {
    const { css } = getThemeLatexConfig(hexo);
    if (css) {
      return [];
    }

    const posts = locals.posts ? locals.posts.toArray() : [];
    const pages = locals.pages ? locals.pages.toArray() : [];
    const siteUsesKatex = [...posts, ...pages].some(
      (item) => hasKatexMarkup(item.content) || hasKatexMarkup(item.excerpt),
    );

    if (!siteUsesKatex) {
      return [];
    }

    const cssPath = path.join(katexDistDir, "katex.min.css");
    const fontsDir = path.join(katexDistDir, "fonts");
    const cssContent = stripLegacyFontFormats(fs.readFileSync(cssPath, "utf8"));

    const assets = [
      {
        path: DEFAULT_CSS_PATH,
        data: cssContent,
      },
    ];

    const fontFiles = fs
      .readdirSync(fontsDir)
      .filter((file) => file.endsWith(".woff2"));

    for (const file of fontFiles) {
      assets.push({
        path: `${DEFAULT_FONTS_DIR}/${file}`,
        data: fs.readFileSync(path.join(fontsDir, file)),
      });
    }

    return assets;
  });
}

if (typeof hexo !== "undefined") {
  register(hexo);
}

module.exports = {
  register,
  isLatexEnabled,
  getPageLatexOptions,
  renderLatexPlaceholders,
  restoreLatexPlaceholders,
  stripLegacyFontFormats,
  hasKatexMarkup,
};
