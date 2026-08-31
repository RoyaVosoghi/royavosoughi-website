"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type { DealWithRelations, PipelineStage } from "@/lib/admin/queries";

function formatAmount(cents: number, currency: string): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency });
}

function DealCard({ deal }: { deal: DealWithRelations }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab rounded-2xl border-2 border-forest/10 bg-offwhite p-3 shadow-sm active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}
    >
      <Link href={`/admin/deals/${deal.id}`} onClick={(e) => isDragging && e.preventDefault()} className="block">
        <p className="text-sm font-semibold text-ink/85">{deal.title}</p>
        <p className="mt-1 text-xs text-ink/50">{deal.contactName}</p>
        <p className="mt-2 text-sm font-bold text-forest">{formatAmount(deal.amountCents, deal.currency)}</p>
        {deal.aiNextAction ? <p className="mt-2 line-clamp-2 text-xs text-emerald">{deal.aiNextAction}</p> : null}
      </Link>
    </div>
  );
}

function StageColumn({ stage, deals, noDealsLabel }: { stage: PipelineStage; deals: DealWithRelations[]; noDealsLabel: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const totalCents = deals.reduce((sum, d) => sum + d.amountCents, 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col gap-3 rounded-3xl border-2 p-4 transition-colors ${
        isOver ? "border-emerald bg-mint/40" : "border-forest/10 bg-mint/10"
      }`}
    >
      <div>
        <p className="font-display text-sm font-bold text-forest">{stage.name}</p>
        <p className="text-xs text-ink/50">
          {deals.length} · {formatAmount(totalCents, deals[0]?.currency ?? "USD")}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {deals.length === 0 ? <p className="text-xs text-ink/40">{noDealsLabel}</p> : null}
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
      </div>
    </div>
  );
}

export function DealsBoard({ stages, deals: initialDeals }: { stages: PipelineStage[]; deals: DealWithRelations[] }) {
  const router = useRouter();
  const t = useTranslations("deals");
  const [deals, setDeals] = useState(initialDeals);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const dealId = String(active.id);
    const newStageId = String(over.id);
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.pipelineStageId === newStageId) return;

    const newStage = stages.find((s) => s.id === newStageId);
    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId
          ? {
              ...d,
              pipelineStageId: newStageId,
              stageName: newStage?.name ?? d.stageName,
              status: newStage?.isWon ? "won" : newStage?.isLost ? "lost" : "open",
            }
          : d,
      ),
    );

    const response = await fetch(`/api/admin/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipelineStageId: newStageId }),
    });
    if (!response.ok) router.refresh();
  }

  const activeDeal = deals.find((d) => d.id === activeId);

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            deals={deals.filter((d) => d.pipelineStageId === stage.id)}
            noDealsLabel={t("noDeals")}
          />
        ))}
      </div>
      <DragOverlay>{activeDeal ? <DealCard deal={activeDeal} /> : null}</DragOverlay>
    </DndContext>
  );
}
