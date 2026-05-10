"use client";

import Link from "next/link";
import { BookOpen, ChevronRight, Library, Save, ScrollText, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChapterSection } from "@/components/chapter-section";
import {
  STORAGE_KEY,
  chapters,
  createInitialDraft,
  mergeDraftWithDefaults,
  type BiographyDraft,
  type ChapterDefinition,
  type PhotoItem,
} from "@/lib/biography";
import { createId } from "@/lib/id";

type SaveResponse = {
  biographyId: string;
  chapterIds: Record<string, string>;
};

const FLOATING_NAV_STORAGE_KEY = "time-biography-floating-nav";

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
  const [activeChapterId, setActiveChapterId] = useState(chapters[0]?.id ?? "");
  const [navPosition, setNavPosition] = useState({ x: 24, y: 180 });
  const [navReady, setNavReady] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const savedFloatingNav = window.localStorage.getItem(FLOATING_NAV_STORAGE_KEY);

    if (savedFloatingNav) {
      try {
        const parsed = JSON.parse(savedFloatingNav) as { x?: number; y?: number };
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          setNavPosition({ x: parsed.x, y: parsed.y });
        }
      } catch {
        window.localStorage.removeItem(FLOATING_NAV_STORAGE_KEY);
      }
    } else if (typeof window !== "undefined") {
      setNavPosition({
        x: Math.max(16, window.innerWidth - 308),
        y: 148,
      });
    }

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as BiographyDraft;
        setDraft(mergeDraftWithDefaults(parsed));
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    setHasHydrated(true);
    setNavReady(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toSerializableDraft(draft)));
  }, [draft, hasHydrated]);

  useEffect(() => {
    if (!navReady) return;
    window.localStorage.setItem(FLOATING_NAV_STORAGE_KEY, JSON.stringify(navPosition));
  }, [navPosition, navReady]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio);

        if (visibleEntries[0]?.target.id) {
          setActiveChapterId(visibleEntries[0].target.id);
        }
      },
      {
        rootMargin: "-18% 0px -55% 0px",
        threshold: [0.2, 0.35, 0.55],
      },
    );

    const chapterElements = chapters
      .map((chapter) => document.getElementById(chapter.id))
      .filter((element): element is HTMLElement => Boolean(element));

    chapterElements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [hasHydrated]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!isDraggingRef.current) return;

      const width = 280;
      const height = 440;
      const nextX = Math.min(
        Math.max(12, event.clientX - dragOffsetRef.current.x),
        window.innerWidth - width - 12,
      );
      const nextY = Math.min(
        Math.max(88, event.clientY - dragOffsetRef.current.y),
        window.innerHeight - height - 12,
      );

      setNavPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

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

  const updateAiContent = (chapterId: string, aiContent: string) => {
    updateChapter(chapterId, (current) => ({
      ...current,
      aiContent,
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
            insertAfterParagraph: existing.length + index,
            annotation: "",
            showAnnotation: false,
          });
        } else {
          const fallbackUrl = await fileToDataUrl(file);
          uploaded.push({
            id: createId("photo"),
            url: fallbackUrl,
            storagePath: null,
            caption: "",
            orderIndex: existing.length + index,
            insertAfterParagraph: existing.length + index,
            annotation: "",
            showAnnotation: false,
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

  const jumpToChapter = (chapterId: string) => {
    document.getElementById(chapterId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setActiveChapterId(chapterId);
  };

  const startDraggingNav = (event: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    dragOffsetRef.current = {
      x: event.clientX - navPosition.x,
      y: event.clientY - navPosition.y,
    };
  };

  return (
    <main className="relative isolate px-4 pb-16 pt-6 md:px-8 md:pb-24 md:pt-10">
      <div className="fixed right-4 top-4 z-40 md:right-8 md:top-6">
        <Link
          className="inline-flex items-center justify-center gap-2 rounded-full border border-rust/25 bg-[#fffaf2]/92 px-5 py-3 text-sm text-ink shadow-[0_14px_36px_rgba(82,58,39,0.14)] backdrop-blur-sm transition hover:bg-white"
          href="/preview"
        >
          <BookOpen className="h-4 w-4" />
          成书预览
        </Link>
      </div>

      <div
        className="fixed z-30 hidden w-[280px] overflow-hidden rounded-[28px] border border-[#d8c7b2] bg-[rgba(255,248,238,0.94)] shadow-[0_24px_60px_rgba(79,55,35,0.18)] backdrop-blur-md xl:block"
        style={{ left: `${navPosition.x}px`, top: `${navPosition.y}px` }}
      >
        <div
          className="cursor-grab border-b border-line/80 bg-[rgba(244,233,217,0.9)] px-5 py-4 active:cursor-grabbing"
          role="button"
          tabIndex={0}
          onPointerDown={startDraggingNav}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-rust/78">五段式采集</p>
              <p className="mt-1 text-sm text-ink/62">可拖动，也可快速跳转到任一章节。</p>
            </div>
            <div className="space-y-1">
              <span className="block h-1 w-8 rounded-full bg-[#b89479]/80" />
              <span className="block h-1 w-8 rounded-full bg-[#b89479]/55" />
            </div>
          </div>
        </div>

        <div className="space-y-2 px-4 py-4">
          {chapters.map((chapter) => {
            const filled =
              draft.chapters[chapter.id].rawInput.trim() || draft.chapters[chapter.id].aiContent.trim();
            const isActive = activeChapterId === chapter.id;

            return (
              <button
                key={chapter.id}
                className={[
                  "flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm transition",
                  isActive
                    ? "bg-[#6f4b3a] text-white shadow-sm"
                    : "bg-white/55 text-ink/78 hover:bg-white",
                ].join(" ")}
                type="button"
                onClick={() => jumpToChapter(chapter.id)}
              >
                <span className="min-w-0">
                  <span className="block font-medium">
                    {chapter.index}. {chapter.title}
                  </span>
                  <span className={["mt-1 block text-xs", isActive ? "text-white/75" : "text-ink/48"].join(" ")}>
                    {chapter.ageRange}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {filled ? (
                    <span className={["h-2.5 w-2.5 rounded-full", isActive ? "bg-[#f0dcc5]" : "bg-[#9f6f51]"].join(" ")} />
                  ) : null}
                  <ChevronRight className="h-4 w-4 shrink-0" />
                </span>
              </button>
            );
          })}
        </div>

        <div className="border-t border-line/80 px-5 py-4">
          <p className="text-xs leading-6 text-ink/58">
            已填写 {chapterCountWithContent} / {chapters.length} 个章节
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl">
        <section className="paper-panel overflow-hidden rounded-[36px] border border-[#ddcfbe]">
          <div className="grid gap-10 px-6 py-8 md:px-10 md:py-10 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-14 xl:grid-cols-[320px_minmax(0,1fr)]">
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

              <div className="rounded-[28px] border border-line/80 bg-[#f7f1e8]/80 p-5 xl:hidden">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-ink">
                  <Sparkles className="h-4 w-4 text-rust" />
                  五段式采集
                </div>
                <div className="space-y-2">
                  {chapters.map((chapter) => (
                    <button
                      key={chapter.id}
                      className={[
                        "flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm transition",
                        activeChapterId === chapter.id
                          ? "bg-[#6f4b3a] text-white"
                          : "text-ink/75 hover:bg-white/70 hover:text-ink",
                      ].join(" ")}
                      type="button"
                      onClick={() => jumpToChapter(chapter.id)}
                    >
                      <span>
                        {chapter.index}. {chapter.title}
                      </span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-line/80 bg-[#f7f1e8]/80 p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-ink">
                  <Sparkles className="h-4 w-4 text-rust" />
                  草稿操作
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
                  onAiContentChange={(value) => updateAiContent(chapter.id, value)}
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
