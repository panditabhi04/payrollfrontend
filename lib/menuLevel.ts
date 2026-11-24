import { getMe } from "@/lib/api/auth";

/**
 * Legacy getaccess() level for one menu: 0 none, 1 R, 2 U, 3 C, 4 D (full). Staff/superusers are full.
 * Mirrors backend `menu_access_level` so pages can hide the same buttons the aspx hides.
 */
const LEVEL: Record<string, number> = { I: 0, R: 1, U: 2, C: 3, D: 4 };

export async function menuLevel(menuName: string): Promise<number> {
  const me = await getMe();
  if (!me) return 0;
  if (me.is_staff) return 4;
  return Math.max(
    0,
    ...me.permissions
      .filter((p) => p.menu === menuName && !p.needs_review)
      .map((p) => LEVEL[p.permission] ?? 0),
  );
}
