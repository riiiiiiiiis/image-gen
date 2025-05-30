# SDXL Emoji Pipeline: Language Learning Card Generator

## 1. Overview

A web application designed to streamline the creation of visually engaging language learning cards. It takes word pairs, generates descriptive prompts using AI, and then creates unique emoji-style images for those prompts, also using AI. The generated assets can be viewed, managed, and exported.

### Key Capabilities
- Import language learning data from JSON files
- Generate visual scene descriptions using Google Gemini AI
- Create emoji-style images using Replicate's SDXL-emoji model
- Persist data in SQLite database for long-term storage
- Manage and export enhanced datasets with generated content

## 2. Purpose & Problem Solved

Language learning often benefits from visual aids. This application automates the creation of custom, emoji-style images associated with vocabulary words, making study materials more engaging and memorable. It solves the tedious task of manually finding or creating relevant images for language flashcards.

## 3. Target Audience

- Language learners seeking to create personalized study materials.
- Educators and content creators developing language learning resources.
- Anyone needing a quick way to generate unique emoji-style visuals based on text prompts.

## 4. Core Features

-   **JSON File Upload**: User-friendly drag-and-drop interface (React Dropzone) for uploading JSON files containing word pairs (e.g., original text, translation).
-   **Interactive Data Table**:
    -   Displays uploaded word pairs along with generated prompts and images.
    -   Powered by TanStack Table for sorting, filtering, and searching.
    -   Inline editing of original text, translations, and generated prompts.
    -   Buttons for triggering AI prompt and image generation per item.
-   **AI Prompt Generation**:
    -   Utilizes Google's Gemini API (`@google/generative-ai`) via a Next.js API route (`/api/generate-prompt`).
    -   Takes the "original text" of a word pair to generate a concise, descriptive scene suitable for image generation.
    -   Example: "cat" -> "A TOK emoji of a cute cat playing with a ball of yarn." (The "A TOK emoji of" prefix is added by the app).
-   **AI Image Generation**:
    -   Employs Replicate's SDXL-emoji model (`fofr/sdxl-emoji`) via a Next.js API route (`/api/generate-image`).
    -   Uses the AI-generated (or manually edited) prompt to create a unique emoji-style image.
    -   Configuration is centralized in `lib/replicateConfig.ts`, specifying model version, image dimensions (1024x1024), negative prompts, and other generation parameters.
    -   Generated images are downloaded from Replicate, saved locally to the `public/images/` directory (named `<entryId>.png`), and a cache-busting local URL is used for display.
-   **Gallery View**:
    -   Displays generated images in a responsive card-based layout.
    -   Cards can be clicked to "flip" and show the prompt used for generation.
    -   Allows downloading of individual images.
-   **Data Export**:
    -   Users can download the entire dataset (including original words, translations, generated prompts, and image URLs) as an enhanced JSON file.
    -   Includes local image paths and original Replicate URLs.
-   **State Management**:
    -   Leverages Zustand for client-side state management.
    -   Data is persisted to SQLite database via API routes for reliable storage.
    -   Real-time activity logging system tracks all operations.
-   **User Feedback**:
    -   Uses React Hot Toast for non-intrusive notifications (e.g., success/error messages for API calls, file uploads).
    -   Loading indicators for asynchronous operations.

## 5. Technology Stack

-   **Framework**: Next.js 15.3.2 (with Turbopack for development)
-   **Language**: TypeScript
-   **Frontend**: React 19
-   **Styling**: Tailwind CSS 4.1.7
-   **State Management**: Zustand 5.0.5 (with localStorage persistence)
-   **UI Components & Libraries**:
    -   **Table**: TanStack Table 8.21.3
    -   **File Upload**: React Dropzone 14.3.8
    -   **Notifications**: React Hot Toast 2.5.2
    -   **Icons**: Lucide Icons (lucide-react 0.511.0)
-   **AI Services & APIs**:
    -   **Prompt Generation**: Google Gemini API (`@google/generative-ai` 0.24.1)
    -   **Image Generation**: Replicate API (`replicate` 1.0.1)
        -   Model: `fofr/sdxl-emoji:dee76b5afde21b0f01ed7925f0665b7e879c50ee718c5f78a9d38e04d523cc5e`
-   **Backend**: Next.js API Routes
-   **HTTP Client**: Built-in `fetch` (Axios 1.9.0 also listed as a dependency, may be used or legacy)
-   **Development Environment**: Node.js, npm

## 6. Functional Flow

1.  **Initialization**:
    -   User navigates to the application.
    -   The app loads and fetches any existing data from the SQLite database via `/api/language-cards`.
    -   If no data exists, the UI presents an option to upload a JSON file.

2.  **Data Ingestion**:
    -   User drags and drops a JSON file (or uses the file selector) onto the designated area.
    -   The JSON file is expected to be an array of objects, each with `id`, `original_text`, `translation_text`, `level_id`, `transcription`.
    -   The file is parsed on the client-side and validated.
    -   Data is loaded into the Zustand store and immediately persisted to SQLite database via POST to `/api/language-cards`.
    -   The "Data Table" tab populates with the uploaded word pairs.
    -   Each entry is enriched with additional fields: `prompt`, `imageUrl`, `promptStatus`, `imageStatus`.

3.  **Prompt Generation**:
    -   In the Data Table, the user clicks the "Generate Prompt" button for a specific word entry.
    -   The button changes to "Generating..." state.
    -   A client-side request is made to the `POST /api/generate-prompt` endpoint, sending the `original_text`.
    -   The API route:
        -   Uses Gemini 2.5 Flash Preview model (`gemini-2.5-flash-preview-05-20`)
        -   Sends a carefully crafted prompt asking for a simple, emoji-appropriate scene
        -   Receives a scene description from Gemini
    -   The generated prompt is returned to the client.
    -   The prompt is saved in the Zustand store and persisted to database via PATCH to `/api/language-cards`.
    -   Activity log shows success/failure status.

4.  **Image Generation**:
    -   After a prompt is available (either AI-generated or manually entered/edited), the user clicks the "Generate Image" button.
    -   The button changes to "Queued..." then "Processing..." state.
    -   A client-side request is made to the `POST /api/generate-image` endpoint, sending the `prompt` and `entryId`.
    -   The API route:
        -   Formats the prompt with the required "TOK emoji of" prefix (critical for model style)
        -   Calls Replicate API using `replicate.run()` pattern with model `fofr/sdxl-emoji`
        -   Configuration: 1110x834 resolution, lora_scale 0.6, no watermark
        -   Waits for generation (typically 10-30 seconds)
        -   Returns the Replicate-hosted image URL
    -   The client updates the Zustand store and persists to database.
    -   Real-time activity log tracks the operation progress.
    -   The Data Table shows a thumbnail preview and Gallery Tab displays the full image.

5.  **Interaction & Viewing**:
    -   **Data Table Tab**: Users can sort by columns, search, and perform inline edits on text fields.
    -   **Gallery Tab**: Users can view all generated images. Clicking on an image card flips it to show the prompt used. Individual images can be downloaded directly from this view.

6.  **Data Export**:
    -   User clicks an "Export JSON" button.
    -   The application retrieves the current dataset from the Zustand store (including all original data, generated prompts, local image URLs, original Replicate URLs, and timestamps).
    -   This data is formatted as a JSON string and triggers a file download in the user's browser.

## 7. User Experience (UX) Considerations

-   **Clear Workflow**: The UI is divided into "Upload", "Data Table", and "Gallery" tabs, guiding the user through the process.
-   **Responsive Design**: The application should be usable across different screen sizes (leveraging Tailwind CSS).
-   **Immediate Feedback**:
    -   Loading spinners or indicators are shown during API calls (prompt/image generation).
    -   Toasts (React Hot Toast) provide success or error messages for operations.
-   **Data Persistence**: All data is persisted to SQLite database via API routes. The database stores word entries with their generated prompts and image URLs, ensuring data survival across sessions and server restarts.
-   **Error Handling**:
    -   Informative error messages for failed API requests (e.g., API key issues, Replicate errors).
    -   Validation for JSON file structure upon upload (basic).
-   **Efficiency**:
    -   Ability to generate prompts and images for individual items. (Batch operations could be a future enhancement).
    -   Local caching of generated images in `public/images/` reduces reliance on external URLs after initial generation and enables offline use if the app is run locally.
-   **Visual Appeal**: The ASCIILogo and overall clean design aim for a pleasant user experience. The emoji-style images themselves are the core visual output.

## 8. Setup and Running the Application

1.  **Clone the Repository**:
    ```bash
    git clone <repository-url>
    cd sdxl-emoji-pipeline
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Set Up Environment Variables**:
    Create a `.env.local` file in the root of the project and add your API keys:
    ```
    GEMINI_API_KEY=your_google_gemini_api_key_here
    REPLICATE_API_TOKEN=your_replicate_api_token_here
    ```

4.  **Run the Development Server**:
    ```bash
    npm run dev
    ```
    This command uses Next.js with Turbopack for faster development builds.

5.  **Open in Browser**:
    Navigate to `http://localhost:3000` in your web browser.

## 9. Project Structure

```
/
├── app/                    # Next.js App Router: Pages and API routes
│   ├── api/                # API backend logic
│   │   ├── generate-image/ # Image generation endpoint (Replicate integration)
│   │   ├── generate-prompt/ # Prompt generation endpoint (Gemini integration)
│   │   ├── generate-prompts-batch/ # Batch prompt generation endpoint
│   │   ├── language-cards/ # Database CRUD operations endpoint
│   │   ├── queue-image/    # Image queue management endpoint
│   │   └── gallery/        # Gallery data endpoint
│   ├── layout.tsx          # Main app layout with dark theme
│   ├── page.tsx            # Main page component ('use client')
│   └── globals.css         # Global styles and Tailwind imports
├── components/             # Reusable React components
│   ├── ASCIILogo.tsx       # Terminal-style branding
│   ├── ActivityLog.tsx     # Real-time operation tracking
│   ├── DataTable.tsx       # TanStack Table implementation
│   ├── FileUpload.tsx      # Drag-and-drop JSON upload
│   ├── Gallery.tsx         # Image gallery with flip cards
│   └── QueueStatus.tsx     # Queue monitoring component
├── lib/                    # Core business logic
│   ├── db/                 # Database layer
│   │   ├── database.ts     # SQLite connection with better-sqlite3
│   │   ├── schema.ts       # Database schema definitions
│   │   ├── repository.ts   # Data access patterns
│   │   └── migrations.ts   # Database migration logic
│   ├── gemini.ts           # Gemini API client configuration
│   ├── replicateConfig.ts  # SDXL-emoji model configuration
│   └── imageQueue.ts       # Image generation queue manager
├── store/                  # Client state management
│   └── useAppStore.ts      # Zustand store with API integration
├── types/                  # TypeScript definitions
│   └── index.ts            # Shared type definitions
├── utils/                  # Utility scripts
│   └── migrate-to-sqlite.ts # Data migration helper
├── data/                   # Data storage
│   ├── language-cards.db   # SQLite database file
│   └── gallery.json        # Gallery metadata cache
├── public/                 # Static assets
│   └── images/             # Generated emoji images
├── CLAUDE.md               # AI assistant instructions
├── .env.local              # Environment variables (gitignored)
├── next.config.ts          # Next.js configuration
├── package.json            # Dependencies and scripts
└── tsconfig.json           # TypeScript configuration
```

## 10. Technical Architecture

### Data Model

Core entity is `WordEntry` with comprehensive status tracking:

```typescript
interface WordEntry {
  id: number;
  original_text: string;      // English word/phrase
  translation_text: string;   // Russian translation
  transcription: string;      // Phonetic notation
  level_id: number;          // Difficulty level (1-5)
  prompt?: string;           // AI-generated or manual scene description
  imageUrl?: string;         // Generated emoji image URL
  promptStatus: 'none' | 'generating' | 'completed' | 'error';
  imageStatus: 'none' | 'queued' | 'processing' | 'completed' | 'error';
  replicateId?: string;      // Replicate job tracking ID
  qaScore?: 'good' | 'bad' | null;  // Quality assessment
  imageGeneratedAt?: string; // ISO timestamp
}
```

### State Management Architecture

- **Zustand Store** (`store/useAppStore.ts`): Manages UI state and coordinates with backend
- **Database Persistence**: SQLite database accessed only through API routes (server-side)
- **Real-time Updates**: Activity log system provides immediate feedback for all operations

### AI Integration Details

#### Gemini Prompt Generation
- Model: `gemini-2.5-flash-preview-05-20` (Latest Gemini 2.5 Flash Preview)
- Specialized prompt engineering for emoji-suitable scenes
- System prompt emphasizes simplicity and visual clarity
- Automatic retry logic for API failures

#### Replicate Image Generation  
- Model: `fofr/sdxl-emoji:dee76b5afde21b0f01ed7925f0665b7e879c50ee718c5f78a9d38e04d523cc5e`
- Critical: Prompts MUST start with "TOK emoji of" for proper style activation
- Configuration optimized for emoji aesthetics (lora_scale: 0.6)
- Images generated at 1110x834 resolution

## 11. API Endpoints

-   **`POST /api/generate-prompt`**:
    -   **Request Body**: `{ "text": "your word or phrase" }`
    -   **Response Body (Success)**: `{ "prompt": "A TOK emoji of a descriptive scene..." }`
    -   **Function**: Takes a word/phrase and returns an AI-generated prompt suitable for the SDXL-emoji model.

-   **`POST /api/generate-image`**:
    -   **Request Body**: `{ "prompt": "the ai-generated prompt", "entryId": "unique_id_for_the_item" }`
    -   **Response Body (Success)**:
        ```json
        {
          "imageUrl": "https://replicate.delivery/.../output.png",
          "entryId": "unique_id_for_the_item",
          "generatedAt": "2023-03-15T12:00:00.000Z"
        }
        ```
    -   **Function**: Takes a prompt, generates an image using Replicate's SDXL-emoji model, returns the hosted URL.

-   **`POST /api/generate-prompts-batch`**:
    -   **Request Body**: `{ "entries": [{ "id": 1, "text": "word" }, ...] }`
    -   **Response Body**: `{ "results": [{ "id": 1, "prompt": "A TOK emoji of..." }, ...], "errors": [...] }`
    -   **Function**: Batch generates prompts for multiple entries using Gemini AI.

-   **`GET /api/language-cards`**:
    -   **Response Body**: Array of all WordEntry objects from database
    -   **Function**: Fetches all language cards from SQLite database.

-   **`POST /api/language-cards`**:
    -   **Request Body**: Array of WordEntry objects
    -   **Response Body**: `{ "success": true }`
    -   **Function**: Bulk upserts entries to SQLite database.

-   **`PATCH /api/language-cards`**:
    -   **Request Body**: `{ "id": 1, "updates": { "prompt": "new prompt" } }`
    -   **Response Body**: `{ "success": true }`
    -   **Function**: Updates a specific entry in the database.

## 12. Development Workflow

### Getting Started

1. **Database Initialization**: On first run, the app automatically creates the SQLite database and required tables.

2. **Data Import**: Upload a JSON file with the required structure. The app validates and enriches the data.

3. **Prompt Generation**: 
   - Individual: Click "Generate Prompt" button per entry
   - Batch: Use batch generation endpoint for multiple entries

4. **Image Creation**: After prompts are ready, generate emoji-style images. Each generation takes 10-30 seconds.

5. **Quality Control**: Review generated images in the gallery, regenerate if needed.

6. **Export**: Download enhanced JSON with all generated content.

### Performance Considerations

- **Database Operations**: All DB access is server-side only to avoid client-side module conflicts
- **Image Generation**: Queue system prevents overwhelming Replicate API
- **Activity Logging**: Provides real-time feedback without blocking operations
- **Table Pagination**: 100 rows default for responsive UI with large datasets

## 13. Future Enhancements (Potential)

-   Batch generation for prompts and images.
-   Advanced image editing/customization options within the app.
-   Support for different AI image models or styles.
-   User accounts and cloud database persistence (e.g., Supabase, Firebase) instead of just localStorage.
-   Direct export to popular flashcard platforms (e.g., Anki).
-   More robust error handling and user feedback mechanisms.
-   Ability to select/deselect items for batch operations in the table.
-   Progress indicators for long-running batch jobs.
