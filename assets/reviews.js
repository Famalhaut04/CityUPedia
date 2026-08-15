/* ============================================================
   CityU Pedia · 课程评价中心（reviews.html）
   两个下拉菜单：学院 → 院系 → 该系课程列表；点击课程直接
   跳转到课程详情页（course.html），在课程详情页查看同学测评
   与提交评价。评价数据与 course.html 共用同一张 Supabase
   course_reviews 表，单独评价与排课时评价全部收录。
   ============================================================ */
(function () {
  "use strict";

  const MSDS = window.MSDS || {};

  // 复用 shared.js 的国际化（MSDS.t / MSDS.applyLang），避免自建表覆盖全站文本
  function t(key) {
    return typeof MSDS.t === "function" ? MSDS.t(key) : key;
  }

  // 页面级统计
  let stats = { courses: 0, reviews: 0, avg: 0 };

  // 当前院系课程（含名称等元信息）
  let currentCourses = [];

  // 全站课程数据（搜索用）
  let allData = null;
  let allCourses = [];
  let searchQuery = "";

  // ============ 构建 学院 → 院系 → 课程 层级 ============
  // 依据 programmes 中的 college / department 归类课程
  function buildHierarchy(data) {
    const colleges = new Map(); // college -> Map(dept -> [course, ...])
    (data.courses || []).forEach((course) => {
      const seen = new Set();
      (course.programmes || []).forEach((code) => {
        const prog = (data.programmes || []).find((p) => p.code === code);
        if (!prog) return;
        const college = prog.college || "其他学院";
        const dept = prog.department || "其他院系";
        const key = `${college}::${dept}`;
        if (seen.has(key)) return;
        seen.add(key);
        if (!colleges.has(college)) colleges.set(college, new Map());
        const deptMap = colleges.get(college);
        if (!deptMap.has(dept)) deptMap.set(dept, []);
        if (!deptMap.get(dept).some((c) => c.code === course.code)) {
          deptMap.get(dept).push(course);
        }
      });
    });
    return colleges;
  }

  function fillCollegeSelect(colleges) {
    const select = document.getElementById("college-select");
    if (!select) return;
    select.innerHTML = "";
    Array.from(colleges.keys()).sort().forEach((college) => {
      const option = document.createElement("option");
      option.value = college;
      option.textContent = college;
      select.appendChild(option);
    });
  }

  function fillDepartmentSelect(colleges, college) {
    const select = document.getElementById("department-select");
    if (!select) return;
    select.innerHTML = "";
    const deptMap = colleges.get(college);
    if (!deptMap) return;
    Array.from(deptMap.keys()).sort().forEach((dept) => {
      const option = document.createElement("option");
      option.value = dept;
      option.textContent = dept;
      select.appendChild(option);
    });
  }

  // ============ 课程列表（参考 cupedia.org/courses 列表行模式） ============
  // 每行：左侧代码+学分，中间课程标题，右侧"平均分/5 + 条评价"
  function courseCard(course, codeReviews) {
    const rows = codeReviews || [];
    const count = rows.length;
    const avg = count ? rows.reduce((s, r) => s + (Number(r.rating) || 0), 0) / count : 0;
    const rec = course.recommendation && course.recommendation.level !== "unknown"
      ? course.recommendation
      : null;
    // 云端有评价用云端平均分；否则用本地口碑分（3.5 等）
    const displayScore = avg || (rec && MSDS.ratingFor ? MSDS.ratingFor(rec) : null) || 0;
    const programmes = (course.programmes || []).join(" · ");
    const verdictBadge = rec && typeof MSDS.recommendationBadge === "function"
      ? MSDS.recommendationBadge(rec, true)
      : "";
    return `
      <article class="reviews-course-row" data-code="${MSDS.escapeHtml(course.code)}" tabindex="0" role="link" aria-label="查看 ${MSDS.escapeHtml(course.code)} 课程详情">
        <div class="reviews-course-row-main">
          <div class="reviews-course-row-head">
            <span class="reviews-course-code">${MSDS.escapeHtml(course.code)}</span>
            <span class="reviews-course-credit">${Number(course.credits) || "—"} 学分</span>
          </div>
          <h3 class="reviews-course-row-title">${MSDS.escapeHtml(course.programme_title || course.title || course.code)}</h3>
          ${verdictBadge ? `<div class="reviews-course-row-badges">${verdictBadge}</div>` : ""}
          <p class="reviews-course-programmes">${MSDS.escapeHtml(programmes)}</p>
        </div>
        <div class="reviews-course-row-side">
          <span class="reviews-course-avg">${displayScore ? `<b>${displayScore.toFixed(1)}</b><i>/5</i>` : '<span class="reviews-course-avg-empty">暂无评分</span>'}</span>
          <span class="reviews-course-count">${count} ${MSDS.escapeHtml(t("reviews.reviews"))}</span>
        </div>
        <svg class="reviews-course-row-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
      </article>`;
  }

  function renderCourseList(courses, groupedReviews) {
    const container = document.getElementById("reviews-course-list");
    const empty = document.getElementById("reviews-course-empty");
    if (!container) return;
    if (!courses.length) {
      empty.hidden = false;
      empty.textContent = t("reviews.empty");
      container.innerHTML = "";
      return;
    }
    empty.hidden = true;
    container.innerHTML = courses
      .slice()
      .sort((a, b) => String(a.code).localeCompare(String(b.code)))
      .map((course) => courseCard(course, groupedReviews[String(course.code)] || []))
      .join("");
    // 绑定点击：直接跳转到课程详情页
    container.querySelectorAll(".reviews-course-row").forEach((card) => {
      const open = () => {
        const code = card.getAttribute("data-code");
        if (code) window.location.href = `course.html?code=${encodeURIComponent(code)}&from=reviews`;
      };
      card.addEventListener("click", open);
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    });
  }

  // ============ 统计与列表刷新 ============
  function refreshCourseCards() {
    const dept = document.getElementById("department-select")?.value;
    if (!dept) return;
    loadDepartment(dept, true);
  }

  function refreshStats() {
    const c = document.getElementById("stat-courses");
    const r = document.getElementById("stat-reviews");
    const a = document.getElementById("stat-avg");
    if (c) c.textContent = stats.courses;
    if (r) r.textContent = stats.reviews;
    if (a) a.textContent = stats.avg ? stats.avg.toFixed(1) : "—";
  }

  // 加载某院系课程列表 + 批量云端评价
  function loadDepartment(dept, force) {
    const courses = currentCourses;
    const container = document.getElementById("reviews-course-list");
    if (!container) return;
    if (!MSDS.cloudReviewsEnabled()) {
      renderCourseList(courses, {});
      return;
    }
    container.innerHTML = `<div class="cloud-reviews-loading">${MSDS.escapeHtml(t("reviews.loading"))}</div>`;
    MSDS.fetchCloudReviewsBatch(courses.map((c) => c.code))
      .then((grouped) => {
        renderCourseList(courses, grouped);
        // 更新评价总数与全站平均分统计
        const all = Object.values(grouped).reduce((s, rows) => s + rows.length, 0);
        const sum = Object.values(grouped).reduce((s, rows) => s + rows.reduce((x, row) => x + (Number(row.rating) || 0), 0), 0);
        stats.reviews = all;
        stats.avg = all ? sum / all : 0;
        refreshStats();
      })
      .catch(() => {
        renderCourseList(courses, {});
      });
  }

  // ============ 课程代码搜索（全站范围） ============
  // 输入课程代码（大小写不敏感，支持前缀匹配），在全站课程中查找并展示结果
  function searchAllCourses(query) {
    const q = String(query || "").trim().toUpperCase();
    const container = document.getElementById("reviews-course-list");
    const empty = document.getElementById("reviews-course-empty");
    if (!container) return;
    if (!q) {
      // 清空搜索：回到当前院系视图
      const dept = document.getElementById("department-select")?.value;
      if (dept) {
        loadDepartment(dept);
      } else {
        empty.hidden = false;
        empty.textContent = t("reviews.empty");
        container.innerHTML = "";
      }
      return;
    }
    const matched = allCourses.filter((course) =>
      String(course.code).toUpperCase().includes(q)
      || String(course.programme_title || course.title || "").toUpperCase().includes(q)
    );
    if (!matched.length) {
      empty.hidden = false;
      empty.textContent = `未找到与「${MSDS.escapeHtml(query)}」匹配的课程`;
      container.innerHTML = "";
      return;
    }
    empty.hidden = true;
    if (!MSDS.cloudReviewsEnabled()) {
      renderCourseList(matched, {});
      return;
    }
    container.innerHTML = `<div class="cloud-reviews-loading">${MSDS.escapeHtml(t("reviews.loading"))}</div>`;
    MSDS.fetchCloudReviewsBatch(matched.map((c) => c.code))
      .then((grouped) => renderCourseList(matched, grouped))
      .catch(() => renderCourseList(matched, {}));
  }

  // ============ 初始化 ============
  async function init() {
    // 语言切换由 shared.js 的 initLangToggle 处理（含 applyLang），此处无需重复绑定；
    // 确保已保存的语言设置生效于静态 data-i18n 元素
    if (typeof MSDS.applyLang === "function") {
      MSDS.applyLang();
    }

    try {
      const data = await MSDS.loadCourseData();
      allData = data;
      allCourses = data.courses || [];
      const hierarchy = buildHierarchy(data);
      stats.courses = (data.courses || []).length;
      refreshStats();

      fillCollegeSelect(hierarchy);
      const collegeSelect = document.getElementById("college-select");
      const deptSelect = document.getElementById("department-select");
      const searchInput = document.getElementById("reviews-course-search");

      if (searchInput) {
        let searchTimer = null;
        searchInput.addEventListener("input", () => {
          clearTimeout(searchTimer);
          searchTimer = setTimeout(() => searchAllCourses(searchInput.value), 200);
        });
      }

      if (deptSelect) {
        deptSelect.addEventListener("change", () => {
          const dept = deptSelect.value;
          currentCourses = [];
          const deptMap = hierarchy.get(collegeSelect.value);
          if (deptMap && deptMap.has(dept)) {
            currentCourses = deptMap.get(dept).slice();
          }
          loadDepartment(dept);
        });
      }

      if (collegeSelect && collegeSelect.options.length) {
        collegeSelect.addEventListener("change", () => {
          fillDepartmentSelect(hierarchy, collegeSelect.value);
          if (deptSelect && deptSelect.options.length) {
            deptSelect.dispatchEvent(new Event("change"));
          }
        });
        // 先填充默认学院（首个学院），触发系下拉填充
        fillDepartmentSelect(hierarchy, collegeSelect.value);
        if (deptSelect && deptSelect.options.length) {
          deptSelect.dispatchEvent(new Event("change"));
        }
      }
    } catch (error) {
      const empty = document.getElementById("reviews-course-empty");
      if (empty) {
        empty.hidden = false;
        empty.textContent = `课程数据加载失败：${error.message}`;
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
