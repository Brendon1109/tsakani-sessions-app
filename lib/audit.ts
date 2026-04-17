import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuditEntry {
  user_id: string | null;
  user_email: string | null;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string | null;
}

export async function logAudit(
  supabase: SupabaseClient,
  entry: AuditEntry
): Promise<void> {
  try {
    await supabase.from("audit_log").insert({
      user_id: entry.user_id,
      user_email: entry.user_email,
      action: entry.action,
      resource_type: entry.resource_type || null,
      resource_id: entry.resource_id || null,
      details: entry.details || null,
      ip_address: entry.ip_address || null,
    });
  } catch (err) {
    // Never fail the request because of audit log
    console.error("Audit log failed:", err);
  }
}
