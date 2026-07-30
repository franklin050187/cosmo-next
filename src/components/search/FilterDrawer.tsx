"use client";

import { useEffect, useRef } from "react";
import type { Filters } from "@/hooks/useFilters";
import FilterBody from "./FilterBody";

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  setFilter: (key: string, value: string | string[]) => void;
  setFilters: (entries: [string, string | string[]][]) => void;
  clearFilters: () => void;
  activeCount: number;
  resultCount: number;
}

export default function FilterDrawer({
  open,
  onClose,
  filters,
  setFilter,
  setFilters,
  clearFilters,
  activeCount,
  resultCount,
}: FilterDrawerProps) {
  useEffect(() => {
    if (open && window.innerWidth < 1024) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onCloseRef.current();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {open && (
      <div
        className="fixed inset-x-0 bottom-0 z-50 bg-[#021526] border-t border-[#1C598C] rounded-t-2xl lg:hidden max-h-[85vh]"
      >
        <div className="flex flex-col h-full max-h-[85vh]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1C598C]/30 shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-semibold">Filters</h2>
              {activeCount > 0 && (
                <span className="bg-cyan-400/20 text-cyan-300 text-xs px-2 py-0.5 rounded-full">
                  {activeCount}
                </span>
              )}
            </div>
            <button onClick={onClose} aria-label="Close filters" className="min-w-[40px] min-h-[40px] flex items-center justify-center text-gray-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-themed">
            <FilterBody
              filters={filters}
              setFilter={setFilter}
              setFilters={setFilters}
              clearFilters={clearFilters}
              showSort
            />
          </div>

          <div className="px-4 py-3 border-t border-[#1C598C]/30 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-lg text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-500 transition-colors"
            >
              Show {resultCount} result{resultCount !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
      )}
    </>
  );
}
