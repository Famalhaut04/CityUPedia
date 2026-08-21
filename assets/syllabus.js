(function () {
  "use strict";

  const detail = document.getElementById("syllabus-detail");
  const code = new URLSearchParams(window.location.search).get("code")?.trim().toUpperCase();

  function getJson(url) {
    return fetch(url).then((response) => {
      if (!response.ok) throw new Error(`数据读取失败：${url}`);
      return response.json();
    });
  }

  function renderPager(pageCount, isBottom = false) {
    return `
      <div class="bilingual-pager${isBottom ? " bilingual-pager-bottom" : ""}">
        <button class="bilingual-page-button" type="button" data-bilingual-action="previous" aria-label="查看上一页中英文课程介绍">← 上一页</button>
        <strong class="bilingual-page-counter" aria-live="polite">第 1 / ${pageCount} 页</strong>
        <button class="bilingual-page-button" type="button" data-bilingual-action="next" aria-label="查看下一页中英文课程介绍">下一页 →</button>
      </div>`;
  }

  function setupBilingualPager(course, pageImages, translationPages) {
    const reader = document.getElementById("bilingual-reader");
    const imageStage = document.getElementById("original-image-stage");
    const imageLink = document.getElementById("original-page-link");
    const image = document.getElementById("original-page-image");
    const imageLoading = document.getElementById("original-image-loading");
    const imageError = document.getElementById("original-image-error");
    const translationText = document.getElementById("bilingual-translation-text");
    const pageLabels = Array.from(document.querySelectorAll(".bilingual-current-page"));
    const pageCounters = Array.from(document.querySelectorAll(".bilingual-page-counter"));
    const previousButtons = Array.from(document.querySelectorAll('[data-bilingual-action="previous"]'));
    const nextButtons = Array.from(document.querySelectorAll('[data-bilingual-action="next"]'));
    let currentIndex = 0;

    function showPage(nextIndex, moveViewport) {
      if (nextIndex < 0 || nextIndex >= translationPages.length) return;
      currentIndex = nextIndex;

      const page = translationPages[currentIndex];
      const imageUrl = new URL(pageImages[currentIndex], document.baseURI).href;
      const pageNumber = Number(page.page) || currentIndex + 1;

      imageStage.dataset.imageState = "loading";
      image.hidden = true;
      imageLoading.hidden = false;
      imageError.hidden = true;
      image.alt = `${course.code} 英文课程介绍第 ${pageNumber} 页`;
      imageLink.href = imageUrl;
      translationText.textContent = page.text || "本页暂时没有中文翻译。";

      image.onload = () => {
        if (currentIndex !== nextIndex) return;
        imageStage.dataset.imageState = "ready";
        image.hidden = false;
        imageLoading.hidden = true;
      };
      image.onerror = () => {
        if (currentIndex !== nextIndex) return;
        imageStage.dataset.imageState = "error";
        image.hidden = true;
        imageLoading.hidden = true;
        imageError.hidden = false;
      };
      image.src = imageUrl;

      pageLabels.forEach((label) => { label.textContent = `第 ${pageNumber} 页`; });
      pageCounters.forEach((counter) => {
        counter.textContent = `第 ${pageNumber} / ${translationPages.length} 页`;
      });
      previousButtons.forEach((button) => { button.disabled = currentIndex === 0; });
      nextButtons.forEach((button) => { button.disabled = currentIndex === translationPages.length - 1; });

      if (currentIndex + 1 < pageImages.length) {
        const nextImage = new Image();
        nextImage.src = new URL(pageImages[currentIndex + 1], document.baseURI).href;
      }

      if (moveViewport) {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        reader.scrollIntoView({
          block: "start",
          behavior: reducedMotion ? "auto" : "smooth"
        });
      }
    }

    previousButtons.forEach((button) => {
      button.addEventListener("click", () => showPage(currentIndex - 1, true));
    });
    nextButtons.forEach((button) => {
      button.addEventListener("click", () => showPage(currentIndex + 1, true));
    });
    reader.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPage(currentIndex - 1, false);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        showPage(currentIndex + 1, false);
      }
    });

    showPage(0, false);
  }

  function render(course, courseDocument, translation, imageDocument) {
    const pageImages = imageDocument?.pages || [];
    const translationPages = translation.pages || [];
    if (!pageImages.length || pageImages.length !== translationPages.length) {
      throw new Error("课程页图与中文翻译页数不一致");
    }

    const pdfUrl = new URL(courseDocument.pdf, window.location.href).href;
    const backUrl = `course.html?code=${encodeURIComponent(course.code)}`;
    const pageCount = translationPages.length;

    document.title = `${course.code} 详细课程介绍 · CityU Pedia`;
    detail.innerHTML = `
      <a class="back-link" href="${backUrl}">← 返回 ${MSDS.escapeHtml(course.code)} 课程详情</a>

      <section class="syllabus-hero">
        <div>
          <div class="detail-code-row">
            <span class="detail-code">${MSDS.escapeHtml(course.code)}</span>
            <span class="document-badge">课程文件</span>
          </div>
          <h1>${MSDS.escapeHtml(translation.title_zh)}</h1>
          <p>${MSDS.escapeHtml(translation.title_en)} · ${pageCount} 页</p>
        </div>
        <div class="syllabus-actions">
          <a class="button button-primary" href="${MSDS.escapeHtml(pdfUrl)}" target="_blank" rel="noreferrer">原 PDF 备用入口</a>
          <a class="button button-quiet" href="${MSDS.escapeHtml(pdfUrl)}" download>下载 PDF</a>
        </div>
      </section>

      <nav class="syllabus-jump-links" aria-label="课程介绍内容导航">
        <a href="#bilingual-reader">中英逐页对照</a>
      </nav>

      <section id="bilingual-reader" class="document-panel bilingual-reader" tabindex="0" aria-label="${MSDS.escapeHtml(course.code)} 中英文逐页课程介绍">
        <div class="document-panel-heading bilingual-reader-heading">
          <div><span>Bilingual document</span><h2>中英逐页对照</h2></div>
          <p>英文页图与中文翻译同步切换；点击英文图片可单独放大。</p>
        </div>

        ${renderPager(pageCount)}

        <div class="bilingual-page-grid">
          <article class="bilingual-page-card original-page-card">
            <div class="bilingual-card-heading">
              <div><span>Original document</span><h3>英文原文</h3></div>
              <strong class="bilingual-current-page">第 1 页</strong>
            </div>
            <div id="original-image-stage" class="original-image-stage" data-image-state="loading">
              <a id="original-page-link" href="#" target="_blank" rel="noreferrer" aria-label="单独打开当前英文原文页图">
                <img id="original-page-image" class="original-page-image" alt="" decoding="async" hidden>
              </a>
              <div id="original-image-loading" class="original-image-message">正在加载英文原文页图…</div>
              <div id="original-image-error" class="original-image-message is-error" hidden>本页图片加载失败，请使用上方原 PDF 备用入口。</div>
            </div>
          </article>

          <article class="bilingual-page-card translation-page-card">
            <div class="bilingual-card-heading translation-card-heading">
              <div><span>Chinese translation</span><h3>中文翻译</h3></div>
              <strong class="bilingual-current-page">第 1 页</strong>
            </div>
            <div id="bilingual-translation-text" class="bilingual-translation-text"></div>
          </article>
        </div>

        <div class="translation-notice"><strong>阅读说明：</strong>中文内容按英文原文逐页整理，仅供理解与课程参考；课程要求、考核规则及阅读资料以英文原文为准。</div>
        ${renderPager(pageCount, true)}
        <p class="pdf-fallback">网页默认加载课程页图，不再使用 PDF.js 或浏览器内置 PDF 阅读器；原 PDF 仅作为备用和下载入口。</p>
      </section>`;

    setupBilingualPager(course, pageImages, translationPages);
  }

  if (!code) {
    detail.innerHTML = '<div class="error-state">缺少课程编号。<br><a class="text-link" href="index.html">返回课程表</a></div>';
    return;
  }

  Promise.all([
    getJson("data/courses/index.json"),
    getJson("data/course-documents/index.json"),
    getJson("data/course-documents/images.json")
  ]).then(([courseIndex, courseDocuments, imageIndex]) => {
    const course = courseIndex.courses.find((item) => item.code === code);
    if (!course) throw new Error("没有找到这门课程");
    const courseDocument = courseDocuments[course.code];
    if (!courseDocument) throw new Error("这门课程暂时没有详细课程文件");
    const imageDocument = imageIndex.courses?.[course.code];
    if (!imageDocument) throw new Error("这门课程暂时没有可用的网页页图");
    return getJson(courseDocument.translation)
      .then((translation) => render(course, courseDocument, translation, imageDocument));
  }).catch((error) => {
    const backUrl = code ? `course.html?code=${encodeURIComponent(code)}` : "index.html";
    detail.innerHTML = `<div class="error-state">${MSDS.escapeHtml(error.message)}<br><a class="text-link" href="${backUrl}">返回课程详情</a></div>`;
  });
})();
