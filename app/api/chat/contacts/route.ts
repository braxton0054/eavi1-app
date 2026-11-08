import { requireChatUser } from "@/lib/chat/access";
import { contactCount, listContacts, randomContact } from "@/lib/chat/conversations";
import { chatRoute } from "@/lib/chat/route";

export const dynamic = "force-dynamic";

/**
 * The school phonebook.
 *
 * Returns only a name, a thumbnail and a role. `search` matches on a name and nothing else, so
 * typing an admission number here finds nobody and therefore reveals nothing.
 */
export async function GET(request: Request) {
  return chatRoute(async () => {
    const viewer = await requireChatUser();
    const url = new URL(request.url);

    const search = url.searchParams.get("q") ?? undefined;
    const roleParam = url.searchParams.get("role");
    const role =
      roleParam === "admin" || roleParam === "tutor" || roleParam === "student" ? roleParam : undefined;
    const order = url.searchParams.get("order") === "az" ? "az" : "random";
    const seed = Number(url.searchParams.get("seed") ?? 1) || 1;
    const cursor = Number(url.searchParams.get("cursor") ?? 0) || 0;

    if (url.searchParams.get("random") === "1") {
      return { person: await randomContact(viewer.id) };
    }

    const [page, total] = await Promise.all([
      listContacts(viewer.id, { search, role, order, seed, cursor }),
      cursor === 0 ? contactCount(viewer.id) : Promise.resolve(null),
    ]);

    return { ...page, total, seed };
  });
}
