"use client";
import { useState } from "react";
import { Users, Plus, Trash2, ShieldCheck, KeyRound, Copy, Workflow } from "lucide-react";
import { useApi } from "@/components/hooks";
import { useT, useLocale } from "@/components/i18n";
import { Card, PageHeader, SkeletonList, ErrorBox, Button, Modal, Field, Badge, Confirm, Toggle, useToast } from "@/components/ui";
import { usePerms } from "@/components/shell";
import { api } from "@/lib/client";

export default function UsersPage() {
  const t = useT(); const locale = useLocale(); const toast = useToast(); const can = usePerms();
  const { data, loading, error, reload } = useApi<any>("/api/users");
  const { data: settings, reload: reloadS } = useApi<any>("/api/settings");
  const [add, setAdd] = useState(false); const [f, setF] = useState({ name: "", email: "", roleId: "" }); const [busy, setBusy] = useState(false); const [temp, setTemp] = useState<string | null>(null);
  const [roleEdit, setRoleEdit] = useState<any>(null); const [del, setDel] = useState<any>(null);
  async function addMember() { setBusy(true); try { const r = await api("/api/users", { body: f }); setAdd(false); setTemp(r.tempPassword); if (!r.tempPassword) toast.success(t("تمت الإضافة", "Member added")); reload(true); } catch (e) { toast.error(e); } finally { setBusy(false); } }
  async function setRole(id: string, roleId: string) { try { await api(`/api/users/${id}`, { method: "PATCH", body: { roleId } }); toast.success(t("تم تحديث الدور", "Role updated")); reload(true); } catch (e) { toast.error(e); } }
  async function saveRole() { try { if (roleEdit.id) await api(`/api/roles/${roleEdit.id}`, { method: "PATCH", body: { permissions: roleEdit.permissions, name: roleEdit.name } }); else await api("/api/roles", { body: { name: roleEdit.name, permissions: roleEdit.permissions } }); setRoleEdit(null); reload(true); toast.success(t("تم الحفظ", "Saved")); } catch (e) { toast.error(e); } }
  async function toggleApproval(v: boolean) { try { await api("/api/settings", { method: "PUT", body: { requireApproval: v } }); reloadS(true); } catch (e) { toast.error(e); } }
  return <div>
    <PageHeader icon={<Users />} title={t("المستخدمون والصلاحيات", "Users & permissions")} actions={can("users.manage") && <Button onClick={() => { setF({ name: "", email: "", roleId: data?.roles.find((r: any) => r.key === "editor")?.id ?? "" }); setAdd(true); }}><Plus className="h-4 w-4" />{t("إضافة عضو", "Add member")}</Button>} />
    {error ? <ErrorBox error={error} onRetry={reload} /> : loading || !data ? <SkeletonList /> : <div className="space-y-4">
      <Card className="divide-y divide-border">{data.members.map((m: any) => <div key={m.id} className="flex flex-wrap items-center gap-3 p-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 font-bold text-primary">{m.user.name[0]}</span>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2 font-medium">{m.user.name}{m.user.id === data.me && <Badge>{t("أنت", "You")}</Badge>}{m.user.mfaEnabled && <ShieldCheck className="h-4 w-4 text-success" />}</div><div className="text-xs text-subtle" dir="ltr">{m.user.email}</div></div>
        <span className="text-xs text-subtle">{m.user.lastLoginAt ? t("آخر دخول", "Last login") + " " + new Date(m.user.lastLoginAt).toLocaleDateString(locale) : t("لم يسجل الدخول", "Never logged in")}</span>
        <select className="input w-auto" value={m.roleId} disabled={!can("users.manage")} onChange={(e) => setRole(m.id, e.target.value)}>{data.roles.map((r: any) => <option key={r.id} value={r.id}>{t(r.nameAr, r.name)}</option>)}</select>
        {can("users.manage") && m.user.id !== data.me && <button className="btn-ghost h-8 w-8 p-0 text-danger" onClick={() => setDel(m)}><Trash2 className="h-4 w-4" /></button>}
      </div>)}</Card>

      <Card className="p-5"><h3 className="mb-1 flex items-center gap-2 font-semibold"><Workflow className="h-4 w-4 text-primary" />{t("سير عمل المراجعة", "Review workflow")}</h3>
        <p className="mb-3 text-sm text-subtle">{t("كاتب المحتوى ← مراجعة ← اعتماد ← جدولة ← نشر", "Writer → Review → Approve → Schedule → Publish")}</p>
        <Toggle checked={!!settings?.workflow.requireApproval} onChange={toggleApproval} label={t("إلزام اعتماد المنشورات قبل الجدولة أو النشر (لمن لا يملك صلاحية الاعتماد)", "Require approval before scheduling/publishing (for users without approve permission)")} /></Card>

      <Card className="p-5"><div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4 text-primary" />{t("الأدوار والصلاحيات", "Roles & permissions")}</h3>{can("users.manage") && <Button variant="outline" onClick={() => setRoleEdit({ name: "", permissions: [] })}><Plus className="h-4 w-4" />{t("دور مخصص", "Custom role")}</Button>}</div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-xs"><thead><tr><th className="p-2 text-start">{t("الصلاحية", "Permission")}</th>{data.roles.map((r: any) => <th key={r.id} className="p-2"><button disabled={!can("users.manage") || r.key === "owner"} onClick={() => setRoleEdit({ ...r })} className="hover:text-primary">{t(r.nameAr, r.name)}</button><div className="font-normal text-subtle">{r._count.memberships}</div></th>)}</tr></thead>
          <tbody className="divide-y divide-border">{data.permissions.map((p: any) => <tr key={p.key}><td className="p-2">{t(p.ar, p.en)}</td>{data.roles.map((r: any) => <td key={r.id} className="p-2 text-center">{r.permissions.includes(p.key) ? <span className="text-success">●</span> : <span className="text-border">○</span>}</td>)}</tr>)}</tbody></table></div></Card>
    </div>}
    <Modal open={add} onClose={() => setAdd(false)} title={t("إضافة عضو", "Add member")} footer={<Button onClick={addMember} loading={busy}>{t("إضافة", "Add")}</Button>}>
      <div className="space-y-3"><Field label={t("الاسم", "Name")}><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field><Field label={t("البريد", "Email")}><input className="input" dir="ltr" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label={t("الدور", "Role")}><select className="input" value={f.roleId} onChange={(e) => setF({ ...f, roleId: e.target.value })}>{data?.roles.map((r: any) => <option key={r.id} value={r.id}>{t(r.nameAr, r.name)}</option>)}</select></Field></div>
    </Modal>
    <Modal open={!!temp} onClose={() => setTemp(null)} size="sm" title={t("تم إنشاء الحساب", "Account created")}><p className="mb-2 text-sm text-subtle">{t("كلمة مرور مؤقتة تظهر مرة واحدة فقط. شاركها بأمان واطلب تغييرها بعد الدخول.", "Temporary password shown once. Share securely and ask them to change it.")}</p><div className="flex gap-2"><code className="input font-mono" dir="ltr">{temp}</code><Button variant="outline" onClick={() => { void navigator.clipboard.writeText(temp!); toast.success(t("تم النسخ", "Copied")); }}><Copy className="h-4 w-4" /></Button></div></Modal>
    {roleEdit && <Modal open onClose={() => setRoleEdit(null)} title={roleEdit.id ? t(roleEdit.nameAr, roleEdit.name) : t("دور جديد", "New role")} footer={<Button onClick={saveRole}>{t("حفظ", "Save")}</Button>}>
      {!roleEdit.isSystem && <Field label={t("اسم الدور", "Role name")} className="mb-3"><input className="input" value={roleEdit.name} onChange={(e) => setRoleEdit({ ...roleEdit, name: e.target.value })} /></Field>}
      <div className="grid gap-2 sm:grid-cols-2">{data.permissions.map((p: any) => <label key={p.key} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm"><input type="checkbox" checked={roleEdit.permissions.includes(p.key)} onChange={() => setRoleEdit({ ...roleEdit, permissions: roleEdit.permissions.includes(p.key) ? roleEdit.permissions.filter((x: string) => x !== p.key) : [...roleEdit.permissions, p.key] })} />{t(p.ar, p.en)}</label>)}</div>
    </Modal>}
    <Confirm open={!!del} onClose={() => setDel(null)} danger title={t("إزالة العضو؟", "Remove member?")} onConfirm={async () => { try { await api(`/api/users/${del.id}`, { method: "DELETE" }); setDel(null); reload(true); } catch (e) { toast.error(e); } }} />
  </div>;
}
