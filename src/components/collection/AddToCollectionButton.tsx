"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Collection {
  id: number;
  title: string;
  ship_count: number | null;
}

interface Props {
  shipId: number;
}

export default function AddToCollectionButton({ shipId }: Props) {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
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
        if (active) setCollections(data);
      } catch {
        if (active) setCollections([]);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
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
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="px-4 py-2 border border-[#1C598C] rounded bg-gradient-to-b from-[#1e3851]/25 to-[#124c80]/25 text-cyan-400 hover:bg-cyan-400/20 hover:text-white transition-colors"
      >
        Add to Collection
      </button>

      {msg && (
        <div className="absolute top-full left-0 mt-1 px-3 py-1 bg-[#021526] border border-[#1C598C] rounded text-sm text-white z-50 whitespace-nowrap">
          {msg}
        </div>
      )}

      {open && (
        <div
          ref={panelRef}
          className="absolute top-full left-0 mt-1 w-64 bg-[#021526] border border-[#1C598C] rounded-md shadow-lg z-50 max-h-60 overflow-y-auto"
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
    </div>
  );
}
