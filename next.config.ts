import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Next.js's default Server Action request body limit is 1MB - the AI
    // Scanner accepts photos up to 8MB (see MAX_IMAGE_BYTES in
    // src/lib/actions/scanner.ts and ImageDropzone.tsx), so without this,
    // virtually every real phone photo submitted via scanStickerBacksAction
    // was rejected by Next.js itself before the action's own code ever ran -
    // this was the actual root cause of the scanner "failing on every
    // upload" (see README's "Sticker Scanner reliability" section for the
    // full investigation). `proxyClientMaxBodySize` covers the same limit
    // for Next.js 16's internal proxy layer (relevant in some deployment
    // modes) - set defensively alongside it.
    serverActions: {
      bodySizeLimit: "10mb",
    },
    proxyClientMaxBodySize: "10mb",
  },
};

export default nextConfig;
