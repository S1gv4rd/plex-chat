# Plex Chat

A conversational AI assistant for your Plex media library. Ask questions about your collection, get personalized recommendations, and discover content using natural language.

## Features

- **Natural Language Search** - Ask "What Tom Hanks movies do I have?" or "Show me sci-fi films from the 90s"
- **Smart Recommendations** - Get personalized suggestions based on your library and watch history
- **Genre Exploration** - Browse your collection by genre, mood, or theme
- **Actor/Director Search** - Find all content featuring specific people
- **Watch History & Stats** - See what you've watched, your top genres, and viewing patterns
- **Similar Content** - Find movies like ones you enjoyed
- **Collection Browser** - Explore your curated Plex collections
- **Real-time Streaming** - Responses stream in as they're generated

## Tech Stack

- **Frontend**: Next.js 16, React, Tailwind CSS
- **AI**: Claude (Anthropic API) with tool use for intelligent library queries
- **Backend**: Next.js API routes
- **Plex Integration**: Direct Plex Media Server API

## Setup

### Prerequisites

- Node.js 18+
- A Plex Media Server
- Anthropic API key

### Environment Variables

Create a `.env.local` file:

```env
PLEX_URL=http://your-plex-server:32400
PLEX_TOKEN=your-plex-token
ANTHROPIC_API_KEY=your-anthropic-api-key
```

**Getting your Plex Token:**
1. Sign in to Plex Web App
2. Open any media item and click "Get Info"
3. Click "View XML"
4. Find `X-Plex-Token` in the URL

### Installation

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start chatting with your library.

## Example Queries

- "What should I watch tonight?"
- "Recommend something for date night"
- "What horror movies do I have?"
- "Films directed by Christopher Nolan"
- "What have I watched recently?"
- "Show me my viewing stats"
- "Movies similar to Inception"
- "What's in my 'Best of 2024' collection?"

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/chat` | Main chat endpoint with streaming responses |
| `GET /api/library` | Library summary (movies, shows, episodes count) |
| `POST /api/webhook` | Plex webhook receiver for real-time updates |

## Deployment

Deploy easily on Vercel:

```bash
npm run build
npx vercel --prod
```

Make sure to set environment variables in your Vercel project settings.

## License

MIT
