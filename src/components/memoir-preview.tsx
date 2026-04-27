"use client";

import Link from "next/link";
import { ArrowLeft, BookText } from "lucide-react";
import { useEffect, useState } from "react";
import { STORAGE_KEY, chapters, createInitialDraft, type BiographyDraft } from "@/lib/biography";

function styleLabel(style: BiographyDraft["authorStyle"]) {
  return style === "YuHua" ? "余华风格" : "刘震云风格";
}

export function MemoirPreview() {
  const [draft, setDraft] = useState<BiographyDraft>(createInitialDraft);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (!saved) return;

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
  }, []);

  return (
    <main className="min-h-screen bg-paper px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <Link
            className="inline-flex items-center gap-2 rounded-full border border-line bg-white/70 px-4 py-2 text-sm text-ink transition hover:bg-white"
            href="/"
          >
            <ArrowLeft className="h-4 w-4" />
            返回采集页
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-rust/20 bg-white/60 px-3 py-1 text-xs uppercase tracking-[0.3em] text-rust/80">
            <BookText className="h-3.5 w-3.5" />
            可打印预览
          </div>
        </div>

        <article className="paper-panel overflow-hidden rounded-[36px] border border-[#ddcfbe] px-6 py-10 md:px-14 md:py-16">
          <header className="border-b border-line/80 pb-12 text-center">
            <p className="text-xs uppercase tracking-[0.38em] text-rust/70">时光传记</p>
            <h1 className="mt-5 font-display text-4xl text-ink md:text-6xl">
              {draft.elderName || "未命名传记"}
            </h1>
            <p className="mt-4 text-sm leading-8 text-ink/60">
              {draft.birthYear || "生年待补"} {draft.hometown ? `· ${draft.hometown}` : ""}
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.28em] text-ink/45">
              {styleLabel(draft.authorStyle)}
            </p>
          </header>

          {draft.preface ? (
            <section className="mx-auto mt-12 max-w-3xl border-b border-line/70 pb-12">
              <h2 className="font-display text-2xl text-ink">序言</h2>
              <p className="mt-5 whitespace-pre-wrap text-[15px] leading-9 text-ink/78">
                {draft.preface}
              </p>
            </section>
          ) : null}

          <div className="mt-12 space-y-12">
            {chapters.map((chapter) => {
              const chapterDraft = draft.chapters[chapter.id];

              return (
                <section key={chapter.id} className="border-b border-line/70 pb-12 last:border-none">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.32em] text-rust/70">
                        {String(chapter.index).padStart(2, "0")} · {chapter.ageRange}
                      </p>
                      <h2 className="mt-3 font-display text-3xl text-ink">{chapter.title}</h2>
                    </div>
                    <p className="max-w-xl text-sm leading-7 text-ink/55">{chapter.hint}</p>
                  </div>

                  <div className="mt-6 space-y-6">
                    <p className="whitespace-pre-wrap text-[16px] leading-9 text-ink/82">
                      {chapterDraft.aiContent || chapterDraft.rawInput || "这一章还没有整理出正文。"}
                    </p>

                    {chapterDraft.photos.length > 0 ? (
                      <div className="grid gap-5 md:grid-cols-2">
                        {chapterDraft.photos
                          .slice()
                          .sort((left, right) => left.orderIndex - right.orderIndex)
                          .map((photo) => (
                            <figure key={photo.id} className="space-y-3">
                              <div className="overflow-hidden rounded-[20px] border border-line bg-white">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  alt={photo.caption || chapter.title}
                                  className="aspect-[4/3] w-full object-cover"
                                  src={photo.url}
                                />
                              </div>
                              <figcaption className="text-sm leading-7 text-ink/60">
                                {photo.caption || "未添加照片标签"}
                              </figcaption>
                            </figure>
                          ))}
                      </div>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>

          {draft.epilogue ? (
            <section className="mx-auto mt-10 max-w-3xl border-t border-line/70 pt-12">
              <h2 className="font-display text-2xl text-ink">后记</h2>
              <p className="mt-5 whitespace-pre-wrap text-[15px] leading-9 text-ink/78">
                {draft.epilogue}
              </p>
            </section>
          ) : null}
        </article>
      </div>
    </main>
  );
}
