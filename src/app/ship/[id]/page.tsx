"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useShipDecode } from "@/hooks/useShipDecode";
import PreconnectForImage from "@/components/ui/PreconnectForImage";

const ShipStats = dynamic(() => import("@/components/ship/ShipStats"), {
  ssr: false,
});
const ShipJson = dynamic(() => import("@/components/ship/ShipJson"), {
  ssr: false,
});
const ShipPriceAnalysis = dynamic(
  () => import("@/components/ship/ShipPriceAnalysis"),
  { ssr: false }
);
import AddToCollectionButton from "@/components/collection/AddToCollectionButton";
import { isTokenExpired } from "@/lib/auth";
import { sanitizeHtml } from "@/lib/sanitize";

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
  downloads: number;
  fav: number;
  date: string;
}

export default function ShipDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [ship, setShip] = useState<Ship | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [showPriceAnalysis, setShowPriceAnalysis] = useState(false);
  const [collections, setCollections] = useState<{ id: number; title: string; owner: string }[]>([]);
  const [backUrl] = useState(() => {
    if (typeof window === "undefined") return "/";
    return sessionStorage.getItem("shipBackUrl") || "/";
  });

  useEffect(() => {
    let active = true;

    const fetchShip = async () => {
      try {
        const res = await fetch(`/api/ship/${params.id}`);
        if (!res.ok) throw new Error("Ship not found");
        const data = await res.json();
        if (!active) return;
        setShip(data);
        document.title = `${data.ship_name?.replace(".ship.png", "")} - CosmoShip`;

        fetch(`/api/collections?shipId=${params.id}`)
          .then((r) => r.json())
          .then((d) => { if (active) setCollections(d.data ?? []); })
          .catch(() => {});

        const token = localStorage.getItem("token");
        if (token && !isTokenExpired(token)) {
          setIsLoggedIn(true);
          try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            if (payload.user?.username === data.submitted_by) {
              setIsOwner(true);
            }
          } catch {}
        } else if (token) {
          localStorage.removeItem("token");
        }
      } catch {
        if (active) setError("Ship not found");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchShip();
    return () => { active = false; };
  }, [params.id]);

  const handleFavorite = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      await fetch(`/api/ship/${params.id}/favorite`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setIsFavorited(true);
    } catch (err) {
      console.error("Failed to add favorite:", err);
    }
  };

  const handleUnfavorite = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      await fetch(`/api/ship/${params.id}/unfavorite`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setIsFavorited(false);
    } catch (err) {
      console.error("Failed to remove favorite:", err);
    }
  };

  const handleDownload = async () => {
    if (!ship) return;

    await fetch(`/api/ship/${params.id}/download`, { method: "POST" });

    try {
      const res = await fetch(ship.data);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = ship.ship_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      const link = document.createElement("a");
      link.href = ship.data;
      link.download = ship.ship_name;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this ship?")) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      await fetch(`/api/ship/${params.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      router.push("/");
    } catch (err) {
      console.error("Failed to delete ship:", err);
    }
  };

  if (loading) return <p className="text-center text-blue-200">Loading...</p>;
  if (error || !ship) return <p className="text-center text-red-400">{error}</p>;

  return (
    <div>
      <PreconnectForImage src={ship.data} />

      <Link href={backUrl} className="inline-flex items-center gap-1.5 text-sm text-blue-300 hover:text-cyan-300 transition-colors mb-6">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to results
      </Link>

      <h1 className="text-4xl text-white text-center uppercase mb-8">
        {ship.ship_name.replace(".ship.png", "")}
      </h1>

      <div className="border border-[#1C598C] rounded-md bg-[#021526]/65 backdrop-blur p-4">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-shrink-0">
            <img
              src={ship.data}
              alt={ship.ship_name}
              width={512}
              height={512}
              fetchPriority="high"
              className="max-w-[512px] w-full h-auto"
            />
          </div>

          <div className="flex-1">
            <p className="text-white mb-2">
              <span className="text-blue-200">Author:</span>{" "}
              <Link
                href={`/?author=${encodeURIComponent(ship.author)}`}
                className="text-cyan-400 hover:underline"
              >
                {ship.author}
              </Link>
            </p>
            <p className="text-white mb-2">
              <span className="text-blue-200">Description:</span>{" "}
              <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(ship.description) }} />
            </p>
            <p className="text-[#0AD448] mb-2">
              <span className="text-blue-200">Cost:</span> {ship.price}₡
            </p>
            <p className="text-white mb-2">
              <span className="text-blue-200">Crew:</span> {ship.crew}
            </p>
            <p className="text-white mb-2">
              <span className="text-blue-200">Popularity:</span> {ship.downloads}
            </p>
            <p className="text-white mb-2">
              <span className="text-blue-200">Submitted by:</span> {ship.submitted_by}
            </p>

            {ship.brand === "exl" && (
              <p className="text-yellow-400 mb-2">
                WARNING: This ship is from the Excelsior library, it requires piloting skills.
              </p>
            )}

            {ship.tags.length > 0 && (
              <div className="mb-3">
                <span className="text-blue-200">Tags:</span>{" "}
                <div className="flex flex-wrap gap-1 mt-1">
                  {ship.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/?tag=${encodeURIComponent(tag)}`}
                      className="inline-block bg-[#00305e] text-white px-2 py-1 rounded hover:bg-[#00408e] transition-colors"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {collections.length > 0 && (
              <p className="text-white mb-3">
                <span className="text-blue-200">Collections:</span>{" "}
                {collections.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && ", "}
                    <Link
                      href={`/collections/${c.id}`}
                      className="text-cyan-400 hover:underline"
                    >
                      {c.title}
                    </Link>
                  </span>
                ))}
              </p>
            )}

            <div className="flex gap-2 flex-wrap mb-3">
              {isLoggedIn ? (
                isFavorited ? (
                  <button
                    onClick={handleUnfavorite}
                    className="px-4 py-2 border border-[#1C598C] rounded bg-gradient-to-b from-[#1e3851]/25 to-[#124c80]/25 text-cyan-400 hover:bg-cyan-400/20 hover:text-white transition-colors"
                  >
                    ★ Unfavorite
                  </button>
                ) : (
                  <button
                    onClick={handleFavorite}
                    className="px-4 py-2 border border-[#1C598C] rounded bg-gradient-to-b from-[#1e3851]/25 to-[#124c80]/25 text-cyan-400 hover:bg-cyan-400/20 hover:text-white transition-colors"
                  >
                    ☆ Favorite
                  </button>
                )
              ) : (
                <Link
                  href={`/auth/discord?returnTo=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : "/")}`}
                  className="px-4 py-2 border border-[#1C598C] rounded bg-gradient-to-b from-[#5865F2]/25 to-[#4752C4]/25 text-[#5865F2] hover:bg-[#5865F2]/20 hover:text-white transition-colors"
                >
                  Login to favorite
                </Link>
              )}

              <button
                onClick={handleDownload}
                className="px-4 py-2 border border-[#1C598C] rounded bg-gradient-to-b from-[#1e3851]/25 to-[#124c80]/25 text-cyan-400 hover:bg-cyan-400/20 hover:text-white transition-colors"
              >
                ↓ Download
              </button>

              {isLoggedIn && <AddToCollectionButton shipId={ship.id} />}
            </div>

            {isOwner && (
              <div className="flex gap-2 flex-wrap mb-3">
                <Link
                  href={`/ship/${params.id}/edit`}
                  className="px-4 py-2 border border-[#1C598C] rounded bg-gradient-to-b from-[#1e3851]/25 to-[#124c80]/25 text-cyan-400 hover:bg-cyan-400/20 hover:text-white transition-colors"
                >
                  Edit
                </Link>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 border border-[#8b0000] rounded bg-gradient-to-b from-[#8b0000]/25 to-[#5c0000]/25 text-red-400 hover:bg-red-400/20 hover:text-white transition-colors"
                >
                  Delete
                </button>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => { setShowStats(!showStats); if (!showStats) { setShowJson(false); setShowPriceAnalysis(false); } }}
                className={`px-4 py-2 border rounded transition-colors ${showStats ? "border-cyan-400 bg-cyan-400/20 text-white" : "border-[#1C598C] bg-gradient-to-b from-[#1e3851]/25 to-[#124c80]/25 text-cyan-400 hover:bg-cyan-400/20 hover:text-white"}`}
              >
                Stats
              </button>
              <button
                onClick={() => { setShowPriceAnalysis(!showPriceAnalysis); if (!showPriceAnalysis) { setShowStats(false); setShowJson(false); } }}
                className={`px-4 py-2 border rounded transition-colors ${showPriceAnalysis ? "border-cyan-400 bg-cyan-400/20 text-white" : "border-[#1C598C] bg-gradient-to-b from-[#1e3851]/25 to-[#124c80]/25 text-cyan-400 hover:bg-cyan-400/20 hover:text-white"}`}
              >
                Price Analysis
              </button>
              <button
                onClick={() => { setShowJson(!showJson); if (!showJson) { setShowStats(false); setShowPriceAnalysis(false); } }}
                className={`px-4 py-2 border rounded transition-colors ${showJson ? "border-cyan-400 bg-cyan-400/20 text-white" : "border-[#1C598C] bg-gradient-to-b from-[#1e3851]/25 to-[#124c80]/25 text-cyan-400 hover:bg-cyan-400/20 hover:text-white"}`}
              >
                JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      {showStats && <ShipStats imageUrl={ship.data} />}
      {showPriceAnalysis && (
        <div className="mt-6 border border-[#1C598C] rounded-md bg-[#021526]/65 backdrop-blur p-4">
          <ShipPriceAnalysisWrapper imageUrl={ship.data} />
        </div>
      )}
      {showJson && <div className="mt-6"><ShipJson imageUrl={ship.data} /></div>}
    </div>
  );
}

function ShipPriceAnalysisWrapper({ imageUrl }: { imageUrl: string }) {
  const { decoded, loading, error } = useShipDecode(imageUrl);

  if (loading) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-blue-200">Analyzing price breakdown...</p>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-400">{error}</p>;
  }

  if (!decoded) return null;

  return <ShipPriceAnalysis decoded={decoded} />;
}
