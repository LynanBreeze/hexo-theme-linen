document.addEventListener("DOMContentLoaded", () => {
  const tocContainer = document.getElementById("toc");
  if (!tocContainer) return;

  const headers = [...document.querySelectorAll("h2, h3")];
  if (headers.length === 0) return;

  const toc = [];
  let lastH2 = null;
  let previousH2Id = null;
  let previousH3Id = null;
  let lastActiveH2Id = null;
  let lastActiveH3Id = null;

  headers.forEach((header) => {
    const title = header.textContent.trim();
    const id = header.id || title.replace(/\s+/g, "-").toLowerCase();

    if (header.tagName === "H2") {
      lastH2 = {
        title,
        id,
        active: false,
        children: [],
        visible: false,
        passiveVisible: false,
      };
      toc.push(lastH2);
    } else if (header.tagName === "H3" && lastH2) {
      lastH2.children.push({
        title,
        id,
        active: false,
        visible: false,
      });
    }
  });

  const tocItems = (tocContainer.children[1] && tocContainer.children[1].children) || [];

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const id = entry.target.id;
        const isVisible = !!entry.intersectionRatio;
        toc.forEach((h2) => {
          if (h2.id === id) {
            h2.visible = isVisible;
            if (isVisible) {
              previousH2Id = h2.id;
            }
          }
          h2.children.forEach((h3) => {
            if (h3.id === id) {
              h3.visible = isVisible;
              if (isVisible) {
                previousH3Id = h3.id;
              }
            }
          });
        });
        toc.forEach((item) => {
          item.passiveVisible =
            (item.children || []).findIndex((h3) => h3.visible) !== -1;
          if (item.passiveVisible) {
            previousH2Id = item.id;
          }
        });
      });

      const activeH2Index = toc.findIndex(
        (tocItem) => tocItem.passiveVisible || tocItem.visible,
      );
      toc.forEach((h2, h2Index) => {
        h2.active = h2Index === activeH2Index;
        if (h2Index === activeH2Index) {
          const activeH3Index = (h2.children || []).findIndex(
            (h3) => h3.visible,
          );
          h2.children.forEach((h3, h3Index) => {
            h3.active = h3Index === activeH3Index;
          });
        } else {
          h2.children.forEach((h3) => {
            h3.active = false;
          });
        }
      });

      const activeH2 = toc.find((item) =>
        typeof anchoringId !== "undefined" && anchoringId
          ? item.id === anchoringId
          : item.active,
      );

      let targetH2Id = null;
      let targetH3Id = null;

      if (activeH2) {
        targetH2Id = activeH2.id;
        const activeH3 = (activeH2.children || []).find((item) => item.active);
        targetH3Id = activeH3 ? activeH3.id : null;
      } else {
        const isScrollingUp = window.scrollY < previousScrollY;
        if (isScrollingUp) {
          const previousH2Index = toc.findIndex((h2) => h2.id === previousH2Id);
          const previousH3ParentIndex = toc.findIndex((h2) =>
            h2 && h2.children && h2.children.find((h3) => h3.id === previousH3Id),
          );
          let targetH2Index = 0;
          if (!previousH3Id || previousH3ParentIndex > previousH2Index) {
            targetH2Index = previousH2Index - 1;
          } else {
            targetH2Index = previousH3ParentIndex;
          }
          const newActiveH2 = toc[targetH2Index];
          if (newActiveH2) {
            targetH2Id = newActiveH2.id;
            let activeH3Index = (newActiveH2.children ? newActiveH2.children.length : 0) - 1;
            if (newActiveH2.children && newActiveH2.children.find((h3) => h3.id === previousH3Id)) {
              const previousH3Index = newActiveH2.children.findIndex(
                (h3) => h3.id === previousH3Id,
              );
              activeH3Index =
                previousH3Index - 1 > -1 ? previousH3Index - 1 : 0;
            }
            targetH3Id = (newActiveH2.children && newActiveH2.children[activeH3Index] && newActiveH2.children[activeH3Index].id) || null;
          }
        } else {
          targetH2Id = previousH2Id;
          targetH3Id = previousH3Id;
        }
      }

      if (targetH2Id) {
        if (lastActiveH2Id === targetH2Id && lastActiveH3Id === targetH3Id && !anchoringId) {
          return;
        }
        lastActiveH2Id = targetH2Id;
        lastActiveH3Id = targetH3Id;

        if (activeH2 && activeH2.children && activeH2.children.every((h3) => !h3.active)) {
          previousH3Id = null;
        }

        Array.from(tocItems).forEach((tocItem) => {
          if (tocItem.children[0].dataset.id === targetH2Id) {
            tocItem.className = "toc-item-wrap active";
            tocItem.scrollIntoView({
              block: "nearest",
              inline: "nearest",
            });
          } else {
            tocItem.className = "toc-item-wrap";
          }
          const subItems = tocItem.children[1];
          if (subItems) {
            Array.from(subItems.children || []).forEach((subItem) => {
              if (subItem.children[0].dataset.id === targetH3Id) {
                subItem.children[0].className = "toc-sub-item-link active";
                subItem.children[0].scrollIntoView({
                  block: "nearest",
                  inline: "nearest",
                });
              } else {
                subItem.children[0].className = "toc-sub-item-link";
              }
            });
          }
        });

        if (anchoringId) {
          anchoringId = null;
        }
      }
    },
    {
      rootMargin: "0px",
      threshold: [0, 1],
    },
  );
  headers.forEach((header) => observer.observe(header));
});
