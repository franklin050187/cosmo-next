"use client";

import { useShipDecode } from "@/hooks/useShipDecode";

interface Props {
  imageUrl: string;
}

export default function ShipJson({ imageUrl }: Props) {
  const { decoded, loading, error } = useShipDecode(imageUrl);

  if (loading) {
    return (
      <div className="flex items-center gap-3 mt-2">
        <div className="h-4 w-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-blue-200 text-sm">Decoding ship blueprint...</p>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-400 mt-2">{error}</p>;
  }

  if (!decoded) return null;

  return (
    <pre className="mt-2 p-2 bg-black/50 rounded text-xs text-green-400 overflow-auto max-h-96 border border-[#1C598C]">
      {JSON.stringify(decoded, null, 2)}
    </pre>
  );
}
