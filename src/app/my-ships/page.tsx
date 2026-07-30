"use client";

import { useState, useEffect } from "react";
import ShipGrid from "@/components/ship/ShipGrid";
import RequireAuth from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { type ShipRow } from "@/lib/db";

function MyShipsContent() {
  const { token } = useAuth();
  const [ships, setShips] = useState<ShipRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyShips = async () => {
      if (!token) return;

      try {
        const res = await fetch("/api/ship/my-ships", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setShips(data.data ?? []);
        }
      } catch (err) {
        console.error("Failed to fetch my ships:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMyShips();
  }, [token]);

  return (
    <>
      <h1 className="text-4xl text-white text-center uppercase mb-8">
        My Ships
      </h1>

      {loading ? (
        <p className="text-center text-blue-200">Loading...</p>
      ) : (
        <>
          <p className="text-center text-blue-200 mb-4">
            {ships.length > 0
              ? `You have uploaded ${ships.length} ship${ships.length !== 1 ? "s" : ""}`
              : "Start sharing your designs now!"}
          </p>
          <ShipGrid ships={ships} />
        </>
      )}
    </>
  );
}

export default function MyShipsPage() {
  return (
    <RequireAuth>
      <MyShipsContent />
    </RequireAuth>
  );
}
