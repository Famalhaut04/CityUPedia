# CityU Pedia · 城大百科

> **当前版本：1.5.1（CityUPedia 1.5.1）**
> 全校八大学院接入：新增商学院、人文社会科学院、理学院、生物医学院、赛马会动物医学及生命科学院、创意媒体学院、能源及环境学院、法律学院共 47 个官方硕士项目，全部逐项目对照城大官方 2026/27 授课式研究生目录核对。1.4.2 对照官方课程页逐课复核（剔除 282 门不开设课程、对齐 82 门开课学期、回填 16 门班次、1,088 门接入「课程详情 PDF」直链）；1.5.1 对照官方**项目页**复核各专业学科名单（新增 19 门、修正 28 条归属，全站 68 项目 / 1,118 门，其中 596 门带 AIMS 班次）。**1.5.0 起全站界面支持三语下拉切换：简体中文 / 繁體中文 / English**；1.5.1 新增「城大攻略」入口（内容筹备中）。
> 完整的版本变更记录请查看 [更新日志（CHANGELOG.md）](CHANGELOG.md)。

CityU Pedia（城大百科）是一个为**香港城市大学（CityU）授课型硕士生**打造的一站式课程综合平台，涵盖排课规划与课程评价两大核心功能。整合课程时间表查询、班次选择与学生评价汇总，帮你做出更明智的决定。

> ⚠️ **免责声明：** 课程评价内容均整理自公开社交平台（小红书、知乎、Reddit 等），仅供参考，不构成建议。请以学校官方信息为准。
>
> 当前数据覆盖 **Semester A 2026/27**、**Semester B** 和 **Summer** 三个学期。Semester A 班次快照时间为 **2026-08-23（AIMS Master Class Schedule）**，名额、教师、教室及注册状态可能随时变化，请以 CityU AIMS 的最新信息为准。

## 在线访问

**https://famalhaut04.github.io/CityUPedia/**

## 已录入项目（Semester A 2026/27 · 共 68 个官方硕士项目）

| 学院 | 项目数 | 项目代码 |
| --- | --- | --- |
| 计算学院 | 7 | MSBIOS、MSCS、MSAI、MSCY、MSEC、MSDS、MSAIFS |
| 创新学院 | 1 | MSVC |
| 工学院 | 13 | MARCH2、MSCAE1、MSCM2、MUDP2、MSCIE、MSEEE、MSEIE2、MSMIT1、MSMEN2、MSME1、MSAIDI、MSEM1、MSSM |
| 商学院 | 19 | MAIA、MSAFBNAI、MSPACG、MSCBDA2、MSCBDA3、MSCOSCM、MSAE、MSF、MSFE、MSAIB、MSBISA、MSDTTI、MAGBM、MSMI、MSMKT1、MBANUGC、EMBAHK、EMBAP、EMBAT |
| 人文社会科学院 | 14 | MSSCSL、MACH1、MAES、MALS、MACNM、MAIMC、MAHUM、MAIS、MAPPM、MSSDS1、MAASS、MSSC、MSSPSY、MSW |
| 理学院 | 3 | MSCHEM1、MSFMS1、MSPDMQT |
| 生物医学院 | 3 | MSBME1、MSHSB、MSN1 |
| 赛马会动物医学及生命科学院 | 2 | MPH、MVM |
| 创意媒体学院 | 2 | MACM、MFACM |
| 能源及环境学院 | 1 | MSEGEV |
| 法律学院 | 3 | JD4、LLMARBDR、LLM3 |

> 全部培养方案（核心/选修/方向分流/学分要求）逐项目对照城大官方 2026/27 授课式研究生目录核对；多方向项目（如 LLM 的七个方向、MSPACG 的 CG/PA 方向）以选修分组形式呈现，具体修读规则见各项目备注。EMBA/MBA 等 cohort 制项目亦已收录，便于浏览课程结构。


## 网页版主要功能

### 课程浏览与筛选

- 三级级联选择学院、院系与硕士项目，逐级展开
- 按课程编号或课程英文名称搜索；按核心课、选修课、上课星期和开课学期（SemA/SemB）筛选
- 选修分组（如 MSCY 的 Group I/II）筛选与分组学分进度统计
- 快速查看课程学分、主课班次数量、上课时间、星级口碑分和学生评价摘要

### 可视化课表规划

- 将课程加入每周课表，并分别选择主课和 Tutorial 班次
- 自动统计已加入课表的课程数量、核心课/选修课数量及总学分
- 自动检测时间冲突，并在课表中标记冲突课程
- 各项目课表在本地独立保存

### 课程详情与学生经验

- 展示课程类型、所属项目、学分、先修要求等
- 展示班次时间、日期、地点、教师、CRN 及网页注册状态
- 汇总学生评价、星级口碑分、课程特点和课程提示

### 详细课程文件与中文翻译

- 课程详情页提供「课程详情 PDF」按钮，可直接下载对应课程的官方课程文件
- 对部分课程提供"查看详细课程介绍"入口（中英逐页对照）
- 英文 PDF 原文转换为网页页图，无需下载本地文件
- 英文页图与对应中文翻译同步切换

## 本地运行

项目使用原生 HTML、CSS 和 JavaScript，无需安装依赖或执行构建。

```powershell
git clone https://github.com/Famalhaut04/CityUPedia.git
cd CityUPedia
python -m http.server 8090
```

然后在浏览器打开 `http://127.0.0.1:8090/`

请通过 HTTP 服务访问，不建议直接双击 `index.html`（`fetch` 读取本地 JSON 在 `file://` 下可能被阻止）。

## 项目结构

```text
├── index.html                 # 课程浏览、项目切换与课表规划主页
├── course.html                # 课程详情页（含课程详情 PDF 下载）
├── syllabus.html              # PDF 原文与中文翻译页面
├── about.html                 # 关于我们（CityUHK CSSA）
├── feedback.html              # 问题反馈页
├── assets/
│   ├── styles.css             # 全站样式与响应式布局
│   ├── shared.js              # 数据加载、存储、i18n 和公共工具
│   ├── planner.js             # 项目切换、课程筛选、课表规划逻辑
│   ├── course.js              # 课程详情渲染逻辑
│   ├── syllabus.js            # 课程文件与翻译渲染逻辑
│   ├── cssa-logo.png          # CSSA 官方 Logo
│   └── course-pages/          # 课程英文原文页图
├── data/
│   ├── courses/index.json     # 多项目注册表、学期和课程索引
│   ├── course-documents/      # PDF 映射、页图索引与逐页中文翻译
│   ├── sections/              # 各课程班次数据
│   ├── reviews/               # 各课程评价摘要
│   ├── source-reviews/        # 按来源整理的课程评价原文
│   └── sources.json           # 评价来源及原文链接
├── docs/                      # 课程官方 PDF 资料（按课程代码命名）
└── tools/
    └── build-web-course-images.mjs # 课程页图生成工具
```

## 发布

仓库通过 GitHub Pages 直接发布 `main` 分支根目录。推送到 `main` 后会自动更新线上网站。

## 联系与贡献

本项目面向香港城市大学学生开放共建。想加入并参与贡献（数据更新、课程评价、前端开发等），请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解**加入流程**（身份验证 → 联系维护者 → GitHub 提交申请）与开发约定。

如遇到任何问题、建议和合作意向，欢迎在 issue 中提交或联系 fomalhautskywalker@gmail.com 或 lyeswork@proton.me，我们会尽快回复并且修复问题。

### 资料致谢

部分课程资料来自以下公开站点：

- [CtiyU-CS-Course-Board](https://shariqri.github.io/CtiyU-CS-Course-Board/)
- [cityuds](https://fluffywood.github.io/cityuds/?term=S)
- [aifs-schedule](https://github.com/WZehan/aifs-schedule)

特别感谢资料提供者（排名不分先后）：

Fluffywood、Perry、MikeyChan、Валерий、兰雅薇（CSSA）、陈玉钏（CSSA）

## 使用提示与免责声明

- 本系统仅为课程评价与课表参考工具，个人最终课表需要在香港城市大学系统中自行确认
- 课程名额、教师、地点、考核方式和注册规则可能变化，请以 CityU 官方系统和课程文件为准
- 学生评价具有主观性，且可能对应往届教学安排，不应作为唯一课程依据
- 原始评价与课程资料的相关权利归各自作者或发布机构所有
