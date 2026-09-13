"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NEWS_POST_FIELDS, type NewsPostData } from "@/cms/news-fields";
import type { SupabaseConfig } from "@/lib/supabase/config";
import { deleteNewsPost, saveNewsPost } from "../../actions";
import FormEditor from "../FormEditor";
import { linkButton } from "../styles";

export default function NewsEditor({
  id,
  initialData,
  version,
  updatedAt,
  updatedBy,
  supabase,
}: {
  id: string | null;
  initialData: NewsPostData;
  version: number | null;
  updatedAt: string | null;
  updatedBy: string | null;
  supabase: SupabaseConfig | null;
}) {
  const router = useRouter();
  // A new post gets its id on first save; later saves update that row.
  const [postId, setPostId] = useState(id);
  const [slug, setSlug] = useState(initialData.published ? initialData.slug : "");
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState("");

  const onDelete = () => {
    if (!postId) return;
    if (!window.confirm("Delete this post permanently? This can't be undone.")) return;
    setDeleteError("");
    startDelete(async () => {
      const result = await deleteNewsPost(postId);
      if (!result.ok) {
        setDeleteError(result.error);
        return;
      }
      router.push("/admin/news");
      router.refresh();
    });
  };

  return (
    <FormEditor
      fields={NEWS_POST_FIELDS}
      initialData={initialData}
      version={version}
      heading={postId ? "Edit post" : "New post"}
      description="Write the article, then switch on “Published” when it's ready for visitors."
      updatedAt={updatedAt}
      updatedBy={updatedBy}
      supabase={supabase}
      uploadFolder="news"
      save={(data, baseVersion) => saveNewsPost(postId, data, baseVersion)}
      onSaved={(result) => {
        const saved = result.data as NewsPostData;
        setSlug(saved.published ? saved.slug : "");
        if (!postId && result.id) {
          setPostId(result.id);
          // Give the post its permanent address without reloading the form.
          window.history.replaceState(null, "", `/admin/news/${result.id}`);
        }
      }}
      links={
        <>
          <Link href="/admin/news" className={linkButton}>
            <span aria-hidden>←</span> All posts
          </Link>
          {slug ? (
            <a href={`/news/${slug}`} target="_blank" rel="noopener noreferrer" className={linkButton}>
              View post <span aria-hidden>↗</span>
            </a>
          ) : null}
        </>
      }
      dangerZone={
        postId ? (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-4"
            style={{ borderColor: "var(--color-admin-danger-soft)" }}
          >
            <div>
              <div className="text-[14px] font-medium">Delete post</div>
              <div className="text-[12.5px]" style={{ color: "var(--color-admin-fg-soft)" }}>
                To hide it without deleting, switch off “Published” and save.
              </div>
              {deleteError ? (
                <div className="mt-1 text-[12.5px]" style={{ color: "var(--color-admin-danger)" }}>
                  {deleteError}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="cursor-pointer rounded-lg px-4 py-2 text-[13.5px] font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--color-admin-danger)" }}
            >
              {deleting ? "Deleting…" : "Delete post"}
            </button>
          </div>
        ) : null
      }
    />
  );
}
