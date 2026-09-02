import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { PromptTemplate } from "@/models/PromptTemplate";
import { PROMPT_DEFAULTS } from "@/lib/prompt-defaults";
import AiAssistantClient, {
  type PromptRow,
  type ResearchTool,
} from "./AiAssistantClient";
import { guardFeature } from "@/lib/feature-guard";

export const dynamic = "force-dynamic";

const TOOLS: ResearchTool[] = [
  {
    name: "Indian Kanoon",
    description: "Free Indian case law search engine.",
    href: "https://indiankanoon.org",
  },
  {
    name: "SCC Online",
    description: "Premium legal research database.",
    href: "https://www.scconline.com",
  },
  {
    name: "Manupatra",
    description: "Indian and international case law.",
    href: "https://www.manupatra.com",
  },
  {
    name: "ChatGPT",
    description: "General AI for drafting assistance.",
    href: "https://chat.openai.com",
  },
  {
    name: "Claude",
    description: "Long-document analysis and drafting.",
    href: "https://claude.ai",
  },
];

export default async function AIPage() {
  await guardFeature("ai");
  const session = await auth();
  const partnerId = session?.user?.partnerId
    ? new mongoose.Types.ObjectId(session.user.partnerId)
    : null;

  let prompts: PromptRow[] = [];

  if (partnerId) {
    await connectDB();

    // Lazy-seed defaults the first time this partner visits.
    const count = await PromptTemplate.countDocuments({
      partnerId,
      isDeleted: false,
    });
    if (count === 0) {
      await PromptTemplate.insertMany(
        PROMPT_DEFAULTS.map((p, idx) => ({
          partnerId,
          title: p.title,
          body: p.body,
          category: p.category,
          sortOrder: idx,
          isSeeded: true,
        }))
      );
    }

    const docs = await PromptTemplate.find({ partnerId, isDeleted: false })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();

    prompts = docs.map((p) => ({
      id: String(p._id),
      title: p.title,
      body: p.body,
      category: p.category,
      isSeeded: p.isSeeded,
    }));
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1280px]">
        <AiAssistantClient tools={TOOLS} initialPrompts={prompts} />
      </div>
    </div>
  );
}
