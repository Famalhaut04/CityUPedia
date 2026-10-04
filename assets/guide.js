/* 城大攻略：数据驱动渲染（data/guides.json） */
(function () {
  "use strict";

  const wrap = document.getElementById("guide-list");
  const detail = document.getElementById("guide-detail");
  if (!wrap && !detail) return;

  const lang = () => (window.MSDS ? MSDS.getStoredLang() : "zh");
  const pick = (g, field) => {
    const en = g[field + "_en"];
    return lang() === "en" && en ? en : g[field];
  };

  function renderList(guides) {
    if (!wrap) return;
    wrap.innerHTML = "";
    if (!guides.length) {
      wrap.innerHTML =
        '<div class="guide-empty">' +
        '<strong data-i18n="guide.empty.title">攻略编写中</strong>' +
        '<span data-i18n="guide.empty.desc">城大攻略正在筹备，将陆续上线选课、生活、求职等主题内容</span>' +
        "</div>";
      if (window.MSDS) MSDS.applyLang();
      return;
    }
    for (const g of guides) {
      const card = document.createElement("a");
      card.className = "guide-card";
      card.href = "guide.html?id=" + encodeURIComponent(g.id);
      card.innerHTML =
        '<span class="guide-card-tag">' + MSDS.escapeHtml(pick(g, "tag")) + "</span>" +
        '<strong class="guide-card-title">' + MSDS.escapeHtml(pick(g, "title")) + "</strong>" +
        '<p class="guide-card-summary">' + MSDS.escapeHtml(pick(g, "summary")) + "</p>" +
        '<span class="guide-card-meta">' + MSDS.escapeHtml(g.updated || "") + "</span>";
      wrap.appendChild(card);
    }
  }

  function renderDetail(guide) {
    if (!detail) return;
    if (!guide) {
      detail.innerHTML =
        '<div class="guide-empty">' +
        '<strong data-i18n="guide.missing.title">没有找到这篇攻略</strong>' +
        '<a class="text-link" href="guide.html" data-i18n="guide.back">返回攻略列表</a>' +
        "</div>";
      if (window.MSDS) MSDS.applyLang();
      return;
    }
    const sections = (guide.sections || [])
      .map((s) =>
        '<section class="guide-section">' +
        "<h2>" + MSDS.escapeHtml(pick(s, "heading")) + "</h2>" +
        '<div class="guide-section-body">' + (lang() === "en" && s.body_en ? s.body_en : MSDS.escapeHtml(s.body).replace(/\n/g, "<br>")) + "</div>" +
        "</section>")
      .join("");
    detail.innerHTML =
      '<a class="back-link" href="guide.html">← <span data-i18n="guide.back">返回攻略列表</span></a>' +
      '<header class="guide-detail-header">' +
      '<span class="guide-card-tag">' + MSDS.escapeHtml(pick(guide, "tag")) + "</span>" +
      "<h1>" + MSDS.escapeHtml(pick(guide, "title")) + "</h1>" +
      '<p class="guide-card-summary">' + MSDS.escapeHtml(pick(guide, "summary")) + "</p>" +
      "</header>" +
      sections;
    if (window.MSDS) MSDS.applyLang();
  }

  fetch("data/guides.json")
    .then((r) => r.json())
    .then((data) => {
      const guides = data.guides || [];
      const id = new URLSearchParams(window.location.search).get("id");
      if (detail) {
        if (id) {
          if (wrap) wrap.hidden = true;
          detail.hidden = false;
          renderDetail(guides.find((g) => g.id === id));
        } else {
          renderList(guides);
        }
      } else {
        renderList(guides);
      }
    })
    .catch(() => renderList([]));
})();
