import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

interface PromptOverrides {
  [key: string]: string;
}

let cachedOverrides: PromptOverrides | null = null;
let lastModified: number = 0;

const OVERRIDES_FILE_PATH = path.join(process.cwd(), 'prompt_overrides.yaml');

function loadOverrides(): PromptOverrides {
  try {
    // Check if file exists
    if (!fs.existsSync(OVERRIDES_FILE_PATH)) {
      console.log('No prompt_overrides.yaml file found, using default behavior');
      return {};
    }

    // Check if we need to reload (file modified)
    const stats = fs.statSync(OVERRIDES_FILE_PATH);
    const currentModified = stats.mtime.getTime();

    if (cachedOverrides && currentModified === lastModified) {
      return cachedOverrides;
    }

    // Load and parse YAML file
    const fileContents = fs.readFileSync(OVERRIDES_FILE_PATH, 'utf8');
    const overrides = yaml.load(fileContents) as PromptOverrides;

    // Update cache
    cachedOverrides = overrides || {};
    lastModified = currentModified;

    console.log(`Loaded ${Object.keys(cachedOverrides).length} prompt overrides from YAML`);
    return cachedOverrides;

  } catch (error) {
    console.error('Error loading prompt overrides:', error);
    return {};
  }
}

export function getPromptOverride(word: string): string | null {
  const overrides = loadOverrides();
  const normalizedWord = word.toLowerCase().trim();
  
  return overrides[normalizedWord] || null;
}

export function hasPromptOverride(word: string): boolean {
  return getPromptOverride(word) !== null;
}