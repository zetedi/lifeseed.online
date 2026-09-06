
import { useMemo } from 'react';
import { Community } from '../types';
import { defaultConfig } from '../config/default';
import { signupRequiresInvite } from '../domain/communityDoor';
import { normalizeTheme, oldEmeraldEarthTheme } from '../utils/theme';

import { nodeDomains } from '../config/charter';
// Branding/shell identity only. This helper MUST NOT decide data scope or nodehood:
// those come from community.reflectsPublic and config/dataAuthority respectively.
export const isSeedShellHost = (domain?: string) => {
    if (!domain) return true;
    const d = domain.toLowerCase().replace(/^www\./, '');
    return nodeDomains.includes(d) || d === 'localhost' || d === '127.0.0.1' || d.startsWith('192.168.') || d.endsWith('.local');
};

const isPreviousLifeseedDefaultTheme = (theme: Community['theme']) =>
  theme?.primary === '#10b981' &&
  theme?.secondary === '#2563eb' &&
  theme?.accent === '#f59e0b' &&
  theme?.background === '#ffffff' &&
  (theme?.surface === undefined || theme.surface === '#ffffff') &&
  (theme?.text === undefined || theme.text === '#0f172a') &&
  (theme?.mode === undefined || theme.mode === 'light');

// The node's default theme for a domain — lifeseed.online keeps its Emerald Earth look; every other
// domain uses the app default. This is the base a community or profile theme layers over, and the
// target a "reset to default" returns to.
export const nodeDefaultTheme = (domain?: string) => {
  const d = (domain || (typeof window !== 'undefined' ? window.location.hostname : defaultConfig.domain))
    .toLowerCase()
    .replace(/^www\./, '');
  return normalizeTheme(d === 'lifeseed.online' ? oldEmeraldEarthTheme : defaultConfig.theme);
};

export const useConfig = (hostCommunity: Community | null) => {
  return useMemo(() => {
    const hostDomain = (hostCommunity?.domain || (typeof window !== 'undefined' ? window.location.hostname : defaultConfig.domain))
      .toLowerCase()
      .replace(/^www\./, '');
    const domainDefaultTheme = nodeDefaultTheme(hostDomain);

    if (!hostCommunity) {
      return {
        ...defaultConfig,
        name: hostDomain === 'lifeseed.online' ? 'lifeseed' : defaultConfig.name,
        domain: hostDomain || defaultConfig.domain,
        theme: domainDefaultTheme,
      };
    }

    return {
      ...defaultConfig,
      name: hostCommunity.name || defaultConfig.name,
      logoUrl: hostCommunity.logoUrl,
      domain: hostCommunity.domain || defaultConfig.domain,
      // Sign-up on this domain is governed by the node's own door: open = anyone may create an
      // account (identity open, delegated to the keeper); else invitation-gated (the default).
      inviteOnly: signupRequiresInvite(hostCommunity),
      theme: normalizeTheme(
        hostDomain === 'lifeseed.online' && isPreviousLifeseedDefaultTheme(hostCommunity.theme)
          ? undefined
          : hostCommunity.theme,
        domainDefaultTheme as any
      )
    };
  }, [hostCommunity]);
};
