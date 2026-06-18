"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PowerBiLinksSlider({ links, mobile = false, emptyText }) {
  const [index, setIndex] = useState(0);
  const total = links.length;
  const current = links[index] || null;

  if (!total) return <EmptyState text={emptyText} />;

  const previous = () => setIndex((value) => (value - 1 + total) % total);
  const next = () => setIndex((value) => (value + 1) % total);

  return (
    <section className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-950 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-3 py-2 text-white">
        <Button size="icon" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={previous} disabled={total <= 1}>
          <ChevronLeft className="size-5" />
        </Button>
        <div className="min-w-0 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-violet-200">Link {index + 1} de {total}</p>
        </div>
        <Button size="icon" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={next} disabled={total <= 1}>
          <ChevronRight className="size-5" />
        </Button>
      </div>
      <iframe
        key={current.id}
        title={`Power BI ${current.id}`}
        src={current.link}
        className={mobile ? "h-[78vh] w-full border-0" : "h-[calc(100vh-190px)] min-h-[640px] w-full border-0"}
        allowFullScreen
      />
      {total > 1 ? (
        <>
          <Button size="icon" variant="ghost" className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-slate-950/70 text-white shadow-lg hover:bg-slate-900 hover:text-white md:inline-flex" onClick={previous}>
            <ChevronLeft className="size-6" />
          </Button>
          <Button size="icon" variant="ghost" className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-slate-950/70 text-white shadow-lg hover:bg-slate-900 hover:text-white md:inline-flex" onClick={next}>
            <ChevronRight className="size-6" />
          </Button>
        </>
      ) : null}
    </section>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/60 p-8 text-center text-sm font-medium text-slate-400">
      {text}
    </div>
  );
}
