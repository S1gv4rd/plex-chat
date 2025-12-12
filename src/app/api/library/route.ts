import { getLibrarySummary } from "@/lib/plex";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const summary = await getLibrarySummary();
    return Response.json(summary);
  } catch (error) {
    console.error("Library API error:", error);
    return Response.json(
      { error: "Failed to fetch library. Check your Plex connection." },
      { status: 500 }
    );
  }
}
