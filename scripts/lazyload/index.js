if (!hexo?.config?.theme_config?.lazyload?.enable) {
  return;
}
hexo.extend.filter.register(
  "after_post_render",
  require("./process").processPost
);
hexo.extend.filter.register(
  "after_render:html",
  require("./process").processCovers,
3);
hexo.extend.filter.register(
  "after_render:html",
  require("./inject")(hexo)
);