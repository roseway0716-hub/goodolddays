export type AuthorStyle = "YuHua" | "LiuZhenyun";

export type ChapterDefinition = {
  id: string;
  index: number;
  title: string;
  ageRange: string;
  prompt: string[];
  hint: string;
  stageType: "0-12" | "13-20" | "21-35" | "36-60" | "61+";
};

export type PhotoItem = {
  id: string;
  url: string;
  caption: string;
  orderIndex: number;
  insertAfterParagraph: number;
  annotation: string;
  showAnnotation: boolean;
  storagePath?: string | null;
};

export type ChapterDraft = {
  id?: string;
  stageType: ChapterDefinition["stageType"];
  rawInput: string;
  aiContent: string;
  photos: PhotoItem[];
  isGenerating: boolean;
  isUploading: boolean;
  error: string | null;
};

export type BiographyDraft = {
  id?: string;
  elderName: string;
  birthYear: string;
  hometown: string;
  preface: string;
  epilogue: string;
  authorStyle: AuthorStyle;
  chapters: Record<string, ChapterDraft>;
};

export function normalizePhotoItem(photo: PhotoItem, index: number): PhotoItem {
  return {
    ...photo,
    orderIndex: Number.isFinite(photo.orderIndex) ? photo.orderIndex : index,
    insertAfterParagraph: Number.isFinite(photo.insertAfterParagraph)
      ? photo.insertAfterParagraph
      : index,
    annotation: photo.annotation ?? "",
    showAnnotation: photo.showAnnotation ?? false,
  };
}

export function mergeDraftWithDefaults(saved: BiographyDraft): BiographyDraft {
  const initial = createInitialDraft();

  return {
    ...initial,
    ...saved,
    chapters: Object.fromEntries(
      chapters.map((chapter) => {
        const savedChapter = saved.chapters?.[chapter.id];

        return [
          chapter.id,
          {
            ...initial.chapters[chapter.id],
            ...savedChapter,
            photos: (savedChapter?.photos ?? []).map((photo, index) =>
              normalizePhotoItem(photo, index),
            ),
          },
        ];
      }),
    ) as Record<string, ChapterDraft>,
  };
}

export const STORAGE_KEY = "time-biography-draft";

export const chapters: ChapterDefinition[] = [
  {
    id: "chapter-1",
    index: 1,
    title: "童年与乡土",
    ageRange: "0-12 岁",
    stageType: "0-12",
    prompt: [
      "小时候家里住的是什么样的房子？家里一共有几口人？",
      "那时候一天都怎么过？早上起来先做什么，晚上又怎么睡？",
      "家里平时吃什么、穿什么？冬天怎么取暖，夏天怎么避暑？",
      "小时候最怕谁、最听谁的话？家里有没有什么特别严的规矩？",
      "村里、院里或者家门口，有没有哪个地方你到现在还记得很清楚？",
    ],
    hint: "从吃穿、称呼、手上的活和家里的规矩入手，往往比大事件更能带出一段日子。",
  },
  {
    id: "chapter-2",
    index: 2,
    title: "少年与出门",
    ageRange: "13-20 岁",
    stageType: "13-20",
    prompt: [
      "那几年你是在读书、下地，还是已经出去做工了？",
      "你第一次离开家是因为什么，要去哪里，心里紧不紧张？",
      "家里当时支不支持你出门？是谁送你的，临走前都说了什么？",
      "那段时间有没有哪件事，让你一下子觉得自己不能再像小孩一样了？",
      "第一次挣钱、第一次坐车、第一次挨批评这些事，你还记得哪一件？",
    ],
    hint: "可以多写第一次：第一次挣工分、第一次坐火车、第一次挨批评、第一次想离开家。",
  },
  {
    id: "chapter-3",
    index: 3,
    title: "成家与谋生",
    ageRange: "21-35 岁",
    stageType: "21-35",
    prompt: [
      "你和爱人是怎么认识的？中间有没有人介绍，第一次见面是什么感觉？",
      "结婚那会儿家里条件怎么样，婚礼是怎么办的？",
      "刚成家那几年，家里主要靠什么收入过日子？",
      "最难的时候难在哪儿，是缺钱、缺粮、工作不稳，还是孩子要养？",
      "家里添第一件大件或者像样家具时，你还记得当时有多高兴吗？",
    ],
    hint: "这一章适合把婚姻、工作、孩子出生和日常账本放在一起，生活的骨架会自然长出来。",
  },
  {
    id: "chapter-4",
    index: 4,
    title: "中年与承担",
    ageRange: "36-60 岁",
    stageType: "36-60",
    prompt: [
      "那时候家里最让你操心的是什么，是老人、孩子、工作，还是家里开销？",
      "有没有哪几年特别忙，忙到连自己生病都顾不上？",
      "家里遇到大事时，通常是谁拿主意，你一般怎么做决定？",
      "你为了家里人，做过哪些硬着头皮也得扛下来的事？",
      "现在回头看，中年那段日子最不容易的一关是什么？",
    ],
    hint: "可以写责任怎样压在肩上，也写人在忙乱里保住体面的方法。",
  },
  {
    id: "chapter-5",
    index: 5,
    title: "晚年与回望",
    ageRange: "61 岁以后",
    stageType: "61+",
    prompt: [
      "现在回头看，这一辈子你觉得最值的是哪几件事？",
      "有没有一些人或一些事，到现在想起来心里还会动一下？",
      "年轻时候吃过的苦，现在再看，你觉得值不值、冤不冤？",
      "这些年你的想法变过吗？以前在意的事，现在还在意吗？",
      "如果给晚辈留几句话，你最想提醒他们什么？",
    ],
    hint: "不必总结得太圆满。说得平常一点，反而更像真话。",
  },
];

export function createInitialDraft(): BiographyDraft {
  return {
    elderName: "",
    birthYear: "",
    hometown: "",
    preface: "",
    epilogue: "",
    authorStyle: "YuHua",
    chapters: Object.fromEntries(
      chapters.map((chapter) => [
        chapter.id,
        {
          stageType: chapter.stageType,
          rawInput: "",
          aiContent: "",
          photos: [],
          isGenerating: false,
          isUploading: false,
          error: null,
        },
      ]),
    ) as Record<string, ChapterDraft>,
  };
}
