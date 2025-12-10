
// This file runs before the app to ensure process.env is set up correctly
declare global {
  interface Window {
    process: any;
  }
  var __STATIC_ENV__: any;
}

if (typeof window !== 'undefined') {
  // Ensure structure exists (redundant with index.html shim but safe)
  window.process = window.process || {};
  window.process.env = window.process.env || {};
  
  // __STATIC_ENV__ is replaced by Vite at build time with the contents of .env
  const staticEnv = (typeof __STATIC_ENV__ !== 'undefined') ? __STATIC_ENV__ : {};
  
  // runtimeEnv might include values injected by host or the HTML shim
  const runtimeEnv = window.process.env;
  
  // Merge: Static envs form the base, runtime envs override them.
  window.process.env = { ...staticEnv, ...runtimeEnv };
}

export {};
