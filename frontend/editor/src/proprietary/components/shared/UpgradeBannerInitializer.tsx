import { useEffect } from "react";
import { useBanner } from "@app/contexts/BannerContext";

// AziralPDF: Stirling Open-Core upsell banner permanently hidden.
// Original UpgradeBanner component preserved in repo but no longer mounted.
export function UpgradeBannerInitializer() {
  const { setBanner } = useBanner();

  useEffect(() => {
    setBanner(null);
  }, [setBanner]);

  return null;
}
