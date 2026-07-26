"use client";

import { useRef, useEffect } from "react";
import { partPhysics } from "@/lib/physics-data";
import type { ShipStats } from "@/lib/physics";

interface Part {
  ID: string;
  Location: [number, number];
  Rotation: number;
  FlipX?: number;
}

interface Props {
  stats: ShipStats;
  parts: Part[];
}

const UP_TURRET_PARTS = new Set([
  "cosmoteer.laser_blaster_small",
  "cosmoteer.laser_blaster_large",
  "cosmoteer.disruptor",
  "cosmoteer.ion_beam_emitter",
  "cosmoteer.ion_beam_prism",
  "cosmoteer.point_defense",
  "cosmoteer.cannon_med",
  "cosmoteer.cannon_large",
  "cosmoteer.cannon_deck",
  "cosmoteer.missile_launcher",
  "cosmoteer.railgun_launcher",
  "cosmoteer.flak_cannon_large",
  "cosmoteer.shield_gen_small",
  "cosmoteer.chaingun",
  "cosmoteer.resonance_beam_turret",
]);

const DOWN_TURRET_PARTS = new Set([
  "cosmoteer.thruster_small",
  "cosmoteer.thruster_med",
  "cosmoteer.thruster_large",
  "cosmoteer.thruster_huge",
  "cosmoteer.thruster_boost",
]);

function spritePosition(part: Part, pos: [number, number]): [number, number] {
  const p = partPhysics[part.ID];
  if (!p || !p.spriteSize) return pos;
  const [px, py] = pos;

  if (part.Rotation === 0 && UP_TURRET_PARTS.has(part.ID)) {
    return [px, py - (p.spriteSize[1] - p.size[1])];
  }
  if (part.Rotation === 3 && UP_TURRET_PARTS.has(part.ID)) {
    return [px - (p.spriteSize[1] - p.size[1]), py];
  }
  if (part.Rotation === 1 && DOWN_TURRET_PARTS.has(part.ID)) {
    return [px - (p.spriteSize[1] - p.size[1]), py];
  }
  if (part.Rotation === 2 && DOWN_TURRET_PARTS.has(part.ID)) {
    return [px, py - (p.spriteSize[1] - p.size[1])];
  }

  if (part.ID === "cosmoteer.thruster_small_2way") {
    if (part.Rotation === 1) return [px - 1, py];
    if (part.Rotation === 2) return [px - 1, py - 1];
    if (part.Rotation === 3) return [px, py - 1];
  }
  if (part.ID === "cosmoteer.thruster_small_3way") {
    if (part.Rotation === 0) return [px - 1, py];
    if (part.Rotation === 1) return [px - 1, py - 1];
    if (part.Rotation === 2) return [px - 1, py - 1];
    if (part.Rotation === 3) return [px, py - 1];
  }

  return pos;
}

const spriteCache = new Map<string, HTMLImageElement>();

function loadSprite(partId: string): Promise<HTMLImageElement> {
  const name = partId.replace("cosmoteer.", "");
  const cached = spriteCache.get(name);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      spriteCache.set(name, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load sprite: ${name}`));
    img.src = `/sprites/${name}.png`;
  });
}

function findCropBounds(
  imageData: ImageData
): { x: number; y: number; w: number; h: number } {
  const { data, width, height } = imageData;
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx] > 0 || data[idx + 1] > 0 || data[idx + 2] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, w: width, h: height };
  }

  const margin = 10;
  minX = Math.max(0, minX - margin);
  minY = Math.max(0, minY - margin);
  maxX = Math.min(width - 1, maxX + margin);
  maxY = Math.min(height - 1, maxY + margin);

  let cropW = maxX - minX + 1;
  let cropH = maxY - minY + 1;

  if (cropW > cropH) {
    const diff = cropW - cropH;
    minY = Math.max(0, minY - Math.floor(diff / 2));
    maxY = Math.min(height - 1, maxY + Math.ceil(diff / 2));
    cropH = maxY - minY + 1;
  } else if (cropH > cropW) {
    const diff = cropH - cropW;
    minX = Math.max(0, minX - Math.floor(diff / 2));
    maxX = Math.min(width - 1, maxX + Math.ceil(diff / 2));
    cropW = maxX - minX + 1;
  }

  return { x: minX, y: minY, w: cropW, h: cropH };
}

export default function ShipReconstruction({ stats, parts }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      for (const part of parts) {
        const x = part.Location[0];
        const y = part.Location[1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }

      const SIZE_FACTOR = 16;
      const canvaSize =
        Math.max(
          Math.abs(maxX) + Math.abs(minX),
          Math.abs(maxY) + Math.abs(minY)
        ) + 250;
      const canvaOffset = canvaSize >> 1;
      const pxSize = canvaSize * SIZE_FACTOR;

      const offscreen = document.createElement("canvas");
      offscreen.width = pxSize;
      offscreen.height = pxSize;
      const ctx = offscreen.getContext("2d")!;

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, pxSize, pxSize);

      const orderedParts = [...parts];
      const reorder = ["cannon_deck", "ion_beam_prism", "resonance_beam_turret"];
      for (let i = orderedParts.length - 1; i >= 0; i--) {
        const suffix = orderedParts[i].ID.replace("cosmoteer.", "");
        if (reorder.includes(suffix)) {
          orderedParts.push(orderedParts.splice(i, 1)[0]);
        }
      }

      const loadPromises = orderedParts.map((p) => loadSprite(p.ID).catch(() => null));
      const sprites = await Promise.all(loadPromises);

      if (cancelled) return;

      for (let i = 0; i < orderedParts.length; i++) {
        const part = orderedParts[i];
        const sprite = sprites[i];
        if (!sprite) continue;

        const p = partPhysics[part.ID];
        if (!p) continue;

        let xCoord = part.Location[0] + canvaOffset;
        let yCoord = part.Location[1] + canvaOffset;

        [xCoord, yCoord] = spritePosition(part, [xCoord, yCoord]);

        const scaledX = Math.round(xCoord * SIZE_FACTOR);
        const scaledY = Math.round(yCoord * SIZE_FACTOR);

        const spriteW = Math.round(sprite.naturalWidth / 4);
        const spriteH = Math.round(sprite.naturalHeight / 4);

        ctx.save();
        ctx.translate(scaledX + spriteW / 2, scaledY + spriteH / 2);

        const rotation = part.Rotation ?? 0;
        ctx.rotate((rotation * Math.PI) / 2);

        if (part.FlipX) {
          ctx.scale(-1, 1);
        }

        if (rotation === 1 || rotation === 3) {
          ctx.drawImage(sprite, -spriteH / 2, -spriteW / 2, spriteH, spriteW);
        } else {
          ctx.drawImage(sprite, -spriteW / 2, -spriteH / 2, spriteW, spriteH);
        }

        ctx.restore();
      }

      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.fillRect(0, 0, pxSize, pxSize);

      const comX = Math.round((stats.centerX + canvaOffset) * SIZE_FACTOR);
      const comY = Math.round((stats.centerY + canvaOffset) * SIZE_FACTOR);

      const tractorParts = parts.filter(
        (p) => p.ID === "cosmoteer.tractor_beam_emitter"
      );
      if (tractorParts.length > 0) {
        const { centerOfMass } = await import("@/lib/physics");
        const tbCom = centerOfMass(tractorParts);
        const tbX = Math.round((tbCom.x + canvaOffset) * SIZE_FACTOR);
        const tbY = Math.round((tbCom.y + canvaOffset) * SIZE_FACTOR);
        ctx.fillStyle = "#ff0000";
        ctx.beginPath();
        ctx.arc(tbX, tbY, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#00ff00";
      ctx.beginPath();
      ctx.arc(comX, comY, 16, 0, Math.PI * 2);
      ctx.fill();

      const totalThrust = stats.thrustDirection.reduce((a, b) => a + b, 0) || 1;
      const arrowSize = 35 * SIZE_FACTOR;

      for (let i = 0; i < 8; i++) {
        if (i !== 7) continue;

        const origin = stats.originThrust[i];
        if (!origin) continue;
        const thrust = stats.thrustDirection[i];
        if (thrust === 0) continue;

        const startX = Math.round((origin.x + canvaOffset) * SIZE_FACTOR);
        const startY = Math.round((origin.y + canvaOffset) * SIZE_FACTOR);

        const dirVec = {
          x: (stats.thrustVector[i].x - origin.x) / totalThrust,
          y: (stats.thrustVector[i].y - origin.y) / totalThrust,
        };

        const endXAbs = Math.round(
          (dirVec.x * arrowSize / SIZE_FACTOR + origin.x + canvaOffset) * SIZE_FACTOR
        );
        const endYAbs = Math.round(
          (dirVec.y * arrowSize / SIZE_FACTOR + origin.y + canvaOffset) * SIZE_FACTOR
        );

        ctx.strokeStyle = "#00c800";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endXAbs, endYAbs);
        ctx.stroke();

        const angle = Math.atan2(endYAbs - startY, endXAbs - startX);
        const headLen = 8;
        ctx.beginPath();
        ctx.moveTo(endXAbs, endYAbs);
        ctx.lineTo(
          endXAbs - headLen * Math.cos(angle - Math.PI / 6),
          endYAbs - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(endXAbs, endYAbs);
        ctx.lineTo(
          endXAbs - headLen * Math.cos(angle + Math.PI / 6),
          endYAbs - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();

        ctx.fillStyle = "#00c800";
        ctx.beginPath();
        ctx.arc(startX, startY, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let i = 0; i < 8; i++) {
        if (i === 7) continue;

        const origin = stats.originThrust[i];
        if (!origin) continue;
        const thrust = stats.thrustDirection[i];
        if (thrust === 0) continue;

        const startX = Math.round((origin.x + canvaOffset) * SIZE_FACTOR);
        const startY = Math.round((origin.y + canvaOffset) * SIZE_FACTOR);

        const dirVec = {
          x: (stats.thrustVector[i].x - origin.x) / totalThrust,
          y: (stats.thrustVector[i].y - origin.y) / totalThrust,
        };

        const endXAbs = Math.round(
          (dirVec.x * arrowSize / SIZE_FACTOR + origin.x + canvaOffset) * SIZE_FACTOR
        );
        const endYAbs = Math.round(
          (dirVec.y * arrowSize / SIZE_FACTOR + origin.y + canvaOffset) * SIZE_FACTOR
        );

        ctx.strokeStyle = "#ffff00";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endXAbs, endYAbs);
        ctx.stroke();

        const angle = Math.atan2(endYAbs - startY, endXAbs - startX);
        const headLen = 8;
        ctx.beginPath();
        ctx.moveTo(endXAbs, endYAbs);
        ctx.lineTo(
          endXAbs - headLen * Math.cos(angle - Math.PI / 6),
          endYAbs - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(endXAbs, endYAbs);
        ctx.lineTo(
          endXAbs - headLen * Math.cos(angle + Math.PI / 6),
          endYAbs - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();

        ctx.fillStyle = "#ffff00";
        ctx.beginPath();
        ctx.arc(startX, startY, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      const fullImageData = ctx.getImageData(0, 0, pxSize, pxSize);
      const crop = findCropBounds(fullImageData);

      const SIZE = 512;
      canvas.width = SIZE;
      canvas.height = SIZE;
      const displayCtx = canvas.getContext("2d")!;
      displayCtx.fillStyle = "#000000";
      displayCtx.fillRect(0, 0, SIZE, SIZE);

      const scale = Math.min(SIZE / crop.w, SIZE / crop.h);
      const drawW = crop.w * scale;
      const drawH = crop.h * scale;
      const drawX = (SIZE - drawW) / 2;
      const drawY = (SIZE - drawH) / 2;

      displayCtx.drawImage(
        offscreen,
        crop.x,
        crop.y,
        crop.w,
        crop.h,
        drawX,
        drawY,
        drawW,
        drawH
      );
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [stats, parts]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="w-full h-auto border border-[#1C598C] rounded"
      />
    </div>
  );
}
