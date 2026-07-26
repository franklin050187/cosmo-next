"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ShipGrid from "@/components/ship/ShipGrid";
import { type ShipRow } from "@/lib/types";

interface Collection {
  id: number;
  owner: string;
  title: string;
  description: string;
  ships: ShipRow[];
  created_at: string;
}

export default function CollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);

  useEffect(() => {
    const fetchCollection = async () => {
      try {
        const res = await fetch(`/api/collections/${params.id}`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        setCollection(data);

        const token = localStorage.getItem("token");
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            if (payload.user?.username === data.owner) {
              setIsOwner(true);
            }
          } catch {}
        }
      } catch {
        setCollection(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCollection();
  }, [params.id]);

  const handleRemove = async (shipId: number) => {
    const token = localStorage.getItem("token");
    if (!token || !collection) return;

    setRemoving(shipId);
    try {
      await fetch(`/api/collections/${collection.id}/ships/${shipId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setCollection({
        ...collection,
        ships: collection.ships.filter((s) => s.id !== shipId),
      });
    } catch {
    } finally {
      setRemoving(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this collection?")) return;
    const token = localStorage.getItem("token");
    if (!token || !collection) return;

    try {
      await fetch(`/api/collections/${collection.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      router.push("/my-collections");
    } catch {}
  };

  if (loading) return <p className="text-center text-blue-200">Loading...</p>;
  if (!collection) return <p className="text-center text-red-400">Collection not found</p>;

  return (
    <div>
      <Link
        href="/collections"
        className="inline-flex items-center gap-1.5 text-sm text-blue-300 hover:text-cyan-300 transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All Collections
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-4xl text-white uppercase">{collection.title}</h1>
          <p className="text-blue-200 text-sm mt-1">
            by {collection.owner} · {collection.ships.length} ship{collection.ships.length !== 1 ? "s" : ""}
          </p>
        </div>

        {isOwner && (
          <div className="flex gap-2">
            <Link
              href={`/collections/${collection.id}/edit`}
              className="px-4 py-2 border border-[#1C598C] rounded bg-gradient-to-b from-[#1e3851]/25 to-[#124c80]/25 text-cyan-400 hover:bg-cyan-400/20 hover:text-white transition-colors"
            >
              Edit
            </Link>
            <button
              onClick={handleDelete}
              className="px-4 py-2 border border-[#1C598C] rounded bg-gradient-to-b from-[#8b0000]/25 to-[#5c0000]/25 text-red-400 hover:bg-red-400/20 hover:text-white transition-colors"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {collection.description && (
        <div className="text-white mb-6" dangerouslySetInnerHTML={{ __html: collection.description }} />
      )}

      {collection.ships.length > 0 ? (
        <div className="space-y-4">
          <ShipGrid ships={collection.ships} />

          {isOwner && (
            <div className="border border-[#1C598C] rounded-md bg-[#021526]/65 backdrop-blur p-4">
              <p className="text-blue-200 text-sm mb-2">Remove ships:</p>
              <div className="flex flex-wrap gap-2">
                {collection.ships.map((ship) => (
                  <button
                    key={ship.id}
                    onClick={() => handleRemove(ship.id)}
                    disabled={removing === ship.id}
                    className="px-2 py-1 text-xs border border-red-800 rounded text-red-400 hover:bg-red-400/20 transition-colors disabled:opacity-50"
                  >
                    × {ship.ship_name?.replace(".ship.png", "") ?? `Ship ${ship.id}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-center text-blue-200 py-8">
          This collection is empty.{" "}
          {isOwner && (
            <Link href="/" className="text-cyan-400 hover:underline">
              Browse ships to add
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
