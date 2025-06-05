# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SDXL Emoji Pipeline is a Next.js application that generates emoji-style images for language learning vocabulary cards. It processes JSON vocabulary data, uses AI to categorize words and generate prompts, then creates emoji-style images using SDXL-emoji model.

## Commands

```bash
# Development
npm run dev          # Start development server with Turbopack on http://localhost:3000

# Production
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
```

## Architecture

- **Next.js 15.3.2 App Router**: All pages in `/app`, API routes in `/app/api`
- **Database**: SQLite with Kysely ORM, stored at `/data/language-cards.db`
- **State Management**: Zustand store in `/store/useAppStore.ts`
- **AI Integration**:
  - OpenRouter API (with Gemini model) for categorization
  - Google Gemini AI for prompt generation
  - Replicate API with SDXL-emoji model for image generation
- **Image Storage**: Downloaded to `/public/images/` locally

## Key Workflows

1. **Word Categorization**: `/app/api/categorize-vocabulary` determines if words are suitable for image generation
2. **Prompt Generation**: `/app/api/generate-prompts-batch` creates SDXL prompts (batch of 10)
3. **Image Generation**: Queue system in `/lib/imageQueue.ts` handles sequential processing
4. **Database Operations**: Repository pattern in `/lib/db/repository.ts`
5. **Random Pending Word**: `/app/api/random-pending-word` returns random word with `image_status != 'completed'` as `{id, prompt}` for n8n integration

## Environment Variables

Required in `.env.local`:
```
GEMINI_API_KEY=your_google_gemini_key
REPLICATE_API_TOKEN=your_replicate_token
OPENROUTER_API_KEY=your_openrouter_key  # Optional, defaults to provided key
OPENROUTER_MODEL=google/gemini-2.5-flash-preview-05-20  # Optional
```

## Database Migrations

Run migrations automatically on startup. New migrations go in `/lib/db/migrations/` following the naming pattern `XXX_description.ts`.

## API Response Patterns

All API routes return consistent JSON:
- Success: `{ success: true, data: ... }`
- Error: `{ success: false, error: "message" }`

## Testing

No test framework is currently configured. When adding tests, update this section with the test command.