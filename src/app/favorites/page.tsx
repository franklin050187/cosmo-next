"use client";

import { useState, useEffect } from "react";
import ShipGrid from "@/components/ship/ShipGrid";
import RequireAuth from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { type ShipRow } from "@/lib/db";

function FavoritesContent() {
  const { token } = useAuth();
  const [ships, setShips] = useState<ShipRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!token) return;

      try {
        const res = await fetch("/api/ship/favorites", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setShips(data.data ?? []);
        }
      } catch (err) {
        console.error("Failed to fetch favorites:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, [token]);

  return (
    <>
      <h1 className="text-4xl text-white text-center uppercase mb-8">
        My Favorites
      </h1>

      {loading ? (
        <p className="text-center text-blue-200">Loading...</p>
      ) : (
        <>
          <p className="text-center text-blue-200 mb-4">
            {ships.length > 0
              ? `You have ${ships.length} favorite ship${ships.length !== 1 ? "s" : ""}`
              : "Start adding ships to your collection now!"}
          </p>
          <ShipGrid ships={ships} />
        </>
      )}
    </>
  );
}

export default function FavoritesPage() {
  return (
    <RequireAuth>
      <FavoritesContent />
    </RequireAuth>
  );
}
