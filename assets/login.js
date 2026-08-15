/* ============================================================
   CityU Pedia · 登录页（login.html）
   双模式：学生登录（可注册，登录后提交评价）与管理员登录
   （登录后可删除任意云端评价）。登录成功后跳转到来源页面。
   支持：忘记密码（邮箱发送重置邮件）与设置新密码（邮件回跳）。
   ============================================================ */
(function () {
  "use strict";

  const MSDS = window.MSDS || {};

  function t(key) {
    return typeof MSDS.t === "function" ? MSDS.t(key) : key;
  }

  function showToast(message) {
    if (typeof MSDS.showToast === "function") MSDS.showToast(message);
  }

  // 登录成功后的跳转目标（支持 ?next=xxx 回跳）
  function getNextUrl() {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && /^(course|reviews|index|about|feedback)\.html/.test(next)) {
      return next;
    }
    return "reviews.html";
  }

  function goNext() {
    window.location.href = getNextUrl();
  }

  // 显示指定登录面板（学生 / 忘记密码 / 设置新密码 / 管理员）
  function showPanel(id) {
    document.querySelectorAll(".login-tab").forEach((tab) => {
      tab.classList.remove("is-active");
      tab.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".login-panel").forEach((p) => p.classList.remove("is-active"));
    const panel = document.getElementById(id);
    if (panel) panel.classList.add("is-active");
    const mode = id.replace("login-panel-", "");
    const tab = document.querySelector(`.login-tab[data-login-mode="${mode}"]`);
    if (tab) {
      tab.classList.add("is-active");
      tab.setAttribute("aria-selected", "true");
    }
  }

  // ============ Tab 切换：学生 / 管理员 ============
  function initTabs() {
    const tabs = document.querySelectorAll(".login-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        showPanel(`login-panel-${tab.getAttribute("data-login-mode")}`);
      });
    });
  }

  // ============ 学生：登录 / 注册切换 ============
  function initStudentForm() {
    const form = document.getElementById("student-form");
    const emailInput = document.getElementById("student-email");
    const passwordInput = document.getElementById("student-password");
    const nicknameField = document.getElementById("student-nickname-field");
    const nicknameInput = document.getElementById("student-nickname");
    const submitBtn = document.getElementById("student-submit");
    const statusEl = document.getElementById("student-status");
    const switchBtn = document.getElementById("student-switch");
    const switchHint = document.getElementById("student-switch-hint");
    const forgotBtn = document.getElementById("student-forgot");

    let mode = "login"; // login | register

    function setStatus(message, isError) {
      statusEl.textContent = message;
      statusEl.classList.toggle("is-error", Boolean(isError));
    }

    function setMode(next) {
      mode = next;
      if (mode === "register") {
        nicknameField.hidden = false;
        submitBtn.textContent = "注 册";
        switchHint.textContent = t("login.hasAccount") || "已有账号？";
        switchBtn.textContent = t("login.toLogin") || "直接登录";
      } else {
        nicknameField.hidden = true;
        submitBtn.textContent = "登 录";
        switchHint.textContent = t("login.noAccount") || "还没有账号？";
        switchBtn.textContent = t("login.toRegister") || "注册新账号";
      }
    }

    switchBtn.addEventListener("click", () => {
      setMode(mode === "login" ? "register" : "login");
      setStatus("", false);
    });

    // 忘记密码：切换到发送重置邮件面板
    forgotBtn.addEventListener("click", () => {
      showPanel("login-panel-forgot");
      const emailEl = document.getElementById("forgot-email");
      if (emailEl && emailInput.value) emailEl.value = emailInput.value;
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      if (!email || !password) {
        setStatus("请输入邮箱和密码", true);
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = "请稍候…";
      try {
        if (mode === "register") {
          const result = await MSDS.studentRegister(email, password, nicknameInput.value.trim());
          if (result.needVerify) {
            setStatus("注册成功！请前往邮箱点击确认链接后再登录。", false);
            submitBtn.disabled = false;
            submitBtn.textContent = "注 册";
          } else {
            showToast("注册成功，已自动登录");
            goNext();
          }
        } else {
          await MSDS.studentLogin(email, password);
          showToast("学生登录成功");
          goNext();
        }
      } catch (error) {
        setStatus(error.message, true);
        submitBtn.disabled = false;
        submitBtn.textContent = mode === "register" ? "注 册" : "登 录";
      }
    });

    // 默认显示登录模式
    setMode("login");
  }

  // ============ 忘记密码：发送重置邮件 ============
  function initForgotForm() {
    const form = document.getElementById("forgot-form");
    const emailInput = document.getElementById("forgot-email");
    const submitBtn = document.getElementById("forgot-submit");
    const statusEl = document.getElementById("forgot-status");
    const backBtn = document.getElementById("forgot-back");

    backBtn.addEventListener("click", () => {
      showPanel("login-panel-student");
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = emailInput.value.trim();
      if (!email) {
        statusEl.textContent = "请输入注册邮箱";
        statusEl.classList.add("is-error");
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = "发送中…";
      statusEl.textContent = "";
      statusEl.classList.remove("is-error");
      try {
        await MSDS.studentSendResetEmail(email);
        statusEl.textContent = "重置邮件已发送，请前往邮箱查收（注意检查垃圾箱）。";
        statusEl.classList.remove("is-error");
      } catch (error) {
        statusEl.textContent = error.message;
        statusEl.classList.add("is-error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = t("login.sendReset") || "发送重置邮件";
      }
    });
  }

  // ============ 设置新密码：邮箱重置链接回跳后使用 ============
  // Supabase 重置邮件链接形如：
  //   https://<site>/login.html#access_token=xxx&type=recovery&expires_at=...
  function initResetForm() {
    const form = document.getElementById("reset-form");
    const passwordInput = document.getElementById("reset-password");
    const confirmInput = document.getElementById("reset-password-confirm");
    const submitBtn = document.getElementById("reset-submit");
    const statusEl = document.getElementById("reset-status");

    // 从 URL hash 中提取重置 access_token
    let resetToken = "";
    try {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      if (hash.get("type") === "recovery" && hash.get("access_token")) {
        resetToken = hash.get("access_token");
      }
    } catch { /* ignore */ }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const pw = passwordInput.value;
      const confirm = confirmInput.value;
      if (!resetToken) {
        statusEl.textContent = "重置链接无效或已过期，请重新申请。";
        statusEl.classList.add("is-error");
        return;
      }
      if (pw.length < 6) {
        statusEl.textContent = "密码至少 6 位";
        statusEl.classList.add("is-error");
        return;
      }
      if (pw !== confirm) {
        statusEl.textContent = "两次输入的密码不一致";
        statusEl.classList.add("is-error");
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = "保存中…";
      statusEl.textContent = "";
      statusEl.classList.remove("is-error");
      try {
        await MSDS.studentUpdatePassword(resetToken, pw);
        statusEl.textContent = "新密码已设置，请用新密码登录。";
        statusEl.classList.remove("is-error");
        // 清空 URL hash，避免刷新后重复提交
        history.replaceState(null, "", window.location.pathname + window.location.search);
        setTimeout(() => showPanel("login-panel-student"), 1200);
      } catch (error) {
        statusEl.textContent = error.message;
        statusEl.classList.add("is-error");
        submitBtn.disabled = false;
        submitBtn.textContent = t("login.resetPassword") || "设置新密码";
      }
    });
  }

  // ============ 管理员登录 ============
  function initAdminForm() {
    const form = document.getElementById("admin-form");
    const emailInput = document.getElementById("admin-email");
    const passwordInput = document.getElementById("admin-password");
    const submitBtn = document.getElementById("admin-submit");
    const statusEl = document.getElementById("admin-status");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      if (!email || !password) {
        statusEl.textContent = "请输入邮箱和密码";
        statusEl.classList.add("is-error");
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = "请稍候…";
      statusEl.textContent = "";
      statusEl.classList.remove("is-error");
      try {
        const session = await MSDS.adminLogin(email, password);
        if (!session.isAdmin) {
          MSDS.adminLogout();
          throw new Error("该账号无管理员权限");
        }
        showToast("管理员登录成功");
        goNext();
      } catch (error) {
        statusEl.textContent = error.message;
        statusEl.classList.add("is-error");
        submitBtn.disabled = false;
        submitBtn.textContent = "登 录";
      }
    });
  }

  // ============ 初始化 ============
  function init() {
    if (typeof MSDS.applyLang === "function") {
      MSDS.applyLang();
    }
    // 已登录学生/管理员：提示已登录，可前往课程评价
    const student = MSDS.currentStudent ? MSDS.currentStudent() : null;
    const admin = MSDS.currentAdmin ? MSDS.currentAdmin() : null;
    if (student || admin) {
      const hint = document.createElement("p");
      hint.className = "login-session-hint";
      hint.textContent = `当前已登录：${student ? student.email : admin.email}`;
      const card = document.querySelector(".login-card");
      if (card) card.prepend(hint);
    }

    initTabs();
    initStudentForm();
    initForgotForm();
    initResetForm();
    initAdminForm();

    // 重置邮件回跳：URL hash 含 recovery token 时，直接显示设置新密码面板
    try {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      if (hash.get("type") === "recovery" && hash.get("access_token")) {
        showPanel("login-panel-reset");
      }
    } catch { /* ignore */ }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
