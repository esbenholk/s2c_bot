// collage.js (or inline below)
const sharp = require("sharp");

/**
 * Collages images together by repeatedly replacing random patches
 * on a base image with corresponding patches from other images.
 *
 * @param {Buffer[]} imageBuffers - list of images (any sizes)
 * @param {Object} opts
 * @param {number} [opts.iterations=12] - how many swaps to perform
 * @param {number} [opts.patchWidth=512]
 * @param {number} [opts.patchHeight=512]
 * @param {number} [opts.seed] - optional RNG seed for reproducibility
 * @returns {Promise<Buffer>} PNG buffer of final collage
 */
async function collageImages(
  imageBuffers,
  { iterations = 50, patchWidth = 20, patchHeight = 20, seed } = {}
) {
  if (!Array.isArray(imageBuffers) || imageBuffers.length < 2) {
    throw new Error("Provide at least two images.");
  }

  // RNG
  let s = typeof seed === "number" ? seed : Math.floor(Math.random() * 1e9);
  const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;

  // Use first image as the base size; resize others to match (cover)
  const baseMeta = await sharp(imageBuffers[0]).metadata();
  const W = baseMeta.width,
    H = baseMeta.height;
  if (!W || !H) throw new Error("Base image has no dimensions.");

  const normalized = await Promise.all(
    imageBuffers.map((buf) =>
      sharp(buf)
        .resize({ width: W, height: H, fit: "cover" })
        .ensureAlpha()
        .toBuffer()
    )
  );

  // We’ll composite all patches in one go for performance.
  const composites = [];

  for (let i = 0; i < iterations; i++) {
    const left = Math.max(0, Math.floor(rnd() * (W - patchWidth)));
    const top = Math.max(0, Math.floor(rnd() * (H - patchHeight)));

    // Choose a donor image different from base
    const donorIndex = 1 + Math.floor(rnd() * (normalized.length - 1));
    const donor = normalized[donorIndex];

    const patch = await sharp(donor)
      .extract({ left, top, width: patchWidth, height: patchHeight })
      .toBuffer();

    composites.push({ input: patch, left, top });
  }

  // Apply all patches onto the first (base) image
  const out = await sharp(normalized[0]).composite(composites).png().toBuffer();

  return out;
}

module.exports = { collageImages };
