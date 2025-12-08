
import React, { createContext, useContext } from "react";
import type { LightseedConfig } from "@/types/ConfigTypes";

const Ctx = createContext<LightseedConfig | null>(null);

export const useConfig = () => {
  const cfg = useContext(Ctx);
  if (!cfg) {
      // Return a safe default if context is missing (rare but prevents crash)
      return {
        appConfig: { type: 'main', title: 'Lifeseed', slug: 'main' },
        theme: { accent: '#6c5ce7', mode: 'light' },
        features: { mastodonBridge: false, map: true, filmstrip: true },
        mainNav: []
      } as LightseedConfig;
  }
  return cfg;
};

export const ConfigProvider: React.FC<{
  cfg: LightseedConfig;
  children: React.ReactNode;
}> = ({ cfg, children }) => <Ctx.Provider value={cfg}>{children}</Ctx.Provider>;
