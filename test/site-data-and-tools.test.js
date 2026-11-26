"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const siteData = require("../scripts/lib/site-data");
const { createMockHexo, loadHexoScript } = require("./helpers/mock-hexo");

describe("scripts/lib/site-data.js & scripts/helpers/tools.js", () => {
  it("supports take and takeLast helpers", () => {
    const hexo = createMockHexo();
    loadHexoScript("scripts/helpers/tools.js", hexo);

    assert.deepEqual(hexo._helpers.take([1, 2, 3, 4], 2), [1, 2]);
    assert.deepEqual(hexo._helpers.takeLast([1, 2, 3, 4], 2), [3, 4]);
  });

  it("merges Hexo _data over assets-db without global.hexo and resolves custom series layoutStyle", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "linen-test-"));
    try {
      fs.mkdirSync(path.join(tmpDir, "assets-db"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, "assets-db/series.json"),
        JSON.stringify({
          Kansai: { layoutStyle: "journal", description: "From assets-db" },
          Notes: { description: "Only assets-db" },
        }),
      );

      const hexo = createMockHexo({
        base_dir: tmpDir,
        locals: {
          data: {
            series: {
              Kansai: { layoutStyle: "journal", description: "From _data" },
            },
          },
        },
      });

      siteData.clearCache();
      loadHexoScript("scripts/helpers/tools.js", hexo);

      const viewCtx = {
        theme: hexo.theme.config,
        config: hexo.config,
        page: { series: "Kansai" },
      };

      assert.equal(hexo._helpers.getSeriesInfo("Kansai").description, "From _data");
      assert.equal(hexo._helpers.getSeriesInfo("Notes").description, "Only assets-db");
      assert.equal(
        hexo._helpers.getPostLayoutStyle.call(viewCtx, viewCtx.page),
        "journal",
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
