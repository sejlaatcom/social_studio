export const PERMISSIONS = {
  "accounts.connect": ["ربط الحسابات وفصلها", "Connect & disconnect accounts"],
  "content.create": ["إنشاء المحتوى", "Create content"],
  "content.edit": ["تعديل المحتوى", "Edit content"],
  "content.delete": ["حذف المحتوى", "Delete content"],
  "content.publish": ["نشر المحتوى وجدولته", "Publish & schedule content"],
  "content.approve": ["اعتماد المحتوى", "Approve content"],
  "campaigns.manage": ["إدارة الحملات", "Manage campaigns"],
  "media.manage": ["إدارة مكتبة الملفات", "Manage media library"],
  "brand.manage": ["إدارة الهوية التجارية", "Manage brand kits"],
  "inbox.manage": ["إدارة الرسائل والتعليقات", "Manage inbox"],
  "users.manage": ["إدارة المستخدمين والأدوار", "Manage users & roles"],
  "reports.view": ["مشاهدة التقارير", "View reports"],
  "settings.manage": ["إدارة الإعدادات ومفاتيح API", "Manage settings & API keys"],
  "ai.use": ["استخدام الذكاء الاصطناعي", "Use AI features"],
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;
const ALL = Object.keys(PERMISSIONS) as PermissionKey[];

export const SYSTEM_ROLES: { key: string; name: string; nameAr: string; perms: PermissionKey[] }[] = [
  { key: "owner", name: "Owner", nameAr: "مالك المنصة", perms: ALL },
  { key: "admin", name: "Admin", nameAr: "مدير", perms: ALL },
  { key: "content_manager", name: "Content Manager", nameAr: "مسؤول محتوى",
    perms: ["content.create", "content.edit", "content.delete", "content.approve", "campaigns.manage", "media.manage", "brand.manage", "reports.view", "ai.use", "inbox.manage"] },
  { key: "designer", name: "Designer", nameAr: "مصمم", perms: ["content.create", "content.edit", "media.manage", "ai.use"] },
  { key: "editor", name: "Editor", nameAr: "محرر", perms: ["content.create", "content.edit", "media.manage", "ai.use"] },
  { key: "publisher", name: "Publisher", nameAr: "مسؤول نشر", perms: ["content.edit", "content.publish", "accounts.connect", "reports.view", "inbox.manage"] },
  { key: "analyst", name: "Analyst", nameAr: "محلل", perms: ["reports.view"] },
  { key: "viewer", name: "Read only", nameAr: "قراءة فقط", perms: [] },
];
