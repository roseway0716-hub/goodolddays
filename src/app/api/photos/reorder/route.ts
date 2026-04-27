import { getSupabaseAdmin } from "@/lib/supabase-admin";

type ReorderPayload = {
  chapterId?: string;
  photos?: Array<{
    id: string;
    orderIndex: number;
    caption: string;
    url: string;
    storagePath?: string | null;
  }>;
};

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return Response.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const payload = (await request.json()) as ReorderPayload;

  if (!payload.chapterId || !payload.photos?.length) {
    return Response.json({ error: "chapterId and photos are required." }, { status: 400 });
  }

  const rows = payload.photos.map((photo) => ({
    id: photo.id,
    chapter_id: payload.chapterId,
    url: photo.url,
    caption: photo.caption,
    order_index: photo.orderIndex,
    storage_path: photo.storagePath || null,
  }));

  const { error } = await supabase.from("photos").upsert(rows);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
