"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { PipelineStageManager } from "@/components/admin/PipelineStageManager";
import type { PipelineStage } from "@/lib/admin/queries";

export function StageManagerToggle({ stages }: { stages: PipelineStage[] }) {
  const t = useTranslations("deals");
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border-2 border-forest/20 px-5 py-2 text-sm font-semibold text-forest transition-colors hover:bg-mint/40"
      >
        {open ? t("doneManagingStages") : t("manageStages")}
      </button>
      {open ? (
        <div className="mt-4">
          <PipelineStageManager initial={stages} />
        </div>
      ) : null}
    </div>
  );
}
