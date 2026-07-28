"use client";

import CollectionPicker from "./CollectionPicker";

interface Props {
  shipId: number;
}

export default function AddToCollectionButton({ shipId }: Props) {
  return (
    <CollectionPicker
      shipId={shipId}
      className="inline-block"
    >
      <button className="px-4 py-2 border border-[#1C598C] rounded bg-gradient-to-b from-[#1e3851]/25 to-[#124c80]/25 text-cyan-400 hover:bg-cyan-400/20 hover:text-white transition-colors">
        Add to Collection
      </button>
    </CollectionPicker>
  );
}
