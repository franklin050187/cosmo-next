"use client";

import { useState, useRef } from "react";
import RichTextEditor from "@/components/ui/RichTextEditor";

interface PriceResult {
  price: number;
  crew: number;
  author: string;
  tags: string[];
}

export default function UploadPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [priceResult, setPriceResult] = useState<PriceResult | null>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decoding, setDecoding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setError(null);
    setPriceResult(null);
    setUploadResult(null);
    setDecoding(true);

    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(selected);

    try {
      const mod = (await import("@/lib/cosmoShip")) as Record<string, unknown>;
      const Ship = mod.Ship as {
        fromSource: (
          f: File
        ) => Promise<{ data: unknown }>;
      };
      const ship = await Ship.fromSource(selected);
      const decodedData = ship.data;

      const { calculateShipPrice } = await import("@/lib/price");
      const data = decodedData as Parameters<typeof calculateShipPrice>[0];
      const result = calculateShipPrice(data);
      setPriceResult(result);
    } catch (err) {
      console.error("Decode error:", err);
      setError(
        "Failed to decode ship data from image. Make sure it's a valid Cosmoteer blueprint PNG."
      );
    } finally {
      setDecoding(false);
    }
  };

  const handleUpload = async () => {
    if (!file || !priceResult) return;

    setUploading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      const { uploadFiles } = await import("@/lib/upload-png");
      const [url] = await uploadFiles({
        files: [file],
        token: token ?? undefined,
        description,
        brand: "gen",
      });
      setUploadResult(url.ufsUrl);
    } catch (err) {
      console.error("Upload error:", err);
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setPriceResult(null);
    setDescription("");
    setUploadResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="border border-[#1C598C] rounded-md bg-[#021526]/65 backdrop-blur p-4">
      {!uploadResult && (
        <>
          <h2 className="text-white text-xl mb-4">Select a ship file</h2>

          <div className="mb-4">
            <label
              className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-[#1C598C] rounded-md bg-[#021526]/80 cursor-pointer hover:border-cyan-400/50 hover:bg-[#021526] transition-colors"
            >
              <span className="text-blue-200 text-lg mb-2">
                {file ? file.name : "Click to select a ship PNG"}
              </span>
              <span className="text-gray-500 text-sm">
                Max 8MB, .png only
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".png"
                onChange={handleFileChange}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>

          {preview && (
            <div className="mb-4">
              <img
                src={preview}
                alt="Preview"
                className="max-w-full h-auto"
              />
            </div>
          )}

          {decoding && (
            <p className="text-blue-200 mb-4">Decoding ship data...</p>
          )}

          {priceResult && (
            <div className="mb-4 space-y-2 p-3 border border-[#1C598C] rounded">
              <p className="text-white">
                <span className="text-blue-200">Author:</span>{" "}
                {priceResult.author}
              </p>
              <p className="text-[#0AD448]">
                <span className="text-blue-200">Price:</span>{" "}
                {priceResult.price}₡
              </p>
              <p className="text-white">
                <span className="text-blue-200">Crew:</span>{" "}
                {priceResult.crew}
              </p>
              <p className="text-white">
                <span className="text-blue-200">Tags:</span>{" "}
                {priceResult.tags.length > 0
                  ? priceResult.tags.join(", ")
                  : "None"}
              </p>
            </div>
          )}

          {priceResult && (
            <div className="mb-4">
              <label className="block text-blue-200 mb-1">Description</label>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Describe your ship design..."
                rows={4}
              />
            </div>
          )}

          {error && <p className="text-red-400 mb-4">{error}</p>}

          {priceResult && (
            <div className="flex gap-2">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-4 py-2 border border-[#1C598C] rounded bg-gradient-to-b from-[#1e3851]/25 to-[#124c80]/25 text-cyan-400 hover:bg-cyan-400/20 hover:text-white transition-colors disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload to Library"}
              </button>
              <button
                onClick={handleReset}
                disabled={uploading}
                className="px-4 py-2 border border-[#1C598C] rounded bg-gradient-to-b from-[#1e3851]/25 to-[#124c80]/25 text-cyan-400 hover:bg-cyan-400/20 hover:text-white transition-colors disabled:opacity-50"
              >
                Reset
              </button>
            </div>
          )}
        </>
      )}

      {uploadResult && (
        <div className="text-center">
          <p className="text-[#0AD448] text-xl mb-4">
            Ship uploaded successfully!
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-[#1C598C] rounded bg-gradient-to-b from-[#1e3851]/25 to-[#124c80]/25 text-cyan-400 hover:bg-cyan-400/20 hover:text-white transition-colors"
            >
              Upload Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
