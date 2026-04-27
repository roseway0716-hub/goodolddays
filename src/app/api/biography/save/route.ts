import type { BiographyDraft } from "@/lib/biography";
import { chapters } from "@/lib/biography";
import { createId } from "@/lib/id";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return Response.json(
      { error: "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  const draft = (await request.json()) as BiographyDraft;
  const biographyId = draft.id || createId("biography");
  const birthYearNumber =
    draft.birthYear && Number.isFinite(Number(draft.birthYear))
      ? Number(draft.birthYear)
      : null;

  const biographyPayload = {
    id: biographyId,
    elder_name: draft.elderName,
    author_style: draft.authorStyle,
    preface: draft.preface,
    epilogue: draft.epilogue,
    birth_year: birthYearNumber,
    hometown: draft.hometown || null,
  };

  const { error: biographyError } = await supabase.from("biographies").upsert(biographyPayload);

  if (biographyError) {
    return Response.json({ error: biographyError.message }, { status: 500 });
  }

  const chapterRows = chapters.map((chapter) => ({
    id: draft.chapters[chapter.id].id || createId("chapter"),
    bio_id: biographyId,
    stage_type: chapter.stageType,
    raw_input: draft.chapters[chapter.id].rawInput,
    ai_content: draft.chapters[chapter.id].aiContent,
  }));

  const { error: chapterError } = await supabase.from("chapters").upsert(chapterRows);

  if (chapterError) {
    return Response.json({ error: chapterError.message }, { status: 500 });
  }

  const chapterIdMap = Object.fromEntries(chapters.map((chapter, index) => [chapter.id, chapterRows[index].id]));

  const photoRows = chapters.flatMap((chapter) =>
    draft.chapters[chapter.id].photos.map((photo) => ({
      id: photo.id,
      chapter_id: chapterIdMap[chapter.id],
      url: photo.url,
      caption: photo.caption,
      order_index: photo.orderIndex,
      storage_path: photo.storagePath || null,
    })),
  );

  if (photoRows.length > 0) {
    const { error: photoError } = await supabase.from("photos").upsert(photoRows);

    if (photoError) {
      return Response.json({ error: photoError.message }, { status: 500 });
    }
  }

  return Response.json({
    biographyId,
    chapterIds: chapterIdMap,
  });
}
