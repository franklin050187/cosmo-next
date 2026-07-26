"use client";

import { useState } from "react";

export default function DecodePage() {
  const [decodedData, setDecodedData] = useState<object | null>(null);
  const [priceResult, setPriceResult] = useState<{ price: number; crew: number; author: string; tags: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setPriceResult(null);

    try {
      const mod = await import("@/lib/cosmoShip") as Record<string, unknown>;
      const Ship = mod.Ship as new (...args: unknown[]) => { data: unknown };
      const ship = await (Ship as unknown as { fromSource: (f: File) => Promise<{ data: unknown }> }).fromSource(file);
      setDecodedData(ship.data as object);
    } catch (err) {
      console.error("Decode error:", err);
      setError("Failed to decode ship data from image");
    }
  };

  const handleCalculate = async () => {
    if (!decodedData) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/price", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(decodedData),
      });

      if (!res.ok) throw new Error("Failed to calculate price");
      const data = await res.json();
      setPriceResult(data);
    } catch {
      setError("Failed to calculate price");
    }
  };

  return (
    <div>
      <h1 className="text-4xl text-white text-center uppercase mb-8">
        Decode Ship Blueprint
      </h1>

      <div className="border border-[#1C598C] rounded-md bg-[#021526]/65 backdrop-blur p-4">
        <input
          type="file"
          accept=".png"
          onChange={handleFileChange}
          className="block w-full text-white mb-4"
        />

        {decodedData && (
          <div className="mb-4">
            <details open>
              <summary className="text-blue-200 cursor-pointer">Decoded data</summary>
              <pre className="mt-2 p-2 bg-black/50 rounded text-xs text-green-400 overflow-auto max-h-96">
                {JSON.stringify(decodedData, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {priceResult && (
          <div className="mb-4 p-3 border border-[#1C598C] rounded">
            <p className="text-[#0AD448]">Price: {priceResult.price}₡</p>
            <p className="text-white">Crew: {priceResult.crew}</p>
            <p className="text-white">Author: {priceResult.author}</p>
            <p className="text-white">Tags: {priceResult.tags.join(", ")}</p>
          </div>
        )}

        {error && <p className="text-red-400 mb-4">{error}</p>}

        {decodedData && (
          <button
            onClick={handleCalculate}
            className="px-4 py-2 border border-[#1C598C] rounded bg-gradient-to-b from-[#1e3851]/25 to-[#124c80]/25 text-cyan-400 hover:bg-cyan-400/20 hover:text-white transition-colors"
          >
            Calculate Price
          </button>
        )}
      </div>
    </div>
  );
}
