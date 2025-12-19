# Plex Chat

A conversational AI assistant for your Plex media library. Ask questions about your collection, get personalized recommendations, and discover content using natural language.

## Features

- **Natural Language Search** - Ask "What Tom Hanks movies do I have?" or "Show me sci-fi films from the 90s"
- **Smart Recommendations** - Get personalized suggestions based on your library and watch history
- **Random Picker** - "Spin the wheel" for a random movie recommendation with confetti celebration
- **Multi-Source Ratings** - Rotten Tomatoes, IMDb, and Letterboxd scores for any movie
- **External Movie Lookup** - Get info about movies not in your library via OMDB
- **Web Search** - Search the web for movie information and reviews
- **Trailer Finder** - Quick links to movie trailers on YouTube
- **Genre Exploration** - Browse your collection by genre, mood, or theme
- **Actor/Director Search** - Find all content featuring specific people
- **Watch History & Stats** - See what you've watched and your viewing patterns
- **Similar Content** - Find movies like ones you enjoyed (with smart sequel filtering)
- **Collection Browser** - Explore your curated Plex collections
- **Suggested Questions** - Quick-start prompts to help you discover content
- **Chat Persistence** - Conversation history saved locally (last 50 messages)
- **Real-time Streaming** - Responses stream in as they're generated
- **Plex Webhooks** - Auto-refresh cache when your library changes
- **PWA Support** - Install as an app on mobile devices
- **Mobile-Friendly** - Optimized for iOS/Android with touch-friendly UI
- **Security** - Rate limiting, CSRF protection, encrypted credential storage

## Quick Start

### Option 1: Using In-App Settings (Easiest)

1. Clone and run the app:
   ```bash
   git clone https://github.com/S1gv4rd/plex-chat.git
   cd plex-chat
   npm install
   npm run dev
   ```

2. Open [http://localhost:3000](http://localhost:3000)

3. Click the **gear icon** in the header to open Settings

4. Enter your credentials:
   - **Plex Server URL**: `http://YOUR-PLEX-IP:32400`
   - **Plex Token**: Your X-Plex-Token (see below)
   - **Anthropic API Key**: Your Claude API key from [console.anthropic.com](https://console.anthropic.com)

5. Click **Save** and start chatting!

### Option 2: Using Environment Variables

1. Clone the repository:
   ```bash
   git clone https://github.com/S1gv4rd/plex-chat.git
   cd plex-chat
   ```

2. Create a `.env.local` file:
   ```env
   PLEX_URL=http://your-plex-server:32400
   PLEX_TOKEN=your-plex-token
   ANTHROPIC_API_KEY=your-anthropic-api-key
   ```

3. Install and run:
   ```bash
   npm install
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Getting Your Plex Token

**Method 1: From Plex Web**
1. Open Plex Web App and sign in
2. Open any media item and click **Get Info**
3. Click **View XML**
4. Find `X-Plex-Token=XXXXX` in the URL

**Method 2: From Browser DevTools**
1. Open Plex Web App
2. Press F12 to open DevTools → Network tab
3. Refresh the page
4. Search for `X-Plex-Token` in any request

## Install as Mobile App (PWA)

**iOS Safari:**
1. Open the app in Safari
2. Tap the Share button
3. Select "Add to Home Screen"

**Android Chrome:**
1. Open the app in Chrome
2. Tap the menu (three dots)
3. Select "Add to Home Screen" or "Install App"

## Example Queries

```
"What should I watch tonight?"
"Spin the wheel!"
"Something funny for date night"
"Best thrillers in my library"
"Movies with Tom Hanks"
"Films directed by Denis Villeneuve"
"What have I watched recently?"
"My viewing stats"
"Movies similar to Inception"
"What's in my Marvel collection?"
"Tell me about Oppenheimer" (external lookup)
"What are critics saying about Dune Part Two?"
"Find me the trailer for The Batman"
```

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4
- **AI**: Google Gemini with function calling
- **Backend**: Next.js API routes with streaming
- **Validation**: Zod schema validation
- **Plex**: Direct Plex Media Server API
- **External APIs**: OMDB, Letterboxd, DuckDuckGo

## Deployment

### Vercel (Recommended)

```bash
npm run build
npx vercel --prod
```

Set environment variables in Vercel project settings, or let users configure via the in-app settings.

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Self-Hosted

```bash
npm run build
npm start
```

Runs on port 3000 by default.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Chat with streaming responses |
| `/api/library` | GET/POST | Library summary and stats |
| `/api/suggestions` | GET | Personalized content suggestions |
| `/api/webhook` | POST | Plex webhook receiver (cache invalidation) |

## License

MIT
