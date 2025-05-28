'use client';

import { activityManager } from './ActivityLog';

export default function DemoButton() {
  const runDemo = () => {
    // Simulate various activities
    activityManager.addActivity('info', 'Starting demo sequence...');
    
    setTimeout(() => {
      activityManager.addActivity('loading', 'Generating prompt for "genius"');
    }, 500);
    
    setTimeout(() => {
      activityManager.addActivity('success', 'Generated prompt for "genius"');
    }, 2000);
    
    setTimeout(() => {
      activityManager.addActivity('loading', 'Queuing image generation for "genius"');
    }, 2500);
    
    setTimeout(() => {
      activityManager.addActivity('error', 'Failed to generate image', 'Invalid API key. Please check your REPLICATE_API_TOKEN in .env.local');
    }, 4000);
  };

  return (
    <button
      onClick={runDemo}
      className="btn-secondary"
    >
      Demo Activity Log
    </button>
  );
}