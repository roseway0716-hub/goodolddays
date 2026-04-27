import { getSupabaseAdmin } from "@/lib/supabase-admin";

type DeletePayload = {
  photoId?: string;
  storagePath?: string | null;
};

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return Response.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const payload = (await request.json()) as DeletePayload;

  if (!payload.photoId && !payload.storagePath) {
    return Response.json({ error: "photoId or storagePath is required." }, { status: 400 });
  }

  if (payload.storagePath) {
    const { error: storageError } = await supabase.storage
      .from("biography-photos")
      .remove([payload.storagePath]);

    if (storageError) {
      return Response.json({ error: storageError.message }, { status: 500 });
    }
  }

  if (payload.photoId) {
    const { error: deleteError } = await supabase.from("photos").delete().eq("id", payload.photoId);

    if (deleteError) {
      return Response.json({ error: deleteError.message }, { status: 500 });
    }
  }

  return Response.json({ ok: true });
}
