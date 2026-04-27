export type AuthorStyle = "YuHua" | "LiuZhenyun";

export type ChapterDefinition = {
  id: string;
  index: number;
  title: string;
  ageRange: string;
  prompt: string;
  hint: string;
  stageType: "0-12" | "13-20" | "21-35" | "36-60" | "61+";
};

export type PhotoItem = {
  id: string;
  url: string;
  caption: string;
  orderIndex: number;
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

export const STORAGE_KEY = "time-biography-draft";

export const chapters: ChapterDefinition[] = [
  {
    id: "chapter-1",
    index: 1,
    title: "童年与乡土",
    ageRange: "0-12 岁",
    stageType: "0-12",
    prompt:
      "家里住的是什么房子？冬天烧什么取暖？第一回记事，是谁在喊你，还是你在哭？有没有一条小路、一口井、一个总穿旧棉袄的人，后来怎么也忘不掉？",
    hint: "从吃穿、称呼、手上的活和家里的规矩入手，往往比大事件更能带出一段日子。",
  },
  {
    id: "chapter-2",
    index: 2,
    title: "少年与出门",
    ageRange: "13-20 岁",
    stageType: "13-20",
    prompt:
      "那几年是在读书、务农，还是已经开始做工？第一次离家去了哪儿？临走时家里谁送，谁没说话？有没有因为一件小事忽然觉得自己长大了？",
    hint: "可以多写第一次：第一次挣工分、第一次坐火车、第一次挨批评、第一次想离开家。",
  },
  {
    id: "chapter-3",
    index: 3,
    title: "成家与谋生",
    ageRange: "21-35 岁",
    stageType: "21-35",
    prompt:
      "怎么认识爱人，媒人说了什么，婚礼办得简单还是热闹？最难的那几年靠什么撑过去？家里添第一样像样的大件时，心里是什么滋味？",
    hint: "这一章适合把婚姻、工作、孩子出生和日常账本放在一起，生活的骨架会自然长出来。",
  },
  {
    id: "chapter-4",
    index: 4,
    title: "中年与承担",
    ageRange: "36-60 岁",
    stageType: "36-60",
    prompt:
      "家里上有老下有小时，最操心的是哪件事？有没有哪一年特别忙，忙到顾不上自己？你做决定时最信哪条理儿，又为了谁改过主意？",
    hint: "可以写责任怎样压在肩上，也写人在忙乱里保住体面的方法。",
  },
  {
    id: "chapter-5",
    index: 5,
    title: "晚年与回望",
    ageRange: "61 岁以后",
    stageType: "61+",
    prompt:
      "现在回头看，一生里最值当的事是什么？哪些苦已经说不出口，哪些人到现在还会时不时想起？如果留一句话给孙辈，你最想叮嘱什么？",
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
