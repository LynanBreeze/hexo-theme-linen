"use strict";

const fs = require("fs");
const path = require("path");
const {
  buildLazyloadStyles,
  getLazyloadClientScript,
} = require("./assets");

const ERROR_TIP_SVG_PATH = path.join(
  __dirname,
  "../../assets/img/lazyload/error-tip.svg",
);

if (
  !(
    hexo?.theme?.config?.lazyload?.enable ??
    hexo?.config?.theme_config?.lazyload?.enable ??
    false
  )
) {
  return;
}

hexo.extend.generator.register("linen-lazyload-assets", function () {
  const assets = [
    {
      path: "linen-theme/js/lazyload.js",
      data: getLazyloadClientScript(),
    },
    {
      path: "linen-theme/css/lazyload.css",
      data: buildLazyloadStyles(hexo),
    },
  ];
  if (fs.existsSync(ERROR_TIP_SVG_PATH)) {
    assets.push({
      path: "linen-theme/img/lazyload/error-tip.svg",
      data: () => fs.createReadStream(ERROR_TIP_SVG_PATH),
    });
  }
  return assets;
});

hexo.extend.filter.register(
  "after_post_render",
  require("./process").processPost,
);
hexo.extend.filter.register(
  "after_render:html",
  require("./process").processCovers,
  3,
);
hexo.extend.filter.register(
  "after_render:html",
  require("./inject")(hexo),
);