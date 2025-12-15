import { getLibrarySummary, warmupCache, isCacheWarmedUp, setCustomCredentials } from "@/lib/plex";
import { NextRequest } from "next/server";

export async function GET() {
  return handleRequest();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.plexUrl || body.plexToken) {
      setCustomCredentials(body.plexUrl, body.plexToken);
    }
  } catch {
    // No body or invalid JSON, use defaults
  }
  return handleRequest();
}

async function handleRequest() {
  try {
    const summary = await getLibrarySummary();

    // Trigger full cache warmup in background after returning summary
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
