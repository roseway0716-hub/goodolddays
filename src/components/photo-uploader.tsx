"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, LoaderCircle, Tag, Trash2 } from "lucide-react";
import { ChangeEvent } from "react";
import type { PhotoItem } from "@/lib/biography";

type PhotoUploaderProps = {
  chapterId: string;
  photos: PhotoItem[];
  isUploading: boolean;
  onUpload: (chapterId: string, files: File[]) => Promise<void>;
  onReorder: (chapterId: string, photos: PhotoItem[]) => void | Promise<void>;
  onCaptionChange: (chapterId: string, photoId: string, caption: string) => void;
  onDelete: (chapterId: string, photo: PhotoItem) => void | Promise<void>;
};

type SortablePhotoCardProps = {
  chapterId: string;
  index: number;
  photo: PhotoItem;
  onCaptionChange: (chapterId: string, photoId: string, caption: string) => void;
  onDelete: (chapterId: string, photo: PhotoItem) => void | Promise<void>;
};

function SortablePhotoCard({
  chapterId,
  index,
  photo,
  onCaptionChange,
  onDelete,
}: SortablePhotoCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: photo.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      className="overflow-hidden rounded-[20px] border border-line/80 bg-white/60"
      style={style}
    >
      <div className="aspect-[4/3] overflow-hidden bg-[#e9dfd0]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={photo.caption || `图 ${index + 1}`} className="h-full w-full object-cover" src={photo.url} />
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-ink/45">
          <span>图 {String(index + 1).padStart(2, "0")}</span>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1 rounded-full border border-line bg-paper/70 px-2 py-1 text-[11px] text-ink/60"
              type="button"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-3.5 w-3.5" />
              拖拽调序
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-full border border-[#d9b3a3] bg-[#fff7f3] px-2 py-1 text-[11px] text-[#8a4f39] transition hover:bg-[#fff1ea]"
              type="button"
              onClick={() => onDelete(chapterId, photo)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </button>
          </div>
        </div>
        <label className="block space-y-2">
          <span className="inline-flex items-center gap-2 text-sm text-ink/70">
            <Tag className="h-4 w-4" />
            极简标签
          </span>
          <input
            className="w-full rounded-2xl border border-line bg-paper/80 px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-rust/60 focus:bg-white"
            placeholder="如：全家福 / 工厂门口 / 新婚"
            value={photo.caption}
            onChange={(event) => onCaptionChange(chapterId, photo.id, event.target.value)}
          />
        </label>
      </div>
    </article>
  );
}

export function PhotoUploader({
  chapterId,
  photos,
  isUploading,
  onUpload,
  onReorder,
  onCaptionChange,
  onDelete,
}: PhotoUploaderProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);

    if (!files.length) return;

    await onUpload(chapterId, files);
    event.target.value = "";
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = photos.findIndex((photo) => photo.id === active.id);
    const newIndex = photos.findIndex((photo) => photo.id === over.id);

    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(photos, oldIndex, newIndex).map((photo, index) => ({
      ...photo,
      orderIndex: index,
    }));

    onReorder(chapterId, reordered);
  };

  return (
    <div className="space-y-4 rounded-[24px] border border-line/80 bg-white/40 p-5">
      <label className="flex cursor-pointer items-center justify-between rounded-[20px] border border-dashed border-rust/40 bg-paper px-4 py-4 transition hover:border-rust/70 hover:bg-white/70">
        <div className="space-y-1">
          <p className="text-sm font-medium text-ink">上传这一章节的老照片</p>
          <p className="text-xs text-ink/55">支持多张选择，拖拽排序后会保存 `order_index`。</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-rust/30 bg-white/80">
          {isUploading ? (
            <LoaderCircle className="h-5 w-5 animate-spin text-rust" />
          ) : (
            <ImagePlus className="h-5 w-5 text-rust" />
          )}
        </div>
        <input
          className="hidden"
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        {photos.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-line bg-white/35 px-4 py-8 text-center text-sm text-ink/55 md:col-span-2">
            还没有照片。这里会成为这一段人生的相册页。
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={photos.map((photo) => photo.id)} strategy={rectSortingStrategy}>
              {photos.map((photo, index) => (
                <SortablePhotoCard
                  key={photo.id}
                  chapterId={chapterId}
                  index={index}
                  photo={photo}
                  onCaptionChange={onCaptionChange}
                  onDelete={onDelete}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
