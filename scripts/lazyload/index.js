"use strict";

const {
  buildLazyloadStyles,
  getLazyloadClientScript,
} = require("./assets");

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
  return [
    {
      path: "linen-theme/js/lazyload.js",
      data: getLazyloadClientScript(),
    },
    {
      path: "linen-theme/css/lazyload.css",
      data: buildLazyloadStyles(hexo),
    },
  ];
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