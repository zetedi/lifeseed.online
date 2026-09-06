import { AppConfig } from './types';
import { charter } from './charter';

export const defaultConfig: AppConfig = {
  name: charter.shortName,
  logo: {
    backgroundFill: 'white',
    strokeColor: '#334155',
    seedFill: 'white',
  },
  theme: {
    primary: '#059669', // emerald-600
    secondary: '#0284c7', // sky-600
    accent: '#f59e0b', // amber-500
    neutral: '#334155', // slate-700
    background: '#ffffff',
    mode: 'light',
    surface: '#ffffff',
    text: '#0f172a',
  },
  domain: charter.domain,
  model: 'gemini-3.5-flash',
  githubActionsEnabled: false,
  // Identity is open (root: "Identity is open"): anyone may create an account. A node closes its
  // door to gate sign-up on its own domain; the fallback (no host community) stays open.
  inviteOnly: false,
};
