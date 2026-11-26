"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const pkg = require("../package.json");

const FONT_VERSION_PLACEHOLDER = "__LINEN_FONT_VERSION__";

let cachedFontVersion = null;

function computeFontVersion(hexoInstance) {
  const baseDir = hexoInstance?.base_dir || "";
  if (baseDir) {
    const hash = crypto.createHash("md5");
    let hasInput = false;

    const lettersFilePath = path.join(baseDir, "custom-scripts/font/letters.txt");
    if (fs.existsSync(lettersFilePath)) {
      try {
        hash.update(fs.readFileSync(lettersFilePath));
        hasInput = true;
      } catch (error) {
        // Ignore unreadable letters.txt
      }
    }

    const targetDir = path.join(baseDir, "source/linen-theme/fonts");
    const backupDir = path.join(baseDir, "source/fonts");
    const fontDir = fs.existsSync(targetDir) ? targetDir : backupDir;

    if (fs.existsSync(fontDir)) {
      try {
        const files = fs.readdirSync(fontDir).sort();
        for (const file of files) {
          if (file.endsWith(".woff2") || file.endsWith(".ttf")) {
            hash.update(file);
            hash.update(fs.readFileSync(path.join(fontDir, file)));
            hasInput = true;
          }
        }
      } catch (error) {
        // Ignore unreadable font directory
      }
    }

    if (hasInput) {
      return hash.digest("hex").slice(0, 8);
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
