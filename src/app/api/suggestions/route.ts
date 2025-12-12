import { getPersonalizedSuggestions } from "@/lib/plex";

export async function GET() {
  try {
    const suggestions = await getPersonalizedSuggestions();
    return Response.json(suggestions);
  } catch (error) {
    console.error("Error getting suggestions:", error);
    return Response.json([]);
  }
}
