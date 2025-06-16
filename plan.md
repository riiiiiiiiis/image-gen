# Simple One-Time Export Plan: Good Images

## Overview
Since this is a one-time export task, we should use the simplest possible approach:
**A single Node.js script that directly queries the database and downloads images.**

## Why This is Better
1. **No API needed** - Script connects directly to Supabase
2. **No UI integration** - Just run the script once
3. **No caching/rate limiting** - Not a production feature
4. **No complex architecture** - Keep it simple

## Single Script Approach

### File: `scripts/export-good-images.js`

**What it does:**
1. Connect directly to Supabase using the service role key
2. Query for all `qa_score = 'good'` entries with `image_url`
3. Download images to local folder with meaningful names

**Directory structure:**
```
good-images-export/
├── images/
│   ├── 001-apple-яблоко.png
│   ├── 002-cat-кот.png
│   └── ...
```

**Dependencies:**
- `@supabase/supabase-js` (already in project)
- `node-fetch` for downloads
- Built-in `fs` and `path` modules

## Implementation Steps (2-3 hours total)

### Step 1: Create the script (1 hour)
- [ ] Create `scripts/export-good-images.js`
- [ ] Add Supabase connection using existing env vars
- [ ] Query database for good images
- [ ] Basic download logic

### Step 2: Add download features (1 hour)
- [ ] Parallel downloads (5 at a time)
- [ ] Progress logging to console
- [ ] Error handling for failed downloads

### Step 3: Test and run (30 min)
- [ ] Test with 10 images first
- [ ] Run full export
- [ ] Verify all images downloaded correctly

## Script Usage
```bash
cd scripts
node export-good-images.js
```

## What You Get
- All good images in `good-images-export/images/` folder
- Files named: `{id}.png`
- Console output showing progress

## No Additional Features Needed
- No resume capability (if it fails, just run again - it's fast)
- No zip creation (you can zip the folder manually if needed)
- No UI integration (one-time task)
- No rate limiting (direct DB access)
- No authentication (script runs locally with your keys)

## Why This is Much Better
1. **2-3 hours vs 12-14 hours** - 75% time savings
2. **Single file vs multiple files** - Much simpler
3. **No production code** - Won't affect the main app
4. **Direct and reliable** - No API layer to fail
5. **Perfect for one-time use** - Exactly what you need