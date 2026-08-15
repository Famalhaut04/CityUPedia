// ============================================================
// 云端课程评价配置（Supabase）
// ------------------------------------------------------------
// 已启用云端共享评价。数据表与 RLS 策略已在 Supabase 中创建完成。
//
// 管理员身份不再在客户端硬编码邮箱，改由 Supabase 后端判定：
//   1) 在 Supabase Dashboard → Authentication → Users 中，为管理员账号
//      的 app_metadata 增加 { "is_admin": true }（Metadata 一栏）；
//   2) 前端登录后从会话 JWT 的 app_metadata.is_admin 读取管理员标记；
//   3) 真正的删除权限仍由数据库 RLS 策略在服务端校验（见本地运维文档）。
//
// 注意：publishable key 用于匿名公开读取/提交评价，
// 请勿放置数据库的 service_role secret key。
// ============================================================
window.CLOUD_CONFIG = {
  supabaseUrl: "https://xifkjcdpbyeknrhiknyb.supabase.co",
  supabaseAnonKey: "sb_publishable_Yf3PoJ0hFDELzmackZF_BQ_aqdw2k-e",
};
