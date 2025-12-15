import { getLibrarySummary, warmupCache, isCacheWarmedUp } from "@/lib/plex";

export async function GET() {
  try {
    const summary = await getLibrarySummary();

    // Trigger full cache warmup in background after returning summary
    // This pre-fetches all library content for faster subsequent queries
    if (!isCacheWarmedUp()) {
      warmupCache().catch(console.error);
    }

    return Response.json(summary);
  } catch (error) {
    console.error("Library API error:", error);
    return Response.json(
      { error: "Failed to fetch library. Check your Plex connection." },
      { status: 500 }
    );
  }
}
