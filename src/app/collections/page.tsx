"use client";

import { useState, useEffect } from "react";
import CollectionGrid from "@/components/collection/CollectionGrid";

interface CollectionSummary {
  id: number;
  owner: string;
  title: string;
  description: string;
  ship_count: number | null;
  created_at: string;
}

export default function CollectionsBrowsePage() {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCollections = () => {
    fetch("/api/collections?page=1")
      .then((r) => r.json())
      .then((data) => setCollections(data.data ?? []))
      .catch(() => setCollections([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCollections();
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) fetchCollections();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  return (
    <>
      <h1 className="text-4xl text-white text-center uppercase mb-8">
        Collections
      </h1>

      {loading ? (
        <p className="text-center text-blue-200">Loading...</p>
      ) : (
        <CollectionGrid collections={collections} />
      )}
    </>
  );
}
