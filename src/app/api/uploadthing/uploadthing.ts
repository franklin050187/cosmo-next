import { createUploadthing } from "uploadthing/next";
import { decodeShipFromUrl, decodeShipFromPixels } from "@/lib/server-decode";
import { calculateShipPrice } from "@/lib/price";
import { insertShip } from "@/lib/db";
import { verifyToken, type TokenPayload } from "@/lib/auth";
import { computeShipSignature } from "@/lib/ship-signature";

const f = createUploadthing();

export const uploadRouter = {
  pngUploader: f({
    "image/png": {
      maxFileSize: "8MB",
      maxFileCount: 1,
    },
  })
    .middleware(async ({ req }) => {
      const headers = req.headers;
      const authHeader = headers.get("authorization");
      const token = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

      let payload: TokenPayload | null = null;
      if (token) {
        try {
          payload = verifyToken(token);
        } catch {
          // invalid token, continue as anonymous
        }
      }

      const description = headers.get("x-description") ?? "";
      const brand = headers.get("x-brand") ?? "gen";

      let userTags: string[] = [];
      const tagsHeader = headers.get("x-tags");
      if (tagsHeader) {
        try {
          const parsed = JSON.parse(tagsHeader);
          if (Array.isArray(parsed)) {
            userTags = parsed.filter((t: unknown) => typeof t === "string");
          }
        } catch {}
      }

      if (!token || !payload?.user) {
        throw new Error(
          "You must be logged in to upload ships. Please log in and try again."
        );
      }

      return {
        submittedBy: payload.user.username,
        description,
        brand,
        userTags,
      };
    })
    .onUploadComplete(async ({ file, metadata }) => {
      try {
        const imageData = await decodeShipFromUrl(file.ufsUrl);
        const shipData = decodeShipFromPixels(imageData);
        const priceInfo = calculateShipPrice(
          shipData as Parameters<typeof calculateShipPrice>[0]
        );
        const shipName = (file.name ?? "unknown").replace(".ship.png", "");

        const signature = computeShipSignature(shipData);

        const allTags = [...new Set([...priceInfo.tags, ...metadata.userTags])];

        const result = await insertShip({
          name: file.name ?? "unknown",
          data: file.ufsUrl,
          submittedBy: metadata.submittedBy,
          description: metadata.description,
          shipName,
          author: priceInfo.author,
          price: priceInfo.price,
          brand: metadata.brand,
          crew: priceInfo.crew,
          tags: allTags,
          signature,
        });

        return { shipId: result.success ? parseInt(result.success, 10) : null };
      } catch (err) {
        console.error("Failed to process uploaded ship:", err);
        return { shipId: null };
      }
    }),
};
