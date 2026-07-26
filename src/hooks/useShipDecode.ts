"use client";

import { useState, useEffect } from "react";

export interface DecodedShip {
  Parts: {
    ID: string;
    Location: [number, number];
    Rotation: number;
    FlipX?: number;
  }[];
  Doors?: { ID: string }[];
  FlightDirection: number;
  PartUIToggleStates?: Array<{
    Key: [{ ID: string; Location: [number, number] }, string];
    Value: number;
  }>;
  NewFlexResourceGridTypes?: Array<{ Value: string }>;
  [key: string]: unknown;
}

const cache = new Map<string, DecodedShip>();

export function useShipDecode(imageUrl: string) {
  const [decoded, setDecoded] = useState<DecodedShip | null>(() => {
    return cache.get(imageUrl) ?? null;
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (decoded || error) return;

    let active = true;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(imageUrl);
        if (!res.ok) throw new Error("Failed to fetch ship image");
        const blob = await res.blob();

        const mod = (await import("@/lib/cosmoShip")) as Record<string, unknown>;
        const Ship = mod.Ship as {
          fromSource: (f: Blob) => Promise<{ data: unknown }>;
        };
        const ship = await Ship.fromSource(blob);
        const result = ship.data as DecodedShip;

        cache.set(imageUrl, result);
        if (active) setDecoded(result);
      } catch (err) {
        console.error("Decode error:", err);
        if (active) setError("Failed to decode ship data from image.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [imageUrl, decoded, error]);

  return { decoded, loading, error };
}
