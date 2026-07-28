"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

interface Collection {
  id: number;
  title: string;
  ship_count: number | null;
}

interface Props {
  shipId: number;
  children: React.ReactNode;
  className?: string;
}

export default function CollectionPicker({ shipId, children, className }: Props) {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    setLoading(true);
    let active = true;

    (async () => {
      try {
        const res = await fetch("/api/collections/mine", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (active) setCollections(Array.isArray(data) ? data : []);
      } catch {
        if (active) setCollections([]);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [open]);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });

    function handleClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const addToCollection = async (collectionId: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setAdding(collectionId);
    try {
      const res = await fetch(`/api/collections/${collectionId}/ships`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shipId }),
      });
      const data = await res.json();
      setMsg(data.warning ?? data.error ?? "Added!");
      setOpen(false);
      setTimeout(() => setMsg(null), 2000);
    } catch {
      setMsg("Failed to add");
      setOpen(false);
      setTimeout(() => setMsg(null), 2000);
    } finally {
      setAdding(null);
    }
  };

  return (
    <>
      <div ref={triggerRef} className={["relative inline-block", className].filter(Boolean).join(" ")}>
        <span onClick={() => setOpen(!open)} className="cursor-pointer">
          {children}
        </span>
      </div>

      {typeof document !== "undefined" && createPortal(
        <>
          {msg && (
            <div
              className="fixed px-3 py-1 bg-[#021526] border border-[#1C598C] rounded text-sm text-white z-[9999] whitespace-nowrap"
              style={{ top: pos.top, left: pos.left }}
            >
              {msg}
            </div>
          )}

          {open && (
            <div
              ref={panelRef}
              className="fixed w-56 bg-[#021526] border border-[#1C598C] rounded-md shadow-lg z-[9999] max-h-60 overflow-y-auto"
              style={{ top: pos.top, left: pos.left }}
            >
              {loading ? (
                <p className="p-3 text-blue-200 text-sm">Loading...</p>
              ) : collections.length === 0 ? (
                <p className="p-3 text-blue-200 text-sm">
                  No collections yet.{" "}
                  <Link href="/collections/new" className="text-cyan-400 hover:underline">
                    Create one
                  </Link>
                </p>
              ) : (
                collections.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => addToCollection(col.id)}
                    disabled={adding === col.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#1C598C]/30 transition-colors disabled:opacity-40 disabled:cursor-default border-b border-[#1C598C]/20 last:border-0"
                  >
                    <span className="text-white">{col.title}</span>
                    {adding === col.id && (
                      <span className="ml-2 text-cyan-400 text-xs">...</span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </>,
        document.body
      )}
    </>
  );
}
