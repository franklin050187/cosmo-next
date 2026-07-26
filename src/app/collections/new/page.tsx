"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import RichTextEditor from "@/components/ui/RichTextEditor";

function NewCollectionContent() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (data.id) {
        router.push(`/collections/${data.id}`);
      } else {
        setError(data.error ?? "Failed to create");
      }
    } catch {
      setError("Failed to create collection");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-4xl text-white text-center uppercase mb-8">
        New Collection
      </h1>

      <div className="border border-[#1C598C] rounded-md bg-[#021526]/65 backdrop-blur p-4 space-y-4">
        <div>
          <label className="block text-blue-200 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My favorite ships"
            className="w-full p-2 bg-[#021526] border border-gray-400 rounded text-white"
          />
        </div>

        <div>
          <label className="block text-blue-200 mb-1">Description</label>
          <RichTextEditor
            value={description}
            onChange={setDescription}
            placeholder="Optional description..."
            rows={4}
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={saving || !title.trim()}
          className="px-4 py-2 border border-[#1C598C] rounded bg-gradient-to-b from-[#1e3851]/25 to-[#124c80]/25 text-cyan-400 hover:bg-cyan-400/20 hover:text-white transition-colors disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create Collection"}
        </button>
      </div>
    </div>
  );
}

export default function NewCollectionPage() {
  return (
    <RequireAuth>
      <NewCollectionContent />
    </RequireAuth>
  );
}
