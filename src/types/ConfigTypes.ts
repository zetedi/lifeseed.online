
import { z } from 'zod';

// We removed zod dependency to cleanup, so defining simple interface
export interface LightseedConfig {
  appConfig: {
    type: string;
    title: string;
    slug: string;
    imageGlob?: string;
  };
  theme: {
    accent: string;
    mode: 'light' | 'dark';
    logo?: string;
    backgroundImage?: string;
  };
  features: {
    mastodonBridge: boolean;
    map: boolean;
    filmstrip: boolean;
  };
  mainNav: Array<{
    title: string;
    href: string;
    disabled?: boolean;
  }>;
}
