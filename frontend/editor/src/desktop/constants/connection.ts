/**
 * Connection-related constants for desktop app
 */

// Default self-hosted server offered on first launch / sign-in
export const DESKTOP_DEFAULT_SERVER_URL: string = import.meta.env
  .VITE_DESKTOP_DEFAULT_SERVER_URL;

// SaaS authentication server URL
export const STIRLING_SAAS_URL: string = import.meta.env.VITE_SAAS_SERVER_URL;

// Stirling SaaS backend API server (for team endpoints, etc.)
export const STIRLING_SAAS_BACKEND_API_URL: string = import.meta.env
  .VITE_SAAS_BACKEND_API_URL;

// Supabase publishable key — used for SaaS authentication
export const SUPABASE_KEY: string = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

// Desktop deep link callback for Supabase email confirmations.
// Scheme must match plugins.deep-link.desktop.schemes in tauri.conf.json.
export const DESKTOP_DEEP_LINK_CALLBACK = "aziralpdf://auth/callback";
