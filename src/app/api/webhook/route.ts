import { NextRequest } from "next/server";

// Store for recent events (in production, use Redis or similar)
const recentEvents: { type: string; title: string; timestamp: number }[] = [];
const MAX_EVENTS = 20;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const payloadStr = formData.get("payload");

    if (!payloadStr || typeof payloadStr !== "string") {
      return Response.json({ error: "No payload" }, { status: 400 });
    }

    const payload = JSON.parse(payloadStr);
    const event = payload.event;
    const metadata = payload.Metadata;

    if (!metadata) {
      return Response.json({ ok: true });
    }

    const eventData = {
      type: event,
      title: metadata.grandparentTitle
        ? `${metadata.grandparentTitle} - ${metadata.title}`
        : metadata.title,
      timestamp: Date.now(),
    };

    // Add to recent events
    recentEvents.unshift(eventData);
    if (recentEvents.length > MAX_EVENTS) {
      recentEvents.pop();
    }

    console.log(`Plex webhook: ${event} - ${eventData.title}`);

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
}

export async function GET() {
  // Return recent events for polling
  return Response.json(recentEvents);
}
