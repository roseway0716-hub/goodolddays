import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createId } from "@/lib/id";

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return Response.json(
      { error: "Supabase is not configured. Falling back to local preview only." },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const chapterId = String(formData.get("chapterId") || "chapter");

  if (!(file instanceof File)) {
    return Response.json({ error: "Missing upload file." }, { status: 400 });
  }

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const photoId = createId("photo");
  const storagePath = `${chapterId}/${photoId}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("biography-photos")
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const { data } = supabase.storage.from("biography-photos").getPublicUrl(storagePath);

  return Response.json({
    id: photoId,
    storagePath,
    url: data.publicUrl,
  });
}
