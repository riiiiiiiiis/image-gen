# Language Learning Card Generator

A minimalistic web application that generates emoji-style images for language learning cards using AI.

## Features

- **JSON File Upload**: Drag-and-drop interface for uploading word pair data
- **Data Table**: Sortable, searchable table with inline editing
- **AI Prompt Generation**: Uses Google Gemini API to create scene descriptions
- **Image Generation**: Creates emoji-style images using Replicate's SDXL-emoji model
- **Gallery View**: Card-based display with flip animation showing prompts
- **Export Functionality**: Download enhanced JSON with prompts and image URLs

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in `.env.local`:
```
GEMINI_API_KEY=your_gemini_api_key_here
REPLICATE_API_TOKEN=your_replicate_api_token_here
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## JSON Format

The app expects JSON files with the following structure:

```json
[
  {
    "id": 11643,
    "original_text": "genius",
    "translation_text": "гений",
    "level_id": 70,
    "transcription": "[ˈʤiːnjəs]"
  }
]
```

## Usage

1. Upload your JSON file by dragging it onto the upload area
2. In the Data Table tab:
   - Generate prompts for each word using the "Generate Prompt" button
   - Edit prompts manually if needed
   - Generate images using the "Generate Image" button
3. In the Gallery tab:
   - View generated images in a card layout
   - Click cards to flip and see the prompt
   - Download individual images or export all data

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **State Management**: Zustand with localStorage persistence
- **UI Components**: TanStack Table, React Dropzone, React Hot Toast
- **APIs**: Google Gemini (prompts), Replicate (images)

## Image Generation Parameters

- Model: `fofr/sdxl-emoji`
- Width: 1110px
- Height: 834px
- LoRA Scale: 0.6
