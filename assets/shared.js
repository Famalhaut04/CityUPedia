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
      // 课程数已超千门，一次性并发拉取全部 sections/reviews 会触发浏览器
      // 并发连接上限（net::ERR_INSUFFICIENT_RESOURCES / Failed to fetch），
      // 改用小并发池顺序消化，总耗时增加约 1–2 秒但加载稳定。
      const mapPool = (items, limit, worker) => {
        const results = new Array(items.length);
        let next = 0;
        const runNext = () => {
          if (next >= items.length) return Promise.resolve();
          const i = next++;
          return Promise.resolve(worker(items[i], i)).then((value) => {
            results[i] = value;
            return runNext();
          });
        };
        return Promise.all(
          Array.from({ length: Math.min(limit, items.length) }, runNext)
        ).then(() => results);
      };
      courseDataPromise = Promise.all([
        getJson("data/courses/index.json"),
        getJson("data/sources.json")
      ]).then(([index, sources]) => Promise.all([
        mapPool(index.courses, 24, (course) => Promise.all([
          getJson(`data/sections/${encodeURIComponent(course.code)}.json`),
          getJson(`data/reviews/${encodeURIComponent(course.code)}.json`)
        ]).then(([eligibleSections, recommendation]) => ({
          ...course,
          eligible_sections: eligibleSections,
          recommendation
        }))),
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
      }))).then((data) => {
        registerDataPhrases(data);
        translateDOM(document.body);
        return data;
      });
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
      const v = localStorage.getItem(LANG_KEY);
      return v === "en" || v === "zh-Hant" ? v : "zh";
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


  // ==================== 运行时三语翻译（简体原文 → 繁体/英文） ====================
  const S2T_SRC = "与专业两个临为么习书争于云产仅从价会传伦体余储关兽内册写冲决准击划则创删别办务动区医华单卖占卫历压参双发变号后吗启员国图场块处备复够学实审对导将届属师带并床库应开强归当录忆态总戏战抢护报拟择换据数断无时显暂术机权条来构标栏检槛毕汇没泪测济浏游满点状独环现电画盖码础硕确积称笔筑筹签简类红级纲纳线组细终绍经结给络统继绩续维综缀编网职联艺节荐获营补见观规视览计认讨训议讯记许论设访证评识译试话该详语误说请读课谈谢谨财败账贸费资赛车转软轻载较辅输过运还这进连适选遗邮采钮银链销锐错门闭问间阅阶际险隐难页项须预领颖题额风马驱驶驾验齐";
  const S2T_DST = "與專業兩個臨為麼習書爭於雲產僅從價會傳倫體餘儲關獸內冊寫衝決準擊劃則創刪別辦務動區醫華單賣佔衞歷壓參雙發變號後嗎啓員國圖場塊處備復夠學實審對導將屆屬師帶並牀庫應開強歸當錄憶態總戲戰搶護報擬擇換據數斷無時顯暫術機權條來構標欄檢檻畢匯沒淚測濟瀏遊滿點狀獨環現電畫蓋碼礎碩確積稱筆築籌籤簡類紅級綱納線組細終紹經結給絡統繼績續維綜綴編網職聯藝節薦獲營補見觀規視覽計認討訓議訊記許論設訪證評識譯試話該詳語誤説請讀課談謝謹財敗賬貿費資賽車轉軟輕載較輔輸過運還這進連適選遺郵採鈕銀鏈銷鋭錯門閉問間閲階際險隱難頁項須預領穎題額風馬驅駛駕驗齊";
  const HANT_FIX = [["信息", "資訊"], ["默认", "預設"], ["打印", "列印"], ["周", "週"]];

  let EN_PHRASE = {"按课程代码搜索":"Search by course code","按上课星期筛选":"Filter by weekday","按学期筛选":"Filter by term","按学院与院系浏览课程，查看所有使用者的共享评价，也可以直接为心仪的课程提交评价":"Browse courses by college and department, read shared reviews from everyone, and submit your own review for a course","班次":"Section","班次可在「已选」中切换":"Switch sections in the Selected tab","保存评价":"Save review","保存中":"Saving","本地口碑分":"Local rating","本地已保存，但云端同步失败":"Saved locally, but cloud sync failed","本地资料没有足够信息，暂不作判断":"Not enough information to judge yet.","本学期课表名称":"Timetable name for this term","本页图片加载失败，请使用上方原 PDF 备用入口":"Failed to load this page image; please use the original PDF link above","本页暂时没有中文翻译":"No Chinese translation for this page yet","必修":"Core","毕业学分":"Credits to graduate","不可正常网页注册，请联系课程单位":"Web registration unavailable; please contact the offering unit","仓库":"Repository","查看":"View","查看课表":"View timetable","查看上一页中英文课程介绍":"View previous page of the bilingual course introduction","查看下一页中英文课程介绍":"View next page of the bilingual course introduction","查看原文":"View original post","城大百科":"CityU Pedia","城大官网":"CityU Website","窗口二：问题描述":"Field 2: Issue description","窗口一：姓名":"Field 1: Name","次评分 · 条评论":" ratings ·  reviews","从左侧加入课程":"Add courses from the left panel","单独打开当前英文原文页图":"Open the current original page image in a new tab","当前项目下没有符合条件的课程":"No courses match the filters in this programme","当前项目学分要求":"Credit requirements of the selected programme","当前学期还没有加入课程，无法导出":"No courses added in this term; nothing to export","当前已登录":"Currently signed in","导出":"Export","地点":"Venue","地点待定":"Venue TBA","的个人评价吗":"'s review?","的评价":"'s review","登 录":"Sign In","登录":"Sign in","登录 / 注册":"Sign In / Sign Up","登录：学生登录后提交课程评价，管理员登录后可管理云端评价":"Sign in: students submit course reviews; administrators manage cloud reviews","登录方式":"Sign-in method","登录后才能提交云端评价":"Sign in to submit cloud reviews","登录后即可为课程提交评价；你的评价会同步到云端并显示昵称":"Sign in to review courses; your review syncs to the cloud with your nickname","登录后评价默认显示的昵称":"Nickname shown with your reviews after signing in","登录失败：邮箱或密码错误":"Sign-in failed: wrong email or password","登录中":"Signing in","第 1 页":"Page 1","第二学期":"Semester B","第一学期":"Semester A","点击取消选择":"Click to deselect","发送失败":"Send failed","发送中":"Sending","发送重置邮件":"Send reset email","发现 Bug、课程数据有误或有任何建议":"Found a bug, a data error, or have suggestions?","反馈已生成":"Feedback ready","返回":"Back","返回登录":"Back to sign in","返回课程表":"Back to timetable","返回课程列表":"Back to course list","返回课程评价":"Back to reviews","返回课程详情":"Back to course details","非网页注册":"Not web-registerable","分（满分 5 分":" out of 5","分享你的课程体验":"Share your course experience","复制内容":"Copy content","复制失败，请手动选择复制":"Copy failed; please select and copy manually","该课程在":"This course runs in","该课程暂无归属项目":"This course belongs to no programme","该项目的课程数据待补充":"Course data for this programme is coming soon","该学院硕士项目数据筹备中":"Programme data for this college is in preparation","该院系暂无课程数据":"No course data for this department yet","该账号无管理员权限":"This account has no administrator access","个主课班次":" lecture sections","更多":"More","更多精彩内容，欢迎关注 CSSA 官方社交媒体账号，获取最新活动资讯与福利信息":"Follow CSSA on social media for the latest events and perks!","更新评价":"Update review","公关外联部":"PR & Outreach Department","共享评价加载失败":"Failed to load shared reviews","关闭":"Dismiss","关于我们":"About Us","关于我们 · 香港城市大学中国学生学者联合会":"About Us · CityUHK CSSA","关注我们":"Follow Us","官方认证 · 非政治 · 非盈利 · 服务全体城大学生与学者":"Officially recognised · Non-political · Non-profit · Serving all CityU students and scholars","官方项目介绍":"Official programme page","管理员":"Administrator","管理员登录":"Administrator sign-in","管理员登录成功":"Administrator signed in","管理员登录后可删除任意云端评价；仅限指定管理员邮箱":"Administrators may remove any cloud review; restricted to designated emails","管理员登录失败：邮箱或密码错误":"Administrator sign-in failed: wrong email or password","管理员删除":"Removed by administrator","管理员已登录":"Administrator signed in:","管理员邮箱":"Administrator email","国际交流与跨文化合作":"international exchange and cross-cultural collaboration","国际事务部":"International Affairs Department","还没有课程":"No courses yet","还没有其他使用者的共享评价，来抢首评吧":"No shared reviews yet — be the first to review!","还没有账号":"No account yet?","核心":"Core","核心课":"Core course","互斥课程":"Exclusion(s)","回到":"Back to","活动策划与组织执行":"event planning and execution","计算学院":"College of Computing","加入":"Add","加入课表":"Add to timetable","加入课程后，可点击课表块查看详情":"After adding a course, click its timetable block for details","加入我们":"Join Us","将课表导出为图片型 PDF 文件":"Export the timetable as an image-based PDF","教师":"Instructor","结果弹窗":"Result dialog","仅限":"Restricted to","仅限：":"Restricted to:","CRN / 注册":"CRN / Registration","总":"Total","导出 PDF":"Export PDF","一":"Mon","二":"Tue","三":"Wed","四":"Thu","五":"Fri","六":"Sat","日":"Sun","门":" courses","分":" credits","微信公众号 · 城大CSSA":"WeChat · CityU CSSA","小红书 · 香港城市大学CSSA":"RED · CityU CSSA","数据读取失败：":"Failed to load data: ","选修课（":"Elective (","核心课（":"Core (","）":")","无":"None","课程名称与课表一致":"course title matches AIMS","开始排课":"Start planning","可网页注册":"Web-registerable","可选班次":"Available Sections","课表":"Timetable","课表快照":"Timetable snapshot:","课表学期切换":"Switch timetable term","课表已清空":"Timetable cleared","课程表规划器":"Timetable Planner","课程介绍内容导航":"Course introduction navigation","课程介绍索引读取失败":"Failed to load the course introduction index","课程类型":"Course type","课程类型筛选":"Course type filters","课程列表与评价":"Course list & reviews","课程面板":"Course panel","课程名称与课表一致":"course title matches AIMS","课程评分":"Course rating","课程评价":"Course Reviews","课程评价表单":"Course review form","课程评价中心":"Review Center","课程评价中心：按学院与院系浏览课程，查看与分享云端共享评价":"Review Center: browse courses by college and department, read and share cloud reviews","课程事实":"Course Facts","课程数据待补充":"Course data coming soon","课程数据加载失败":"Failed to load course data","课程文件":"Course document","课程详情":"Course Details","课程详情、班次和学生评价":"course details, sections and student reviews","课程页图与中文翻译页数不一致":"Page counts of the original pages and the translation mismatch","课程预览":"Course preview","课程总数":"Total courses","口碑评分":"Rating","例如：数据科学硕士":"e.g. MSc Data Science","两次输入的密码不一致":"The two passwords do not match","浏览课程":"Browse Courses","留下你的信息与问题描述，我们会尽快跟进处理":"Leave your info and a description of the issue; we will follow up as soon as possible","吗？该操作不可恢复":"? This cannot be undone","没有匹配的项目":"No matching programmes","没有匹配的学院":"No matching colleges","没有匹配的院系":"No matching departments","没有匹配项":"No matches","没有找到这门课程":"Course not found","密码":"Password","密码更新失败":"Failed to update password","密码至少 6 位":"Password must be at least 6 characters","目前还与候选区间有交集":"currently overlaps the candidate range","内容创作与品牌传播":"content creation and brand communication","你的信息":"Your info","昵称（不填显示匿名":"Nickname (anonymous if left blank","昵称（选填":"Nickname (optional","匿名":"Anonymous","排课系统":"Timetable Planner","匹配的课程":"matching courses","平均分":"Average","平均评分":"Average rating","评分":"Rating","评分与评语仅保存在当前浏览器本地，仅供自己参考（云端共享未启用":"Ratings and comments are stored in this browser only (cloud sharing disabled","评价已删除":"Review deleted","评价中心统计":"Review center statistics","评价总数":"Total reviews","其他":"Others","其他学院":"Other colleges","其他院系":"Other departments","企业合作与资源拓展":"corporate partnership and resource development","清空":"Clear","请复制以下内容，发送给管理员或提交到":"Please copy the following and send it to the administrators or submit it to","请描述你遇到的问题":"Describe the issue you met","请描述你遇到的问题或建议":"Describe your issue or suggestion","请稍候":"Please wait","请输入你的姓名或昵称":"Your name or nickname","请输入邮箱和密码":"Enter email and password","请输入注册邮箱":"Enter your registered email","请填写姓名":"Name is required","请填写专业":"Programme is required","请通过本地服务器打开网站":"Please open the site through a local server.","请先登录":"Please sign in first","请先登录后再提交评价（登录后可分享到云端":"Sign in before submitting a review (reviews can be shared to the cloud","请先选择星级评分":"Please pick a star rating first","请先选择学院与院系，即可查看该系的课程列表":"Select a college and department to view its course list","请详细描述问题现象、出现的页面和操作步骤，或写下你的建议":"Describe the symptom, the page and the steps, or write your suggestion","请选择":"Select","取消选择":"Deselect","去登录":"Sign in","全部":"All","全校八大学院接入":"All 8 Colleges Added","缺少课程编号":"Missing course code.","确定":"OK","确定删除":"Delete","确认新密码":"Confirm new password","日常运营与社群维护":"daily operations and community maintenance","删除":"Delete","删除你提交的这条评价":"Delete this review of yours","删除失败":"Delete failed","删除这条评价":"Delete this review","删除中":"Deleting","上课日":"Weekday","上课时间":"Class time","上一页":"Previous","设置成功后即可用新密码登录":"Sign in with the new password once it is set","设置新密码":"Set new password","设置新密码：邮箱重置链接回跳后使用":"Set a new password: used after following the email reset link","时间":"Time","首页":"Home","授课教师":"Instructor","授课语言":"Medium","输入注册邮箱后，我们会发送一封密码重置邮件，点击邮件中的链接即可设置新密码":"Enter your registered email and we will send a password reset link","暑期":"Summer","数据采集自 CityU AIMS 系统。名额和注册状态会变化，请以 CityU 系统为准":"Data collected from CityU AIMS. Seats and registration status may change — always refer to CityU systems","数据读取失败":"Failed to load data","数据科学理学硕士":"MSc Data Science","硕士项目":"Master's programme","硕士项目数据筹备中":"Programme data in preparation","搜索":"Search","搜索课程":"Search courses","搜索课程代码，如":"Search a course code, e.g.","搜索课号或课程名":"Search code or title","搜索项目代码或名称":"Search programme code or name","搜索学院":"Search colleges","搜索院系":"Search departments","所属项目":"Programmes","所有使用者的共享评价，定期同步自审核数据库":"Shared reviews from all users, periodically synced from the moderated database.","提交到":"submit to","提交反馈":"Submit feedback","提交评价":"Submit Review","提交时间":"Submitted at","填写下方表单提交你的课程评价，提交后由 CSSA 管理员审核通过后展示":"Fill in the form below to submit a review; it appears after CSSA moderation","条评价":" reviews","同学测评":"Student reviews","退出登录":"Sign out","网页默认加载课程页图，不再使用":"The page loads course page images instead of","忘记密码":"Forgot password","忘记密码：输入邮箱发送重置邮件":"Forgot password: enter email to receive a reset link","微信公众号 · 城大":"WeChat Official Account · CityU","为同学们提供多元化的锻炼平台":"A platform with diverse opportunities for students:","未登录：提交评价需登录账号":"Not signed in: an account is required to review","未排入课表（无固定上课时段":"Not scheduled (no fixed meeting time","未评分":"Unrated","未填写评语":"No comment","未找到与":"No courses found matching","问题反馈":"Feedback","问题反馈专用样式":"Feedback-specific styles","问题描述":"Issue description","我的课表":"My Timetable","我的评价":"My review","我们正按学院逐步收录香港城市大学各授课式硕士项目，当前已上线计算学院（College of Computing）与创新学院（CityUHK Academy of Innovation）的项目数据。欢迎通过「问题反馈」告诉我们你想优先看到的项目":"We are rolling out taught master's programmes college by college; the College of Computing and the CityUHK Academy of Innovation are already online. Tell us which programmes you want next via Feedback","无可选班次，该课程不排入课表":"No selectable sections; this course is not scheduled","无论你是希望提升组织协调能力、积累职场资源，还是单纯想结识志同道合的伙伴，CSSA 都是你不容错过的成长舞台。欢迎加入我们的大家庭，在金秋校园与我们相遇，一起书写属于你的城大篇章":"Whether you want to sharpen your organisational skills, build career resources, or simply meet like-minded friends, CSSA is a stage you should not miss. Join our family and write your own CityU chapter!","五大常设部门":"Five Standing Departments","下一页":"Next","下载":"Download","先修课程未加入":"Prerequisite not added","先修要求":"Prerequisite(s)","先选择学院，再选择院系与硕士项目，即可按对应培养方案浏览课程、比较班次并规划每周课表；左侧悬停可预览课程评价与时段":"Pick a college, then a department and programme to browse its curriculum, compare sections and plan your weekly timetable; hover a course on the left to preview reviews and times","香港城市大学授课式硕士排课与课程评价综合平台，支持计算学院七大硕士项目":"A one-stop platform of timetable planning and course reviews for CityU taught master's students","香港城市大学中国学生学者联合会":"CityUHK Chinese Students and Scholars Association","香港城市大学中国学生学者联合会（CityUHK CSSA）是官方认证、非政治、非盈利的学生组织，致力于服务全体城大学生与学者。我们提供免费的学业支持、职业发展、反诈宣传及":"The CityUHK Chinese Students and Scholars Association (CSSA) is an officially recognised, non-political, non-profit student organisation serving all CityU students and scholars. We offer free academic support, career development and anti-fraud programmes, plus 40+","详情":"Details","详细课程介绍":"Full Course Introduction","详细课程介绍、英文 PDF 原文与中文翻译":"Full introduction, original English PDF and Chinese translation","项目介绍":"Programme page","小红书 · 香港城市大学":"Xiaohongshu (RED) · CityU","写评价":"Write a review","写下你的课程感受、上课体验或避坑建议":"Write how the course went, your class experience, or tips to avoid pitfalls","新密码":"New password","新密码已设置，请用新密码登录":"New password set; please sign in with it","新增商学院、人文社会科学院、理学院、生物医学院、兽医学及生命科学院、创意媒体学院、能源及环境学院、法律学院共 47 个官方硕士项目，并逐课对照官方课程页复核：累计剔除 282 门不开设课程、对齐 82 门开课学期、回填 16 门班次":"47 more official taught master's programmes across Business, Liberal Arts & Social Sciences, Science, Biomedicine, Veterinary Medicine, Creative Media, Energy & Environment, and Law — every course re-verified against its official 2026/27 catalogue page: 282 not-offered courses removed, 82 offering terms aligned, 16 timetables restored","兴趣社团，并定期举办名企参访、粤语课堂、春节嘉年华等丰富活动":" interest clubs, plus company visits, Cantonese classes and Spring Festival carnivals","姓名":"Name","宣传部":"Publicity Department","选修":"Elective","选修课":"Elective course","选修学分":"Elective credits","选择":"Select","选择硕士项目":"Select a programme","选择系":"Select a department","选择学院":"Select a college","选择院系":"Select a department","学分":"credits","学期":"Term","学期开设，请切换到对应学期":" term; please switch to that term","学生登录":"Student sign-in","学生登录 / 注册":"Student Sign In / Sign Up","学生登录成功":"Student signed in","学生登录后可提交课程评价；管理员登录后可管理云端评价":"Students sign in to submit reviews; administrators manage cloud reviews","学生经验":"Student experience","学生经验摘要":"Student Experience Summary","学生评价":"Student reviews","学生已登录":"Student signed in:","学院":"College","学院与硕士项目选择":"College and programme selection","学院与院系筛选":"College and department filters","已保存":"Saved","已保存于":"Saved to","已导出课表 PDF（图片型":"Timetable PDF exported (image-based","已复制到剪贴板":"Copied to clipboard","已加入":"Added","已加入的课程没有固定时段":"Added courses without fixed times","已加入课表":"Added to timetable","已加入课程快捷操作":"Quick actions for added courses","已评":"Reviewed","已切换":"Switched","已切换到":"Switched to","已切换为中文":"Language switched","已切换至":"Switched to","已取消选择":"Deselected","已删除评价":"Review deleted","已同步到云端，感谢分享":"Synced to the cloud — thanks for sharing","已退出登录":"Signed out","已退出管理员登录":"Administrator signed out","已退出管理员模式":"Administrator mode exited","已选":"Selected","已选核心课":"Selected core","已选且为核心课":"Selected & core","已移除":"Removed","已有账号":"Already have an account","以下内容整理自公开社交平台的学生分享，仅供参考，不构成课程建议":"The following is compiled from public social posts by students, for reference only","以学院为准":"subject to the college","英文课程介绍第":"English introduction page","英文页图与中文翻译同步切换；点击英文图片可单独放大":"The English page and Chinese translation switch together; click the image to enlarge","英文原文":"English original","邮箱":"Email","有班次可网页注册":"Web registration available","与核心课时间冲突":"conflicts with a core course","原 PDF 备用入口":"Original PDF fallback","院系":"Department","阅读说明":"Reading note:","云端共享未启用，暂无法查看其他使用者的评价":"Cloud sharing is disabled; other users' reviews are unavailable","云端共享未启用：管理员需在":"Cloud sharing disabled: administrators must configure","云端评价读取失败":"Failed to load cloud reviews","云端评价提交失败":"Failed to submit cloud review","云端评价未启用":"Cloud reviews disabled","运营部":"Operations Department","再次输入新密码":"Re-enter the new password","暂无冲突":"No conflicts","暂无评分":"No rating yet","暂无评价":"No reviews yet","暂无评价，来抢首评吧":"No reviews yet — be the first!","这门课程暂时没有可用的网页页图":"No page images available for this course yet","这门课程暂时没有详细课程文件":"No detailed course document for this course yet","正在读取课程资料":"Loading course data","正在读取详细课程介绍":"Loading the full course introduction","正在加载课程":"Loading courses","正在加载课程评价":"Loading course reviews","正在加载英文原文页图":"Loading the original page image","直接登录":"Sign in directly","至多":"At most","至少":"At least","中配置 Supabase 数据库地址":" the Supabase URL in","中文":"Chinese","中文翻译":"Chinese translation","中文内容按英文原文逐页整理，仅供理解与课程参考；课程要求、考核规则及阅读资料以英文原文为准":"The Chinese content follows the English original page by page for comprehension only; course requirements, assessment and readings follow the English original","中英文切换":"Language","中英文逐页课程介绍":"Bilingual page-by-page course introduction","中英逐页对照":"Bilingual side-by-side","重置":"Reset","重置链接无效或已过期，请重新申请":"Reset link invalid or expired; please request again","重置邮件已发送，请前往邮箱查收（注意检查垃圾箱":"Reset email sent; please check your inbox (and spam","周二":"Tue","周六":"Sat","周日":"Sun","周三":"Wed","周四":"Thu","周五":"Fri","周一":"Mon","主导航":"Main navigation","主要功能":"Main features","注 册":"Sign Up","注册":"Sign up","注册成功，已自动登录":"Signed up; signed in automatically","注册成功！请前往邮箱点击确认链接后再登录":"Signed up! Please confirm via the email link before signing in","注册失败":"Sign-up failed","注册时使用的邮箱":"The email used at sign-up","注册新账号":"Create an account","注册状态":"Registration","专业":"Programme","自助排课台":"Timetable Studio","综合推荐指数":"Overall recommendation","组织部":"Organisation Department","组织简介":"About the Association","AIMS 班次":"AIMS sections","AIMS 系统":"AIMS","CityU 课表":"CityU timetable","CityU 系统为准":"refer to CityU systems","CSSA 都是你不容错过的成长舞台":"CSSA is a stage you should not miss","CSSA 官方社交媒体账号":"CSSA official social accounts","CSSA 管理员审核通过后展示":"it appears after CSSA moderation","PDF 备用入口":"PDF fallback","PDF 仅作为备用和下载入口":"the PDF serves only as a fallback and download","PDF 文件":"PDF file","PDF 原文与中文翻译":"original PDF and Chinese translation","PDF 阅读器":"PDF reader","PDF 直链":"PDF link","官方大纲 PDF ↗":"Official outline PDF ↗","课程详情 PDF":"Course outline PDF","下载 PDF":"Download PDF","查看详细课程介绍":"View full course introduction","选择时间":"Pick a time","选择 Tutorial":"Pick a tutorial","条评价来源":" review sources","星":"stars","个班次条目":" section entries","门课程冲突":" course conflicts","已选 ":"Selected "," 门":" courses"," 分":" credits","选修课（":"Elective (","）":")"};
  // 子串级安全替换词（班次/时间等组合文本用，避免误译内容区）
  const EN_PARTIAL_KEYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日", "学分", "仅限：", "个主课班次", "暂无评分", "暂无评价", "已加入课表", "查看详情", "课程详情 PDF", "下载 PDF", "查看", "官方项目介绍", "官方大纲 PDF ↗", "已切换至", "已切换到", "条评价", "门课程", "个班次", "第 ", " 页", "硕士项目数据筹备中", "课程数据待补充", "选修课（", "核心课（", "）", "课程名称与课表一致", "数据读取失败："];
  let EN_PARTIAL_RE = null;
  let EN_NAME_RE = null;
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function buildPartialRe() {
    const keys = EN_PARTIAL_KEYS.slice().sort((a, b) => b.length - a.length);
    EN_PARTIAL_RE = keys.length ? new RegExp(keys.map(escapeRe).join("|"), "g") : null;
  }
  buildPartialRe();
  let DATA_NAMES = {};
  function buildNameRe() {
    const keys = Object.keys(DATA_NAMES).sort((a, b) => b.length - a.length);
    EN_NAME_RE = keys.length ? new RegExp(keys.map(escapeRe).join("|"), "g") : null;
  }

  function s2t(s) {
    for (const [from, to] of HANT_FIX) s = s.split(from).join(to);
    let out = "";
    for (const ch of s) {
      const i = S2T_SRC.indexOf(ch);
      out += i >= 0 ? S2T_DST[i] : ch;
    }
    return out;
  }

  function T(text) {
    if (text == null) return text;
    const lang = getStoredLang();
    if (lang === "zh-Hant") return /[\u4e00-\u9fff]/.test(text) ? s2t(String(text)) : text;
    if (lang === "en") {
      const key = String(text).trim();
      if (EN_PHRASE[key] != null) return EN_PHRASE[key];
      if (EN_PARTIAL_RE && /[\u4e00-\u9fff]/.test(key)) {
        return key.replace(EN_PARTIAL_RE, (m) => EN_PHRASE[m] != null ? EN_PHRASE[m] : m);
      }
    }
    return text;
  }

  function registerDataPhrases(data) {
    const add = (zh, en) => {
      if (!zh || !en) return;
      const k = String(zh).trim();
      if (k && EN_PHRASE[k] == null) EN_PHRASE[k] = en;
      if (k && k.length >= 3) DATA_NAMES[k] = en;
    };
    for (const p of (data && data.programmes) || []) {
      add(p.name_zh, p.name_en);
      add(p.department, p.department_en);
      add(p.college, p.college_en);
      for (const g of (p.requirement_credit_units && p.requirement_credit_units.elective_groups) || []) {
        add(g.label_zh, g.label_en);
      }
    }
    for (const c of (data && data.colleges) || []) add(c.name_zh, c.name_en);
    for (const d of (data && data.departments) || []) add(d.name_zh, d.name_en);
    buildNameRe();
  }

  const I18N_SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "TEMPLATE"]);
  const I18N_ATTRS = ["placeholder", "aria-label", "title", "alt"];

  function translateStringForDom(s) {
    const lang = getStoredLang();
    if (lang === "zh" || !s) return s;
    if (lang === "zh-Hant") return /[\u4e00-\u9fff]/.test(s) ? s2t(s) : s;
    const key = s.trim();
    if (EN_PHRASE[key] != null) return EN_PHRASE[key];
    if (/[\u4e00-\u9fff]/.test(key)) {
      let out = key;
      if (EN_NAME_RE) out = out.replace(EN_NAME_RE, (m) => (EN_PHRASE[m] != null ? EN_PHRASE[m] : m));
      if (EN_PARTIAL_RE) out = out.replace(EN_PARTIAL_RE, (m) => (EN_PHRASE[m] != null ? EN_PHRASE[m] : m));
      // 折叠 "English（English）" 重复（含前缀组合）
      out = out.replace(/([^（()]{2,})（\1）/g, "$1");
      out = out.replace(/([^（()]{2,})\(\1\)/g, "$1");
      // " · " 组合：分段各自翻译（精确/名称）
      if (out.includes(" · ")) {
        out = out.split(" · ").map((seg) => {
          const segTrim = seg.trim();
          if (!/[\u4e00-\u9fff]/.test(segTrim)) return seg;
          if (EN_PHRASE[segTrim] != null) return EN_PHRASE[segTrim];
          if (EN_NAME_RE) return seg.replace(EN_NAME_RE, (m) => (EN_PHRASE[m] != null ? EN_PHRASE[m] : m));
          return seg;
        }).join(" · ");
        out = out.replace(/([^（()]{2,})（\1）/g, "$1");
      }
      return out;
    }
    return s;
  }

  let domObserver = null;
  let domTranslateScheduled = false;

  function translateDOM(root) {
    if (getStoredLang() === "zh" || !root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || I18N_SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest && parent.closest("[data-no-i18n]")) return NodeFilter.FILTER_REJECT;
        if (!/[\u4e00-\u9fff]/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const out = translateStringForDom(node.nodeValue);
      if (out !== node.nodeValue) node.nodeValue = out;
    }
    // 属性
    const els = root.querySelectorAll ? root.querySelectorAll("[placeholder], [aria-label], [title], [alt]") : [];
    for (const el of els) {
      for (const attr of I18N_ATTRS) {
        const v = el.getAttribute(attr);
        if (v && /[\u4e00-\u9fff]/.test(v)) {
          const out = translateStringForDom(v);
          if (out !== v) el.setAttribute(attr, out);
        }
      }
    }
    if (document.title && /[\u4e00-\u9fff]/.test(document.title)) {
      const out = translateStringForDom(document.title);
      if (out !== document.title) document.title = out;
    }
  }

  function scheduleDomTranslate() {
    if (getStoredLang() === "zh" || domTranslateScheduled) return;
    domTranslateScheduled = true;
    window.setTimeout(() => {
      domTranslateScheduled = false;
      if (!domObserver) return;
      // 防抖窗口内到达的记录可能已被回调消费，直接全量扫 body 兜底
      domObserver.disconnect();
      translateDOM(document.body);
      domObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: false });
    }, 120);
  }

  function startDomTranslation() {
    if (getStoredLang() === "zh" || domObserver) return;
    translateDOM(document.documentElement);
    domObserver = new MutationObserver(scheduleDomTranslate);
    domObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: false });
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
"zh-Hant": {
      "nav.courses": "排課系統",
      "nav.cityu": "城大官網",
      "nav.reviews": "課程評價",
      "nav.lang": "中英文切換",
      "nav.github": "GitHub 倉庫",
      "nav.account": "登錄 / 註冊",
      "nav.group.main": "主要功能",
      "nav.group.more": "更多",
      "intro.eyebrow": "我的課表",
      "intro.title": "自助排課台",
      "intro.desc": "先選擇學院，再選擇院系與碩士項目，即可按對應培養方案瀏覽課程、比較班次並規劃每週課表；左側懸停可預覽課程評價與時段。",
      "stat.graduation": "畢業學分",
      "stat.requirement": "核心 + 選修",
      "prog.label": "碩士項目",
      "college.label": "學院",
      "department.label": "院系",
      "college.placeholder": "選擇學院",
      "college.search": "搜索學院",
      "department.placeholder": "選擇院系",
      "department.search": "搜索院系",
      "prog.placeholder": "選擇碩士項目",
      "prog.search": "搜索項目代碼或名稱",
      "tab.browse": "瀏覽課程",
      "tab.selected": "已選",
      "search.placeholder": "搜索課號或課程名",
      "filter.all": "全部",
      "filter.core": "核心",
      "filter.elective": "選修",
      "day.label": "上課日",
      "day.all": "全部",
      "toolbar.clear": "清空",
      "conflict.clear": "暫無衝突",
      "empty.timetable.title": "從左側加入課程",
      "empty.timetable.desc": "班次可在「已選」中切換",
      "empty.unscheduled.title": "已加入的課程沒有固定時段",
      "timetable.unscheduled.note": "未排入課表（無固定上課時段）：",
      "selected.nosection": "無可選班次，該課程不排入課表",
      "course.detail.title": "課程詳情",
      "syllabus.title": "詳細課程介紹",
      "nav.about": "關於我們",
      "about.subtitle": "CityUHK CSSA · 關於我們",
      "about.intro.title": "組織簡介",
      "about.intro": "香港城市大學中國學生學者聯合會（CityUHK CSSA）是官方認證、非政治、非盈利的學生組織，致力於服務全體城大學生與學者。我們提供免費的學業支持、職業發展、反詐宣傳及 40+ 興趣社團，並定期舉辦名企參訪、粵語課堂、春節嘉年華等豐富活動。",
      "about.dept.title": "五大常設部門",
      "about.dept.desc": "為同學們提供多元化的鍛鍊平台：",
      "about.join.title": "加入我們",
      "about.cta": "無論你是希望提升組織協調能力、積累職場資源，還是單純想結識志同道合的夥伴，CSSA 都是你不容錯過的成長舞台。歡迎加入我們的大家庭，在金秋校園與我們相遇，一起書寫屬於你的城大篇章！",
      "about.follow.title": "關注我們",
      "about.follow": "更多精彩內容，歡迎關注 CSSA 官方社交媒體賬號，獲取最新活動資訊與福利信息！",
      "nav.feedback": "問題反饋",
      "feedback.hero.title": "問題反饋",
      "feedback.hero.line1": "發現 Bug、課程數據有誤或有任何建議？",
      "feedback.hero.line2": "留下你的信息與問題描述，我們會盡快跟進處理。",
      "feedback.section.info": "你的信息",
      "feedback.label.name": "姓名",
      "feedback.label.programme": "專業",
      "feedback.placeholder.name": "請輸入你的姓名或暱稱",
      "feedback.placeholder.programme": "例如：數據科學碩士 / MSc Data Science",
      "feedback.section.description": "問題描述",
      "feedback.label.description": "請描述你遇到的問題或建議",
      "feedback.placeholder.description": "請詳細描述問題現象、出現的頁面和操作步驟，或寫下你的建議…",
      "feedback.btn.reset": "重置",
      "feedback.btn.submit": "提交反饋",
      "feedback.result.title": "反饋已生成",
      "feedback.result.desc": "請複製以下內容，發送給管理員或提交到 GitHub Issues：",
      "feedback.result.copy": "複製內容",
      "feedback.result.github": "提交到 GitHub",
      "feedback.result.close": "關閉",
      "login.title": "登錄",
      "login.desc": "學生登錄後可提交課程評價；管理員登錄後可管理雲端評價。",
      "login.student": "學生登錄",
      "login.admin": "管理員登錄",
      "login.email": "郵箱",
      "login.password": "密碼",
      "login.nickname": "暱稱（選填）",
      "login.noAccount": "還沒有賬號？",
      "login.toRegister": "註冊新賬號",
      "login.hasAccount": "已有賬號？",
      "login.toLogin": "直接登錄",
      "login.studentHint": "登錄後即可為課程提交評價；你的評價會同步到雲端並顯示暱稱。",
      "login.adminHint": "管理員登錄後可刪除任意雲端評價；僅限指定管理員郵箱。",
      "login.forgot": "忘記密碼？",
      "login.sendReset": "發送重置郵件",
      "login.backToLogin": "← 返回登錄",
      "login.forgotHint": "輸入註冊郵箱後，我們會發送一封密碼重置郵件，點擊郵件中的鏈接即可設置新密碼。",
      "login.newPassword": "新密碼",
      "login.confirmPassword": "確認新密碼",
      "login.resetPassword": "設置新密碼",
      "login.resetHint": "設置成功後即可用新密碼登錄。",
      "reviews.title": "課程評價中心",
      "reviews.desc": "按學院與院系瀏覽課程，查看所有使用者的共享評價，也可以直接為心儀的課程提交評價。",
      "reviews.statCourses": "課程總數",
      "reviews.statReviews": "評價總數",
      "reviews.statAvg": "平均評分",
      "reviews.empty": "該院系暫無課程數據。",
      "reviews.reviews": "條評價",
      "reviews.noReviews": "暫無評價，來搶首評吧！",
      "reviews.reviewTitle": "課程評價",
      "reviews.myReview": "我的評價",
      "reviews.nicknamePlaceholder": "暱稱（不填顯示匿名）",
      "reviews.commentPlaceholder": "分享你的課程體驗…",
      "reviews.submit": "提交評價",
      "reviews.loading": "正在加載課程…",
      "reviews.cloudDisabled": "雲端共享未啓用：管理員需在 assets/cloud-config.js 中配置 Supabase 數據庫地址。",
      "reviews.localExp": "學生經驗摘要",
      "reviews.localHint": "以下內容整理自公開社交平台的學生分享，僅供參考，不構成課程建議。",
      "reviews.recommendIndex": "綜合推薦指數",
      "reviews.studentsReviews": "同學測評",
      "reviews.submitTab": "提交評價",
      "reviews.back": "返回課程列表",
      "reviews.heroStats": "次評分 · 條評論",
      "reviews.localScore": "本地口碑分",
      "reviews.writeReview": "寫評價"
    },    en: {
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

  // 把词典 zh→en 对预注入英文短语表（覆盖 stat.requirement 等动态渲染的 dict 文本）
  for (const k of Object.keys(I18N.zh)) {
    if (I18N.en && I18N.en[k] && EN_PHRASE[I18N.zh[k]] == null) EN_PHRASE[I18N.zh[k]] = I18N.en[k];
  }

  function applyLang() {
    const lang = getStoredLang();
    document.documentElement.lang = lang === "zh-Hant" ? "zh-HK" : (lang === "en" ? "en" : "zh-CN");

    // 同步语言下拉菜单
    const langSelect = document.getElementById("lang-select");
    if (langSelect) langSelect.value = lang;

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
    const langSelect = document.getElementById("lang-select");
    if (langSelect) {
      langSelect.value = getStoredLang();
      langSelect.addEventListener("change", () => {
        saveLang(langSelect.value);
        window.location.reload();
      });
    }

    applyLang();
    startDomTranslation();
  }

  // ==================== 关于我们弹窗（已改为独立页面，保留兼容） ====================
  function initAboutToggle() {
    // 关于我们已迁移到 about.html 独立页面，此处保留空函数以兼容旧引用
  }

  function initUpdateNotice() {
    try {
      if (localStorage.getItem("cityu-schedule-update-20261003") === "dismissed") return;
    } catch (e) { /* localStorage 不可用时仍显示通知 */ }
    const lang = getStoredLang();
    const isEn = lang === "en";
    const zhTitle = "全校八大学院接入 · v1.5.0（10/3）";
    const zhBody = "新增商学院、人文社会科学院、理学院、生物医学院、兽医学及生命科学院、创意媒体学院、能源及环境学院、法律学院共 47 个官方硕士项目，并逐课对照官方课程页复核：累计剔除 282 门不开设课程、对齐 82 门开课学期、回填 16 门班次，1,072 门课程接入官方课程详情 PDF 直链（全站 68 项目 / 1,099 门，其中 589 门带 AIMS 班次）。全站界面升级三语下拉切换（简体中文 / 繁體中文 / English），导航、排课、课程详情与评价中心全量翻译。";
    const notice = document.createElement("div");
    notice.className = "update-notice";
    notice.setAttribute("role", "status");
    notice.innerHTML =
      '<div class="update-notice-body">' +
        '<strong>' + (isEn ? "All 8 Colleges Added — v1.5.0 (Oct 3)" : T(zhTitle)) + '</strong>' +
        '<span>' + (isEn
          ? "47 more official taught master's programmes across Business, Liberal Arts & Social Sciences, Science, Biomedicine, Veterinary Medicine, Creative Media, Energy & Environment, and Law — every course re-verified against its official 2026/27 catalogue page: 282 not-offered courses removed, 82 offering terms aligned, 16 timetables restored, and 1,072 courses now link the official course-outline PDF (now 68 programmes / 1,099 courses, 589 with AIMS sections). Community course reviews added for BIS, OSCM, LLM, MACNM and Marketing."
          : T(zhBody)) +
        '</span>' +
      '</div>' +
      '<button class="update-notice-close" type="button" aria-label="' + (isEn ? "Dismiss" : "关闭") + '">&times;</button>';
    notice.querySelector(".update-notice-close").addEventListener("click", () => {
      notice.remove();
      try { localStorage.setItem("cityu-schedule-update-20261003", "dismissed"); } catch (e) { /* ignore */ }
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
    T,
    applyLang,
    registerDataPhrases,
    createSearchSelect
  };
})();
