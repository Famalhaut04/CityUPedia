(function () {
  "use strict";

  const DAYS = ["M", "T", "W", "R", "F", "S"];
  const START_HOUR = 9;
  const END_HOUR = 22;
  const COLORS = [
    ["#dceee6", "#145f49", "#0e4938"],
    ["#e1ecf4", "#275b83", "#204c6c"],
    ["#f8e9d7", "#a45b16", "#81440d"],
    ["#ebe6f3", "#65508d", "#514071"],
    ["#edf0d9", "#6d7b25", "#526018"],
    ["#f2e4e8", "#984a63", "#77364c"]
  ];

  let data = null;
  let courses = [];
  let programmes = [];
  let activeProgramme = MSDS.getStoredProgramme() || MSDS.DEFAULT_PROGRAMME;
  let activeSemester = MSDS.getStoredSemester ? MSDS.getStoredSemester() : "SemA";
  let activeCollege = "";
  let activeDepartment = "";
  let selections = {};
  let searchTerm = "";
  let activeFilter = "all";
  let activeDay = "all";
  let activeSemesterFilter = activeSemester;

  const listElement = document.getElementById("course-list");
  const selectedListElement = document.getElementById("selected-list");

  function currentProgramme() {
    return MSDS.getProgramme(data, activeProgramme);
  }

  // 当前项目可选的课程（未标注归属的课程默认归入默认项目）
  function programmeCourses() {
    return courses.filter((course) => MSDS.courseProgrammes(course, data).includes(activeProgramme));
  }

  function requirementTypeOf(course) {
    return MSDS.getRequirementType(course, activeProgramme);
  }

  function courseByCode(code) {
    return courses.find((course) => course.code === code);
  }

  function reloadSelections() {
    selections = MSDS.getStoredSelections(activeProgramme, activeSemester);
  }

  function filterCourses() {
    return programmeCourses().filter((course) => {
      const haystack = `${course.code} ${course.programme_title}`.toLowerCase();
      const matchesSearch = haystack.includes(searchTerm.toLowerCase());
      const matchesFilter = activeFilter === "all"
        || (activeFilter === "core" || activeFilter === "elective"
          ? requirementTypeOf(course) === activeFilter
          : MSDS.getElectiveGroup(course, activeProgramme) === activeFilter);
      const primaryDays = course.eligible_sections
        .filter((section) => Number(section.credits) > 0)
        .map((section) => section.day);
      const matchesDay = activeDay === "all" || primaryDays.includes(activeDay);
      const matchesSemester = activeSemesterFilter === "all" || MSDS.courseOfferedInSemester(course, activeSemesterFilter);
      return matchesSearch && matchesFilter && matchesDay && matchesSemester;
    });
  }

  function renderProgrammePills() {
    // 三级级联：学院 → 系 → 硕士项目；三行始终可见，默认展开当前项目所在的学院与院系
    renderCollegePills();
    renderDepartmentPills();
    renderProgrammeLevelPills();
  }

  // 一级：学院
  function colleges() {
    const seen = new Set();
    const list = [];
    programmes.forEach((p) => {
      const key = p.college_en || "College of Computing";
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ key, name_zh: p.college || "计算学院", name_en: key });
      }
    });
    return list;
  }

  function collegeProgrammes(collegeKey) {
    return programmes.filter((p) => (p.college_en || "College of Computing") === collegeKey);
  }

  function renderCollegePills() {
    const container = document.getElementById("college-pills");
    if (!container) return;
    const list = colleges();
    const row = document.getElementById("college-row");
    if (row) row.hidden = list.length === 0;
    container.innerHTML = list.map((c) => {
      const active = c.key === activeCollege;
      return `<button class="programme-pill college-pill ${active ? "active" : ""}" type="button" role="tab" aria-selected="${active ? "true" : "false"}" data-college="${MSDS.escapeHtml(c.key)}" title="${MSDS.escapeHtml(c.name_zh)}（${MSDS.escapeHtml(c.name_en)}）">${MSDS.escapeHtml(c.name_zh)}<small>${MSDS.escapeHtml(c.name_en)}</small></button>`;
    }).join("");
  }

  // 二级：系
  function departments() {
    const seen = new Set();
    const list = [];
    collegeProgrammes(activeCollege).forEach((p) => {
      const key = p.department_en || p.department || "Department";
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ key, name_zh: p.department || key, name_en: key });
      }
    });
    return list;
  }

  function renderDepartmentPills() {
    const container = document.getElementById("department-pills");
    if (!container) return;
    const list = departments();
    if (!list.some((d) => d.key === activeDepartment)) activeDepartment = list.length ? list[0].key : "";
    const row = document.getElementById("department-row");
    if (row) row.hidden = list.length === 0;
    container.innerHTML = list.map((d) => {
      const active = d.key === activeDepartment;
      return `<button class="programme-pill department-pill ${active ? "active" : ""}" type="button" role="tab" aria-selected="${active ? "true" : "false"}" data-department="${MSDS.escapeHtml(d.key)}" title="${MSDS.escapeHtml(d.name_en)}">${MSDS.escapeHtml(d.name_zh)}<small>${MSDS.escapeHtml(d.name_en.replace(/^Department of /, ""))}</small></button>`;
    }).join("");
  }

  // 三级：硕士项目
  function departmentProgrammes() {
    return collegeProgrammes(activeCollege).filter(
      (p) => (p.department_en || p.department || "Department") === activeDepartment
    );
  }

  function renderProgrammeLevelPills() {
    const container = document.getElementById("programme-pills");
    if (!container) return;
    const list = departmentProgrammes();
    const row = document.getElementById("programme-row");
    if (row) row.hidden = list.length === 0;
    const hints = [];
    container.innerHTML = list.map((programme) => {
      const available = programme.data_ready !== false
        && courses.some((course) => MSDS.courseProgrammes(course, data).includes(programme.code));
      const active = programme.code === activeProgramme;
      // 保留原始文本供 textContent 使用，写进 title 属性时再转义，
      // 否则 hints[0] 进 textContent 会把 & < > 显示成 &amp; &lt; &gt;
      const hint = available
        ? `${programme.name_zh}（${programme.name_en}）`
        : `${programme.name_zh}：课程数据待补充`;
      if (active) hints.push(hint);
      if (!available) {
        return `<span class="programme-pill is-pending" role="tab" aria-selected="false" title="课程数据待补充，敬请期待">${MSDS.escapeHtml(programme.code)}<small>筹备中</small></span>`;
      }
      return `<button class="programme-pill ${active ? "active" : ""}" type="button" role="tab" aria-selected="${active ? "true" : "false"}" data-programme="${MSDS.escapeHtml(programme.code)}" title="${MSDS.escapeHtml(hint)}">${MSDS.escapeHtml(programme.code)}<small>${MSDS.escapeHtml(programme.name_zh.replace(/硕士$/, ""))}</small></button>`;
    }).join("");
    const hint = document.getElementById("programme-bar-hint");
    if (hint) hint.textContent = hints[0] || "";
  }

  function renderProgrammeStats() {
    const programme = currentProgramme();
    document.getElementById("stat-graduation").textContent = programme.graduation_credit_units
      ? `${programme.graduation_credit_units}`
      : "—";
    document.getElementById("stat-graduation-label").textContent = "毕业学分";
    const requirement = programme.requirement_credit_units;
    if (requirement && requirement.core != null && requirement.electives != null) {
      document.getElementById("stat-requirement").textContent = `${requirement.core} + ${requirement.electives}`;
      document.getElementById("stat-requirement-label").textContent = "核心 + 选修";
    } else {
      document.getElementById("stat-requirement").textContent = "以学院为准";
      document.getElementById("stat-requirement-label").textContent = "核心 + 选修学分";
    }
    document.getElementById("programme-summary-name").textContent = `${programme.code} · ${programme.name_zh}`;
    renderFilterRow(programme);
    renderTermFilter();
    // 课表表头的项目介绍链接
    const infoLink = document.getElementById("programme-info-link");
    if (infoLink) {
      if (programme.programme_url) {
        infoLink.href = programme.programme_url;
        infoLink.hidden = false;
        infoLink.title = `查看 ${programme.name_zh} 官方项目介绍`;
        infoLink.textContent = "项目介绍 ↗";
      } else {
        infoLink.hidden = true;
      }
    }
    document.getElementById("data-note").textContent = `课表快照：${data.schedule_as_of || ""}（Asia/Beijing），数据采集自 CityU AIMS 系统。名额和注册状态会变化，请以 CityU 系统为准。`;
  }

  // 若当前项目配置了选修分组（如 MSCY 的 Group I / Group II），在“选修”后追加对应筛选按钮
  function renderFilterRow(programme) {
    const row = document.querySelector(".filter-row");
    if (!row) return;
    row.querySelectorAll(".filter-pill-group").forEach((el) => el.remove());

    const groups = programme?.requirement_credit_units?.elective_groups;
    if (Array.isArray(groups) && groups.length) {
      const lang = MSDS.getStoredLang();
      let anchor = row.querySelector('[data-filter="elective"]');
      groups.forEach((group) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "filter-pill filter-pill-group";
        button.dataset.filter = group.key;
        button.textContent = lang === "en" ? group.label_en : group.label_zh;
        anchor?.insertAdjacentElement("afterend", button);
        anchor = button;
      });
    }

    const validFilters = ["all", "core", "elective", ...(groups || []).map((group) => group.key)];
    if (!validFilters.includes(activeFilter)) activeFilter = "all";
    row.querySelectorAll(".filter-pill").forEach((item) => item.classList.toggle("active", item.dataset.filter === activeFilter));
  }

  // 若当前项目的课程带有学期标签（如 MSCY 的 SemA/SemB），显示独立的学期筛选行；
  // 该维度与“核心/选修/分组”筛选相互独立，可同时生效（与 activeDay 的模式一致）
  function renderTermFilter() {
    const container = document.getElementById("term-filter");
    const row = document.getElementById("term-filter-row");
    if (!container || !row) return;

    const terms = [...new Set(programmeCourses().flatMap((course) => MSDS.courseTerms(course)))].sort();
    if (!terms.length) {
      container.hidden = true;
      row.innerHTML = "";
      activeSemesterFilter = "all";
      return;
    }
    container.hidden = false;
    if (!["all", ...terms].includes(activeSemesterFilter)) activeSemesterFilter = "all";
    row.innerHTML = [`<button class="term-filter-pill ${activeSemesterFilter === "all" ? "active" : ""}" type="button" data-term-filter="all">全部</button>`]
      .concat(terms.map((term) => `<button class="term-filter-pill ${MSDS.termBadgeClass(term)} ${activeSemesterFilter === term ? "active" : ""}" type="button" data-term-filter="${MSDS.escapeHtml(term)}">${MSDS.escapeHtml(term)}</button>`))
      .join("");
  }

  function renderCourseList() {
    const filtered = filterCourses();
    if (!filtered.length) {
      listElement.innerHTML = '<div class="empty-list">当前项目下没有符合条件的课程</div>';
      return;
    }

    listElement.innerHTML = filtered.map((course) => {
      const rec = MSDS.getRecommendation(course);
      const isAdded = Boolean(selections[course.code]);
      // 原始记录：一个班次可能对应多条“每周上课时间”（如一周两次课），用于课表文案完整展示
      const primaries = course.eligible_sections.filter((item) => Number(item.credits) > 0);
      const tutorials = course.eligible_sections.filter((item) => Number(item.credits) === 0);
      // 去重后的班次列表：用于“共几个班次”计数与“选择时间”下拉框（同一班次的多次上课时间不算多个选项）
      const primaryOptions = MSDS.uniqueByKey(primaries);
      const tutorialOptions = MSDS.uniqueByKey(tutorials);
      const scheduleText = primaries.map((item) => `${MSDS.DAY_NAMES[item.day]} ${item.time}`).join(" / ");
      const selectedPrimary = selections[course.code]?.primaryCrn;
      const selectedTutorial = selections[course.code]?.tutorialCrn
        || (tutorialOptions.length ? MSDS.sectionKey(MSDS.pickTutorial(MSDS.findSection(course, selectedPrimary) || primaryOptions[0], tutorialOptions)) : null);
      const coreBadge = requirementTypeOf(course) === "core"
        ? '<span class="mini-badge core">核心</span>'
        : MSDS.recommendationBadge(rec, true);
      const groupInfo = MSDS.getElectiveGroupInfo(currentProgramme(), MSDS.getElectiveGroup(course, activeProgramme));
      const groupBadge = groupInfo ? `<span class="mini-badge group">${MSDS.escapeHtml(groupInfo.label_zh)}</span>` : "";
      const termBadge = MSDS.courseTerms(course).map((term) => `<span class="mini-badge term ${MSDS.termBadgeClass(term)}">${MSDS.escapeHtml(term)}</span>`).join("");
      const myReview = MSDS.getCourseReview(course.code);
      const reviewBadge = myReview ? `<span class="mini-badge review" title="我的评价：${Number(myReview.rating)} 星${myReview.comment ? " · " + MSDS.escapeHtml(myReview.comment) : ""}">已评 ${Number(myReview.rating)}★</span>` : "";
      return `
        <article class="course-row">
          <div class="course-row-main">
            <div class="course-code-line">
              <span class="course-code">${MSDS.escapeHtml(course.code)}</span>
              ${coreBadge}
              ${groupBadge}
              ${termBadge}
              ${reviewBadge}
            </div>
            <a class="course-title-link" href="course.html?code=${encodeURIComponent(course.code)}">${MSDS.escapeHtml(course.programme_title)}</a>
            <div class="course-meta"><span>${course.credits} 学分</span><span>${primaryOptions.length} 个主课班次</span>${MSDS.ratingStars(rec, { withMeta: false }) ? `<span class="course-rating">${MSDS.ratingStars(rec, { withMeta: false })}</span>` : ""}</div>
            <div class="course-schedule" title="${MSDS.escapeHtml(scheduleText)}">${MSDS.escapeHtml(scheduleText)}</div>
            <div class="course-preview" aria-label="${MSDS.escapeHtml(course.code)} 课程预览">
              <p>${MSDS.escapeHtml(rec.summary)}</p>
              <div class="course-preview-tags">${rec.tags.slice(0, 3).map((tag) => `<span>${MSDS.escapeHtml(tag)}</span>`).join("") || `<span>${MSDS.escapeHtml(rec.verdict)}</span>`}</div>
            </div>
            ${primaryOptions.length > 1 ? `<label class="quick-section-picker"><span>选择时间</span><select data-quick-section="${MSDS.escapeHtml(course.code)}" aria-label="选择 ${MSDS.escapeHtml(course.code)} 上课时间">${sectionOptions(primaryOptions, selectedPrimary || MSDS.sectionKey(primaryOptions[0]))}</select></label>` : ""}
            ${tutorialOptions.length > 1 ? `<label class="quick-section-picker"><span>选择 Tutorial</span><select data-quick-tutorial="${MSDS.escapeHtml(course.code)}" aria-label="选择 ${MSDS.escapeHtml(course.code)} Tutorial">${sectionOptions(tutorialOptions, selectedTutorial)}</select></label>` : ""}
          </div>
          ${(() => {
            // 所有已添加课程都显示为可再次点击取消的按钮，点击即可撤销选择
            if (!isAdded) {
              return `<button class="add-course" type="button" data-code="${MSDS.escapeHtml(course.code)}" aria-label="加入 ${MSDS.escapeHtml(course.code)}" title="加入课表">+</button>`;
            }
            return `<button class="add-course is-added is-removable" type="button" data-code="${MSDS.escapeHtml(course.code)}" aria-label="取消选择 ${MSDS.escapeHtml(course.code)}" title="点击取消选择">✓</button>`;
          })()}
        </article>`;
    }).join("");
  }

  function sectionOptions(sections, selectedKey) {
    return sections.map((section) => {
      const key = MSDS.sectionKey(section);
      const webNote = section.web === "N" ? " · 非网页注册" : "";
      const restricted = MSDS.sectionRestrictedProgrammes(section);
      const restrictionNote = restricted.length ? ` · 仅限：${restricted.join("、")}` : "";
      return `<option value="${MSDS.escapeHtml(key)}" ${String(selectedKey) === key ? "selected" : ""}>${MSDS.escapeHtml(MSDS.formatSection(section) + webNote + restrictionNote)}</option>`;
    }).join("");
  }

  function renderSelectedList() {
    const selectedCourses = programmeCourses().filter((course) => selections[course.code]);
    if (!selectedCourses.length) {
      selectedListElement.innerHTML = '<div class="empty-list"><strong>还没有课程</strong><br>回到“浏览课程”开始排课</div>';
      return;
    }

    selectedListElement.innerHTML = selectedCourses.map((course) => {
      const selected = selections[course.code];
      const primaries = MSDS.uniqueByKey(course.eligible_sections.filter((section) => Number(section.credits) > 0));
      const tutorials = MSDS.uniqueByKey(course.eligible_sections.filter((section) => Number(section.credits) === 0));
      return `
        <article class="selected-course">
          <div class="selected-course-head">
            <div><a href="course.html?code=${encodeURIComponent(course.code)}">${MSDS.escapeHtml(course.code)}</a><small>${MSDS.escapeHtml(course.programme_title)}</small></div>
          </div>
          <div class="section-selects">
            <label>主课<select data-code="${MSDS.escapeHtml(course.code)}" data-kind="primary">${sectionOptions(primaries, selected.primaryCrn)}</select></label>
            ${tutorials.length ? `<label>Tutorial<select data-code="${MSDS.escapeHtml(course.code)}" data-kind="tutorial"><option value="">不选择</option>${sectionOptions(tutorials, selected.tutorialCrn)}</select></label>` : ""}
          </div>
        </article>`;
    }).join("");
  }

  function renderSelectedChips() {
    const selectedCourses = programmeCourses().filter((course) => selections[course.code]);
    const container = document.getElementById("selected-chips");
    if (!selectedCourses.length) {
      container.innerHTML = '<span class="selected-chips-empty">加入课程后，可点击课表块查看详情</span>';
      return;
    }
    container.innerHTML = selectedCourses.map((course) => `
      <span class="selected-chip">
        <a href="course.html?code=${encodeURIComponent(course.code)}">${MSDS.escapeHtml(course.code)}</a>
        <span aria-hidden="true">·</span>
      </span>`).join("");
  }

  function minutes(time) {
    const [hours, mins] = time.split(":").map(Number);
    return hours * 60 + mins;
  }

  function selectedEvents() {
    const events = [];
    programmeCourses().forEach((course, courseIndex) => {
      const selected = selections[course.code];
      if (!selected) return;
      [selected.primaryCrn, selected.tutorialCrn].filter(Boolean).forEach((key) => {
        // 同一 CRN 可能一周上多次课（如周四+周三各一次），每条记录都要单独上课表；
        // 同一天同一时间出现多条记录（如同一节课分两个教室平行上课）则合并成一格，避免课表上出现“自己和自己冲突”的假重叠
        const meetings = course.eligible_sections.filter((item) => MSDS.sectionKey(item) === String(key));
        const byDayTime = new Map();
        meetings.forEach((item) => {
          if (!item.time || !DAYS.includes(item.day)) return;
          const dtKey = `${item.day}|${item.time}`;
          const existing = byDayTime.get(dtKey);
          if (!existing) {
            byDayTime.set(dtKey, item);
            return;
          }
          const rooms = new Set([existing, item].map((s) => [s.building, s.room].filter(Boolean).join(" ")).filter(Boolean));
          if (rooms.size > 1) byDayTime.set(dtKey, { ...existing, building: "", room: [...rooms].join(" / ") });
        });
        byDayTime.forEach((section, dtKey) => {
          const [startText, endText] = section.time.split(" - ");
          events.push({
            id: `${course.code}-${key}-${dtKey}`,
            course,
            section,
            start: minutes(startText),
            end: minutes(endText),
            color: COLORS[courseIndex % COLORS.length],
            conflict: false,
            lane: 0,
            laneCount: 1
          });
        });
      });
    });

    events.forEach((event, index) => {
      events.slice(index + 1).forEach((other) => {
        if (event.section.day === other.section.day && event.start < other.end && other.start < event.end) {
          event.conflict = true;
          other.conflict = true;
        }
      });
    });

    DAYS.forEach((day) => {
      const dayEvents = events.filter((event) => event.section.day === day).sort((a, b) => a.start - b.start || a.end - b.end);
      const laneEnds = [];
      dayEvents.forEach((event) => {
        let lane = laneEnds.findIndex((end) => end <= event.start);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = event.end;
        event.lane = lane;
      });
      const count = Math.max(1, laneEnds.length);
      dayEvents.forEach((event) => { event.laneCount = count; });
    });
    return events;
  }

  function renderTimeAxis() {
    const axis = document.getElementById("time-axis");
    axis.innerHTML = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => {
      const hour = START_HOUR + index;
      // 首个标签（09:00）不下移，避免被表头 sticky 背景遮挡而显示不全
      const shift = index === 0 ? "0" : "-6px";
      return `<span class="time-label" style="top:${index * 60}px;transform:translateY(${shift})">${String(hour).padStart(2, "0")}:00</span>`;
    }).join("");
  }

  function renderTimetable() {
    const events = selectedEvents();
    const columns = document.getElementById("day-columns");
    columns.innerHTML = DAYS.map((day) => {
      const blocks = events.filter((event) => event.section.day === day).map((event) => {
        const top = ((event.start - START_HOUR * 60) / 60) * 60;
        const height = Math.max(34, ((event.end - event.start) / 60) * 60);
        const width = 100 / event.laneCount;
        const left = event.lane * width;
        const room = [event.section.building, event.section.room].filter(Boolean).join(" ");
        const recommendation = MSDS.getRecommendation(event.course);
        const tooltipTags = recommendation.tags.slice(0, 3).map((tag) => `<span class="event-tooltip-tag">${MSDS.escapeHtml(tag)}</span>`).join("");
        return `<div class="course-event ${event.conflict ? "is-conflict" : ""} ${event.start >= 19 * 60 ? "tooltip-up" : ""} ${event.section.day === "F" ? "tooltip-left" : ""}" role="button" tabindex="0"
          data-event-code="${MSDS.escapeHtml(event.course.code)}"
          aria-label="查看 ${MSDS.escapeHtml(event.course.code)} 详情：${MSDS.escapeHtml(recommendation.verdict)}"
          style="top:${top}px;height:${height}px;left:calc(${left}% + 3px);width:calc(${width}% - 6px);--event-bg:${event.color[0]};--event-accent:${event.color[1]};--event-ink:${event.color[2]}">
          <span class="event-label"><strong>${MSDS.escapeHtml(event.course.code)} · ${MSDS.escapeHtml(event.section.section)}</strong>
            <span>${MSDS.escapeHtml(event.section.time)}</span>
            <span>${MSDS.escapeHtml(room)}</span>
          </span>
          <span class="event-overlay" role="tooltip">
            <span class="event-overlay-content"><strong>${MSDS.escapeHtml(event.course.programme_title)}</strong><span>${MSDS.escapeHtml(MSDS.DAY_NAMES[event.section.day])} · ${MSDS.escapeHtml(event.section.time)}</span><span>${MSDS.escapeHtml(room || "地点待定")}</span><span class="event-tooltip-tags">${tooltipTags || `<span class="event-tooltip-tag">${MSDS.escapeHtml(recommendation.verdict)}</span>`}</span></span>
            <span class="event-overlay-actions"><a href="course.html?code=${encodeURIComponent(event.course.code)}" data-event-link>详情</a><button type="button" data-event-remove="${MSDS.escapeHtml(event.course.code)}">删除</button></span>
          </span>
        </div>`;
      }).join("");
      return `<div class="day-column" data-day-column="${day}">${blocks}</div>`;
    }).join("");

    document.getElementById("empty-timetable").hidden = events.length > 0;
    const conflicts = events.filter((event) => event.conflict);
    const status = document.getElementById("conflict-status");
    if (conflicts.length) {
      status.className = "conflict-status has-conflict";
      status.textContent = `${new Set(conflicts.map((event) => event.course.code)).size} 门课程冲突`;
    } else {
      status.className = "conflict-status is-clear";
      status.textContent = "暂无冲突";
    }
  }

  function updateSummary() {
    const selectedCourses = programmeCourses().filter((course) => selections[course.code]);
    const coreCourses = selectedCourses.filter((course) => requirementTypeOf(course) === "core");
    const electiveCourses = selectedCourses.filter((course) => requirementTypeOf(course) === "elective");
    const sumCredits = (items) => items.reduce((sum, course) => sum + Number(course.credits || 0), 0);

    document.getElementById("core-count").textContent = coreCourses.length;
    document.getElementById("core-credit-count").textContent = sumCredits(coreCourses);
    document.getElementById("elective-count").textContent = electiveCourses.length;
    document.getElementById("elective-credit-count").textContent = sumCredits(electiveCourses);
    document.getElementById("selected-count").textContent = selectedCourses.length;
    document.getElementById("selected-tab-count").textContent = selectedCourses.length;
    document.getElementById("credit-count").textContent = sumCredits(selectedCourses);

    updateElectiveGroupSummary(electiveCourses, sumCredits);
  }

  // 展示 Group I / Group II 等选修分组的学分进度（如有配置），提示是否满足下限/上限
  function updateElectiveGroupSummary(electiveCourses, sumCredits) {
    const container = document.getElementById("elective-group-summary");
    if (!container) return;
    const programme = currentProgramme();
    const groups = programme?.requirement_credit_units?.elective_groups;
    if (!Array.isArray(groups) || !groups.length) {
      container.hidden = true;
      container.innerHTML = "";
      return;
    }
    container.hidden = false;
    const lang = MSDS.getStoredLang();
    container.innerHTML = groups.map((group) => {
      const groupCourses = electiveCourses.filter((course) => MSDS.getElectiveGroup(course, activeProgramme) === group.key);
      const credits = sumCredits(groupCourses);
      const belowMin = group.min_credits != null && credits < group.min_credits;
      const aboveMax = group.max_credits != null && credits > group.max_credits;
      const label = lang === "en" ? group.label_en : group.label_zh;
      const requirementText = lang === "en"
        ? (group.min_credits != null ? `min ${group.min_credits} credits` : `max ${group.max_credits} credits`)
        : (group.min_credits != null ? `至少 ${group.min_credits} 学分` : `至多 ${group.max_credits} 学分`);
      const selectedText = lang === "en" ? `${credits} credits selected` : `已选 ${credits} 学分`;
      return `<span class="elective-group-item ${belowMin || aboveMax ? "is-warn" : ""}">${MSDS.escapeHtml(label)}: ${selectedText} (${requirementText})</span>`;
    }).join("");
  }

  function renderAll() {
    MSDS.saveSelections(selections, activeProgramme, activeSemester);
    renderCourseList();
    renderSelectedList();
    renderSelectedChips();
    renderTimetable();
    updateSummary();
  }

  function applyDefaultSelections() {
    // 不再自动安排必修课/默认课程到课表。
    // 同学可能需要调整必修课时间，因此默认课表保持为空，由用户自行选择。
    const hasStored = Object.keys(selections).length > 0;
    if (hasStored) return;
    selections = {};
    MSDS.saveSelections(selections, activeProgramme, activeSemester);
  }

  // 切换课表学期（SemA / SemB / Summer），各自独立保存课表
  function switchSemester(semester) {
    if (semester === activeSemester) return;
    activeSemester = semester;
    // 学期切换时同步选课列表过滤，使 Summer 等学期形成独立的选课块
    activeSemesterFilter = semester;
    if (typeof MSDS.saveSemester === "function") MSDS.saveSemester(semester);
    reloadSelections();
    applyDefaultSelections();
    renderProgrammeStats();
    renderAll();
    updateSemesterSwitchUI();
    MSDS.showToast(`已切换到 ${semester} 课表`);
  }

  function updateSemesterSwitchUI() {
    document.querySelectorAll("[data-semester-switch]").forEach((button) => {
      button.classList.toggle("active", button.dataset.semesterSwitch === activeSemester);
    });
    const label = document.getElementById("semester-summary-name");
    if (label) label.textContent = activeSemester;
    const summary = document.getElementById("programme-summary-name");
    if (summary) summary.textContent = `${currentProgramme().name_zh} · ${activeSemester}`;
  }

  function selectionForPrimary(course, primaryCrn, tutorialCrn) {
    const selection = MSDS.makeDefaultSelection(course);
    if (primaryCrn) {
      selection.primaryCrn = primaryCrn;
      const tutorials = course.eligible_sections.filter((section) => Number(section.credits) === 0);
      const matching = MSDS.makeDefaultSelection({
        ...course,
        eligible_sections: [MSDS.findSection(course, primaryCrn), ...tutorials].filter(Boolean)
      });
      selection.tutorialCrn = matching.tutorialCrn;
    }
    if (tutorialCrn) selection.tutorialCrn = tutorialCrn;
    return selection;
  }

  function toggleCourse(code, primaryCrn, tutorialCrn) {
    const course = courseByCode(code);
    if (!course) return;
    if (selections[code]) {
      delete selections[code];
      MSDS.showToast(`已移除 ${code}`);
    } else {
      // 学期隔离：a 学期的课不能在 b 学期选上
      if (!MSDS.courseOfferedInSemester(course, activeSemester)) {
        const terms = MSDS.courseTerms(course);
        MSDS.showToast(`该课程在 ${terms.join(" / ") || "其他"} 学期开设，请切换到对应学期`);
        return;
      }
      selections[code] = selectionForPrimary(course, primaryCrn, tutorialCrn);
      MSDS.showToast(`已加入 ${code}`);
    }
    renderAll();
  }

  function switchCollege(key) {
    if (key === activeCollege) return;
    activeCollege = key;
    const depts = departments();
    activeDepartment = depts.length ? depts[0].key : "";
    const progs = departmentProgrammes();
    if (progs.length && !progs.some((p) => p.code === activeProgramme)) {
      const first = progs.find((p) => p.data_ready !== false);
      if (first) activeProgramme = first.code;
    }
    MSDS.saveProgramme(activeProgramme);
    renderProgrammePills();
    refreshAfterProgrammeChange();
  }

  function switchDepartment(key) {
    if (key === activeDepartment) return;
    activeDepartment = key;
    const progs = departmentProgrammes();
    if (progs.length && !progs.some((p) => p.code === activeProgramme)) {
      const first = progs.find((p) => p.data_ready !== false);
      if (first) activeProgramme = first.code;
    }
    MSDS.saveProgramme(activeProgramme);
    renderProgrammePills();
    refreshAfterProgrammeChange();
  }

  function refreshAfterProgrammeChange() {
    reloadSelections();
    applyDefaultSelections();
    renderProgrammeStats();
    renderAll();
    MSDS.showToast(`已切换至 ${currentProgramme().name_zh}`);
  }

  // ==================== 课表导出为图片型 PDF ====================
  // 用 Canvas 按周课表网格绘制当前学期课表，导出单页图片型 PDF（无第三方依赖）
  function exportTimetableAsPdf() {
    const events = selectedEvents();
    if (!events.length) {
      MSDS.showToast("当前学期还没有加入课程，无法导出 PDF");
      return;
    }

    const canvas = document.createElement("canvas");
    const scale = 2;
    const colWidth = 200;
    const hourHeight = 92;
    const headerHeight = 110;
    const titleHeight = 78;
    const timeColWidth = 72;
    const canvasHeight = Math.ceil((headerHeight + titleHeight + (END_HOUR - START_HOUR) * hourHeight) / 10) * 10;
    const canvasWidth = Math.ceil((timeColWidth + DAYS.length * colWidth) / 10) * 10;
    canvas.width = canvasWidth * scale;
    canvas.height = canvasHeight * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    // 背景
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 标题区
    ctx.fillStyle = "#2B2822";
    ctx.font = "700 26px 'Source Serif 4','Noto Serif SC',serif";
    ctx.textBaseline = "middle";
    const progName = currentProgramme().name_zh || currentProgramme().name_en;
    ctx.fillText(`CityU 课表 · ${progName}（${activeSemester}）`, 24, 34);
    ctx.font = "400 15px 'Inter','Noto Sans SC',sans-serif";
    ctx.fillStyle = "#6E6A5F";
    ctx.fillText(`Programme: ${activeProgramme} · Semester: ${activeSemester} · ${new Date().toLocaleDateString("zh-CN")}`, 24, 62);

    const gridTop = titleHeight;
    // 表头
    ctx.fillStyle = "#F5F3ED";
    ctx.fillRect(0, gridTop, canvasWidth, headerHeight);
    ctx.fillStyle = "#2B2822";
    ctx.font = "700 17px 'Inter','Noto Sans SC',sans-serif";
    ctx.fillText("GMT+8", timeColWidth / 2, gridTop + headerHeight / 2);
    DAYS.forEach((day, index) => {
      const x = timeColWidth + index * colWidth;
      ctx.fillStyle = "#FAF9F5";
      ctx.fillRect(x, gridTop, colWidth, headerHeight);
      ctx.fillStyle = "#2B2822";
      ctx.textAlign = "center";
      ctx.font = "700 18px 'Inter','Noto Sans SC',sans-serif";
      ctx.fillText(MSDS.DAY_NAMES[day], x + colWidth / 2, gridTop + 32);
      ctx.font = "500 13px 'Inter',sans-serif";
      ctx.fillStyle = "#9A958A";
      ctx.fillText(day, x + colWidth / 2, gridTop + 58);
      ctx.textAlign = "left";
    });

    // 时间轴与网格线
    for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
      const y = gridTop + headerHeight + (hour - START_HOUR) * hourHeight;
      ctx.strokeStyle = "#EAE7DE";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
      ctx.fillStyle = "#6E6A5F";
      ctx.font = "500 12px 'Inter',sans-serif";
      ctx.fillText(`${String(hour).padStart(2, "0")}:00`, 8, y + 16);
    }
    DAYS.forEach((day, index) => {
      const x = timeColWidth + index * colWidth;
      ctx.strokeStyle = "#EAE7DE";
      ctx.beginPath();
      ctx.moveTo(x, gridTop + headerHeight);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    });

    // 课程块
    events.forEach((event) => {
      const dayIndex = DAYS.indexOf(event.section.day);
      if (dayIndex < 0) return;
      const x = timeColWidth + dayIndex * colWidth + event.lane * (colWidth / event.laneCount);
      const y = gridTop + headerHeight + ((event.start - START_HOUR * 60) / 60) * hourHeight;
      const height = Math.max(26, ((event.end - event.start) / 60) * hourHeight);
      const width = colWidth / event.laneCount;
      ctx.fillStyle = event.color[0];
      ctx.fillRect(x + 2, y + 2, width - 4, height - 4);
      ctx.fillStyle = event.color[2];
      ctx.font = "700 13px 'Inter',sans-serif";
      ctx.fillText(`${event.course.code} · ${event.section.section}`, x + 8, y + 16);
      ctx.font = "500 11px 'Inter',sans-serif";
      ctx.fillText(event.section.time, x + 8, y + 33);
      const room = [event.section.building, event.section.room].filter(Boolean).join(" ");
      if (room) ctx.fillText(room, x + 8, y + 50);
    });

    // 转 JPEG → 手写最小 PDF（单页图片型）
    const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const jpegBase64 = jpegDataUrl.split(",")[1];
    // 注意：canvas 经 ctx.scale(scale,scale) 绘制后，位图像素尺寸是 canvas.width × canvas.height（已乘 scale），
    // 必须传入物理尺寸，否则 PDF 中 /Width //Height 与 JPEG 实际采样点数不符，阅读器会渲染成灰屏/空白。
    const pdfBytes = jpegImageToPdf(jpegBase64, canvas.width, canvas.height);

    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const fileName = `cityu-timetable-${activeProgramme}-${activeSemester}-${new Date().toISOString().slice(0, 10)}.pdf`;
    const file = new File([blob], fileName, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: "CityU 课表 PDF" }).catch(() => {});
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
    MSDS.showToast("已导出课表 PDF（图片型）");
  }

  // 将 JPEG 图片（base64）打包为单页 PDF（PDF 1.4 最小结构，DCTDecode 内嵌图片）
  function jpegImageToPdf(jpegBase64, widthPx, heightPx) {
    const binary = atob(jpegBase64);
    const imgData = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) imgData[i] = binary.charCodeAt(i);

    const wPt = 595; // A4 宽（pt）
    const hPt = Math.round(wPt * (heightPx / widthPx));

    // 兼容无 TextEncoder 的环境：用 charCodeAt 逐字节编码
    const enc = (s) => {
      const bytes = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
      return bytes;
    };
    const content = `q ${wPt} 0 0 ${hPt} 0 0 cm /Im0 Do Q`;

    // 对象：1 Catalog, 2 Pages, 3 Page, 4 Contents, 5 Image
    const objects = [];
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
    objects[3] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`;
    objects[4] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    objects[5] = `<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgData.length} >>\nstream\n`;

    let pdf = new Uint8Array(1024 + imgData.length + 2048);
    let pos = 0;
    const offsets = [];

    function write(bytes) {
      if (pos + bytes.length > pdf.length) {
        const bigger = new Uint8Array(Math.max(pdf.length * 2, pos + bytes.length + 4096));
        bigger.set(pdf);
        pdf = bigger;
      }
      pdf.set(bytes, pos);
      pos += bytes.length;
    }

    write(enc("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"));
    for (let i = 1; i <= 5; i++) {
      offsets[i] = pos;
      write(enc(`${i} 0 obj\n`));
      write(enc(objects[i]));
      if (i === 5) {
        write(imgData);
        write(enc("\nendstream"));
      }
      write(enc("\nendobj\n"));
    }
    const xrefPos = pos;
    write(enc("xref\n0 6\n0000000000 65535 f \n"));
    for (let i = 1; i <= 5; i++) {
      write(enc(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`));
    }
    write(enc(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`));
    return pdf.slice(0, pos);
  }

  function switchProgramme(code) {
    if (code === activeProgramme) return;
    const available = programmes.find((p) => p.code === code);
    const hasCourses = courses.some((course) => MSDS.courseProgrammes(course, data).includes(code));
    if (!available || !hasCourses) {
      MSDS.showToast("该项目的课程数据待补充");
      return;
    }
    activeProgramme = code;
    MSDS.saveProgramme(code);
    reloadSelections();
    applyDefaultSelections();
    renderProgrammePills();
    renderProgrammeStats();
    renderAll();
    MSDS.showToast(`已切换至 ${currentProgramme().name_zh}`);
  }

  function bindEvents() {
    document.getElementById("course-search").addEventListener("input", (event) => {
      searchTerm = event.target.value.trim();
      renderCourseList();
    });

    document.querySelector(".filter-row")?.addEventListener("click", (event) => {
      const button = event.target.closest(".filter-pill");
      if (!button) return;
      activeFilter = button.dataset.filter;
      document.querySelectorAll(".filter-pill").forEach((item) => item.classList.toggle("active", item === button));
      renderCourseList();
    });

    document.querySelectorAll(".day-filter-pill").forEach((button) => {
      button.addEventListener("click", () => {
        activeDay = button.dataset.dayFilter;
        document.querySelectorAll(".day-filter-pill").forEach((item) => item.classList.toggle("active", item === button));
        renderCourseList();
      });
    });

    document.getElementById("term-filter-row")?.addEventListener("click", (event) => {
      const button = event.target.closest(".term-filter-pill");
      if (!button) return;
      activeSemesterFilter = button.dataset.termFilter;
      document.querySelectorAll("#term-filter-row .term-filter-pill").forEach((item) => item.classList.toggle("active", item === button));
      renderCourseList();
    });

    document.querySelectorAll(".segment").forEach((button) => {
      button.addEventListener("click", () => {
        const selectedPanel = button.dataset.panel;
        document.querySelectorAll(".segment").forEach((item) => {
          const active = item === button;
          item.classList.toggle("active", active);
          item.setAttribute("aria-selected", String(active));
        });
        document.getElementById("browse-panel").hidden = selectedPanel !== "browse";
        document.getElementById("selected-panel").hidden = selectedPanel !== "selected";
      });
    });

    document.getElementById("programme-pills").addEventListener("click", (event) => {
      const pill = event.target.closest("[data-programme]");
      if (pill) switchProgramme(pill.dataset.programme);
    });

    const collegePills = document.getElementById("college-pills");
    if (collegePills) collegePills.addEventListener("click", (event) => {
      const pill = event.target.closest("[data-college]");
      if (pill) switchCollege(pill.dataset.college);
    });

    const departmentPills = document.getElementById("department-pills");
    if (departmentPills) departmentPills.addEventListener("click", (event) => {
      const pill = event.target.closest("[data-department]");
      if (pill) switchDepartment(pill.dataset.department);
    });

    listElement.addEventListener("click", (event) => {
      const button = event.target.closest("[data-code]");
      if (!button) return;
      const row = button.closest(".course-row");
      const sectionSelect = row?.querySelector("[data-quick-section]");
      const tutorialSelect = row?.querySelector("[data-quick-tutorial]");
      toggleCourse(button.dataset.code, sectionSelect?.value, tutorialSelect?.value);
    });

    listElement.addEventListener("change", (event) => {
      const sectionSelect = event.target.closest("[data-quick-section]");
      const tutorialSelect = event.target.closest("[data-quick-tutorial]");
      const select = sectionSelect || tutorialSelect;
      if (!select) return;
      const code = sectionSelect ? select.dataset.quickSection : select.dataset.quickTutorial;
      if (!selections[code]) return;
      const course = courseByCode(code);
      if (sectionSelect) {
        selections[course.code] = selectionForPrimary(course, select.value);
      } else {
        selections[course.code].tutorialCrn = select.value || null;
      }
      renderAll();
      MSDS.showToast(`已切换 ${course.code} 班次`);
    });

    selectedListElement.addEventListener("change", (event) => {
      const select = event.target.closest("select[data-code]");
      if (!select) return;
      const code = select.dataset.code;
      const course = courseByCode(code);
      if (!course || !selections[code]) return;
      if (select.dataset.kind === "primary") {
        selections[code] = selectionForPrimary(course, select.value);
      } else {
        selections[code].tutorialCrn = select.value || null;
      }
      renderAll();
    });

    document.getElementById("day-columns").addEventListener("click", (event) => {
      const removeButton = event.target.closest("[data-event-remove]");
      if (removeButton) {
        event.stopPropagation();
        toggleCourse(removeButton.dataset.eventRemove);
        return;
      }
      if (event.target.closest("[data-event-link]")) return;
      const block = event.target.closest("[data-event-code]");
      if (block) window.location.href = `course.html?code=${encodeURIComponent(block.dataset.eventCode)}`;
    });

    document.getElementById("day-columns").addEventListener("keydown", (event) => {
      const block = event.target.closest("[data-event-code]");
      if (!block || (event.key !== "Enter" && event.key !== " ")) return;
      if (event.target.closest("[data-event-remove]") || event.target.closest("[data-event-link]")) return;
      event.preventDefault();
      window.location.href = `course.html?code=${encodeURIComponent(block.dataset.eventCode)}`;
    });

    document.getElementById("clear-selection").addEventListener("click", () => {
      selections = {};
      renderAll();
      MSDS.showToast("课表已清空");
    });

    document.querySelectorAll("[data-semester-switch]").forEach((button) => {
      button.addEventListener("click", () => switchSemester(button.dataset.semesterSwitch));
    });

    document.getElementById("export-pdf").addEventListener("click", exportTimetableAsPdf);
  }

  MSDS.loadCourseData().then((loadedData) => {
    data = loadedData;
    courses = data.courses;
    programmes = MSDS.getProgrammes(data);
    reloadSelections();
    // 默认展开当前项目所在的学院与院系，避免级联行初始为空
    const startingProgramme = currentProgramme();
    activeCollege = startingProgramme.college_en || "College of Computing";
    activeDepartment = startingProgramme.department_en || startingProgramme.department || "Department";
    renderProgrammePills();
    renderProgrammeStats();
    renderTimeAxis();
    bindEvents();
    applyDefaultSelections();
    updateSemesterSwitchUI();
    renderAll();
  }).catch((error) => {
    listElement.innerHTML = `<div class="empty-list">${MSDS.escapeHtml(error.message)}<br>请通过本地服务器打开网站。</div>`;
  });
})();
