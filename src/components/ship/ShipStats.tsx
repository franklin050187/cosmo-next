"use client";

import { useState, useEffect } from "react";
import { useShipDecode } from "@/hooks/useShipDecode";
import { calculateShipStats } from "@/lib/physics";
import type { ShipStats as ShipStatsType } from "@/lib/physics";
import dynamic from "next/dynamic";

const ShipReconstruction = dynamic(() => import("./ShipReconstruction"), {
  ssr: false,
});
const ShipStatsPanel = dynamic(() => import("./ShipStatsPanel"), { ssr: false });

interface Props {
  imageUrl: string;
}

interface CachedStats {
  stats: ShipStatsType;
  parts: {
    ID: string;
    Location: [number, number];
    Rotation: number;
    FlipX?: number;
  }[];
}

const statsCache = new Map<string, CachedStats>();

export default function ShipStats({ imageUrl }: Props) {
  const { decoded, loading, error: decodeError } = useShipDecode(imageUrl);

  const [cached, setCached] = useState<CachedStats | null>(() => {
    return statsCache.get(imageUrl) ?? null;
  });

  useEffect(() => {
    if (!decoded || cached) return;

    let active = true;

    (async () => {
      try {
        const stats = calculateShipStats(decoded);
        const result: CachedStats = { stats, parts: decoded.Parts };
        statsCache.set(imageUrl, result);
        if (active) setCached(result);
      } catch (err) {
        console.error("Stats error:", err);
      }
    })();

    return () => {
      active = false;
    };
  }, [decoded, cached, imageUrl]);

  if (loading) {
    return (
      <div className="mt-6 border border-[#1C598C] rounded-md bg-[#021526]/65 backdrop-blur p-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-blue-200">Analyzing ship...</p>
        </div>
      </div>
    );
  }

  if (decodeError) {
    return (
      <div className="mt-6 border border-[#1C598C] rounded-md bg-[#021526]/65 backdrop-blur p-4">
        <p className="text-red-400">{decodeError}</p>
      </div>
    );
  }

  if (!cached) return null;

  return (
    <div className="mt-6 border border-[#1C598C] rounded-md bg-[#021526]/65 backdrop-blur p-4">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-shrink-0 w-full max-w-[512px] flex items-start justify-center">
          <ShipReconstruction stats={cached.stats} parts={cached.parts} />
        </div>
        <div className="flex-1 min-w-0">
          <ShipStatsPanel stats={cached.stats} />
        </div>
      </div>
    </div>
  );
}
