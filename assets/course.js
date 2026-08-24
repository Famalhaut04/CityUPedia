(function () {
  "use strict";

  const detail = document.getElementById("course-detail");
  const code = new URLSearchParams(window.location.search).get("code")?.toUpperCase();
  const fromReviews = new URLSearchParams(window.location.search).get("from") === "reviews";
  const backHref = fromReviews ? "reviews.html" : "index.html";
  const backLabel = fromReviews ? "← 返回课程评价" : "← 返回课程表";

  function fact(label, value) {
    return `<div class="fact"><span>${MSDS.escapeHtml(label)}</span><strong>${MSDS.escapeHtml(value || "无")}</strong></div>`;
  }

  // 评价星级选择器：5 个可点击的星，支持悬停预览与点击选择
  function ratingPickerHTML(current, readOnly) {
    const stars = [1, 2, 3, 4, 5].map((value) => {
      const filled = current >= value ? "is-filled" : "";
      const label = readOnly ? "" : `aria-label="评分 ${value} 星"`;
      return `<button type="button" class="rate-star ${filled}" data-rate="${value}" ${label} ${readOnly ? "disabled" : ""}>★</button>`;
    }).join("");
    return `<div class="rating-picker" role="radiogroup" aria-label="课程评分">${stars}</div>`;
  }

  function renderCourse(data, course, courseDocument) {
    const rec = MSDS.getRecommendation(course);
    const sourceStore = data.sources || {};
    const sourceReviewStore = data.sourceReviews || {};
    const sources = (rec.source_ids || rec.sourceIds || []).map((id) => {
      const source = sourceStore[id];
      if (!source) return null;
      return {
        ...source,
        id,
        review: String(sourceReviewStore[id]?.course_reviews?.[course.code] || "").trim()
      };
    }).filter(Boolean);
    // 有原文摘录的来源排在前面：部分来源尚未逐课整理原文，此时只展示标题与原文链接
    sources.sort((a, b) => Number(Boolean(b.review)) - Number(Boolean(a.review)));
    const currentProgramme = MSDS.getStoredProgramme() || MSDS.DEFAULT_PROGRAMME;
    const courseProgrammes = MSDS.courseProgrammes(course, data);
    const belongsToCurrent = courseProgrammes.includes(currentProgramme);
    const displayProgramme = belongsToCurrent ? currentProgramme : (courseProgrammes[0] || MSDS.DEFAULT_PROGRAMME);
    const displayRequirementType = MSDS.getRequirementType(course, displayProgramme);
    const displayGroupInfo = MSDS.getElectiveGroupInfo(MSDS.getProgramme(data, displayProgramme), MSDS.getElectiveGroup(course, displayProgramme));
    const activeSemester = MSDS.getStoredSemester ? MSDS.getStoredSemester() : "SemA";
    const offeredHere = MSDS.courseOfferedInSemester ? MSDS.courseOfferedInSemester(course, activeSemester) : true;
    const selections = MSDS.getStoredSelections(currentProgramme, activeSemester);
    const isAdded = Boolean(selections[course.code]);
    const myReview = MSDS.getCourseReview(course.code);
    let added = isAdded;
    // 原始记录：一个班次可能对应多条“每周上课时间”（如一周两次课），表格需要逐条展示
    const primaries = course.eligible_sections.filter((section) => Number(section.credits) > 0);
    const tutorials = course.eligible_sections.filter((section) => Number(section.credits) === 0);
    // 去重后的 tutorial 列表：用于挑选默认值（同一 tutorial 的多次上课时间不算多个选项）
    const tutorialOptions = MSDS.uniqueByKey(tutorials);
    const defaultPrimary = MSDS.uniqueByKey(primaries)[0] || course.eligible_sections[0];
    const defaultTutorial = MSDS.pickTutorial(defaultPrimary, tutorialOptions);
    let chosenTutorialCrn = selections[course.code]?.tutorialCrn
      ?? (defaultTutorial ? MSDS.sectionKey(defaultTutorial) : null);
    const instructors = [...new Set(course.eligible_sections.map((section) => section.instructor).filter(Boolean))].join("；");
    const webStatus = course.eligible_sections.some((section) => section.web === "Y") ? "有班次可网页注册" : "不可正常网页注册，请联系课程单位";
    const titleNote = course.title_changed ? `本学期课表名称：${course.schedule_title}` : "课程名称与课表一致";
    const rating = MSDS.ratingStars(rec);
    const programmeBadges = courseProgrammes.map((pCode) => {
      const programme = MSDS.getProgramme(data, pCode);
      const type = MSDS.getRequirementType(course, pCode);
      return `<span class="programme-badge" title="${MSDS.escapeHtml(programme.name_en)}">${MSDS.escapeHtml(programme.code)}<small>${type === "core" ? "核心" : "选修"}</small></span>`;
    }).join("");

    document.title = `${course.code} ${course.programme_title} · CityU Pedia`;
    detail.innerHTML = `
      <a class="back-link" href="${backHref}">${backLabel}</a>
      <section class="detail-hero">
        <div>
          <div class="detail-code-row">
            <span class="detail-code">${MSDS.escapeHtml(course.code)}</span>
            ${displayRequirementType === "core" ? '<span class="verdict-badge core">核心课</span>' : MSDS.recommendationBadge(rec)}
            ${MSDS.courseTerms(course).map((term) => `<span class="mini-badge term ${MSDS.termBadgeClass(term)}">${MSDS.escapeHtml(term)}</span>`).join("")}
          </div>
          <h1>${MSDS.escapeHtml(course.programme_title)}</h1>
          <p>${course.credits} 学分 · ${MSDS.escapeHtml(course.remarks)} · ${MSDS.escapeHtml(titleNote)}</p>
          ${programmeBadges ? `<div class="programme-badges">${programmeBadges}</div>` : ""}
        </div>
        <div class="detail-actions">
          ${offeredHere
            ? `<button id="detail-add" class="button ${isAdded ? "button-quiet" : "button-primary"}" type="button">${isAdded ? "已加入课表" : "加入课表"}</button>`
            : `<button id="detail-add" class="button button-quiet" type="button" disabled>本学期未开设</button>`}
          <a class="button button-quiet" href="index.html">查看课表</a>
          <a class="button button-reviews" href="#course-reviews">课程评价</a>
          ${courseDocument?.translation ? `<a class="button button-document" href="syllabus.html?code=${encodeURIComponent(course.code)}">查看详细课程介绍</a>` : ""}
          ${courseDocument ? `<a class="button button-document" href="${MSDS.escapeHtml(courseDocument.pdf)}" download>课程详情 PDF</a>` : ""}
        </div>
      </section>

      <div class="detail-layout">
        <div>
          <section class="detail-section">
            <h2>学生经验摘要</h2>
            <div class="review-lead ${MSDS.escapeHtml(rec.level)}">
              <strong>${MSDS.escapeHtml(rec.verdict)}</strong>
              ${rating ? `<div class="review-rating">${rating}</div>` : ""}
              <p>${MSDS.escapeHtml(rec.summary)}</p>
              ${rec.tags.length ? `<div class="tag-list detail-tags">${rec.tags.map((tag) => `<span class="tag">${MSDS.escapeHtml(tag)}</span>`).join("")}</div>` : ""}
            </div>
          </section>

          <section class="detail-section my-review-section">
            <h2>提交评价</h2>
            <p class="my-review-hint">${MSDS.larkReviewsEnabled() ? "填写下方表单提交你的课程评价，提交后由 CSSA 管理员审核通过后展示。" : "评分与评语仅保存在当前浏览器本地，仅供自己参考（云端共享未启用）。"}</p>
            ${MSDS.larkReviewsEnabled() ? `
            <iframe src="${MSDS.escapeHtml(window.LARK_CONFIG.formUrl)}" style="width:100%;height:680px;border:none;min-height:480px;" title="课程评价表单" allow="clipboard-read;clipboard-write"></iframe>
            <p class="my-review-hint" style="margin-top:0.5rem;">表单由飞书提供，填写后数据进入审核流程。</p>
            ` : `
            <div class="my-review-form">
              <div class="my-review-stars">
                <span class="my-review-label">课程评分</span>
                ${ratingPickerHTML(myReview?.rating || 0, false)}
                <span class="my-review-score" id="my-review-score">${myReview?.rating ? `${myReview.rating} 星` : "未评分"}</span>
              </div>
              <label class="my-review-comment-label" for="my-review-comment">课程评语（选填）</label>
              <textarea id="my-review-comment" class="my-review-comment" rows="4" maxlength="500" placeholder="写下你的课程感受、上课体验或避坑建议…">${myReview ? MSDS.escapeHtml(myReview.comment) : ""}</textarea>
              <div class="my-review-actions">
                <button id="my-review-save" class="button button-primary" type="button">${myReview ? "更新评价" : "保存评价"}</button>
                <button id="my-review-remove" class="button button-quiet" type="button" ${myReview ? "" : "hidden"}>删除评价</button>
                <span class="my-review-saved" id="my-review-saved" hidden></span>
              </div>
            </div>`}
          </section>

          <section class="detail-section cloud-reviews-section" id="course-reviews">
            <h2>课程评价</h2>
            <p class="my-review-hint">${MSDS.cloudReviewsEnabled() ? "所有使用者的共享评价，定期同步自审核数据库。" : "云端共享未启用，暂无法查看其他使用者的评价。"}</p>
            ${MSDS.cloudReviewsEnabled() && !MSDS.larkReviewsEnabled() ? `
            <div class="admin-panel" id="admin-panel">
              <form class="admin-login-form" id="admin-login-form">
                <strong class="admin-panel-title">管理员登录</strong>
                <input id="admin-email" type="email" autocomplete="username" placeholder="管理员邮箱" required>
                <input id="admin-password" type="password" autocomplete="current-password" placeholder="密码" required>
                <button class="button button-primary button-small" type="submit">登录</button>
                <span class="admin-panel-status" id="admin-status"></span>
              </form>
              <div class="admin-logged" id="admin-logged" hidden>
                <strong class="admin-panel-title">管理员模式</strong>
                <span class="admin-panel-email" id="admin-email-label"></span>
                <button class="button button-quiet button-small" type="button" id="admin-logout">退出</button>
              </div>
            </div>` : ""}
            <div id="cloud-reviews" class="cloud-reviews-list">
              <div class="cloud-reviews-loading">正在加载课程评价…</div>
            </div>
          </section>

          <section class="detail-section">
            <h2>课程事实</h2>
            <div class="fact-grid">
              ${fact("课程类型", displayRequirementType === "core"
                ? "核心课"
                : (displayGroupInfo ? `选修课（${displayGroupInfo.label_zh}）` : "选修课"))}
              ${fact("所属项目", courseProgrammes.map((pCode) => MSDS.getProgramme(data, pCode).code).join("、"))}
              ${fact("先修要求", course.prerequisites === "Nil" ? "无" : course.prerequisites)}
              ${fact("互斥课程", course.exclusive_course === "Nil" ? "无" : course.exclusive_course)}
              ${fact("授课语言", course.summary?.medium)}
              ${fact("授课教师", instructors)}
              ${fact("注册状态", webStatus)}
            </div>
          </section>

          <section class="detail-section">
            <h2>可选班次</h2>
            <div class="section-table-wrap">
              <table class="section-table">
                <thead><tr>${tutorials.length ? "<th>选择</th>" : ""}<th>班次</th><th>时间</th><th>地点</th><th>教师</th><th>CRN / 注册</th></tr></thead>
                <tbody>${(() => {
                  const seenTutorialKeys = new Set();
                  return course.eligible_sections.map((section) => {
                    const isFirstTutorialMeeting = Number(section.credits) === 0 && !seenTutorialKeys.has(MSDS.sectionKey(section));
                    if (isFirstTutorialMeeting) seenTutorialKeys.add(MSDS.sectionKey(section));
                    const restricted = MSDS.sectionRestrictedProgrammes(section);
                    return `
                  <tr>
                    ${tutorials.length ? `<td>${isFirstTutorialMeeting ? `<input type="radio" class="tutorial-pick" name="tutorial-pick" value="${MSDS.escapeHtml(MSDS.sectionKey(section))}" ${MSDS.sectionKey(section) === String(chosenTutorialCrn) ? "checked" : ""}>` : ""}</td>` : ""}
                    <td><strong>${MSDS.escapeHtml(section.section)}</strong><span>${Number(section.credits) === 0 ? "Tutorial · 0 学分" : `${section.credits} 学分`}</span>${restricted.length ? `<span class="section-restriction">仅限：${MSDS.escapeHtml(restricted.join("、"))}</span>` : ""}</td>
                    <td><strong>${MSDS.escapeHtml(MSDS.DAY_NAMES[section.day] || section.day)} ${MSDS.escapeHtml(section.time)}</strong><span>${MSDS.escapeHtml(section.date)}</span></td>
                    <td><strong>${MSDS.escapeHtml([section.building, section.room].filter(Boolean).join(" "))}</strong></td>
                    <td><strong>${MSDS.escapeHtml(section.instructor)}</strong></td>
                    <td><strong>${MSDS.escapeHtml(section.crn)}</strong><span>${section.web === "Y" ? "可网页注册" : "WEB=N"}</span></td>
                  </tr>`;
                  }).join("");
                })()}</tbody>
              </table>
            </div>
          </section>

          <section class="detail-section source-section">
            <h2>原始来源与评价原文</h2>
            <p class="source-section-intro">以下内容按课程从原始帖子中摘录，保留原作者信息与措辞，仅整理换行和标点；无关课程、话题标签和无关评论未收录。</p>
            ${sources.length ? `<div class="source-list">${sources.map((source) => `
              <article class="source-review">
                <div class="source-review-header">
                  <div>
                    <strong>${MSDS.escapeHtml(source.title)}</strong>
                    <span>${MSDS.escapeHtml(source.platform)} · 学生经验</span>
                  </div>
                  <a class="source-review-link" href="${MSDS.escapeHtml(source.url)}" target="_blank" rel="noreferrer">查看原文</a>
                </div>
                ${source.review
                  ? `<p>${MSDS.escapeHtml(source.review)}</p>`
                  : '<p class="source-review-pending">本站尚未整理这条来源中与本课程相关的原文摘录，可点击「查看原文」阅读原帖。</p>'}
              </article>`).join("")}</div>` : '<div class="notice source-empty">本地资料暂未找到可核对的学生评价来源。</div>'}
            <div class="notice source-notice"><strong>阅读提示：</strong>学生经验对应往届课程，考核方式、教师与难度可能变化。当前班次事实来自 ${MSDS.escapeHtml(data.schedule_as_of || "课表快照")} 的 AIMS 课表快照。</div>
          </section>
        </div>
      </div>`;

    document.getElementById("detail-add").addEventListener("click", () => {
      // 学期隔离：不在当前学期开设的课程禁止加入
      if (!offeredHere) {
        const terms = MSDS.courseTerms(course);
        MSDS.showToast(`该课程在 ${terms.join(" / ") || "其他"} 学期开设，请切换到对应学期`);
        return;
      }
      const programme = belongsToCurrent ? currentProgramme : courseProgrammes[0];
      if (!programme) {
        MSDS.showToast("该课程暂无归属项目");
        return;
      }
      const current = MSDS.getStoredSelections(programme, activeSemester);
      if (current[course.code]) {
        // 已加入：再次点击取消选择
        delete current[course.code];
        MSDS.saveSelections(current, programme, activeSemester);
        added = false;
        const button = document.getElementById("detail-add");
        button.textContent = "加入课表";
        button.className = "button button-primary";
        MSDS.showToast(`已取消选择 ${course.code}`);
        return;
      }
      current[course.code] = MSDS.makeDefaultSelection(course);
      if (chosenTutorialCrn) {
        current[course.code].tutorialCrn = chosenTutorialCrn;
      }
      MSDS.saveSelections(current, programme, activeSemester);
      if (!belongsToCurrent) {
        MSDS.saveProgramme(programme);
      }
      added = true;
      const button = document.getElementById("detail-add");
      button.textContent = "已加入课表";
      button.className = "button button-quiet";
      MSDS.showToast(`已加入 ${course.code}（${programme}）`);
    });

    // ============ 我的评价：星级选择、保存、删除 ============
    // Lark 模式下评价表单改为 iframe，以下逻辑跳过
    const larkMode = MSDS.larkReviewsEnabled();
    let chosenRating = myReview?.rating || 0;
    const scoreEl = document.getElementById("my-review-score");
    const starsContainer = document.querySelector(".rating-picker");

    // 登录状态横幅：未登录提示去登录；已登录显示账号与退出按钮
    function renderAuthBanner() {
      if (larkMode) return;
      const banner = document.getElementById("course-auth-banner");
      if (!banner) return;
      const student = MSDS.currentStudent ? MSDS.currentStudent() : null;
      const admin = MSDS.currentAdmin ? MSDS.currentAdmin() : null;
      if (admin) {
        banner.innerHTML = `
          <span class="auth-banner-user">管理员已登录：<strong>${MSDS.escapeHtml(admin.email)}</strong></span>
          <button class="button button-quiet button-small" type="button" id="auth-admin-logout">退出登录</button>`;
        const btn = document.getElementById("auth-admin-logout");
        if (btn) btn.addEventListener("click", () => {
          MSDS.adminLogout();
          MSDS.showToast("已退出管理员登录");
          renderAuthBanner();
          loadCloudReviews(true);
        });
        return;
      }
      if (student) {
        const nickname = MSDS.getStoredUserNickname ? MSDS.getStoredUserNickname() : "";
        const name = nickname || student.email.split("@")[0];
        banner.innerHTML = `
          <span class="auth-banner-user">学生已登录：<strong>${MSDS.escapeHtml(name)}</strong>（${MSDS.escapeHtml(student.email)}）</span>
          <button class="button button-quiet button-small" type="button" id="auth-student-logout">退出登录</button>`;
        const btn = document.getElementById("auth-student-logout");
        if (btn) btn.addEventListener("click", () => {
          MSDS.studentLogout();
          MSDS.showToast("已退出登录");
          renderAuthBanner();
          loadCloudReviews(true);
        });
        return;
      }
      const next = encodeURIComponent(`course.html?code=${encodeURIComponent(course.code)}#course-reviews`);
      banner.innerHTML = `
        <span class="auth-banner-user">未登录：提交评价需登录账号</span>
        <a class="button button-primary button-small" href="login.html?next=${next}">去登录</a>`;
    }

    renderAuthBanner();

    function refreshStarState() {
      starsContainer.querySelectorAll(".rate-star").forEach((star) => {
        star.classList.toggle("is-filled", Number(star.dataset.rate) <= chosenRating);
      });
      scoreEl.textContent = chosenRating ? `${chosenRating} 星` : "未评分";
    }

    if (starsContainer && !larkMode) {
      starsContainer.addEventListener("click", (event) => {
        const star = event.target.closest(".rate-star");
        if (!star || star.disabled) return;
        chosenRating = Number(star.dataset.rate);
        refreshStarState();
      });
      starsContainer.addEventListener("mouseover", (event) => {
        const star = event.target.closest(".rate-star");
        if (!star || star.disabled) return;
        starsContainer.querySelectorAll(".rate-star").forEach((s) => {
          s.classList.toggle("is-hover", Number(s.dataset.rate) <= Number(star.dataset.rate));
        });
      });
      starsContainer.addEventListener("mouseout", () => {
        starsContainer.querySelectorAll(".rate-star").forEach((s) => s.classList.remove("is-hover"));
      });
    }

    const saveBtn = document.getElementById("my-review-save");
    if (saveBtn && !larkMode) {
    saveBtn.addEventListener("click", () => {
      if (!chosenRating) {
        MSDS.showToast("请先选择星级评分");
        return;
      }
      const comment = document.getElementById("my-review-comment").value.trim();
      MSDS.saveCourseReview(course.code, { rating: chosenRating, comment });
      const savedEl = document.getElementById("my-review-saved");
      savedEl.textContent = `已保存于 ${new Date().toLocaleString("zh-CN", { hour12: false })}`;
      savedEl.hidden = false;
      // 首次保存后立即切换成“已有评价”状态，无需刷新页面才能看到删除按钮
      document.getElementById("my-review-save").textContent = "更新评价";
      document.getElementById("my-review-remove").hidden = false;
      MSDS.showToast(`已保存 ${course.code} 的评价`);
      // 云端共享：若已启用 Supabase，同步提交到云端并刷新“课程评价”
      if (MSDS.cloudReviewsEnabled()) {
        const nicknameEl = document.getElementById("my-review-nickname");
        const nickname = nicknameEl ? nicknameEl.value.trim() : "";
        MSDS.submitCloudReview(course.code, { rating: chosenRating, comment, nickname })
          .then(() => {
            MSDS.showToast(`已同步到云端，感谢分享！`);
            loadCloudReviews(true);
          })
          .catch((error) => {
            if (String(error.message).includes("请先登录")) {
              // 未登录：提示并跳转登录页（登录后回跳本课程评价区）
              MSDS.showToast("登录后才能提交云端评价");
              window.location.href = `login.html?next=${encodeURIComponent(`course.html?code=${encodeURIComponent(course.code)}#course-reviews`)}`;
              return;
            }
            savedEl.textContent = `本地已保存，但云端同步失败：${error.message}`;
          });
      }
    });
    }

    const removeBtn = document.getElementById("my-review-remove");
    if (removeBtn && !larkMode) {
    removeBtn.addEventListener("click", () => {
      if (!window.confirm(`确定删除 ${course.code} 的个人评价吗？`)) return;
      MSDS.removeCourseReview(course.code);
      chosenRating = 0;
      document.getElementById("my-review-comment").value = "";
      refreshStarState();
      document.getElementById("my-review-remove").hidden = true;
      const saveButton = document.getElementById("my-review-save");
      saveButton.textContent = "保存评价";
      const savedEl = document.getElementById("my-review-saved");
      savedEl.hidden = true;
      savedEl.textContent = "";
      MSDS.showToast("已删除评价");
    });
    }

    document.querySelectorAll(".tutorial-pick").forEach((radio) => {
      radio.addEventListener("change", (event) => {
        chosenTutorialCrn = event.target.value;
        if (!added) return;
        const programme = belongsToCurrent ? currentProgramme : courseProgrammes[0];
        const current = MSDS.getStoredSelections(programme, activeSemester);
        if (!current[course.code]) return;
        current[course.code].tutorialCrn = chosenTutorialCrn;
        MSDS.saveSelections(current, programme, activeSemester);
        const section = MSDS.findSection(course, chosenTutorialCrn);
        MSDS.showToast(section ? `已切换到 ${section.section}` : "已切换 Tutorial");
      });
    });

    // ============ 课程评价：加载并渲染云端共享评价 ============
    // 删除权限：本人（登录学生 user_id 或 user_key 匹配）可删自己的评价；管理员登录后任意评价可删
    function cloudReviewCard(item) {
      const stars = "★".repeat(Math.max(0, Math.min(5, Number(item.rating) || 0))) + "☆".repeat(Math.max(0, 5 - Math.min(5, Number(item.rating) || 0)));
      const when = new Date(item.created_at).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
      const student = MSDS.currentStudent ? MSDS.currentStudent() : null;
      const isMine = !larkMode && ((student && student.userId && item.user_id && String(item.user_id) === String(student.userId))
        || (MSDS.getUserKey() && item.user_key && item.user_key === MSDS.getUserKey()));
      const isAdmin = !larkMode && MSDS.isAdminLoggedIn();
      const canDelete = isMine || isAdmin;
      const deleteLabel = isAdmin && !isMine ? "管理员删除" : "删除";
      return `
        <article class="cloud-review-card" data-review-id="${MSDS.escapeHtml(String(item.id))}">
          <div class="cloud-review-head">
            <span class="cloud-review-stars" aria-label="${Number(item.rating)} 星">${stars}</span>
            <span class="cloud-review-score">${Number(item.rating)} 星</span>
            <span class="cloud-review-nickname">${MSDS.escapeHtml(item.nickname || "匿名")}${isMine ? '<span class="cloud-review-mine">我</span>' : ""}</span>
            <span class="cloud-review-time">${MSDS.escapeHtml(when)}</span>
            ${canDelete ? `<button class="cloud-review-delete" type="button" data-delete="${MSDS.escapeHtml(String(item.id))}">${deleteLabel}</button>` : ""}
          </div>
          ${item.course_professor ? `<p class="cloud-review-professor">授课教师：${MSDS.escapeHtml(item.course_professor)}</p>` : ""}
          ${item.comment ? `<p class="cloud-review-comment">${MSDS.escapeHtml(item.comment)}</p>` : '<p class="cloud-review-comment is-empty">（未填写评语）</p>'}
        </article>`;
    }

    function renderCloudReviews(rows) {
      const container = document.getElementById("cloud-reviews");
      if (!container) return;
      if (!MSDS.cloudReviewsEnabled()) {
        container.innerHTML = '<div class="notice source-empty">云端共享未启用：管理员需在 assets/cloud-config.js 中配置 Supabase 数据库地址。</div>';
        return;
      }
      if (!rows.length) {
        container.innerHTML = '<div class="notice source-empty">还没有其他使用者的共享评价，来抢首评吧！</div>';
        return;
      }
      container.innerHTML = rows.map(cloudReviewCard).join("");
    }

    function updateAdminPanel() {
      const panel = document.getElementById("admin-panel");
      if (!panel) return;
      const admin = MSDS.currentAdmin();
      const loginForm = document.getElementById("admin-login-form");
      const loggedBox = document.getElementById("admin-logged");
      const emailLabel = document.getElementById("admin-email-label");
      if (admin) {
        loginForm.hidden = true;
        loggedBox.hidden = false;
        if (emailLabel) emailLabel.textContent = admin.email;
      } else {
        loginForm.hidden = false;
        loggedBox.hidden = true;
        if (emailLabel) emailLabel.textContent = "";
      }
    }

    function bindCloudReviewDelete() {
      if (larkMode) return;
      const container = document.getElementById("cloud-reviews");
      if (!container) return;
      container.querySelectorAll("[data-delete]").forEach((button) => {
        button.addEventListener("click", async () => {
          const id = button.getAttribute("data-delete");
          if (!id) return;
          // 按钮原文案（“删除” / “管理员删除”）要留存，失败后需要原样还原
          const originalLabel = button.textContent;
          const confirmText = MSDS.isAdminLoggedIn() && originalLabel.includes("管理员") ? "删除这条评价" : "删除你提交的这条评价";
          if (!window.confirm(`确定${confirmText}吗？该操作不可恢复。`)) return;
          button.disabled = true;
          button.textContent = "删除中…";
          try {
            await MSDS.deleteCloudReview(course.code, id);
            MSDS.showToast("评价已删除");
            loadCloudReviews(true);
          } catch (error) {
            button.disabled = false;
            button.textContent = originalLabel;
            MSDS.showToast(`删除失败：${error.message}`);
          }
        });
      });
    }

    function loadCloudReviews(force) {
      const container = document.getElementById("cloud-reviews");
      if (!container) return;
      if (!MSDS.cloudReviewsEnabled()) {
        renderCloudReviews([]);
        return;
      }
      container.innerHTML = '<div class="cloud-reviews-loading">正在加载课程评价…</div>';
      MSDS.fetchCloudReviews(course.code, { force: Boolean(force) })
        .then((rows) => {
          renderCloudReviews(rows);
          bindCloudReviewDelete();
        })
        .catch((error) => {
          container.innerHTML = `<div class="notice source-empty">共享评价加载失败：${MSDS.escapeHtml(error.message)}</div>`;
        });
    }

    // 管理员登录 / 退出（Lark 模式下跳过）
    const adminPanel = document.getElementById("admin-panel");
    if (adminPanel && !larkMode) {
      const loginForm = document.getElementById("admin-login-form");
      const statusEl = document.getElementById("admin-status");
      loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const emailInput = document.getElementById("admin-email");
        const passwordInput = document.getElementById("admin-password");
        if (statusEl) {
          statusEl.textContent = "登录中…";
          statusEl.classList.remove("is-error");
        }
        try {
          const session = await MSDS.adminLogin(emailInput.value, passwordInput.value);
          if (!session.isAdmin) {
            // 登录成功但非管理员账号：不授予管理员权限（RLS 后端仍会拒绝其删除操作）
            MSDS.showToast("该账号无管理员权限");
          } else {
            MSDS.showToast("管理员登录成功");
          }
          updateAdminPanel();
          loadCloudReviews(true);
          passwordInput.value = "";
        } catch (error) {
          if (statusEl) {
            statusEl.textContent = error.message;
            statusEl.classList.add("is-error");
          }
        }
      });
      const logoutBtn = document.getElementById("admin-logout");
      logoutBtn.addEventListener("click", () => {
        MSDS.adminLogout();
        updateAdminPanel();
        loadCloudReviews(true);
        MSDS.showToast("已退出管理员模式");
      });
      updateAdminPanel();
    }

    loadCloudReviews();
  }

  if (!code) {
    detail.innerHTML = '<div class="error-state">缺少课程编号。<br><a class="text-link" href="index.html">返回课程表</a></div>';
    return;
  }

  Promise.all([
    MSDS.loadCourseData(),
    fetch("data/course-documents/index.json").then((response) => {
      if (!response.ok) throw new Error("课程介绍索引读取失败");
      return response.json();
    })
  ]).then(([data, courseDocuments]) => {
    const course = data.courses.find((item) => item.code === code);
    if (!course) throw new Error("没有找到这门课程");
    renderCourse(data, course, courseDocuments[course.code]);
    // 支持从评价中心跳转：#course-reviews 锚点定位到评价区并高亮提示
    if (window.location.hash === "#course-reviews") {
      requestAnimationFrame(() => {
        const target = document.getElementById("course-reviews");
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        target.classList.add("is-highlight");
        setTimeout(() => target.classList.remove("is-highlight"), 1600);
      });
    }
  }).catch((error) => {
    detail.innerHTML = `<div class="error-state">${MSDS.escapeHtml(error.message)}<br><a class="text-link" href="index.html">返回课程表</a></div>`;
  });
})();
