"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const pkg = require("../package.json");

const FONT_VERSION_PLACEHOLDER = "__LINEN_FONT_VERSION__";

let cachedFontVersion = null;

function computeFontVersion(hexoInstance) {
  const lettersFilePath = hexoInstance?.base_dir
    ? path.join(hexoInstance.base_dir, "custom-scripts/font/letters.txt")
    : "";

  if (lettersFilePath && fs.existsSync(lettersFilePath)) {
    try {
      const content = fs.readFileSync(lettersFilePath);
      return crypto.createHash("md5").update(content).digest("hex").slice(0, 8);
    } catch (error) {
      // Fall back to theme version if letters.txt cannot be read
    }
  }

  return String(
    hexoInstance?.theme?.config?.version || pkg?.version || "1",
  );
}

hexo.extend.filter.register("before_generate", function () {
  cachedFontVersion = computeFontVersion(hexo);
});

hexo.extend.filter.register("after_render:css", function (str) {
  if (typeof str !== "string" || !str.includes(FONT_VERSION_PLACEHOLDER)) {
    return str;
  }
  const version = cachedFontVersion || computeFontVersion(hexo);
  return str.split(FONT_VERSION_PLACEHOLDER).join(version);
});
