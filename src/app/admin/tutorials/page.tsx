import { connectDB } from "@/lib/db";
import { TutorialMedia } from "@/models/TutorialMedia";
import TutorialsManager, { type TutorialRow } from "./TutorialsManager";

export const dynamic = "force-dynamic";

export default async function TutorialsPage() {
  await connectDB();
  const docs = await TutorialMedia.find({ isDeleted: false })
    .sort({ order: 1, createdAt: -1 })
    .lean();

  const tutorials: TutorialRow[] = docs.map((d) => ({
    id: String(d._id),
    title: d.title,
    description: d.description,
    kind: d.kind,
    filename: d.filename,
    contentType: d.contentType,
    size: d.size,
    order: d.order,
    isActive: d.isActive,
    uploadedByName: d.uploadedByName,
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-[1100px]">
      {/* Header */}
      <div className="fade-up-sm">
        <div
          className="text-[11px] font-medium uppercase tracking-[0.18em] text-admin-accent"
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          Learning
        </div>
        <h2 className="mt-2 text-[34px] font-semibold tracking-tight text-admin-fg">
          Tutorials
        </h2>
        <p className="mt-2 max-w-2xl text-[14px] text-admin-fg-muted">
          Upload videos, images and PDFs that appear in the mobile app&rsquo;s
          tutorial library. Toggle <em>Active</em> to control visibility and use{" "}
          <em>Order</em> to arrange them — lowest number shows first.
        </p>
      </div>

      <div className="mt-10">
        <TutorialsManager tutorials={tutorials} />
      </div>
    </div>
  );
}
