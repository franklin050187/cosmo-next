"use client";

export async function downloadShip(shipId: number, shipName: string) {
  await fetch(`/api/ship/${shipId}/download`, { method: "POST" }).catch(() => {});

  try {
    const res = await fetch(`/api/ship/${shipId}`);
    if (!res.ok) throw new Error("Failed to fetch ship");
    const ship = await res.json();
    const imgRes = await fetch(ship.data);
    const blob = await imgRes.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = shipName || `ship-${shipId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Download failed (fallback unavailable):", err);
  }
}
