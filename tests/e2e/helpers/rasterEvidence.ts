import type { Page } from "@playwright/test";

export type RasterEvidence = {
  width: number;
  height: number;
  sampledPixels: number;
  nonWhitePixels: number;
  whiteCornerPixels: number;
};

export type EvidenceBounds = {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export async function inspectRasterDataUrl(page: Page, dataUrl: string): Promise<RasterEvidence> {
  return page.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas 2D context is unavailable.");
    context.drawImage(image, 0, 0);

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const stride = Math.max(1, Math.floor((canvas.width * canvas.height) / 100_000));
    let sampledPixels = 0;
    let nonWhitePixels = 0;
    for (let pixel = 0; pixel < canvas.width * canvas.height; pixel += stride) {
      const index = pixel * 4;
      const white = pixels[index] >= 250 && pixels[index + 1] >= 250 && pixels[index + 2] >= 250;
      sampledPixels += 1;
      if (!white) nonWhitePixels += 1;
    }

    const corners = [
      [0, 0],
      [Math.max(0, canvas.width - 1), 0],
      [0, Math.max(0, canvas.height - 1)],
      [Math.max(0, canvas.width - 1), Math.max(0, canvas.height - 1)]
    ];
    const whiteCornerPixels = corners.filter(([x, y]) => {
      const data = context.getImageData(x, y, 1, 1).data;
      return data[0] >= 250 && data[1] >= 250 && data[2] >= 250 && data[3] === 255;
    }).length;

    return {
      width: canvas.width,
      height: canvas.height,
      sampledPixels,
      nonWhitePixels,
      whiteCornerPixels
    };
  }, dataUrl);
}

export function findOverlappingBounds(bounds: EvidenceBounds[]) {
  const collisions: Array<[string, string]> = [];

  for (let leftIndex = 0; leftIndex < bounds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < bounds.length; rightIndex += 1) {
      const left = bounds[leftIndex];
      const right = bounds[rightIndex];
      if (
        left.left < right.right &&
        left.right > right.left &&
        left.top < right.bottom &&
        left.bottom > right.top
      ) {
        collisions.push([left.id, right.id]);
      }
    }
  }

  return collisions;
}
