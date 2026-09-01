(function () {
  "use strict";

  const LEGACY_STORAGE_KEY = "MSDS-planner-selections-v1";
  const STORAGE_KEY = "CITYU-planner-selections-v3";
  const SEMESTER_KEY = "CITYU-current-semester";
  const REVIEWS_KEY = "CITYU-course-reviews-v1";
  const PROGRAMME_KEY = "CITYU-current-programme";
  const DEFAULT_PROGRAMME = "MSDS";
  const DAY_NAMES = { M: "周一", T: "周二", W: "周三", R: "周四", F: "周五", S: "周六", U: "周日" };
  let courseDataPromise;

  // 评价等级 → 星级口碑分（0-5，未知为 null）
  const LEVEL_RATINGS = {
    strong: 5,
    recommended: 4.5,
    good: 4.5,
    research: 4,
    neutral: 3.5,
    caution: 2.5,
    unknown: null
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // 把文本里识别到的课程代码（CSDSCISMS… + 4 位数字 + 可选字母后缀）转成可点击链接。
  // 已知课程代码列表用于消歧（不会链接到不存在的课程）。
  // 例：输入 "CS3334 Data Structures and CS5487 Machine Learning: Principles and Practice"
  //   输出 "<a href='course.html?code=CS3334'>CS3334</a> Data Structures and <a href='course.html?code=CS5487'>CS5487</a> Machine Learning: ..."
  function renderCourseMentions(text, coursesByCode) {
    if (text == null) return "";
    const raw = String(text);
    if (!raw) return "";
    const known = coursesByCode && typeof coursesByCode === "object"
      ? new Set(Object.keys(coursesByCode))
      : null;
    const esc = escapeHtml(raw);
    const pattern = /\b([A-Z]{2,5})(?:\s|-)?(\d{4}[A-Z]?)\b/g;
    return esc.replace(pattern, (match, prefix, num) => {
      const code = `${prefix}${num}`;
      // 已知的课程代码才生成链接，避免误把无关文本当课程码
      if (known && !known.has(code)) return match;
      return `<a class="course-mention" href="course.html?code=${encodeURIComponent(code)}" data-code="${code}">${match}</a>`;
    });
  }

  function loadCourseData() {
    if (!courseDataPromise) {
      const getJson = (url) => fetch(url).then((response) => {
        if (!response.ok) throw new Error(`数据读取失败：${url}`);
        return response.json();
      });
      courseDataPromise = Promise.all([
        getJson("data/courses/index.json"),
        getJson("data/sources.json")
      ]).then(([index, sources]) => Promise.all([
        Promise.all(index.courses.map((course) => Promise.all([
          getJson(`data/sections/${encodeURIComponent(course.code)}.json`),
          getJson(`data/reviews/${encodeURIComponent(course.code)}.json`)
        ]).then(([eligibleSections, recommendation]) => ({
          ...course,
          eligible_sections: eligibleSections,
          recommendation
        })))),
        Promise.all(Object.keys(sources).map((sourceId) =>
          getJson(`data/source-reviews/${encodeURIComponent(sourceId)}.json`)
            .then((sourceReview) => [sourceId, sourceReview])
            .catch(() => [sourceId, { source_id: sourceId, course_reviews: {} }])
        ))
      ]).then(([courses, sourceReviewEntries]) => ({
        ...index,
        sources,
        sourceReviews: Object.fromEntries(sourceReviewEntries),
        courses
      })));
    }
    return courseDataPromise;
  }

  function getRecommendation(course) {
    return course?.recommendation || {
      level: "unknown",
      verdict: "暂无评价",
      summary: "本地资料没有足够信息，暂不作判断。",
      tags: [],
      source_ids: [],
      sourceIds: []
    };
  }

  function getProgrammes(data) {
    return Array.isArray(data?.programmes) ? data.programmes : [];
  }

  function getProgramme(data, code) {
    const programmes = getProgrammes(data);
    const target = String(code || DEFAULT_PROGRAMME);
    return programmes.find((item) => item.code === target)
      || programmes.find((item) => item.code === DEFAULT_PROGRAMME)
      || { code: DEFAULT_PROGRAMME, name_en: "MSc Data Science", name_zh: "数据科学理学硕士" };
  }

  // 课程在某个项目下的必修/选修类型；未单独指定时回退到课程的 requirement_type
  function getRequirementType(course, programmeCode) {
    const code = String(programmeCode || DEFAULT_PROGRAMME);
    return course?.programme_requirement_types?.[code] || course?.requirement_type || "elective";
  }

  // 课程在某个项目下所属的选修分组（如 Group I / Group II）；无分组要求时返回 null
  function getElectiveGroup(course, programmeCode) {
    const code = String(programmeCode || DEFAULT_PROGRAMME);
    return course?.programme_elective_groups?.[code] || null;
  }

  // 根据项目的 requirement_credit_units.elective_groups 配置查找分组的展示信息
  function getElectiveGroupInfo(programme, groupKey) {
    const groups = programme?.requirement_credit_units?.elective_groups;
    if (!Array.isArray(groups)) return null;
    return groups.find((group) => group.key === groupKey) || null;
  }

  // 课程所属的项目列表；未标注时回退到默认项目
  function courseProgrammes(course, data) {
    if (Array.isArray(course?.programmes) && course.programmes.length) return course.programmes;
    return [data?.programme || DEFAULT_PROGRAMME];
  }

  // 课程学期列表：semester_tag 支持 "SemB+Summer" 形式，表示同一门课在多个学期开设
  function courseTerms(course) {
    const raw = course?.semester_tag;
    if (!raw) return [];
    return String(raw).split("+").map((term) => term.trim()).filter(Boolean);
  }

  // 课程详情页加入课表时使用的主学期（双学期课程取第一个，即常规学期）
  function primarySemester(course) {
    const terms = courseTerms(course);
    return terms.length ? terms[0] : "SemA";
  }

  // 课程是否在指定学期开设：无学期标签视为不限制（任意学期可选）；
  // 有标签（如 "SemA" / "SemB+Summer"）则必须包含该学期，用于学期隔离。
  function courseOfferedInSemester(course, semester) {
    const terms = courseTerms(course);
    if (!terms.length) return true;
    return terms.includes(normalizeSemester(semester));
  }

  // 学期标签的 CSS 修饰类
  function termBadgeClass(term) {
    return term === "SemA" ? "term-a" : term === "SemB" ? "term-b" : term === "Summer" ? "term-summer" : "";
  }

  function getStoredProgramme() {
    try {
      return localStorage.getItem(PROGRAMME_KEY) || DEFAULT_PROGRAMME;
    } catch {
      return DEFAULT_PROGRAMME;
    }
  }

  function saveProgramme(code) {
    try {
      localStorage.setItem(PROGRAMME_KEY, String(code || DEFAULT_PROGRAMME));
    } catch {
      /* ignore */
    }
  }

  function getAllSelections() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function migrateLegacySelections() {
    try {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "{}");
      if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) return;
      const all = getAllSelections();
      if (!all[DEFAULT_PROGRAMME] || typeof all[DEFAULT_PROGRAMME] !== "object" || all[DEFAULT_PROGRAMME].SemA === undefined) {
        all[DEFAULT_PROGRAMME] = { SemA: legacy, SemB: {}, Summer: {} };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      }
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  // 课表按 项目 → 学期（SemA/SemB/Summer）→ 课程 三层保存；
  // 旧版数据为 项目 → 课程 两层，读取时自动归入 SemA 并回写迁移
  function normalizeSemester(s) {
    return s === "SemB" ? "SemB" : s === "Summer" ? "Summer" : "SemA";
  }

  function ensureSemesterStructure(stored) {
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
    if (stored.SemA === undefined && stored.SemB === undefined) {
      return { SemA: stored, SemB: {}, Summer: {} };
    }
    if (stored.Summer === undefined) stored.Summer = {};
    return stored;
  }

  function getStoredSemester() {
    try {
      return normalizeSemester(localStorage.getItem(SEMESTER_KEY));
    } catch {
      return "SemA";
    }
  }

  function saveSemester(semester) {
    try {
      localStorage.setItem(SEMESTER_KEY, normalizeSemester(semester));
    } catch {
      /* ignore */
    }
  }

  function getStoredSelections(programmeCode, semester) {
    migrateLegacySelections();
    const all = getAllSelections();
    const code = String(programmeCode || getStoredProgramme());
    const term = normalizeSemester(semester);
    let stored = all[code];
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
    const migrated = ensureSemesterStructure(stored);
    if (migrated && migrated !== stored) {
      all[code] = migrated;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      stored = migrated;
    }
    const selections = stored[term];
    return selections && typeof selections === "object" && !Array.isArray(selections) ? selections : {};
  }

  function saveSelections(selections, programmeCode, semester) {
    const all = getAllSelections();
    const code = String(programmeCode || getStoredProgramme());
    const term = normalizeSemester(semester);
    let stored = all[code];
    const migrated = ensureSemesterStructure(stored);
    stored = migrated || { SemA: {}, SemB: {}, Summer: {} };
    stored[term] = selections || {};
    all[code] = stored;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  function clearSelections(programmeCode, semester) {
    const all = getAllSelections();
    const code = String(programmeCode || getStoredProgramme());
    const term = normalizeSemester(semester);
    let stored = all[code];
    const migrated = ensureSemesterStructure(stored);
    if (!migrated) return;
    stored = migrated;
    stored[term] = {};
    all[code] = stored;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  // ============ 用户个人课程评价（本地保存） ============
  // 数据结构：{ [courseCode]: { rating: 1-5, comment: string, updatedAt: ISO 字符串 } }
  function getStoredReviews() {
    try {
      const parsed = JSON.parse(localStorage.getItem(REVIEWS_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function getCourseReview(code) {
    const all = getStoredReviews();
    return all[String(code)] || null;
  }

  function saveCourseReview(code, review) {
    const all = getStoredReviews();
    all[String(code)] = {
      rating: Math.max(1, Math.min(5, Number(review.rating) || 0)),
      comment: String(review.comment || "").trim(),
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(all));
  }

  function removeCourseReview(code) {
    const all = getStoredReviews();
    delete all[String(code)];
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(all));
  }

  // ============ 云端课程评价（Supabase，共享给所有用户） ============
  // 通过 assets/cloud-config.js 配置 supabaseUrl / supabaseAnonKey 后启用；
  // 未配置时以下函数自动降级为“不可用”，不影响本地评价功能。
  const CLOUD_CACHE_KEY = "CITYU-cloud-reviews-cache-v1";
  const CLOUD_CACHE_TTL = 5 * 60 * 1000; // 会话缓存 5 分钟，降低重复请求流量
  const USER_KEY_STORAGE = "CITYU-cloud-user-key"; // 个人评价标识，用于“只能删除自己的评价”
  const ADMIN_SESSION = "CITYU-admin-session"; // 管理员登录会话（access_token 与过期时间）
  const USER_SESSION = "CITYU-user-session"; // 学生登录会话（access_token 与过期时间）
  const USER_NICKNAME = "CITYU-user-nickname"; // 学生昵称（登录/注册时填写，评价默认显示）

  function larkReviewsEnabled() {
    try {
      return Boolean(window.LARK_CONFIG && window.LARK_CONFIG.formUrl);
    } catch {
      return false;
    }
  }

  function cloudReviewsEnabled() {
    if (larkReviewsEnabled()) return true;
    try {
      const config = window.CLOUD_CONFIG;
      return Boolean(config && config.supabaseUrl && config.supabaseAnonKey);
    } catch {
      return false;
    }
  }

  let larkReviewsCache = null;
  async function getLarkReviews() {
    if (larkReviewsCache) return larkReviewsCache;
    const response = await fetch("data/lark-reviews.json");
    if (!response.ok) return [];
    const all = await response.json();
    larkReviewsCache = Array.isArray(all) ? all : [];
    return larkReviewsCache;
  }

  // 生成或读取本机唯一的 user_key（localStorage 持久化）
  function getUserKey() {
    try {
      let key = localStorage.getItem(USER_KEY_STORAGE);
      if (!key) {
        key = "uk_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 12);
        localStorage.setItem(USER_KEY_STORAGE, key);
      }
      return key;
    } catch {
      return "";
    }
  }

  // ============ 管理员（Supabase Auth 邮箱登录） ============
  // 管理员身份由 Supabase 后端判定：仅当账号的 app_metadata.is_admin === true
  // 时才视为管理员，客户端不再硬编码管理员邮箱。

  // 管理员登录：邮箱 + 密码 → access_token（存会话，默认 1 小时）
  async function adminLogin(email, password) {
    if (!cloudReviewsEnabled()) throw new Error("云端评价未启用");
    const config = window.CLOUD_CONFIG;
    const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: String(email).trim(), password: String(password) })
    });
    if (!response.ok) throw new Error("管理员登录失败：邮箱或密码错误");
    const data = await response.json();
    const session = {
      token: data.access_token,
      email: String(data.user?.email || email).trim(),
      isAdmin: Boolean(data.user?.app_metadata?.is_admin === true),
      expiresAt: Date.now() + (Number(data.expires_in || 3600) * 1000)
    };
    try {
      sessionStorage.setItem(ADMIN_SESSION, JSON.stringify(session));
    } catch {
      /* 忽略 */
    }
    return session;
  }

  function adminLogout() {
    try {
      sessionStorage.removeItem(ADMIN_SESSION);
    } catch {
      /* 忽略 */
    }
  }

  // 当前管理员会话（未过期且带有后端 is_admin 标记才返回，否则返回 null）
  function currentAdmin() {
    try {
      const raw = sessionStorage.getItem(ADMIN_SESSION);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || !session.token || !session.isAdmin || Date.now() > session.expiresAt) return null;
      return session;
    } catch {
      return null;
    }
  }

  // 管理员会话是否有效（有效则具备任意删除权限）
  function isAdminLoggedIn() {
    return Boolean(currentAdmin());
  }

  // ============ 学生（Supabase Auth 邮箱登录，登录后可提交评价） ============
  function getStoredUserNickname() {
    try {
      return String(localStorage.getItem(USER_NICKNAME) || "").trim();
    } catch {
      return "";
    }
  }

  // 学生注册：邮箱 + 密码 + 昵称（选填）→ 创建账号并自动登录
  async function studentRegister(email, password, nickname) {
    if (!cloudReviewsEnabled()) throw new Error("云端评价未启用");
    const config = window.CLOUD_CONFIG;
    const response = await fetch(`${config.supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: String(email).trim(),
        password: String(password)
      })
    });
    if (!response.ok) {
      let message = "注册失败";
      try {
        const err = await response.json();
        message = String(err.error_description || err.msg || err.message || message);
      } catch { /* ignore */ }
      throw new Error(message);
    }
    const data = await response.json();
    // 保存昵称（注册后评价默认显示）
    const finalNickname = String(nickname || "").trim();
    if (finalNickname) {
      try {
        localStorage.setItem(USER_NICKNAME, finalNickname);
      } catch { /* ignore */ }
    }
    // signup 默认返回 session（未开启邮箱验证时）；若开启验证则返回 null，提示先验证邮箱
    if (data.session) {
      saveUserSession(data.session);
      return { session: data.session, needVerify: false };
    }
    return { session: null, needVerify: true };
  }

  // 学生登录：邮箱 + 密码 → access_token（存会话，默认 1 小时）
  async function studentLogin(email, password) {
    if (!cloudReviewsEnabled()) throw new Error("云端评价未启用");
    const config = window.CLOUD_CONFIG;
    const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: String(email).trim(), password: String(password) })
    });
    if (!response.ok) throw new Error("登录失败：邮箱或密码错误");
    const data = await response.json();
    saveUserSession(data);
    return data;
  }

  function saveUserSession(data) {
    const session = {
      token: data.access_token,
      refreshToken: data.refresh_token || "",
      email: String(data.user?.email || "").trim(),
      userId: String(data.user?.id || "").trim(),
      expiresAt: Date.now() + (Number(data.expires_in || 3600) * 1000)
    };
    try {
      sessionStorage.setItem(USER_SESSION, JSON.stringify(session));
    } catch { /* ignore */ }
    return session;
  }

  function studentLogout() {
    try {
      sessionStorage.removeItem(USER_SESSION);
    } catch { /* ignore */ }
  }

  // 当前学生会话（未过期则返回，否则返回 null）
  function currentStudent() {
    try {
      const raw = sessionStorage.getItem(USER_SESSION);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || !session.token || Date.now() > session.expiresAt) return null;
      return session;
    } catch {
      return null;
    }
  }

  function isStudentLoggedIn() {
    return Boolean(currentStudent());
  }

  // 学生修改昵称（评价默认显示）
  function saveUserNickname(nickname) {
    const final = String(nickname || "").trim();
    try {
      if (final) localStorage.setItem(USER_NICKNAME, final);
      else localStorage.removeItem(USER_NICKNAME);
    } catch { /* ignore */ }
    return final;
  }

  // 忘记密码：向注册邮箱发送密码重置邮件（邮件内容由 Supabase Auth 模板控制）
  async function studentSendResetEmail(email) {
    if (!cloudReviewsEnabled()) throw new Error("云端评价未启用");
    const config = window.CLOUD_CONFIG;
    const response = await fetch(`${config.supabaseUrl}/auth/v1/recover`, {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: String(email).trim() })
    });
    if (!response.ok) {
      let message = "发送失败";
      try {
        const err = await response.json();
        message = String(err.error_description || err.msg || err.message || message);
      } catch { /* ignore */ }
      throw new Error(message);
    }
    return true;
  }

  // 使用重置邮件中的 access_token 设置新密码（替换原密码）
  async function studentUpdatePassword(token, newPassword) {
    if (!cloudReviewsEnabled()) throw new Error("云端评价未启用");
    const config = window.CLOUD_CONFIG;
    const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ password: String(newPassword) })
    });
    if (!response.ok) {
      let message = "密码更新失败";
      try {
        const err = await response.json();
        message = String(err.error_description || err.msg || err.message || message);
      } catch { /* ignore */ }
      throw new Error(message);
    }
    return true;
  }

  // ============ 云端评价读写 ============

  // 读取缓存：命中且未过期则直接返回，避免重复拉取云端数据
  function readCloudCache(code) {
    try {
      const raw = sessionStorage.getItem(CLOUD_CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      const hit = cached && cached.code === String(code) && cached.reviews && Date.now() - cached.at < CLOUD_CACHE_TTL;
      return hit ? cached.reviews : null;
    } catch {
      return null;
    }
  }

  function writeCloudCache(code, reviews) {
    try {
      sessionStorage.setItem(CLOUD_CACHE_KEY, JSON.stringify({ code: String(code), reviews, at: Date.now() }));
    } catch {
      // sessionStorage 不可用时忽略缓存，不影响功能
    }
  }

  // 读取某门课程的最新云端评价（按时间倒序，最多 20 条；配合 5 分钟会话缓存控制流量）
  async function fetchCloudReviews(code, options = {}) {
    if (!cloudReviewsEnabled()) return [];
    if (larkReviewsEnabled()) {
      const all = await getLarkReviews();
      return all.filter((r) => String(r.course_code).toUpperCase() === String(code).toUpperCase());
    }
    const force = Boolean(options.force);
    if (!force) {
      const cached = readCloudCache(code);
      if (cached) return cached;
    }
    const config = window.CLOUD_CONFIG;
    const url = `${config.supabaseUrl}/rest/v1/course_reviews?course_code=eq.${encodeURIComponent(String(code))}&order=created_at.desc&limit=20`;
    const response = await fetch(url, {
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`
      }
    });
    if (!response.ok) throw new Error(`云端评价读取失败（${response.status}）`);
    const rows = await response.json();
    const reviews = Array.isArray(rows) ? rows : [];
    writeCloudCache(code, reviews);
    return reviews;
  }

  // 提交一条云端评价：
  // - 学生已登录：携带学生 access_token 与昵称（RLS 校验登录身份）
  // - 管理员已登录：携带管理员 token
  // - 均未登录：抛错提示先登录（登录后才能提交评价）
  async function submitCloudReview(code, review) {
    if (!cloudReviewsEnabled()) throw new Error("云端评价未启用");
    const config = window.CLOUD_CONFIG;
    const student = currentStudent();
    const admin = currentAdmin();
    const token = student?.token || admin?.token || "";
    if (!token) {
      throw new Error("请先登录后再提交评价（登录后可分享到云端）");
    }
    const nickname = String(review.nickname || "").trim() || (student ? getStoredUserNickname() : "") || (student ? student.email.split("@")[0] : "") || "匿名";
    const response = await fetch(`${config.supabaseUrl}/rest/v1/course_reviews`, {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        course_code: String(code),
        rating: Math.max(1, Math.min(5, Number(review.rating) || 0)),
        comment: String(review.comment || "").trim(),
        nickname,
        user_key: getUserKey(),
        user_id: (student && student.userId) || null
      })
    });
    if (!response.ok) {
      let message = `云端评价提交失败（${response.status}）`;
      try {
        const err = await response.json();
        message = String(err.message || err.error_description || message);
      } catch { /* ignore */ }
      throw new Error(message);
    }
    const rows = await response.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  // 删除一条云端评价：
  // - 本人删除（学生登录）：携带学生 access_token + x-user-key，RLS 校验 user_id/user_key 与记录一致
  // - 本人删除（匿名历史评价）：携带 x-user-key，RLS 校验与记录 user_key 一致
  // - 管理员删除：请求头携带管理员 access_token，RLS 校验管理员邮箱
  async function deleteCloudReview(code, id) {
    if (!cloudReviewsEnabled()) return;
    const config = window.CLOUD_CONFIG;
    const admin = currentAdmin();
    const student = currentStudent();
    const token = admin?.token || student?.token || config.supabaseAnonKey;
    const headers = {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      "x-user-key": admin ? admin.email : getUserKey()
    };
    const url = `${config.supabaseUrl}/rest/v1/course_reviews?id=eq.${encodeURIComponent(String(id))}`;
    const response = await fetch(url, { method: "DELETE", headers });
    if (!response.ok) {
      let message = `删除失败（${response.status}）`;
      try {
        const err = await response.json();
        message = String(err.message || err.error_description || message);
      } catch { /* ignore */ }
      throw new Error(message);
    }
  }

  // 批量读取多门课程的云端评价（一次请求，用于课程评价中心按系展示）
  // codes：课程编号数组；返回 { course_code: [rows...] }
  async function fetchCloudReviewsBatch(codes) {
    const list = Array.isArray(codes) ? codes.map((c) => String(c).trim()).filter(Boolean) : [];
    if (!cloudReviewsEnabled() || !list.length) return {};
    if (larkReviewsEnabled()) {
      const all = await getLarkReviews();
      const grouped = {};
      all.forEach((r) => {
        const code = String(r.course_code || "").toUpperCase();
        if (!list.map((c) => c.toUpperCase()).includes(code)) return;
        if (!grouped[code]) grouped[code] = [];
        grouped[code].push(r);
      });
      return grouped;
    }
    const config = window.CLOUD_CONFIG;
    const url = `${config.supabaseUrl}/rest/v1/course_reviews?course_code=in.(${list.map((c) => encodeURIComponent(c)).join(",")})&limit=1000`;
    const response = await fetch(url, {
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`
      }
    });
    if (!response.ok) throw new Error(`云端评价读取失败（${response.status}）`);
    const rows = await response.json();
    const grouped = {};
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const code = String(row.course_code || "");
      if (!grouped[code]) grouped[code] = [];
      grouped[code].push(row);
    });
    return grouped;
  }

  function sectionKey(section) {
    return String(section.crn || `${section.section}-${section.day}-${section.time}`);
  }

  // 同一 CRN 可能对应多条“每周上课时间”记录（如一周两次课）；
  // 凡是需要枚举“可选班次”本身（而非某班次的每次上课时间）的地方，都应先按 CRN 去重
  function uniqueByKey(sections) {
    const seen = new Set();
    return sections.filter((section) => {
      const key = sectionKey(section);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function pickTutorial(primary, tutorials) {
    if (!tutorials.length) return null;
    const suffix = primary?.section?.match(/(\d+)$/)?.[1];
    if (suffix) {
      const exact = tutorials.find((item) => item.section.endsWith(suffix));
      if (exact) return exact;
      const family = tutorials.find((item) => item.section.slice(1, 2) === primary.section.slice(1, 2));
      if (family) return family;
    }
    return tutorials[0];
  }

  function makeDefaultSelection(course) {
    const primaries = uniqueByKey(course.eligible_sections.filter((section) => Number(section.credits) > 0));
    const tutorials = uniqueByKey(course.eligible_sections.filter((section) => Number(section.credits) === 0));
    const primary = primaries[0] || course.eligible_sections[0];
    const tutorial = pickTutorial(primary, tutorials);
    return {
      primaryCrn: primary ? sectionKey(primary) : null,
      tutorialCrn: tutorial ? sectionKey(tutorial) : null
    };
  }

  function findSection(course, key) {
    return course.eligible_sections.find((section) => sectionKey(section) === String(key));
  }

  function formatSection(section) {
    if (!section) return "";
    return `${section.section} · ${DAY_NAMES[section.day] || section.day} ${section.time}`;
  }

  // 从 notes 中提取“only for Programme: X”限制，返回专业名称列表（无限制则为空数组）
  function sectionRestrictedProgrammes(section) {
    if (!Array.isArray(section?.notes)) return [];
    return section.notes
      .map((note) => note.match(/^only for Programme:\s*(.+)$/i)?.[1]?.trim())
      .filter(Boolean);
  }

  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function recommendationBadge(rec, small = false) {
    const className = small ? "mini-badge" : "verdict-badge";
    return `<span class="${className} ${escapeHtml(rec.level)}">${escapeHtml(rec.verdict)}</span>`;
  }

  // 由评价等级推导口碑分；未知返回 null
  function ratingFor(rec) {
    const level = rec?.level || "unknown";
    const score = LEVEL_RATINGS[level];
    return score == null ? null : score;
  }

  // 渲染星级口碑分（含分数与来源数）
  // 半星用「实心星叠加在空心星上并按百分比裁切」实现：早期版本用 ⯨（U+2BE8）表示半星，
  // 但该字符不在常见中英文字体内，Chrome / Safari 上会渲染成方框「豆腐块」。
  function ratingStars(rec, options = {}) {
    const score = ratingFor(rec);
    if (score == null) return "";
    const percent = Math.max(0, Math.min(100, (score / 5) * 100));
    const count = rec?.source_ids?.length || rec?.sourceIds?.length || 0;
    const meta = options.withMeta === false ? "" : `<span class="rating-meta">${count ? `${count} 条评价来源` : "学生评价"}</span>`;
    return `<span class="rating-line" aria-label="口碑评分 ${score} 分（满分 5 分）"><span class="rating-stars" aria-hidden="true"><span class="rating-stars-empty">★★★★★</span><span class="rating-stars-fill" style="width:${percent}%">★★★★★</span></span><strong class="rating-score">${score.toFixed(1)}</strong>${meta}</span>`;
  }

  // ==================== 可搜索下拉选择组件 ====================
  // 生成一个带搜索过滤的下拉选择器，支持键盘操作（↑/↓ 移动、Enter 确认、Esc 关闭）。
  // 返回 { getValue, setValue, setOptions, destroy }。
  function createSearchSelect(container, config = {}) {
    const placeholder = config.placeholder || "请选择";
    const searchPlaceholder = config.searchPlaceholder || "搜索…";
    const emptyText = config.emptyText || "没有匹配项";

    const root = document.createElement("div");
    root.className = "select-search";
    root.innerHTML = `
      <button class="select-search-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">
        <span class="select-search-value"></span>
        <svg class="select-search-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      <div class="select-search-menu" hidden>
        <div class="select-search-inputwrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input class="select-search-input" type="text" autocomplete="off" spellcheck="false">
        </div>
        <ul class="select-search-list" role="listbox"></ul>
      </div>`;
    container.appendChild(root);

    const trigger = root.querySelector(".select-search-trigger");
    const valueEl = root.querySelector(".select-search-value");
    const menu = root.querySelector(".select-search-menu");
    const input = root.querySelector(".select-search-input");
    const list = root.querySelector(".select-search-list");
    input.placeholder = searchPlaceholder;

    let items = [];
    let visible = [];
    let value = null;
    let activeIndex = -1;
    let open = false;

    function labelOf(item) {
      return item ? (item.sub ? `${item.label}（${item.sub}）` : item.label) : placeholder;
    }

    function renderValue() {
      const current = items.find((item) => item.value === value);
      valueEl.textContent = labelOf(current);
      valueEl.classList.toggle("is-placeholder", !current);
    }

    function renderList() {
      if (!visible.length) {
        list.innerHTML = `<li class="select-search-empty">${escapeHtml(emptyText)}</li>`;
        return;
      }
      list.innerHTML = visible.map((item, index) => `
        <li class="select-search-option ${item.disabled ? "is-disabled" : ""} ${index === activeIndex ? "is-active" : ""} ${item.value === value ? "is-selected" : ""}"
            role="option" aria-selected="${item.value === value ? "true" : "false"}" aria-disabled="${item.disabled ? "true" : "false"}"
            data-index="${index}">
          <span class="select-search-option-label">${escapeHtml(item.label)}</span>
          ${item.sub ? `<small>${escapeHtml(item.sub)}</small>` : ""}
        </li>`).join("");
    }

    function applyFilter() {
      const query = input.value.trim().toLowerCase();
      visible = !query ? items.slice() : items.filter((item) =>
        `${item.label} ${item.sub || ""} ${item.value}`.toLowerCase().includes(query));
      activeIndex = visible.findIndex((item) => !item.disabled);
      renderList();
    }

    function setOpen(next) {
      if (open === next) return;
      open = next;
      menu.hidden = !open;
      root.classList.toggle("is-open", open);
      trigger.setAttribute("aria-expanded", String(open));
      if (open) {
        input.value = "";
        applyFilter();
        input.focus();
        input.select();
      }
    }

    function choose(item) {
      if (!item || item.disabled) return;
      value = item.value;
      renderValue();
      setOpen(false);
      trigger.focus();
      if (config.onChange) config.onChange(value);
    }

    function moveActive(step) {
      if (!visible.length) return;
      let index = activeIndex;
      for (let i = 0; i < visible.length; i += 1) {
        index = (index + step + visible.length) % visible.length;
        if (!visible[index].disabled) break;
      }
      activeIndex = index;
      renderList();
      const node = list.children[activeIndex];
      if (node) node.scrollIntoView({ block: "nearest" });
    }

    trigger.addEventListener("click", () => setOpen(!open));
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setOpen(true);
      }
    });
    input.addEventListener("input", applyFilter);
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveActive(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveActive(-1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        choose(visible[activeIndex]);
      } else if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.focus();
      }
    });
    list.addEventListener("click", (event) => {
      const option = event.target.closest("[data-index]");
      if (option) choose(visible[Number(option.dataset.index)]);
    });
    list.addEventListener("mousemove", (event) => {
      const option = event.target.closest("[data-index]");
      if (option && Number(option.dataset.index) !== activeIndex) {
        activeIndex = Number(option.dataset.index);
        renderList();
      }
    });
    function onDocumentClick(event) {
      if (!root.contains(event.target)) setOpen(false);
    }
    document.addEventListener("click", onDocumentClick);

    renderValue();

    return {
      getValue: () => value,
      setValue(next) {
        value = next;
        renderValue();
      },
      // nextValue 不在选项中时，自动落到第一个可用选项
      setOptions(nextItems, nextValue) {
        items = Array.isArray(nextItems) ? nextItems : [];
        const current = items.find((item) => item.value === nextValue);
        value = current ? current.value : (items.find((item) => !item.disabled)?.value ?? null);
        renderValue();
      },
      destroy() {
        document.removeEventListener("click", onDocumentClick);
        root.remove();
      }
    };
  }

  // ==================== 语言切换 ====================
  const LANG_KEY = "CITYU-lang";

  function getStoredLang() {
    try {
      return localStorage.getItem(LANG_KEY) || "zh";
    } catch {
      return "zh";
    }
  }

  function saveLang(lang) {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* ignore */
    }
  }

  const I18N = {
    zh: {
      "nav.courses": "排课系统",
      "nav.cityu": "城大官网",
      "nav.reviews": "课程评价",
      "nav.lang": "中英文切换",
      "nav.github": "GitHub 仓库",
      "nav.account": "登录 / 注册",
      "nav.group.main": "主要功能",
      "nav.group.more": "更多",
      "intro.eyebrow": "我的课表",
      "intro.title": "自助排课台",
      "intro.desc": "先选择学院，再选择院系与硕士项目，即可按对应培养方案浏览课程、比较班次并规划每周课表；左侧悬停可预览课程评价与时段。",
      "stat.graduation": "毕业学分",
      "stat.requirement": "核心 + 选修",
      "prog.label": "硕士项目",
      "college.label": "学院",
      "department.label": "院系",
      "college.placeholder": "选择学院",
      "college.search": "搜索学院",
      "department.placeholder": "选择院系",
      "department.search": "搜索院系",
      "prog.placeholder": "选择硕士项目",
      "prog.search": "搜索项目代码或名称",
      "tab.browse": "浏览课程",
      "tab.selected": "已选",
      "search.placeholder": "搜索课号或课程名",
      "filter.all": "全部",
      "filter.core": "核心",
      "filter.elective": "选修",
      "day.label": "上课日",
      "day.all": "全部",
      "toolbar.clear": "清空",
      "conflict.clear": "暂无冲突",
      "empty.timetable.title": "从左侧加入课程",
      "empty.timetable.desc": "班次可在「已选」中切换",
      "empty.unscheduled.title": "已加入的课程没有固定时段",
      "timetable.unscheduled.note": "未排入课表（无固定上课时段）：",
      "selected.nosection": "无可选班次，该课程不排入课表",
      "course.detail.title": "课程详情",
      "syllabus.title": "详细课程介绍",
      "nav.about": "关于我们",
      "about.subtitle": "CityUHK CSSA · 关于我们",
      "about.intro.title": "组织简介",
      "about.intro": "香港城市大学中国学生学者联合会（CityUHK CSSA）是官方认证、非政治、非盈利的学生组织，致力于服务全体城大学生与学者。我们提供免费的学业支持、职业发展、反诈宣传及 40+ 兴趣社团，并定期举办名企参访、粤语课堂、春节嘉年华等丰富活动。",
      "about.dept.title": "五大常设部门",
      "about.dept.desc": "为同学们提供多元化的锻炼平台：",
      "about.join.title": "加入我们",
      "about.cta": "无论你是希望提升组织协调能力、积累职场资源，还是单纯想结识志同道合的伙伴，CSSA 都是你不容错过的成长舞台。欢迎加入我们的大家庭，在金秋校园与我们相遇，一起书写属于你的城大篇章！",
      "about.follow.title": "关注我们",
      "about.follow": "更多精彩内容，欢迎关注 CSSA 官方社交媒体账号，获取最新活动资讯与福利信息！",
      "nav.feedback": "问题反馈",
      "feedback.hero.title": "问题反馈",
      "feedback.hero.line1": "发现 Bug、课程数据有误或有任何建议？",
      "feedback.hero.line2": "留下你的信息与问题描述，我们会尽快跟进处理。",
      "feedback.section.info": "你的信息",
      "feedback.label.name": "姓名",
      "feedback.label.programme": "专业",
      "feedback.placeholder.name": "请输入你的姓名或昵称",
      "feedback.placeholder.programme": "例如：数据科学硕士 / MSc Data Science",
      "feedback.section.description": "问题描述",
      "feedback.label.description": "请描述你遇到的问题或建议",
      "feedback.placeholder.description": "请详细描述问题现象、出现的页面和操作步骤，或写下你的建议…",
      "feedback.btn.reset": "重置",
      "feedback.btn.submit": "提交反馈",
      "feedback.result.title": "反馈已生成",
      "feedback.result.desc": "请复制以下内容，发送给管理员或提交到 GitHub Issues：",
      "feedback.result.copy": "复制内容",
      "feedback.result.github": "提交到 GitHub",
      "feedback.result.close": "关闭",
      "login.title": "登录",
      "login.desc": "学生登录后可提交课程评价；管理员登录后可管理云端评价。",
      "login.student": "学生登录",
      "login.admin": "管理员登录",
      "login.email": "邮箱",
      "login.password": "密码",
      "login.nickname": "昵称（选填）",
      "login.noAccount": "还没有账号？",
      "login.toRegister": "注册新账号",
      "login.hasAccount": "已有账号？",
      "login.toLogin": "直接登录",
      "login.studentHint": "登录后即可为课程提交评价；你的评价会同步到云端并显示昵称。",
      "login.adminHint": "管理员登录后可删除任意云端评价；仅限指定管理员邮箱。",
      "login.forgot": "忘记密码？",
      "login.sendReset": "发送重置邮件",
      "login.backToLogin": "← 返回登录",
      "login.forgotHint": "输入注册邮箱后，我们会发送一封密码重置邮件，点击邮件中的链接即可设置新密码。",
      "login.newPassword": "新密码",
      "login.confirmPassword": "确认新密码",
      "login.resetPassword": "设置新密码",
      "login.resetHint": "设置成功后即可用新密码登录。",
      "reviews.title": "课程评价中心",
      "reviews.desc": "按学院与院系浏览课程，查看所有使用者的共享评价，也可以直接为心仪的课程提交评价。",
      "reviews.statCourses": "课程总数",
      "reviews.statReviews": "评价总数",
      "reviews.statAvg": "平均评分",
      "reviews.empty": "该院系暂无课程数据。",
      "reviews.reviews": "条评价",
      "reviews.noReviews": "暂无评价，来抢首评吧！",
      "reviews.reviewTitle": "课程评价",
      "reviews.myReview": "我的评价",
      "reviews.nicknamePlaceholder": "昵称（不填显示匿名）",
      "reviews.commentPlaceholder": "分享你的课程体验…",
      "reviews.submit": "提交评价",
      "reviews.loading": "正在加载课程…",
      "reviews.cloudDisabled": "云端共享未启用：管理员需在 assets/cloud-config.js 中配置 Supabase 数据库地址。",
      "reviews.localExp": "学生经验摘要",
      "reviews.localHint": "以下内容整理自公开社交平台的学生分享，仅供参考，不构成课程建议。",
      "reviews.recommendIndex": "综合推荐指数",
      "reviews.studentsReviews": "同学测评",
      "reviews.submitTab": "提交评价",
      "reviews.back": "返回课程列表",
      "reviews.heroStats": "次评分 · 条评论",
      "reviews.localScore": "本地口碑分",
      "reviews.writeReview": "写评价"
    },
    en: {
      "nav.courses": "Planner",
      "nav.cityu": "CityU",
      "nav.reviews": "Course Reviews",
      "nav.lang": "Language",
      "nav.github": "GitHub Repo",
      "nav.account": "Sign In / Register",
      "nav.group.main": "Main",
      "nav.group.more": "More",
      "intro.eyebrow": "My Timetable",
      "intro.title": "Course Planner",
      "intro.desc": "Pick a college, then a department and a master's programme to browse courses, compare sections, and plan your weekly schedule. Hover on the left panel to preview course reviews and time slots.",
      "stat.graduation": "Graduation Credits",
      "stat.requirement": "Core + Elective",
      "prog.label": "Programme",
      "college.label": "College",
      "department.label": "Department",
      "college.placeholder": "Select college",
      "college.search": "Search colleges",
      "department.placeholder": "Select department",
      "department.search": "Search departments",
      "prog.placeholder": "Select programme",
      "prog.search": "Search programme code or name",
      "tab.browse": "Browse",
      "tab.selected": "Selected",
      "search.placeholder": "Search course code or name",
      "filter.all": "All",
      "filter.core": "Core",
      "filter.elective": "Elective",
      "day.label": "Day",
      "day.all": "All",
      "toolbar.clear": "Clear",
      "conflict.clear": "No conflicts",
      "empty.timetable.title": "Add courses from the left",
      "empty.timetable.desc": "Switch sections in \"Selected\" tab",
      "empty.unscheduled.title": "Selected courses have no fixed time slot",
      "timetable.unscheduled.note": "Not on the timetable (no fixed time slot): ",
      "selected.nosection": "No sections available; not placed on the timetable",
      "course.detail.title": "Course Detail",
      "syllabus.title": "Course Syllabus",
      "nav.about": "About Us",
      "about.subtitle": "CityUHK CSSA · About Us",
      "about.intro.title": "About the Organisation",
      "about.intro": "The Chinese Students and Scholars Association at City University of Hong Kong (CityUHK CSSA) is an officially recognised, non-political, non-profit student organisation dedicated to serving all CityU students and scholars. We offer free academic support, career development, anti-fraud outreach, and 40+ interest clubs, and regularly host company visits, Cantonese classes, Spring Festival carnival, and more.",
      "about.dept.title": "Five Standing Departments",
      "about.dept.desc": "Providing diverse platforms for students to grow:",
      "about.join.title": "Join Us",
      "about.cta": "Whether you want to sharpen your organisational skills, build professional networks, or simply meet like-minded friends, CSSA is a stage you cannot miss. Join our family, meet us on campus this autumn, and write your own CityU chapter together!",
      "about.follow.title": "Follow Us",
      "about.follow": "Follow CSSA's official social media for the latest events and perks!",
      "nav.feedback": "Feedback",
      "feedback.hero.title": "Feedback",
      "feedback.hero.line1": "Found a bug, incorrect course data, or have a suggestion?",
      "feedback.hero.line2": "Leave your info and describe the issue — we'll follow up soon.",
      "feedback.section.info": "Your Info",
      "feedback.label.name": "Name",
      "feedback.label.programme": "Programme",
      "feedback.placeholder.name": "Enter your name or nickname",
      "feedback.placeholder.programme": "e.g. MSc Data Science",
      "feedback.section.description": "Issue Description",
      "feedback.label.description": "Describe the issue or suggestion",
      "feedback.placeholder.description": "Please describe the issue, the page it occurred on, and the steps to reproduce, or share your suggestion…",
      "feedback.btn.reset": "Reset",
      "feedback.btn.submit": "Submit Feedback",
      "feedback.result.title": "Feedback Generated",
      "feedback.result.desc": "Please copy the content below and send it to the admin or submit it to GitHub Issues:",
      "feedback.result.copy": "Copy Content",
      "feedback.result.github": "Submit to GitHub",
      "feedback.result.close": "Close",
      "login.title": "Sign In",
      "login.desc": "Students sign in to submit course reviews; admins sign in to manage cloud reviews.",
      "login.student": "Student Login",
      "login.admin": "Admin Login",
      "login.email": "Email",
      "login.password": "Password",
      "login.nickname": "Nickname (optional)",
      "login.noAccount": "No account yet?",
      "login.toRegister": "Sign up",
      "login.hasAccount": "Already have an account?",
      "login.toLogin": "Sign in",
      "login.studentHint": "Sign in to submit course reviews. Your review syncs to the cloud with your nickname.",
      "login.adminHint": "Admins can delete any cloud review. Restricted to the designated admin email.",
      "login.forgot": "Forgot password?",
      "login.sendReset": "Send reset email",
      "login.backToLogin": "← Back to sign in",
      "login.forgotHint": "Enter your registered email and we will send a password reset link.",
      "login.newPassword": "New password",
      "login.confirmPassword": "Confirm new password",
      "login.resetPassword": "Set new password",
      "login.resetHint": "Sign in with your new password once it is set.",
      "reviews.title": "Course Reviews",
      "reviews.desc": "Browse courses by college and department, read shared reviews, or submit your own.",
      "reviews.statCourses": "Courses",
      "reviews.statReviews": "Reviews",
      "reviews.statAvg": "Avg Rating",
      "reviews.empty": "No courses in this department yet.",
      "reviews.reviews": "reviews",
      "reviews.noReviews": "No reviews yet. Be the first!",
      "reviews.reviewTitle": "Course Reviews",
      "reviews.myReview": "My Review",
      "reviews.nicknamePlaceholder": "Nickname (optional)",
      "reviews.commentPlaceholder": "Share your experience…",
      "reviews.submit": "Submit",
      "reviews.loading": "Loading courses…",
      "reviews.cloudDisabled": "Cloud reviews disabled: configure Supabase in assets/cloud-config.js.",
      "reviews.localExp": "Student Experience Summary",
      "reviews.localHint": "Compiled from public social media posts. For reference only.",
      "reviews.recommendIndex": "Overall Rating",
      "reviews.studentsReviews": "Student Reviews",
      "reviews.submitTab": "Submit Review",
      "reviews.back": "Back to course list",
      "reviews.heroStats": "ratings · reviews",
      "reviews.localScore": "Community score",
      "reviews.writeReview": "Write a review"
    }
  };

  function t(key) {
    const lang = getStoredLang();
    return (I18N[lang] && I18N[lang][key]) || (I18N.zh[key] || key);
  }

  function applyLang() {
    const lang = getStoredLang();
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";

    // 更新语言按钮标签
    const langLabel = document.getElementById("lang-label");
    if (langLabel) {
      langLabel.textContent = lang === "zh" ? "EN" : "中文";
    }

    // 更新带 data-i18n 的元素
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const text = t(key);
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.placeholder = text;
      } else {
        el.textContent = text;
      }
    });
  }

  function initLangToggle() {
    const toggle = document.getElementById("lang-toggle");
    if (!toggle) return;

    toggle.addEventListener("click", () => {
      const current = getStoredLang();
      const next = current === "zh" ? "en" : "zh";
      saveLang(next);
      applyLang();
      showToast(next === "zh" ? "已切换为中文" : "Switched to English");
    });

    applyLang();
  }

  // ==================== 关于我们弹窗（已改为独立页面，保留兼容） ====================
  function initAboutToggle() {
    // 关于我们已迁移到 about.html 独立页面，此处保留空函数以兼容旧引用
  }

  function initUpdateNotice() {
    try {
      if (localStorage.getItem("cityu-schedule-update-20260901") === "dismissed") return;
    } catch (e) { /* localStorage 不可用时仍显示通知 */ }
    const isEn = getStoredLang() === "en";
    const notice = document.createElement("div");
    notice.className = "update-notice";
    notice.setAttribute("role", "status");
    notice.innerHTML =
      '<div class="update-notice-body">' +
        '<strong>' + (isEn ? "Planner Rules & Validation (Sep 1)" : "选课逻辑与规则校验（9/1）") + '</strong>' +
        '<span>' + (isEn
          ? "Conflict detection upgraded (faster on 30+ classes); course cards warn when prerequisites are missing or when an elective collides with a core course in time."
          : "冲突检测算法升级（30+ 门课时更流畅）；课程卡片新增「先修未加入」「与核心课时间冲突」红/橙警告。") +
        '</span>' +
      '</div>' +
      '<button class="update-notice-close" type="button" aria-label="' + (isEn ? "Dismiss" : "关闭") + '">&times;</button>';
    notice.querySelector(".update-notice-close").addEventListener("click", () => {
      notice.remove();
      try { localStorage.setItem("cityu-schedule-update-20260901", "dismissed"); } catch (e) { /* ignore */ }
    });
    document.body.prepend(notice);
  }

  function initShared() {
    initLangToggle();
    initAboutToggle();
    initUpdateNotice();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initShared);
  } else {
    initShared();
  }

  window.MSDS = {
    DAY_NAMES,
    DEFAULT_PROGRAMME,
    STORAGE_KEY,
    PROGRAMME_KEY,
    clearSelections,
    cloudReviewsEnabled,
    larkReviewsEnabled,
    courseProgrammes,
    courseTerms,
    courseOfferedInSemester,
    primarySemester,
    termBadgeClass,
    currentAdmin,
    deleteCloudReview,
    escapeHtml,
    renderCourseMentions,
    fetchCloudReviews,
    fetchCloudReviewsBatch,
    findSection,
    formatSection,
    sectionRestrictedProgrammes,
    getUserKey,
    isAdminLoggedIn,
    adminLogin,
    adminLogout,
    currentAdmin,
    getStoredUserNickname,
    studentRegister,
    studentLogin,
    studentLogout,
    currentStudent,
    isStudentLoggedIn,
    saveUserNickname,
    studentSendResetEmail,
    studentUpdatePassword,
    getCourseReview,
    getElectiveGroup,
    getElectiveGroupInfo,
    getProgramme,
    getProgrammes,
    getRecommendation,
    getRequirementType,
    getStoredProgramme,
    getStoredReviews,
    getStoredSelections,
    getStoredSemester,
    saveSemester,
    loadCourseData,
    makeDefaultSelection,
    pickTutorial,
    uniqueByKey,
    ratingFor,
    ratingStars,
    recommendationBadge,
    removeCourseReview,
    saveCourseReview,
    saveProgramme,
    saveSelections,
    sectionKey,
    showToast,
    submitCloudReview,
    getStoredLang,
    saveLang,
    t,
    applyLang,
    createSearchSelect
  };
})();
