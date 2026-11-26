const pagination = require("hexo-pagination");
const { getSiteData } = require("./lib/site-data");

hexo.extend.generator.register("series", function (locals) {
  const seriesMap = {};
  const seriesInfo = getSiteData(hexo, "series");

  locals.posts.forEach((post) => {
    if (post?.hide?.archive) return;
    const series = post.series;
    if (series) {
      if (!seriesMap[series]) {
        seriesMap[series] = [];
      }
      seriesMap[series].push(post);
    }
  });

  const result = [];

  Object.keys(seriesMap).forEach((seriesName) => {
    const posts = seriesMap[seriesName].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const pages = pagination(`series/${seriesName}/`, posts, {
      perPage: hexo.config.per_page,
      layout: ["series"],
      format: "page/%d/",
      data: {
        series: seriesName,
        seriesPosts: posts,
        seriesInfo: seriesInfo[seriesName],
      },
    });

    result.push(...pages);
  });

  return result;
});
