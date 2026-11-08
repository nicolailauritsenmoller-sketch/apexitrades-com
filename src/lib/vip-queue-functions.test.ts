import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), staff: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => { const b = { middleware: () => b, inputValidator: () => b, handler: (fn: unknown) => fn }; return b; } }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/desk.server", () => ({ privileged: async () => ({ from: mocks.from, rpc: mocks.rpc }), assertStaff: mocks.staff, logAudit: vi.fn(), appendSignature: vi.fn() }));
import { getVipDirectory, getVipThread, getVipDesk, requestVipAccess, sendVipDeskMessage, sendVipMessage, updateVipThread } from "./vip.functions";
let tables: Record<string, unknown[]>;
beforeEach(() => {
  vi.clearAllMocks();
  tables = { agent_profiles: [{ user_id: "agent", full_name: "Secret Agent", avatar_url: "private-avatar" }], vip_access: [{ role_key: "billing_settlements", unlocked: false }], vip_messages: [] };
  mocks.from.mockImplementation((table: string) => {
    const filters: Array<(row: any) => boolean> = [];
    let patch: any;
    const rows = () => (tables[table] ?? []).filter(row => filters.every(filter => filter(row)));
    const b: any = { then: (resolve: any) => {
      const selected = rows();
      if (patch) selected.forEach(row => Object.assign(row as object, patch));
      return Promise.resolve({ data: selected, error: null }).then(resolve);
    } };
    for (const key of ["select", "order", "limit", "not", "like"]) b[key] = () => b;
    b.eq = (key: string, value: unknown) => { filters.push(row => row[key] === value); return b; };
    b.neq = (key: string, value: unknown) => { filters.push(row => row[key] !== value); return b; };
    b.is = (key: string, value: unknown) => { filters.push(row => (row[key] ?? null) === value); return b; };
    b.update = (value: unknown) => { patch = value; return b; };
    b.insert = (value: unknown) => { tables[table] = [...(tables[table] ?? []), value]; return b; };
    b.maybeSingle = async () => ({ data: rows()[0] ?? null, error: null });
    return b;
  });
  tables.vip_access = [{ user_id: "customer", role_key: "billing_settlements", unlocked: false }];
});
const context = { userId: "customer", supabase: {} };
it("pending directory response contains no specialist identity", async () => {
  const result = await (getVipDirectory as any)({ context });
  expect(JSON.stringify(result)).not.toContain("Secret Agent");
  expect(JSON.stringify(result)).not.toContain("private-avatar");
  expect(result[0].agent).toBeNull();
});
it("pending customer cannot fetch or send thread messages", async () => {
  expect(await (getVipThread as any)({ context, data: { roleKey: "billing_settlements" } })).toEqual([]);
  await expect((sendVipMessage as any)({ context, data: { roleKey: "billing_settlements", body: "test" } })).rejects.toThrow("accept and join");
});
it("nonstaff cannot accept a queued request", async () => {
  mocks.staff.mockRejectedValueOnce(new Error("Forbidden"));
  await expect((updateVipThread as any)({ context, data: { userId: "customer", roleKey: "billing_settlements", action: "assign" } })).rejects.toThrow("Forbidden");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("a competing staff acceptance fails rather than overwriting assignment", async () => {
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  await expect((updateVipThread as any)({ context, data: { userId: "customer", roleKey: "billing_settlements", action: "assign" } })).rejects.toThrow("already accepted");
});

const acceptedGrant = () => ({ id: "grant", user_id: "customer", role_key: "billing_settlements", unlocked: true, assigned_to: "agent", accepted_at: "2026-11-08T10:00:00Z", agent_joined_at: "2026-11-08T10:00:00Z", thread_status: "resolved", resolved_at: "2026-11-08T10:01:00Z", hidden_from_staff_at: "2026-11-08T10:01:00Z" });
it("resolved chats reconnect explicitly and allow customer messages after reopening", async () => {
  const grant = acceptedGrant();
  tables.vip_access = [grant];
  const before = await (getVipDirectory as any)({ context });
  expect(before[0]).toMatchObject({ resolved: true, connected: false, agent: null });
  await (requestVipAccess as any)({ context, data: { roleKey: "billing_settlements" } });
  expect(grant).toMatchObject({ thread_status: "open", resolved_at: null, hidden_from_staff_at: null, assigned_to: "agent" });
  await (sendVipMessage as any)({ context, data: { roleKey: "billing_settlements", body: "Follow-up question" } });
  expect(tables.vip_messages).toContainEqual(expect.objectContaining({ body: "Follow-up question", user_id: "customer", sender_role: "user" }));
  expect((await (getVipThread as any)({ context, data: { roleKey: "billing_settlements" } }))[0].body).toBe("Follow-up question");
});
it("reconnecting an unaccepted resolved assignment does not bypass acceptance", async () => {
  const grant = { ...acceptedGrant(), accepted_at: null, agent_joined_at: null };
  tables.vip_access = [grant];
  await (requestVipAccess as any)({ context, data: { roleKey: "billing_settlements" } });
  expect(grant.thread_status).toBe("open");
  expect((await (getVipDirectory as any)({ context }))[0].agent).toBeNull();
  await expect((sendVipMessage as any)({ context, data: { roleKey: "billing_settlements", body: "test" } })).rejects.toThrow("accept and join");
});
it("legacy assigned specialists can accept directly, but competing specialists cannot", async () => {
  const grant = { ...acceptedGrant(), thread_status: "open", accepted_at: null, agent_joined_at: null, hidden_from_staff_at: null };
  tables.vip_access = [grant];
  const staffContext = { ...context, userId: "agent" };
  const own = await (getVipDesk as any)({ context: staffContext });
  expect(own.threads[0]).toMatchObject({ assignedTo: "agent", connected: false, canAccept: true });
  expect((await (getVipDesk as any)({ context: { ...context, userId: "other" } })).threads[0].canAccept).toBe(false);
  await expect((sendVipDeskMessage as any)({ context: staffContext, data: { userId: "customer", roleKey: "billing_settlements", body: "test" } })).rejects.toThrow("Accept and join");
  mocks.rpc.mockImplementation(async () => { Object.assign(grant, { accepted_at: "2026-11-08T10:20:00Z", agent_joined_at: "2026-11-08T10:20:00Z" }); return { data: true, error: null }; });
  await (updateVipThread as any)({ context: staffContext, data: { userId: "customer", roleKey: "billing_settlements", action: "assign" } });
  expect(mocks.rpc).toHaveBeenCalledWith("accept_vip_queue", { p_user_id: "customer", p_role_key: "billing_settlements", p_agent_id: "agent" });
  await (sendVipDeskMessage as any)({ context: staffContext, data: { userId: "customer", roleKey: "billing_settlements", body: "Reply" } });
  expect(tables.vip_messages).toContainEqual(expect.objectContaining({ sender_role: "specialist", sender_id: "agent" }));
  await expect((sendVipDeskMessage as any)({ context: { ...context, userId: "other" }, data: { userId: "customer", roleKey: "billing_settlements", body: "Reply" } })).rejects.toThrow("Accept and join");
});
it("reconnect is scoped to the requesting customer's resolved grant", async () => {
  const other = { ...acceptedGrant(), id: "other-grant", user_id: "other" };
  tables.vip_access = [acceptedGrant(), other];
  await (requestVipAccess as any)({ context, data: { roleKey: "billing_settlements" } });
  expect(other.thread_status).toBe("resolved");
});