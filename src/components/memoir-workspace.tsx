"use client";

import Link from "next/link";
import { BookOpen, ChevronRight, Library, Save, ScrollText, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ChapterSection } from "@/components/chapter-section";
import {
  STORAGE_KEY,
  chapters,
  createInitialDraft,
  type BiographyDraft,
  type ChapterDefinition,
  type PhotoItem,
} from "@/lib/biography";
import { createId } from "@/lib/id";

type SaveResponse = {
  biographyId: string;
  chapterIds: Record<string, string>;
};

function toSerializableDraft(draft: BiographyDraft) {
  return {
    ...draft,
    chapters: Object.fromEntries(
      Object.entries(draft.chapters).map(([chapterId, chapter]) => [
        chapterId,
        {
          ...chapter,
          isGenerating: false,
          isUploading: false,
          error: null,
        },
      ]),
    ),
  };
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("读取图片失败。"));
    reader.readAsDataURL(file);
  });
}

export function MemoirWorkspace() {
  const [draft, setDraft] = useState<BiographyDraft>(createInitialDraft);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as BiographyDraft;
        setDraft({
          ...createInitialDraft(),
          ...parsed,
          chapters: {
            ...createInitialDraft().chapters,
            ...parsed.chapters,
          },
        });
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toSerializableDraft(draft)));
  }, [draft, hasHydrated]);

  const chapterCountWithContent = useMemo(
    () =>
      chapters.filter(
        (chapter) =>
          draft.chapters[chapter.id].rawInput.trim() || draft.chapters[chapter.id].aiContent.trim(),
      ).length,
    [draft.chapters],
  );

  const updateDraft = (patch: Partial<BiographyDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const updateChapter = (
    chapterId: string,
    updater: (current: BiographyDraft["chapters"][string]) => BiographyDraft["chapters"][string],
  ) => {
    setDraft((current) => ({
      ...current,
      chapters: {
        ...current.chapters,
        [chapterId]: updater(current.chapters[chapterId]),
      },
    }));
  };

  const updateRawInput = (chapterId: string, rawInput: string) => {
    updateChapter(chapterId, (current) => ({
      ...current,
      rawInput,
    }));
  };

  const generateChapter = async (chapter: ChapterDefinition) => {
    const currentDraft = draft.chapters[chapter.id];
    const rawInput = currentDraft.rawInput.trim();

    if (!rawInput) {
      updateChapter(chapter.id, (current) => ({
        ...current,
        error: "先写一点素材，AI 才能开始整理这一章。",
      }));
      return;
    }

    const subjectParts = [draft.elderName.trim(), draft.hometown.trim()].filter(Boolean);

    updateChapter(chapter.id, (current) => ({
      ...current,
      aiContent: "",
      error: null,
      isGenerating: true,
    }));

    try {
      const response = await fetch("/api/polish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          authorStyle: draft.authorStyle,
          rawInput,
          elderName: subjectParts.join(" / "),
          chapterTitle: chapter.title,
          birthYear: draft.birthYear,
        }),
      });

      if (!response.ok || !response.body) {
        const errorData = (await response.json().catch(() => null)) as
          | { error?: string; detail?: string }
          | null;

        throw new Error(errorData?.detail || errorData?.error || "生成失败，请稍后再试。");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        fullText += decoder.decode(value, { stream: true });
        updateChapter(chapter.id, (current) => ({
          ...current,
          aiContent: fullText,
        }));
      }

      const lastChunk = decoder.decode();

      if (lastChunk) {
        fullText += lastChunk;
      }

      updateChapter(chapter.id, (current) => ({
        ...current,
        aiContent: fullText,
        isGenerating: false,
      }));
    } catch (error) {
      updateChapter(chapter.id, (current) => ({
        ...current,
        isGenerating: false,
        error: error instanceof Error ? error.message : "生成失败，请稍后再试。",
      }));
    }
  };

  const uploadPhotos = async (chapterId: string, files: File[]) => {
    updateChapter(chapterId, (current) => ({
      ...current,
      isUploading: true,
      error: null,
    }));

    try {
      const existing = draft.chapters[chapterId].photos;
      const uploaded: PhotoItem[] = [];

      for (const [index, file] of files.entries()) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("chapterId", chapterId);

        const response = await fetch("/api/photos/upload", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data = (await response.json()) as {
            id: string;
            url: string;
            storagePath?: string | null;
          };

          uploaded.push({
            id: data.id,
            url: data.url,
            storagePath: data.storagePath,
            caption: "",
            orderIndex: existing.length + index,
          });
        } else {
          const fallbackUrl = await fileToDataUrl(file);
          uploaded.push({
            id: createId("photo"),
            url: fallbackUrl,
            storagePath: null,
            caption: "",
            orderIndex: existing.length + index,
          });
        }
      }

      updateChapter(chapterId, (current) => ({
        ...current,
        isUploading: false,
        photos: [...current.photos, ...uploaded],
      }));
    } catch (error) {
      updateChapter(chapterId, (current) => ({
        ...current,
        isUploading: false,
        error: error instanceof Error ? error.message : "上传照片失败。",
      }));
    }
  };

  const reorderPhotos = async (chapterId: string, photos: PhotoItem[]) => {
    updateChapter(chapterId, (current) => ({
      ...current,
      photos,
    }));

    const persistedChapterId = draft.chapters[chapterId].id;

    if (!persistedChapterId) return;

    await fetch("/api/photos/reorder", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chapterId: persistedChapterId,
        photos,
      }),
    }).catch(() => null);
  };

  const updatePhotoCaption = (chapterId: string, photoId: string, caption: string) => {
    updateChapter(chapterId, (current) => ({
      ...current,
      photos: current.photos.map((photo) =>
        photo.id === photoId ? { ...photo, caption } : photo,
      ),
    }));
  };

  const deletePhoto = async (chapterId: string, photo: PhotoItem) => {
    const nextPhotos = draft.chapters[chapterId].photos
      .filter((item) => item.id !== photo.id)
      .map((item, index) => ({
        ...item,
        orderIndex: index,
      }));

    updateChapter(chapterId, (current) => ({
      ...current,
      photos: nextPhotos,
    }));

    if (photo.storagePath || draft.chapters[chapterId].id) {
      await fetch("/api/photos/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          photoId: photo.id,
          storagePath: photo.storagePath || null,
        }),
      }).catch(() => null);
    }

    if (draft.chapters[chapterId].id) {
      await fetch("/api/photos/reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chapterId: draft.chapters[chapterId].id,
          photos: nextPhotos,
        }),
      }).catch(() => null);
    }
  };

  const saveBiography = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch("/api/biography/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(toSerializableDraft(draft)),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as
          | { error?: string; detail?: string }
          | null;

        throw new Error(errorData?.detail || errorData?.error || "保存失败。");
      }

      const data = (await response.json()) as SaveResponse;

      setDraft((current) => ({
        ...current,
        id: data.biographyId,
        chapters: Object.fromEntries(
          Object.entries(current.chapters).map(([chapterId, chapter]) => [
            chapterId,
            { ...chapter, id: data.chapterIds[chapterId] || chapter.id },
          ]),
        ),
      }));
      setSaveMessage("草稿已保存到 Supabase。");
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="relative isolate px-4 pb-16 pt-6 md:px-8 md:pb-24 md:pt-10">
      <div className="mx-auto max-w-7xl">
        <section className="paper-panel overflow-hidden rounded-[36px] border border-[#ddcfbe]">
          <div className="grid gap-10 px-6 py-8 md:px-10 md:py-10 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-14">
            <aside className="space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-rust/20 bg-white/60 px-3 py-1 text-xs uppercase tracking-[0.3em] text-rust/80">
                  <BookOpen className="h-3.5 w-3.5" />
                  时光传记
                </div>
                <div className="space-y-3">
                  <h1 className="font-display text-4xl leading-tight text-ink md:text-5xl">
                    把一生，慢慢写成一本书
                  </h1>
                  <p className="max-w-md text-sm leading-8 text-ink/65">
                    先收集真实生活的碎片，再让 AI 按文学风格把它们整理成有纪实感的章节。
                  </p>
                </div>
              </div>

              <div className="rounded-[28px] border border-line/80 bg-white/45 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-ink">
                  <ScrollText className="h-4 w-4 text-rust" />
                  基本信息
                </div>
                <div className="space-y-4">
                  <label className="block space-y-2">
                    <span className="text-sm text-ink/70">长辈姓名</span>
                    <input
                      className="w-full rounded-2xl border border-line bg-paper/80 px-3 py-2.5 text-sm outline-none transition focus:border-rust/60 focus:bg-white"
                      placeholder="例如：李春荣"
                      value={draft.elderName}
                      onChange={(event) => updateDraft({ elderName: event.target.value })}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm text-ink/70">出生年份</span>
                    <input
                      className="w-full rounded-2xl border border-line bg-paper/80 px-3 py-2.5 text-sm outline-none transition focus:border-rust/60 focus:bg-white"
                      placeholder="例如：1948"
                      value={draft.birthYear}
                      onChange={(event) => updateDraft({ birthYear: event.target.value })}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm text-ink/70">籍贯</span>
                    <input
                      className="w-full rounded-2xl border border-line bg-paper/80 px-3 py-2.5 text-sm outline-none transition focus:border-rust/60 focus:bg-white"
                      placeholder="例如：河南延津"
                      value={draft.hometown}
                      onChange={(event) => updateDraft({ hometown: event.target.value })}
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-[28px] border border-line/80 bg-white/45 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-ink">
                  <Sparkles className="h-4 w-4 text-rust" />
                  文学风格
                </div>
                <div className="grid gap-3">
                  <button
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      draft.authorStyle === "YuHua"
                        ? "border-rust/50 bg-white text-ink"
                        : "border-line bg-paper/60 text-ink/65 hover:bg-white/70"
                    }`}
                    type="button"
                    onClick={() => updateDraft({ authorStyle: "YuHua" })}
                  >
                    <span className="block text-sm font-medium">余华风格</span>
                    <span className="mt-1 block text-xs leading-6 text-ink/55">
                      极简、冷峻、克制，用动作和生理反应写出苦难中的韧性。
                    </span>
                  </button>
                  <button
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      draft.authorStyle === "LiuZhenyun"
                        ? "border-rust/50 bg-white text-ink"
                        : "border-line bg-paper/60 text-ink/65 hover:bg-white/70"
                    }`}
                    type="button"
                    onClick={() => updateDraft({ authorStyle: "LiuZhenyun" })}
                  >
                    <span className="block text-sm font-medium">刘震云风格</span>
                    <span className="mt-1 block text-xs leading-6 text-ink/55">
                      更看重生活里的理儿、人情世故和带着分寸的幽默。
                    </span>
                  </button>
                </div>
              </div>

              <div className="rounded-[28px] border border-line/80 bg-white/45 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-ink">
                  <Library className="h-4 w-4 text-rust" />
                  成书结构
                </div>
                <div className="space-y-3">
                  <label className="block space-y-2">
                    <span className="text-sm text-ink/70">序言</span>
                    <textarea
                      className="min-h-[120px] w-full rounded-2xl border border-line bg-paper/80 px-3 py-2.5 text-sm leading-7 outline-none transition focus:border-rust/60 focus:bg-white"
                      placeholder="写下你为什么想替长辈记录这本回忆录。"
                      value={draft.preface}
                      onChange={(event) => updateDraft({ preface: event.target.value })}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm text-ink/70">后记</span>
                    <textarea
                      className="min-h-[120px] w-full rounded-2xl border border-line bg-paper/80 px-3 py-2.5 text-sm leading-7 outline-none transition focus:border-rust/60 focus:bg-white"
                      placeholder="写下长辈留给后辈的话，或者你想留在书尾的一段话。"
                      value={draft.epilogue}
                      onChange={(event) => updateDraft({ epilogue: event.target.value })}
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-[28px] border border-line/80 bg-[#f7f1e8]/80 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-ink">
                  <Sparkles className="h-4 w-4 text-rust" />
                  五段式采集
                </div>
                <div className="space-y-2">
                  {chapters.map((chapter) => (
                    <a
                      key={chapter.id}
                      className="flex items-center justify-between rounded-2xl px-3 py-3 text-sm text-ink/75 transition hover:bg-white/70 hover:text-ink"
                      href={`#${chapter.id}`}
                    >
                      <span>
                        {chapter.index}. {chapter.title}
                      </span>
                      <ChevronRight className="h-4 w-4" />
                    </a>
                  ))}
                </div>
                <div className="mt-5 space-y-3 border-t border-line/80 pt-4">
                  <p className="text-xs leading-6 text-ink/55">
                    已填写 {chapterCountWithContent} / {chapters.length} 个章节
                  </p>
                  <button
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-rust/30 bg-[#6f4b3a] px-4 py-2.5 text-sm text-white transition hover:bg-[#5f4032] disabled:cursor-not-allowed disabled:bg-[#a58a79]"
                    disabled={isSaving}
                    type="button"
                    onClick={saveBiography}
                  >
                    <Save className="h-4 w-4" />
                    {isSaving ? "保存中..." : "保存到 Supabase"}
                  </button>
                  <Link
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-line bg-white/70 px-4 py-2.5 text-sm text-ink transition hover:bg-white"
                    href="/preview"
                  >
                    <BookOpen className="h-4 w-4" />
                    打开成书预览
                  </Link>
                  {saveMessage ? <p className="text-xs leading-6 text-ink/55">{saveMessage}</p> : null}
                </div>
              </div>
            </aside>

            <div className="space-y-6">
              {chapters.map((chapter) => (
                <ChapterSection
                  key={chapter.id}
                  {...chapter}
                  aiContent={draft.chapters[chapter.id].aiContent}
                  error={draft.chapters[chapter.id].error}
                  isGenerating={draft.chapters[chapter.id].isGenerating}
                  isUploading={draft.chapters[chapter.id].isUploading}
                  photos={draft.chapters[chapter.id].photos}
                  rawInput={draft.chapters[chapter.id].rawInput}
                  selectedStyle={draft.authorStyle}
                  onGenerate={() => generateChapter(chapter)}
                  onPhotoCaptionChange={updatePhotoCaption}
                  onPhotoDelete={deletePhoto}
                  onPhotoReorder={reorderPhotos}
                  onPhotoUpload={uploadPhotos}
                  onRawInputChange={(value) => updateRawInput(chapter.id, value)}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
