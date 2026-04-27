import { NextRequest } from "next/server";

const STYLE_PROMPTS = {
  YuHua:
    "你现在是文学大师余华。文风极简、冷峻。杜绝华丽修辞，通过具体的动作和生理反应描写苦难中的韧性。保持克制，多用短句，用第一人称叙述。",
  LiuZhenyun:
    "你现在是文学大师刘震云。强调生活的逻辑、人情世故和幽默感。叙事讲究‘话赶话’和‘理儿’，展现平凡生活背后的世俗智慧。",
} as const;

const COMMON_PROMPT =
  "保留用户素材中的地道方言；严禁煽情；确保纪实感。不要虚构不存在的事件，不要补写未经提供的人名、地点或年代细节。";

type AuthorStyle = keyof typeof STYLE_PROMPTS;

type PolishPayload = {
  authorStyle?: AuthorStyle;
  rawInput?: string;
  elderName?: string;
  chapterTitle?: string;
  birthYear?: string;
};

function createSystemPrompt(authorStyle: AuthorStyle) {
  return `${STYLE_PROMPTS[authorStyle]}\n${COMMON_PROMPT}`;
}

function createUserPrompt({
  rawInput,
  elderName,
  chapterTitle,
  birthYear,
}: {
  rawInput: string;
  elderName: string;
  chapterTitle: string;
  birthYear?: string;
}) {
  return (
    `请把以下口述素材整理为纪实回忆录中的一个章节片段。\n` +
    `人物：${elderName}\n` +
    (birthYear ? `出生年份：${birthYear}\n` : "") +
    `章节：${chapterTitle}\n` +
    `要求：只输出整理后的正文，不要标题，不要解释，不要加编者按。\n\n` +
    `原始素材：\n${rawInput}`
  );
}

function externalSseToTextStream(stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = stream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            const dataLines = event
              .split("\n")
              .filter((line) => line.startsWith("data: "))
              .map((line) => line.slice(6));

            if (!dataLines.length) continue;

            const data = dataLines.join("\n").trim();

            if (data === "[DONE]") {
              controller.close();
              return;
            }

            try {
              const parsed = JSON.parse(data) as {
                choices?: Array<{
                  delta?: {
                    content?: string;
                  };
                  message?: {
                    content?: string;
                  };
                }>;
              };

              const choice = parsed.choices?.[0];
              const text = choice?.delta?.content ?? choice?.message?.content;

              if (text) {
                controller.enqueue(encoder.encode(text));
              }
            } catch {
              // Ignore heartbeat or non-JSON chunks from upstream.
            }
          }
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

export async function POST(request: NextRequest) {
  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const apiUrl = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

  if (!apiKey) {
    return Response.json(
      {
        error: "Missing DEEPSEEK_API_KEY in server environment.",
      },
      { status: 500 },
    );
  }

  const payload = (await request.json()) as PolishPayload;
  const authorStyle = payload.authorStyle;
  const rawInput = payload.rawInput?.trim();

  if (!authorStyle || !(authorStyle in STYLE_PROMPTS)) {
    return Response.json({ error: "Invalid authorStyle." }, { status: 400 });
  }

  if (!rawInput) {
    return Response.json({ error: "rawInput is required." }, { status: 400 });
  }

  const elderName = payload.elderName?.trim() || "受访长辈";
  const chapterTitle = payload.chapterTitle?.trim() || "人生章节";
  const birthYear = payload.birthYear?.trim();

  const upstreamResponse = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        {
          role: "system",
          content: createSystemPrompt(authorStyle),
        },
        {
          role: "user",
          content: createUserPrompt({
            rawInput,
            elderName,
            chapterTitle,
            birthYear,
          }),
        },
      ],
    }),
  });

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    const errorText = await upstreamResponse.text();
    let detail = errorText;

    try {
      const parsed = JSON.parse(errorText) as {
        error?: {
          message?: string;
          code?: string;
        };
      };

      if (parsed.error?.message) {
        if (parsed.error.message === "Insufficient Balance") {
          detail = "DeepSeek 账户余额不足，请先到 DeepSeek 后台充值，然后再试。";
        } else {
          detail = parsed.error.message;
        }
      }
    } catch {
      // Keep raw text when upstream does not return JSON.
    }

    return Response.json(
      {
        error: "External API upstream request failed.",
        detail,
      },
      { status: upstreamResponse.status || 500 },
    );
  }

  return new Response(externalSseToTextStream(upstreamResponse.body), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
