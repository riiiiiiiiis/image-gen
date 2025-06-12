# Implementation Plan: Export Good Images (Variant 3 - Hybrid Approach)

## Overview
Create a system where users can export all images marked as "good" (`qaScore: 'good'`) from Supabase Storage. The solution consists of:
1. API endpoint that provides metadata
2. Local Node.js script for downloading

## Phase 1: API Endpoint Development

### 1.1 Create Export Metadata Endpoint
**File:** `app/api/export-good-images/route.ts`

**Functionality:**
- Query database joining `word_entries` with storage information
- Filter for `qa_score = 'good'` AND `image_url IS NOT NULL`
- Return comprehensive metadata for each image

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "total": 2000,
    "exportDate": "2024-01-15T10:00:00Z",
    "images": [
      {
        "id": 123,
        "englishWord": "apple",
        "russianWord": "яблоко",
        "transcription": "yabloko",
        "imageUrl": "https://xxx.supabase.co/storage/v1/object/public/emoji-images/123.png",
        "storagePath": "123.png",
        "generatedAt": "2024-01-10T15:30:00Z",
        "fileSize": null, // Optional: could query from storage.objects
        "prompt": "red apple fruit"
      }
    ]
  }
}
```

**Security Considerations:**
- Add rate limiting (1 request per minute)
- Optional: Require authentication
- Cache response for 5 minutes to reduce DB load

### 1.2 Optimize Database Query
**Direct SQL Query to use:**
```sql
SELECT 
  w.id,
  w.original_text as english_word,
  w.translation_text as russian_word,
  w.transcription,
  w.image_url,
  w.image_generated_at,
  w.prompt,
  -- Extract storage path from image_url
  REGEXP_REPLACE(w.image_url, '^.*/([^/]+)$', '\1') as storage_path
FROM word_entries w
WHERE w.qa_score = 'good' 
  AND w.image_url IS NOT NULL
ORDER BY w.id;
```

## Phase 2: Node.js Download Script

### 2.1 Script Structure
**File:** `scripts/download-good-images.js`

**Core Features:**
- Fetch metadata from API
- Download images in parallel batches
- Progress tracking with progress bar
- Resume capability
- Organize files in meaningful structure
- Create final zip archive

### 2.2 Directory Organization
```
exports/
├── good-images-2024-01-15/
│   ├── manifest.json
│   ├── by-id/
│   │   ├── 123-apple.png
│   │   ├── 124-banana.png
│   │   └── ...
│   └── by-word/
│       ├── apple-123.png
│       ├── banana-124.png
│       └── ...
```

### 2.3 Script Configuration
**Config Options:**
- API endpoint URL
- Output directory
- Batch size (default: 10 concurrent downloads)
- Retry attempts (default: 3)
- Organization method (by-id, by-word, or both)
- Create zip after download (yes/no)

### 2.4 Progress Tracking
- Use `cli-progress` for visual progress bar
- Save progress to `progress.json` for resume capability
- Track: downloaded, failed, remaining

### 2.5 Error Handling
- Automatic retry with exponential backoff
- Failed downloads logged to `errors.log`
- Option to retry only failed downloads
- Network timeout handling

## Phase 3: User Documentation

### 3.1 README for Download Script
**File:** `scripts/README-DOWNLOAD.md`

**Contents:**
- Prerequisites (Node.js 18+)
- Installation instructions
- Configuration options
- Usage examples
- Troubleshooting guide

### 3.2 In-App Instructions
- Add "Export Good Images" button to Gallery
- Modal with instructions:
  1. Click to get your export data
  2. Download the Node.js script
  3. Run the script locally
  4. Find your images in the exports folder

## Phase 4: Implementation Steps

### Step 1: Database Preparation (30 min)
- [ ] Test the SQL query in Supabase dashboard
- [ ] Verify all good images have valid URLs
- [ ] Check for any data inconsistencies

### Step 2: API Endpoint (2 hours)
- [ ] Create new route handler
- [ ] Implement database query
- [ ] Add response caching
- [ ] Add rate limiting
- [ ] Test with Postman/curl

### Step 3: Download Script Core (3 hours)
- [ ] Set up Node.js project structure
- [ ] Implement metadata fetching
- [ ] Create download queue system
- [ ] Add parallel download logic
- [ ] Implement progress tracking

### Step 4: Download Script Features (2 hours)
- [ ] Add resume capability
- [ ] Implement file organization options
- [ ] Add zip creation
- [ ] Error handling and logging
- [ ] CLI interface

### Step 5: Testing (2 hours)
- [ ] Test with small dataset (10 images)
- [ ] Test with medium dataset (100 images)
- [ ] Test resume functionality
- [ ] Test error scenarios
- [ ] Performance testing with 2k+ images

### Step 6: Documentation (1 hour)
- [ ] Write README-DOWNLOAD.md
- [ ] Add inline code comments
- [ ] Create usage examples
- [ ] Document troubleshooting

### Step 7: UI Integration (1 hour)
- [ ] Add Export button to Gallery
- [ ] Create instruction modal
- [ ] Add loading states
- [ ] Test user flow

## Phase 5: Advanced Features (Optional)

### 5.1 Incremental Exports
- Track last export date
- Only download new good images since last export
- Merge with existing local collection

### 5.2 Filtering Options
- Export by date range
- Export by level (A1, A2, etc.)
- Export by word categories

### 5.3 Cloud Integration
- Option to upload zip to Google Drive
- Option to upload to Dropbox
- Generate shareable links

## Technical Considerations

### Performance
- API response could be 500KB+ for 2k images
- Consider pagination if over 5k images
- Implement streaming for very large datasets

### Security
- Don't expose Supabase service key
- Use public URLs only (no signed URLs needed)
- Optional: Add user authentication

### Reliability
- Handle Supabase rate limits (100 requests/second)
- Implement circuit breaker for API calls
- Graceful degradation if API is down

## Success Metrics
- [ ] Successfully exports 2000+ images
- [ ] Download completes in under 10 minutes
- [ ] Resume works after interruption
- [ ] Zero data corruption
- [ ] Clear error messages
- [ ] Easy to use for non-technical users

## Timeline
- **Total Estimate:** 12-14 hours
- **Priority Features:** 8-10 hours  
- **Optional Features:** 4-6 hours

## Risks & Mitigations
1. **Risk:** API timeout with large datasets
   - **Mitigation:** Implement response streaming or pagination

2. **Risk:** User's internet connection fails mid-download
   - **Mitigation:** Resume capability with progress tracking

3. **Risk:** Supabase rate limiting
   - **Mitigation:** Respect rate limits, add delays between batches

4. **Risk:** Storage costs for temporary files
   - **Mitigation:** Clean up after successful download