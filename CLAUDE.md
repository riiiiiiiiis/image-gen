# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build production bundle
- `npm run lint` - Run Next.js linting

## Environment Setup

Required environment variables in `.env.local`:
- `GEMINI_API_KEY` - Google Gemini API key for prompt generation
- `REPLICATE_API_TOKEN` - Replicate API token for image generation

## Architecture Overview

This is a Next.js application that generates emoji-style images for language learning cards using AI. The app follows a client-server architecture with React frontend and API routes.

### Core Data Flow
1. **JSON Import**: Users upload JSON files with word pairs (English/Russian + transcription)
2. **Prompt Generation**: Uses Gemini 2.5 Flash Preview to create scene descriptions
3. **Image Generation**: Uses Replicate's SDXL-emoji model to create emoji-style images
4. **State Management**: Zustand store with localStorage persistence

### Key Components Architecture

**State Management (`store/useAppStore.ts`)**:
- Central Zustand store managing WordEntry objects
- Persistent localStorage for data survival across sessions
- Filtered data computation for table display

**API Routes Architecture**:
- `/api/generate-prompt` - Gemini integration with specific prompt engineering for visual scenes
- `/api/generate-image` - Replicate integration using `replicate.run()` pattern with TOK emoji prefix

**Activity Logging System (`components/ActivityLog.tsx`)**:
- Global activity manager for real-time operation feedback
- Operation tracking with unique keys (`prompt-${id}`, `image-${id}`)
- Auto-cleanup of related messages on completion/error

### Data Model

Core entity is `WordEntry` with status tracking:
```typescript
interface WordEntry {
  id: number;
  original_text: string;      // English word
  translation_text: string;   // Russian translation  
  transcription: string;      // Phonetic notation
  prompt?: string;            // Generated/manual scene description
  imageUrl?: string;          // Generated emoji image
  promptStatus: 'none' | 'generating' | 'completed' | 'error';
  imageStatus: 'none' | 'queued' | 'processing' | 'completed' | 'error';
}
```

### Design System

Uses monospace aesthetic with dark theme:
- Font: JetBrains Mono with fallbacks
- Custom CSS variables for dark grays (`--color-notion-gray-*`)
- Terminal-style UI elements (`[PROMPT]`, `[IMAGE]`, `← PREV`)
- ASCII art logo instead of traditional headers

### External API Integrations

**Gemini API**:
- Model: `gemini-2.5-flash-preview-05-20` (Latest Gemini 2.5 Flash Preview)
- Specialized prompt engineering for emoji-suitable scene descriptions
- Error handling for API key validation and rate limits

**Replicate API**:
- Model: `fofr/sdxl-emoji:dee76b5afde21b0f01ed7925f0665b7e879c50ee718c5f78a9d38e04d523cc5e`
- Uses `replicate.run()` pattern (not predictions API)
- Prompt format: `"TOK emoji of ${user_prompt}"` (IMPORTANT: Must start with "TOK emoji of" - this is the key trigger for the model style)
- Parameters: 1110x834, lora_scale 0.6, no watermark

### Table Implementation

Uses TanStack Table with:
- 100 rows default pagination
- Real-time editing of prompts with operation state tracking
- Column sizing optimized for full-width display
- Inline status indicators for async operations