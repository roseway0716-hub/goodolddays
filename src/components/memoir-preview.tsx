"use client";

import Link from "next/link";
import { ArrowLeft, BookText, Image as ImageIcon, MessageSquareText } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  STORAGE_KEY,
  chapters,
  createInitialDraft,
  mergeDraftWithDefaults,
  type BiographyDraft,
  type PhotoItem,
} from "@/lib/biography";

function styleLabel(style: BiographyDraft["authorStyle"]) {
  return style === "YuHua" ? "余华风格" : "刘震云风格";
}

function normalizeParagraphIndex(index: number, paragraphCount: number) {
  return Math.max(0, Math.min(index, paragraphCount));
}

function splitContentToParagraphs(content: string) {
  const paragraphs = content
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs.length ? paragraphs : ["这一章还没有整理出正文。"];
}

const PREVIEW_LAYOUT_STORAGE_KEY = "time-biography-preview-layout";

type PreviewLayoutMode = "single" | "spread";

type BookPageProps = {
  pageNumber: number;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  side?: "single" | "left" | "right";
};

function BookPage({
  pageNumber,
  eyebrow,
  title,
  subtitle,
  children,
  side = "single",
}: BookPageProps) {
  return (
    <section className={["book-page", `book-page--${side}`].join(" ")}>
      <div className="book-page__edge" aria-hidden="true" />
      <div className="book-page__content">
        <header className="border-b border-[#d8cab7] pb-7 text-center">
          {eyebrow ? (
            <p className="text-[11px] uppercase tracking-[0.34em] text-rust/70">{eyebrow}</p>
          ) : null}
          <h2 className="mt-3 font-display text-3xl text-ink md:text-[2.4rem]">{title}</h2>
          {subtitle ? <p className="mt-3 text-sm leading-7 text-ink/58">{subtitle}</p> : null}
        </header>

        <div className="mt-8">{children}</div>

        <footer className="mt-10 flex items-center justify-center gap-4 text-[11px] uppercase tracking-[0.3em] text-ink/38">
          <span className="h-px w-10 bg-[#cfbea7]" />
          <span>{String(pageNumber).padStart(2, "0")}</span>
          <span className="h-px w-10 bg-[#cfbea7]" />
        </footer>
      </div>
    </section>
  );
}

type PreviewChapter = {
  chapter: (typeof chapters)[number];
  chapterContent: string;
  orderedPhotos: PhotoItem[];
  paragraphs: string[];
};

type PreviewPageItem = {
  key: string;
  pageNumber: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  content: ReactNode;
};

function chunkIntoPairs<T>(items: T[]) {
  const pairs: Array<[T, T | null]> = [];

  for (let index = 0; index < items.length; index += 2) {
    pairs.push([items[index], items[index + 1] ?? null]);
  }

  return pairs;
}

type PhotoPlacementControlProps = {
  chapterId: string;
  paragraphs: string[];
  photo: PhotoItem;
  photoIndex: number;
  onPhotoUpdate: (chapterId: string, photoId: string, patch: Partial<PhotoItem>) => void;
};

function PhotoPlacementControl({
  chapterId,
  paragraphs,
  photo,
  photoIndex,
  onPhotoUpdate,
}: PhotoPlacementControlProps) {
  const maxPosition = paragraphs.length;

  return (
    <div className="rounded-[20px] border border-line/80 bg-white/55 p-4">
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[14px] border border-line bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={photo.caption || `图片 ${photoIndex + 1}`} className="h-full w-full object-cover" src={photo.url} />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-medium text-ink">图片 {String(photoIndex + 1).padStart(2, "0")}</p>
            <p className="text-xs leading-6 text-ink/50">{photo.caption || "未填写图片标签"}</p>
          </div>

          <label className="block space-y-2">
            <span className="inline-flex items-center gap-2 text-sm text-ink/70">
              <ImageIcon className="h-4 w-4 text-rust" />
              插入位置
            </span>
            <select
              className="w-full rounded-2xl border border-line bg-paper/80 px-3 py-2 text-sm text-ink outline-none transition focus:border-rust/60 focus:bg-white"
              value={normalizeParagraphIndex(photo.insertAfterParagraph, maxPosition)}
              onChange={(event) =>
                onPhotoUpdate(chapterId, photo.id, {
                  insertAfterParagraph: Number(event.target.value),
                })
              }
            >
              <option value={0}>正文前</option>
              {paragraphs.map((_, index) => (
                <option key={index + 1} value={index + 1}>
                  第 {index + 1} 段后
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-3 text-sm text-ink/75">
            <input
              checked={photo.showAnnotation}
              className="h-4 w-4 accent-[#6f4b3a]"
              type="checkbox"
              onChange={(event) =>
                onPhotoUpdate(chapterId, photo.id, {
                  showAnnotation: event.target.checked,
                })
              }
            />
            显示图片注释
          </label>

          {photo.showAnnotation ? (
            <label className="block space-y-2">
              <span className="inline-flex items-center gap-2 text-sm text-ink/70">
                <MessageSquareText className="h-4 w-4 text-rust" />
                注释内容
              </span>
              <input
                className="w-full rounded-2xl border border-line bg-paper/80 px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-rust/60 focus:bg-white"
                placeholder="例如：这是外公第一次去县城时拍的照片。"
                value={photo.annotation}
                onChange={(event) =>
                  onPhotoUpdate(chapterId, photo.id, {
                    annotation: event.target.value,
                  })
                }
              />
            </label>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type ChapterBodyProps = {
  chapterTitle: string;
  content: string;
  photos: PhotoItem[];
};

function ChapterBody({ chapterTitle, content, photos }: ChapterBodyProps) {
  const paragraphs = useMemo(() => splitContentToParagraphs(content), [content]);
  const photosByParagraph = useMemo(() => {
    const grouped = new Map<number, PhotoItem[]>();

    for (const photo of photos) {
      const key = normalizeParagraphIndex(photo.insertAfterParagraph, paragraphs.length);
      const current = grouped.get(key) ?? [];
      current.push(photo);
      grouped.set(key, current);
    }

    for (const value of grouped.values()) {
      value.sort((left, right) => left.orderIndex - right.orderIndex);
    }

    return grouped;
  }, [paragraphs.length, photos]);

  return (
    <div className="space-y-6">
      {(photosByParagraph.get(0) ?? []).map((photo) => (
        <figure key={photo.id} className="space-y-3">
          <div className="overflow-hidden rounded-[20px] border border-line bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={photo.caption || chapterTitle} className="aspect-[4/3] w-full object-cover" src={photo.url} />
          </div>
          {photo.showAnnotation && photo.annotation.trim() ? (
            <figcaption className="text-sm italic leading-7 text-ink/45">{photo.annotation}</figcaption>
          ) : null}
        </figure>
      ))}

      {paragraphs.map((paragraph, index) => (
        <div key={`${chapterTitle}-${index}`} className="space-y-6">
          <p
            className={[
              "whitespace-pre-wrap text-[16px] leading-9 text-ink/82",
              index === 0
                ? "first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:font-display first-letter:text-5xl first-letter:leading-none first-letter:text-rust"
                : "",
            ].join(" ")}
          >
            {paragraph}
          </p>
          {(photosByParagraph.get(index + 1) ?? []).map((photo) => (
            <figure key={photo.id} className="space-y-3">
              <div className="overflow-hidden rounded-[20px] border border-line bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={photo.caption || chapterTitle} className="aspect-[4/3] w-full object-cover" src={photo.url} />
              </div>
              {photo.showAnnotation && photo.annotation.trim() ? (
                <figcaption className="text-sm italic leading-7 text-ink/45">{photo.annotation}</figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      ))}
    </div>
  );
}

export function MemoirPreview() {
  const [draft, setDraft] = useState<BiographyDraft>(createInitialDraft);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [layoutMode, setLayoutMode] = useState<PreviewLayoutMode>("single");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const savedLayout = window.localStorage.getItem(PREVIEW_LAYOUT_STORAGE_KEY);

    if (savedLayout === "single" || savedLayout === "spread") {
      setLayoutMode(savedLayout);
    }

    if (!saved) {
      setHasHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(saved) as BiographyDraft;
      setDraft(mergeDraftWithDefaults(parsed));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHasHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;
    window.localStorage.setItem(PREVIEW_LAYOUT_STORAGE_KEY, layoutMode);
  }, [hasHydrated, layoutMode]);

  const previewChapters = useMemo<PreviewChapter[]>(
    () =>
      chapters
        .map((chapter) => {
          const chapterDraft = draft.chapters[chapter.id];
          const chapterContent = chapterDraft.aiContent || chapterDraft.rawInput || "";
          const orderedPhotos = chapterDraft.photos
            .slice()
            .sort((left, right) => left.orderIndex - right.orderIndex);

          if (!chapterContent.trim() && orderedPhotos.length === 0) {
            return null;
          }

          return {
            chapter,
            chapterContent,
            orderedPhotos,
            paragraphs: splitContentToParagraphs(chapterContent),
          };
        })
        .filter((item): item is PreviewChapter => item !== null),
    [draft.chapters],
  );

  const hasBookContent =
    Boolean(draft.preface.trim()) ||
    Boolean(draft.epilogue.trim()) ||
    previewChapters.length > 0;

  const pageItems = useMemo<PreviewPageItem[]>(() => {
    const pages: PreviewPageItem[] = [];
    let pageNumber = 1;

    if (!hasBookContent) {
      pages.push({
        key: "blank-opening",
        pageNumber,
        eyebrow: "卷首",
        title: "书稿尚未落笔",
        subtitle: "回到采集页补充人物故事、序言或章节内容，这里会自动排成一本可阅读的回忆录。",
        content: (
          <p className="text-[16px] leading-9 text-ink/78">
            目前这本书还停留在空白扉页。等你写下片段、补上照片，再回来时，它会开始拥有章节、呼吸和时间留下的纹理。
          </p>
        ),
      });

      return pages;
    }

    if (draft.preface.trim()) {
      pages.push({
        key: "preface",
        pageNumber: pageNumber++,
        eyebrow: "序言",
        title: "写在前面",
        subtitle: "一些为回忆开启的缘由，也为读者轻轻翻开第一页。",
        content: <p className="whitespace-pre-wrap text-[16px] leading-9 text-ink/78">{draft.preface}</p>,
      });
    }

    for (const { chapter, chapterContent, orderedPhotos } of previewChapters) {
      pages.push({
        key: chapter.id,
        pageNumber: pageNumber++,
        eyebrow: `${String(chapter.index).padStart(2, "0")} · ${chapter.ageRange}`,
        title: chapter.title,
        subtitle: chapter.hint,
        content: (
          <ChapterBody chapterTitle={chapter.title} content={chapterContent} photos={orderedPhotos} />
        ),
      });
    }

    if (draft.epilogue.trim()) {
      pages.push({
        key: "epilogue",
        pageNumber: pageNumber++,
        eyebrow: "后记",
        title: "合上这一册",
        subtitle: "故事讲完以后，余下的是时间与人心仍在回响。",
        content: <p className="whitespace-pre-wrap text-[16px] leading-9 text-ink/78">{draft.epilogue}</p>,
      });
    }

    return pages;
  }, [draft.epilogue, draft.preface, hasBookContent, previewChapters]);

  const updateChapterPhoto = async (
    chapterId: string,
    photoId: string,
    patch: Partial<PhotoItem>,
  ) => {
    const chapterDraft = draft.chapters[chapterId];
    const nextPhotos = chapterDraft.photos.map((photo) =>
      photo.id === photoId ? { ...photo, ...patch } : photo,
    );

    setDraft((current) => ({
      ...current,
      chapters: {
        ...current.chapters,
        [chapterId]: {
          ...current.chapters[chapterId],
          photos: current.chapters[chapterId].photos.map((photo) =>
            photo.id === photoId ? { ...photo, ...patch } : photo,
          ),
        },
      },
    }));

    if (!chapterDraft.id) return;

    await fetch("/api/photos/reorder", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chapterId: chapterDraft.id,
        photos: nextPhotos,
      }),
    }).catch(() => null);
  };

  return (
    <main className="book-room min-h-screen px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link
            className="inline-flex items-center gap-2 rounded-full border border-[#cbb59b] bg-[#fffaf1]/85 px-4 py-2 text-sm text-ink transition hover:bg-white"
            href="/"
          >
            <ArrowLeft className="h-4 w-4" />
            返回采集页
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-rust/20 bg-[#fff7ea]/70 px-3 py-1 text-xs uppercase tracking-[0.3em] text-rust/80">
              <BookText className="h-3.5 w-3.5" />
              成书阅读模式
            </div>
            <p className="text-sm text-ink/55">封面、纸页纹理、页码与留白已按阅读体验重新排版。</p>
            <div className="inline-flex rounded-full border border-[#ccb79c] bg-[#fffaf1]/80 p-1 text-sm text-ink/70">
              <button
                className={[
                  "rounded-full px-4 py-2 transition",
                  layoutMode === "single" ? "bg-[#7f543d] text-[#fff6ea] shadow-sm" : "hover:bg-[#f3e6d5]",
                ].join(" ")}
                type="button"
                onClick={() => setLayoutMode("single")}
              >
                单页阅读
              </button>
              <button
                className={[
                  "rounded-full px-4 py-2 transition",
                  layoutMode === "spread" ? "bg-[#7f543d] text-[#fff6ea] shadow-sm" : "hover:bg-[#f3e6d5]",
                ].join(" ")}
                type="button"
                onClick={() => setLayoutMode("spread")}
              >
                双页摊开
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-8 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-5 xl:sticky xl:top-8 xl:self-start">
            <section className="rounded-[28px] border border-[#ceb99e] bg-[rgba(255,248,237,0.82)] p-6 shadow-[0_18px_50px_rgba(71,49,31,0.12)] backdrop-blur-sm">
              <p className="text-[11px] uppercase tracking-[0.34em] text-rust/75">装帧信息</p>
              <h2 className="mt-3 font-display text-2xl text-ink">
                {draft.elderName || "未命名传记"}
              </h2>
              <p className="mt-3 text-sm leading-7 text-ink/62">
                这里保留排版微调入口，正文阅读区则尽量像一本真正摊开的家庭回忆录。
              </p>
              <div className="mt-5 space-y-2 text-sm text-ink/58">
                <p>体例：{styleLabel(draft.authorStyle)}</p>
                <p>章节：{previewChapters.length || 0} 篇</p>
                <p>
                  人物：{draft.birthYear || "生年待补"}
                  {draft.hometown ? ` · ${draft.hometown}` : ""}
                </p>
              </div>
            </section>

            {previewChapters.map(({ chapter, orderedPhotos, paragraphs }) =>
              orderedPhotos.length > 0 ? (
                <section
                  key={chapter.id}
                  className="space-y-4 rounded-[28px] border border-[#d4c2aa] bg-[rgba(255,250,242,0.75)] p-5 shadow-[0_16px_40px_rgba(79,55,34,0.08)] backdrop-blur-sm"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-ink">
                    <BookText className="h-4 w-4 text-rust" />
                    {chapter.title} · 图片排版
                  </div>
                  <div className="grid gap-3">
                    {orderedPhotos.map((photo, photoIndex) => (
                      <PhotoPlacementControl
                        key={photo.id}
                        chapterId={chapter.id}
                        paragraphs={paragraphs}
                        photo={photo}
                        photoIndex={photoIndex}
                        onPhotoUpdate={updateChapterPhoto}
                      />
                    ))}
                  </div>
                </section>
              ) : null,
            )}
          </aside>

          <div className="space-y-8">
            <section className="book-cover">
              <div className="book-cover__plate">
                <p className="text-xs uppercase tracking-[0.42em] text-[#f2dec3]/82">时光传记</p>
                <h1 className="mt-8 font-display text-4xl text-[#fff8ef] md:text-6xl">
                  {draft.elderName || "未命名传记"}
                </h1>
                <p className="mt-5 text-sm leading-8 text-[#f7ead9]/72">
                  {draft.birthYear || "生年待补"} {draft.hometown ? `· ${draft.hometown}` : ""}
                </p>
                <div className="mx-auto mt-10 h-px w-24 bg-[#e7cba8]/40" />
                <p className="mt-8 text-xs uppercase tracking-[0.32em] text-[#ead7be]/74">
                  {styleLabel(draft.authorStyle)}
                </p>
              </div>
            </section>

            {layoutMode === "spread" ? (
              <div className="space-y-8">
                {chunkIntoPairs(pageItems).map(([leftPage, rightPage], index) => (
                  <section key={`${leftPage.key}-${rightPage?.key ?? "empty"}`} className="book-spread">
                    <div className="book-spread__gutter" aria-hidden="true" />
                    <BookPage
                      pageNumber={leftPage.pageNumber}
                      eyebrow={leftPage.eyebrow}
                      title={leftPage.title}
                      subtitle={leftPage.subtitle}
                      side="left"
                    >
                      {leftPage.content}
                    </BookPage>
                    {rightPage ? (
                      <BookPage
                        pageNumber={rightPage.pageNumber}
                        eyebrow={rightPage.eyebrow}
                        title={rightPage.title}
                        subtitle={rightPage.subtitle}
                        side="right"
                      >
                        {rightPage.content}
                      </BookPage>
                    ) : (
                      <div className="book-page book-page--ghost" aria-hidden="true" />
                    )}
                  </section>
                ))}
              </div>
            ) : (
              <div className="space-y-8">
                {pageItems.map((page) => (
                  <BookPage
                    key={page.key}
                    pageNumber={page.pageNumber}
                    eyebrow={page.eyebrow}
                    title={page.title}
                    subtitle={page.subtitle}
                  >
                    {page.content}
                  </BookPage>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
