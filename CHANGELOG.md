# 更新日志 / Changelog

## 正式版 1.0（CityUPedia 1.0）· 2026-08-15

> 正式上线。发布至新仓库 `CityUPedia`；对照城大官网核对七大项目核心课程并修正 2 处差异，完成全站数据校验与 HTTP 测试。

### 核心课程核对与修正

- **对照城大官网逐项核对**：核对计算学院七大授课型硕士项目（MSDS、MSCS、MSAI、MSCY、MSBIOS、MSEC、MSAIFS）的核心课程与学分要求
- **MSBIOS 补全 2 门核心课**：按官网 P97 培养方案补全「一体化健康生物统计概论（PH5102）」与「流行病学与一体化健康原理（PH5103）」，核心课由 5 门增至 7 门（21 学分），并下载官方大纲 PDF、登记文档索引、补建班次与评价数据文件
- **MSEC 补全信息安全核心课**：按官网 P17 培养方案将 CS5285（网络安全导论）映射为电子商贸核心课（对应「电子商务信息安全」），核心课由 4 门增至 5 门（15 学分）

### 夏季学期课程与排课台修复

- **夏季学期独立选课块**：新增 Summer 暑期课程，7 个项目各含 capstone 项目 / 论文 / 指导研究课程——CS6520 Project（MSCS，官方培养方案确认的「Project (continued)」）、CS6535（MSAI）、CS6531（MSCY）、EC6001（MSEC）、DSC6006 Dissertation（MSDS）、BIOS6903（MSBIOS）、DSC6024（MSAIFS）
- **双学期表示（按官方课程文档修正）**：6 学分课程（CS6520、CS6531、EC6001、DSC6024）在 SemB 与 Summer 均开设，`semester_tag` 记为 `SemB+Summer`；3 学分课程（DSC6006、BIOS6903、CS6535）仅 Summer 开设。排课台按学期展开为独立筛选标签，同一门课可同时出现在 SemB 与 Summer 两个选课块
- **夏季学期时间**：Summer Term 2026 为 2026-06-08 至 2026-07-25（以 AIMS Master Class Schedule 为准，暑期以项目 / 论文 / 实习延续为主，不含常规授课班）
- **学期切换联动**：切换 SemA / SemB / Summer 时同步过滤选课列表，夏季课程独立成块
- **排课台 09:00 时间块修复**：修复时间轴首个标签（09:00）被 sticky 表头遮挡、显示不全的问题

### 数据完整性修复

- **清理 4 个孤立班次文件**：删除 BIOS8001/BIOS8004/CS8692/CS8695（仅面向 PhD/MPhil 研究型课程，不属于七大授课型硕士项目）
- **修复 14 个 JSON 的 UTF-8 BOM**：DSC 系列班次文件去除 BOM 前缀，避免浏览器 `response.json()` 解析失败导致整站无法加载
- **课程总数**：由 159 门增至 **161 门**，课程 PDF、班次、评价文件 0 断裂引用

### 发布

- **新仓库 `CityUPedia`**：正式版独立发布至 `https://github.com/Famalhaut04/CityUPedia`，站点地址 `https://Famalhaut04.github.io/CityUPedia/`
- **全站测试**：数据校验 0 错误 0 警告；HTTP 测试 7 个页面、9 项静态资源、161 门课程班次/评价、161 份课程 PDF 全部正常加载
