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
- **Database**: Supabase (cloud) with repository pattern in `/lib/db/repository.ts`
- **State Management**: Zustand store in `/store/useAppStore.ts`
- **AI Integration**:
  - OpenRouter API (with Gemini model) for categorization
  - Google Gemini AI for prompt generation
  - Replicate API with SDXL-emoji model for image generation
- **Image Storage**: Supabase Storage with automatic upload after generation

## Key Workflows

1. **Word Categorization**: `/app/api/categorize-vocabulary` determines if words are suitable for image generation and provides transformation suggestions for abstract words
2. **Prompt Generation**: Smart layered approach in `/app/api/generate-prompt` and `/app/api/generate-prompts-batch`:
   - Priority 1: YAML overrides from `prompt_overrides.yaml`
   - Priority 2: Database transformation suggestions from categorization
   - Priority 3: AI generation (only when needed)
3. **Image Generation**: Queue system in `/lib/imageQueue.ts` handles sequential processing and automatically updates database with results
4. **Database Operations**: Repository pattern in `/lib/db/repository.ts` with 5000-row limit for full dataset access
5. **Random Pending Word**: `/app/api/random-pending-word` returns random word with `image_status != 'completed'` as `{id, prompt}` for n8n integration

## Environment Variables

Required in `.env.local`:
```
GEMINI_API_KEY=your_google_gemini_key
REPLICATE_API_TOKEN=your_replicate_token
OPENROUTER_API_KEY=your_openrouter_key  # Optional, defaults to provided key
OPENROUTER_MODEL=google/gemini-2.5-flash-preview-05-20  # Optional

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## Important Implementation Details

### Prompt Generation Optimization
- The system leverages categorization results to avoid redundant AI calls
- Abstract words use pre-computed `transformation_suggestion` from categorization
- Categorization prompts generate clean, direct suggestions (no "emoji" word, max 4 words)
- This significantly reduces API costs and improves consistency

### Image Queue Processing
- `/lib/imageQueue.ts` automatically updates the database after successful/failed image generation
- No manual database updates needed - the queue handles persistence
- Includes retry logic with exponential backoff for failed generations

### Database Query Limits
- Repository `findAll()` method uses `.limit(5000)` to override Supabase's default 1000-row limit
- Gallery API removes hardcoded slice limits to display all entries
- Supports 4000+ vocabulary entries without pagination

## API Response Patterns

All API routes return consistent JSON:
- Success: `{ success: true, data: ... }`
- Error: `{ success: false, error: "message" }`

## Git Workflow Rules

- **NEVER push to main branch without explicit user permission**
- Always work on feature branches for changes
- Only push to main when explicitly requested by the user
- Ask before any git push operations

## Testing

No test framework is currently configured. When adding tests, update this section with the test command.