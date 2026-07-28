"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import RichTextEditor from "@/components/ui/RichTextEditor";
import AddToCollectionButton from "@/components/collection/AddToCollectionButton";
import UserTagEditor from "@/components/tags/UserTagEditor";
import { extractUserTags } from "@/lib/user-tag-data";

interface Ship {
  id: number;
  ship_name: string;
  data: string;
  author: string;
  description: string;
  price: number;
  crew: number;
  tags: string[];
  submitted_by: string;
  brand: string;
}

export default function EditShipPage() {
  const params = useParams();
  const router = useRouter();
  const [ship, setShip] = useState<Ship | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notOwner, setNotOwner] = useState(false);

  const [shipName, setShipName] = useState("");
  const [description, setDescription] = useState("");
  const [userTags, setUserTags] = useState<string[]>([]);
  const [autoTags, setAutoTags] = useState<string[]>([]);
  const [brand, setBrand] = useState("gen");

  useEffect(() => {
    const fetchShip = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/");
        return;
      }

      try {
        const res = await fetch(`/api/ship/${params.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Ship not found");
        const data = await res.json();

        let username: string | null = null;
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          username = payload.user?.username ?? null;
        } catch {}

        if (!username || data.submitted_by !== username) {
          setNotOwner(true);
          return;
        }

        setShip(data);
        setShipName(data.ship_name);
        setDescription(data.description);
        setBrand(data.brand === "exl" ? "exl" : "gen");
        const { userTags: ut, autoTags: at } = extractUserTags(data.tags ?? []);
        setUserTags(ut);
        setAutoTags(at);
      } catch (err) {
        console.error("Failed to fetch ship:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchShip();
  }, [params.id, router]);

  const handleSave = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setSaving(true);
    try {
      await fetch(`/api/ship/${params.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ship_name: shipName,
          description,
          tags: [...autoTags, ...userTags],
          brand,
        }),
      });
      router.push(`/ship/${params.id}`);
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-center text-blue-200">Loading...</p>;
  if (notOwner) {
    router.push(`/ship/${params.id}`);
    return null;
  }
  if (!ship) return <p className="text-center text-red-400">Ship not found</p>;

  return (
    <div>
      <h1 className="text-4xl text-white text-center uppercase mb-8">
        Edit Ship
      </h1>

      <div className="border border-[#1C598C] rounded-md bg-[#021526]/65 backdrop-blur p-4">
        <div className="md:grid md:grid-cols-2 md:gap-6">
          {/* Left: preview + metadata */}
          <div className="space-y-4">
            <div>
              <img src={ship.data} alt={ship.ship_name} className="max-w-full h-auto max-sm:max-h-48 max-sm:object-contain" />
            </div>

            <div>
              <label className="block text-blue-200 mb-1">Author</label>
              <p className="text-white">{ship.author}</p>
            </div>

            <div>
              <label className="block text-blue-200 mb-1">Price</label>
              <p className="text-[#0AD448]">{ship.price}₡</p>
            </div>
          </div>

          {/* Right: editable fields */}
          <div className="md:sticky md:top-24 space-y-4">
            <div>
              <label className="block text-blue-200 mb-1">Ship Name</label>
              <input
                type="text"
                value={shipName}
                onChange={(e) => setShipName(e.target.value)}
                className="w-full p-2 bg-[#021526] border border-gray-400 rounded text-white"
              />
            </div>

            <div>
              <label className="block text-blue-200 mb-1">Tags</label>
              {autoTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {autoTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-block bg-[#00305e] text-white/70 text-xs px-2 py-1 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <UserTagEditor value={userTags} onChange={setUserTags} brand={brand} onBrandChange={setBrand} />
            </div>

            <div>
              <label className="block text-blue-200 mb-1">Description</label>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                rows={6}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 border border-[#1C598C] rounded bg-gradient-to-b from-[#1e3851]/25 to-[#124c80]/25 text-cyan-400 hover:bg-cyan-400/20 hover:text-white transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <AddToCollectionButton shipId={ship.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
