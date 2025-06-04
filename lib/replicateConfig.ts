// Centralized Replicate configuration - single source of truth
export const REPLICATE_CONFIG = {
  model: "fofr/sdxl-emoji:dee76b5afde21b0f01ed7925f0665b7e879c50ee718c5f78a9d38e04d523cc5e",
  
  // Image generation parameters
  input: {
    negative_prompt: "black skin, dark skin",
    width: 1152,
    height: 896,
    num_outputs: 1,
    num_inference_steps: 50,
    guidance_scale: 7.5,
    scheduler: "K_EULER" as const,
    lora_scale: 0.6,
    refine: "no_refiner" as const,
    apply_watermark: false,
    high_noise_frac: 0.8,
    prompt_strength: 0.8,
    disable_safety_checker: true,
  }
} as const;

// Function to create input with prompt
export function createReplicateInput(prompt: string) {
  return {
    ...REPLICATE_CONFIG.input,
    prompt: `A TOK emoji of ${prompt}`,
  };
}

// Function to get model identifier
export function getReplicateModel() {
  return REPLICATE_CONFIG.model;
}