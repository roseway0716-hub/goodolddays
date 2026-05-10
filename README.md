# 时光传记

> 把一生，慢慢写成一本书。

面向家庭成员的长辈口述史采集、AI 文学化整理与成书预览工具。用户按人生阶段输入碎片素材，上传相关照片，选择文学风格，由 AI 将原始口述整理为克制、纪实、有可读性的章节正文，最终生成可预览、可打印的传记草稿。

---

## 功能概览

- **五段式人生采集**：童年与乡土 → 少年与出门 → 成家与谋生 → 中年与承担 → 晚年与回望
- **引导问题**：每章提供口语化访谈问题，帮助用户问出生活细节
- **AI 流式润色**：调用 DeepSeek API，按余华或刘震云风格实时生成章节正文
- **润色稿直接编辑**：AI 输出后可在原地继续人工修改
- **章节相册**：按章节上传照片，支持拖拽排序、图片说明编辑、删除
- **成书预览**：`/preview` 页面提供单页 / 双页翻开两种阅读模式，含封面、页码与纸张纹理
- **图片插入位置控制**：在预览页为每张照片选择插入到正文哪一段之后
- **图片注释**：可开启灰色斜体注释，样式近似出版物图注
- **本地草稿**：通过 `localStorage` 自动保存，刷新不丢失
- **云端保存**：通过 Supabase 持久化传记、章节和照片数据

---

## 技术栈

| 层次 | 技术 |
|------|------|
| 框架 | Next.js 15 (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS |
| 拖拽 | @dnd-kit/core + @dnd-kit/sortable |
| 图标 | lucide-react |
| 数据库 | Supabase (PostgreSQL) |
| 存储 | Supabase Storage |
| AI   | DeepSeek Chat Completions API（流式） |

---

## 快速开始

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd time-biography
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制示例文件并填写：

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```env
# DeepSeek API（必填，用于 AI 润色）
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash

# Supabase（可选，不填则仅支持本地草稿）
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

> **注意**：未配置 Supabase 时，应用仍可正常使用——本地草稿和 AI 润色功能不受影响，云端保存和照片上传会返回友好提示。

### 4. 初始化数据库（如使用 Supabase）

在 Supabase SQL 编辑器中依次执行：

```
supabase/migrations/0001_init.sql
supabase/migrations/0002_photo_layout_fields.sql
```

同时在 Supabase Storage 中创建名为 `biography-photos` 的公开 Bucket。

### 5. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)。

---

## 项目结构

```
src/
├── app/
│   ├── api/
│   │   ├── biography/save/   # 保存传记到 Supabase
│   │   ├── photos/
│   │   │   ├── upload/       # 上传照片到 Storage
│   │   │   ├── delete/       # 删除照片
│   │   │   └── reorder/      # 持久化照片排序
│   │   └── polish/           # DeepSeek 流式润色
│   ├── preview/              # 成书预览页
│   ├── layout.tsx
│   └── page.tsx              # 采集工作台首页
├── components/
│   ├── memoir-workspace.tsx  # 主工作台（状态管理核心）
│   ├── memoir-preview.tsx    # 成书预览
│   ├── chapter-section.tsx   # 单章节采集区
│   └── photo-uploader.tsx    # 照片上传 + 拖拽排序
└── lib/
    ├── biography.ts          # 数据类型、章节定义、草稿工具
    ├── id.ts                 # ID 生成
    └── supabase-admin.ts     # Supabase 客户端（服务端）
```

---

## API 接口

### `POST /api/polish`

将章节原始素材润色为纪实回忆录正文（流式返回）。

**请求体**

```json
{
  "authorStyle": "YuHua",
  "rawInput": "用户写的碎片素材",
  "elderName": "李春荣",
  "chapterTitle": "童年与乡土",
  "birthYear": "1948"
}
```

**响应**：`text/plain` 流式文本。

---

### `POST /api/biography/save`

保存完整草稿到 Supabase，返回传记 ID 与章节 ID 映射。

---

### `POST /api/photos/upload`

上传图片到 Supabase Storage，返回 `{ id, storagePath, url }`。

---

### `POST /api/photos/delete`

删除照片记录及 Storage 文件。

---

### `POST /api/photos/reorder`

持久化章节照片的排序与插入位置。

---

## 数据库结构

```sql
biographies   -- 传记主表（姓名、风格、序言、后记等）
chapters      -- 章节表（原始素材、AI 润色稿）
photos        -- 照片表（URL、说明、排序、插入位置、注释）
```

详见 `supabase/migrations/`。

---

## 文学风格说明

| 风格 | 描述 |
|------|------|
| `YuHua`（余华风格） | 极简、冷峻、克制，多短句，通过具体动作和生理反应写出苦难中的韧性 |
| `LiuZhenyun`（刘震云风格） | 强调生活逻辑、人情世故与幽默感，叙事讲究"话赶话"和"理儿" |

> 后续版本计划将风格标签改为更通用的描述性词汇，降低合规风险。

---

## 开发脚本

```bash
npm run dev      # 启动开发服务器
npm run build    # 构建生产包
npm run start    # 启动生产服务器
npm run lint     # ESLint 检查
```

---

## 路线图

**当前 MVP 已实现**：五段式采集、AI 流式润色、润色稿编辑、照片管理、本地保存、Supabase 保存、成书预览、图片插入位置控制、图片注释。

**Beta 计划**：传记项目列表、PDF/DOCX 导出、AI 访谈提纲生成、图片压缩与上传进度、移动端优化。

**正式版计划**：账号体系、家庭成员协作、分享链接、版本历史、印刷服务。

---

## 注意事项

- 用户输入可能包含个人与家庭隐私，正式上线前请补充隐私政策与数据删除能力。
- 图片建议在客户端压缩后再上传，避免大文件影响体验。
- 当前为单项目草稿模型（每个浏览器只能维护一份本地草稿），多项目支持在 Beta 版引入。
