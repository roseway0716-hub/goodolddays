import { Camera, Feather, Mic2, Sparkles } from "lucide-react";
import { PhotoUploader } from "@/components/photo-uploader";
import type { AuthorStyle, PhotoItem } from "@/lib/biography";

type ChapterSectionProps = {
  id: string;
  index: number;
  title: string;
  ageRange: string;
  prompt: string;
  hint: string;
  rawInput: string;
  aiContent: string;
  photos: PhotoItem[];
  isGenerating: boolean;
  isUploading: boolean;
  error: string | null;
  selectedStyle: AuthorStyle;
  onRawInputChange: (value: string) => void;
  onGenerate: () => void;
  onPhotoUpload: (chapterId: string, files: File[]) => Promise<void>;
  onPhotoReorder: (chapterId: string, photos: PhotoItem[]) => void | Promise<void>;
  onPhotoCaptionChange: (chapterId: string, photoId: string, caption: string) => void;
  onPhotoDelete: (chapterId: string, photo: PhotoItem) => void | Promise<void>;
};

export function ChapterSection({
  id,
  index,
  title,
  ageRange,
  prompt,
  hint,
  rawInput,
  aiContent,
  photos,
  isGenerating,
  isUploading,
  error,
  selectedStyle,
  onRawInputChange,
  onGenerate,
  onPhotoUpload,
  onPhotoReorder,
  onPhotoCaptionChange,
  onPhotoDelete,
}: ChapterSectionProps) {
  return (
    <section
      id={id}
      className="paper-panel scroll-mt-24 rounded-[32px] border border-[#dbcdbd] px-5 py-6 md:px-8 md:py-8"
    >
      <div className="flex flex-col gap-4 border-b border-[#d8ccbb] pb-5 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-rust/80">
            <span>{String(index).padStart(2, "0")}</span>
            <span>{ageRange}</span>
          </div>
          <h2 className="font-display text-2xl text-ink md:text-3xl">{title}</h2>
        </div>
        <p className="max-w-xl text-sm leading-7 text-ink/60">{hint}</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-line/80 bg-white/35 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
              <Mic2 className="h-4 w-4 text-rust" />
              时代钩子
            </div>
            <p className="text-[15px] leading-8 text-ink/70">{prompt}</p>
          </div>

          <label className="block space-y-3">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-ink">
              <Feather className="h-4 w-4 text-rust" />
              碎片素材记录
            </span>
            <textarea
              className="min-h-[260px] w-full rounded-[24px] border border-line bg-white/55 px-5 py-4 text-[15px] leading-8 text-ink outline-none transition placeholder:text-ink/35 focus:border-rust/60 focus:bg-white"
              placeholder="可以写关键词、方言原话、人物关系、当时做过的活、记住的一顿饭、一场病、一段路。越碎，越真实。"
              value={rawInput}
              onChange={(event) => onRawInputChange(event.target.value)}
            />
          </label>

          <div className="flex flex-col gap-3 rounded-[24px] border border-line/80 bg-white/35 p-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-ink">AI 润色</p>
              <p className="text-xs leading-6 text-ink/55">
                当前按{selectedStyle === "YuHua" ? "余华" : "刘震云"}风格生成，支持流式输出。
              </p>
            </div>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-full border border-rust/30 bg-[#6f4b3a] px-4 py-2 text-sm text-white transition hover:bg-[#5f4032] disabled:cursor-not-allowed disabled:bg-[#a58a79]"
              disabled={isGenerating}
              type="button"
              onClick={onGenerate}
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? "生成中..." : "生成本章"}
            </button>
          </div>

          {error ? (
            <div className="rounded-[20px] border border-[#c78b74] bg-[#fff6f1] px-4 py-3 text-sm text-[#8a4f39]">
              {error}
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <Camera className="h-4 w-4 text-rust" />
            章节相册
          </div>
          <PhotoUploader
            chapterId={id}
            isUploading={isUploading}
            photos={photos}
            onCaptionChange={onPhotoCaptionChange}
            onDelete={onPhotoDelete}
            onReorder={onPhotoReorder}
            onUpload={onPhotoUpload}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <article className="rounded-[24px] border border-line/80 bg-white/45 p-5">
          <div className="mb-3 text-sm font-medium text-ink">原始素材</div>
          <div className="min-h-[220px] whitespace-pre-wrap text-[15px] leading-8 text-ink/68">
            {rawInput || "这一栏会保留原始口述，方便后续与润色稿对照。"}
          </div>
        </article>
        <article className="rounded-[24px] border border-rust/20 bg-[#fcfaf5] p-5">
          <div className="mb-3 text-sm font-medium text-ink">润色稿</div>
          <div className="min-h-[220px] whitespace-pre-wrap text-[15px] leading-8 text-ink/78">
            {aiContent || (isGenerating ? "正在整理这段回忆..." : "点击“生成本章”后，这里会实时出现文学化整理结果。")}
          </div>
        </article>
      </div>
    </section>
  );
}
