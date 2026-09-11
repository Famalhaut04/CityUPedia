# 参与贡献指南（How to Contribute）

> CityU Pedia（城大百科）即将在开源社区开放共建。本文档说明加入流程、贡献方向与开发约定。
> 当前开发与协作均在 **CityUPediaTest** 仓库（本仓库）进行；线上正式版 CityUPedia 由维护者定期同步发布。

## 加入流程（三步）

面向香港城市大学学生开放，按以下顺序完成加入：

### 第 1 步 · 身份验证

准备以下信息，证明你是香港城市大学的学生：

- **实名**（与证件一致的中文或拼音姓名）
- **学生 ID**（Student ID，学号）

### 第 2 步 · 联系我们

将上述验证信息通过以下任一渠道发送给维护者：

- **邮箱**：[fomalhautskywalker@gmail.com](mailto:fomalhautskywalker@gmail.com)（推荐，处理最快）
- **微信**：通过微信公众号「城大CSSA」留言，或使用维护者在开源公告中公布的个人微信号

> 🔒 **隐私说明**：实名与学生 ID **仅用于身份核验**，不会被提交到任何 Git 仓库、不会出现在网站或 Issue 中。核验通过后即不再保留；你在项目中的公开身份就是你的 GitHub 账号。

### 第 3 步 · 在 GitHub 提交申请

身份验证通过后，回到 GitHub 完成申请（二选一）：

| 方式 | 适合人群 | 做法 |
|------|----------|------|
| **A. Pull Request** | 想直接提交改动 | Fork 本仓库 → 新建分支开发 → 提交 PR，并在 PR 描述中注明核验时分配给你的确认标记 |
| **B. 申请 Collaborator** | 长期参与、需要直接提交分支 | 新建 Issue，标题使用「贡献者申请」，附上核验确认标记与 GitHub 用户名，维护者审核后会发送 Collaborator 邀请 |

## 贡献方向

- **班次数据**：对照 CityU AIMS 更新 `data/sections/<课程代码>.json`（开课时间、教师、教室、CRN）
- **课程评价**：按 `data/sources.json` + `data/source-reviews/` + `data/reviews/` 三层结构整理社区评价，**必须附原帖链接，保留原作者措辞，不得编造**
- **课程资料**：`docs/` 官方课程 PDF 与 `data/course-documents/` 逐页翻译
- **前端功能与修复**：排课器（`assets/planner.js`）、课程页（`assets/course.js`）、共享组件（`assets/shared.js`）等
- **新学院/新项目扩展**：在 `data/courses/index.json` 的 `programmes` / `colleges` 中按官方名称登记

## 本地开发

数据通过 `fetch()` 加载，请通过本地服务器访问（直接双击 HTML 会因跨域失败）：

```bash
git clone https://github.com/Famalhaut04/CityUPediaTest.git
cd CityUPediaTest
python -m http.server 8000
# 浏览器打开 http://localhost:8000/index.html
```

## 仓库与数据约定

- **目录结构**见 [README](README.md)。课程数据四层：`data/courses/index.json`（课程与项目元数据）→ `data/sections/`（AIMS 班次）→ `data/reviews/`（评价结论）→ `data/source-reviews/`（按来源的原文摘录），来源登记在 `data/sources.json`
- **换行符**：仓库内文件换行符不统一（HTML/CSS 多为 CRLF，JS/JSON 多为 LF）。提交前请只改动需要的行，避免「整文件保存/重排」引入全文件噪音；不确定时可用 `git diff` 检查是否出现整文件变更
- **缓存版本号**：修改 `assets/*.js` 或 `assets/*.css` 后，请同步更新引用页面中的 `?v=` 参数（如 `course.js?v=20260911a`）
- **提交信息**：使用 `类型(范围): 中文描述` 格式，类型取 `feat` / `fix` / `data` / `docs` / `chore`，例如 `data: CS5483 SemB 班次时间更新`、`fix(course): 来源区占位卡不再显示`

## 发布流程（测试版先行）

1. 所有改动先进入 **CityUPediaTest** 的 `main` 分支
2. 推送后在测试站 https://famalhaut04.github.io/CityUPediaTest/ 在线验证
3. 验证通过后由维护者同步到正式版 **CityUPedia**（同时推送 `main` 与 `v1.0` 分支，GitHub Pages 从 `v1.0` 部署）

普通贡献者只需完成第 1 步；第 2、3 步由维护者执行。

## 审核

- Pull Request 由维护者 Review 后合入 `main`，一般 48 小时内响应
- 涉及学生评价的数据类 PR，会额外核对原帖链接真实性
- 长期活跃的贡献者可晋升为 Collaborator，参与 Review 与数据同步
