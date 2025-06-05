import path from 'path';

// Base directories
export const CWD = process.cwd();
export const DATA_DIR = path.join(CWD, 'data');
export const PUBLIC_DIR = path.join(CWD, 'public');

// Common file paths
export const GALLERY_JSON_PATH = path.join(DATA_DIR, 'gallery.json');
export const IMAGES_DIR_PATH = path.join(PUBLIC_DIR, 'images');
export const PROMPT_OVERRIDES_YAML_PATH = path.join(CWD, 'prompt_overrides.yaml');
export const DATABASE_FILE_PATH = path.join(DATA_DIR, 'language-cards.db');