
import type { LightseedConfig } from '../types/ConfigTypes';

export async function loadConfig(): Promise<LightseedConfig> {
  const url = new URL(window.location.href);
  const configName = url.searchParams.get('config') || 'config.json';
  
  try {
    const res = await fetch(`/${configName}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${configName}`);
    const json = await res.json();
    
    // Set CSS variables
    const root = document.documentElement;
    root.style.setProperty('--accent-color', json.theme.accent);
    
    return json as LightseedConfig;
  } catch (e) {
    console.error("Failed to load config", e);
    // Fallback config to prevent crash
    return {
        appConfig: { type: 'main', title: 'Lifeseed', slug: 'main' },
        theme: { accent: '#6c5ce7', mode: 'light' },
        features: { mastodonBridge: false, map: true, filmstrip: true },
        mainNav: []
    };
  }
}
