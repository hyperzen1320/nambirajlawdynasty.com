"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DocumentId } from "@/cms/documents";
import { restoreRevision } from "../../../actions";
import { linkButton } from "../../styles";

export default function RestoreButton({
  docId,
  revisionId,
  version,
}: {
  docId: DocumentId;
  revisionId: number;
  version: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const onClick = () => {
    if (!window.confirm(`Make version ${version} live again? The current version will be kept in history.`)) return;
    setError("");
    startTransition(async () => {
      const result = await restoreRevision(docId, revisionId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/admin/${docId}`);
      router.refresh();
    });
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button type="button" onClick={onClick} disabled={pending} className={`${linkButton} cursor-pointer disabled:opacity-50`}>
        {pending ? "Restoring…" : "Restore"}
      </button>
      {error ? (
        <span className="text-[12px]" style={{ color: "var(--color-admin-danger)" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
