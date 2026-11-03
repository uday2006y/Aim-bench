import "server-only";

import { supabaseAdmin } from "./supabaseAdmin";
import { getSessionAccountId } from "./session";

export interface Me {
  /** The EasyAim display name, falling back to the username. */
  name: string;
  /** The Discord avatar, falling back to the EasyAim one. */
  avatar: string | null;
}

/** Read-only lookup for the sidebar. Never throws; a failure just means no avatar. */
export async function loadMe(): Promise<Me | null> {
  try {
    const accountId = await getSessionAccountId();
    if (!accountId) return null;

    const [account, link] = await Promise.all([
      supabaseAdmin
        .from("accounts")
        .select("username, avatar_url")
        .eq("id", accountId)
        .maybeSingle(),
      supabaseAdmin
        .from("easyaim_links")
        .select("easyaim_username, display_name, avatar_url")
        .eq("account_id", accountId)
        .maybeSingle(),
    ]);

    const a = (account.data ?? null) as { username: string | null; avatar_url: string | null } | null;
    const l = (link.data ?? null) as {
      easyaim_username: string | null;
      display_name: string | null;
      avatar_url: string | null;
    } | null;

    return {
      name: l?.display_name || l?.easyaim_username || a?.username || "Account",
      avatar: a?.avatar_url || l?.avatar_url || null,
    };
  } catch {
    return null;
  }
}
