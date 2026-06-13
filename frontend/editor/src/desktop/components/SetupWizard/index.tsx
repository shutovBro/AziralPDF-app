import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Stack, Text, Button, Alert, Loader, Center } from "@mantine/core";
import { DesktopAuthLayout } from "@app/components/SetupWizard/DesktopAuthLayout";
import { ServerSelectionScreen } from "@app/components/SetupWizard/ServerSelectionScreen";
import { SelfHostedLoginScreen } from "@app/components/SetupWizard/SelfHostedLoginScreen";
import {
  ServerConfig,
  SSOProviderConfig,
  connectionModeService,
} from "@app/services/connectionModeService";
import {
  AuthServiceError,
  authService,
  UserInfo,
} from "@app/services/authService";
import { tauriBackendService } from "@app/services/tauriBackendService";
import { DESKTOP_DEFAULT_SERVER_URL } from "@app/constants/connection";
import { listen } from "@tauri-apps/api/event";
import "@app/routes/authShared/auth.css";
import { DisabledButtonWithTooltip } from "@app/components/shared/DisabledButtonWithTooltip";

enum SetupStep {
  ServerSelection,
  SelfHostedLogin,
}

interface SetupWizardProps {
  onComplete: () => void;
  /** Omit the DesktopAuthLayout wrapper — use when rendering inside a modal */
  noLayout?: boolean;
  /** Called when the user dismisses the wizard (modal close button) */
  onClose?: (() => void) | undefined;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({
  onComplete,
  noLayout = false,
  onClose: _onClose,
}) => {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState<SetupStep>(
    SetupStep.SelfHostedLogin,
  );
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selfHostedMfaCode, setSelfHostedMfaCode] = useState("");
  const [selfHostedMfaRequired, setSelfHostedMfaRequired] = useState(false);
  const [lockConnectionMode, setLockConnectionMode] = useState(false);
  const [serverUnreachable, setServerUnreachable] = useState(false);
  const [serverChecking, setServerChecking] = useState(true);

  const handleLocalMode = async () => {
    try {
      setLoading(true);
      setError(null);
      // Save the server URL so it pre-fills on reconnect
      if (serverConfig?.url) {
        localStorage.setItem("server_url", serverConfig.url);
      }
      await connectionModeService.switchToLocal();
      tauriBackendService.startBackend().catch(console.error);
      onComplete();
    } catch (err) {
      console.error("Failed to continue in local mode:", err);
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  const handleServerSelection = (config: ServerConfig) => {
    console.log("[SetupWizard] Server selected:", config);
    console.log("[SetupWizard] OAuth providers:", config.enabledOAuthProviders);
    console.log("[SetupWizard] Login method:", config.loginMethod);
    setServerConfig(config);
    setError(null);
    setSelfHostedMfaCode("");
    setSelfHostedMfaRequired(false);
    setServerUnreachable(false);
    setActiveStep(SetupStep.SelfHostedLogin);
  };

  const handleSelfHostedLogin = async (username: string, password: string) => {
    console.log("[SetupWizard] 🔐 Starting self-hosted login");
    console.log(`[SetupWizard] Server: ${serverConfig?.url}`);
    console.log(`[SetupWizard] Username: ${username}`);

    if (!serverConfig) {
      console.error("[SetupWizard] ❌ No server configured");
      setError("No server configured");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log("[SetupWizard] Step 1: Authenticating with server...");
      const trimmedMfa = selfHostedMfaCode.trim();
      const mfaCode = trimmedMfa ? trimmedMfa : undefined;
      await authService.login(serverConfig.url, username, password, mfaCode);
      console.log("[SetupWizard] ✅ Authentication successful");

      setSelfHostedMfaRequired(false);
      setSelfHostedMfaCode("");

      console.log("[SetupWizard] Step 2: Switching to self-hosted mode...");
      await connectionModeService.switchToSelfHosted(serverConfig);
      console.log("[SetupWizard] ✅ Switched to self-hosted mode");

      console.log("[SetupWizard] Step 3: Initializing external backend...");
      await tauriBackendService.initializeExternalBackend();
      console.log("[SetupWizard] ✅ External backend initialized");

      console.log("[SetupWizard] ✅ Setup complete, calling onComplete()");
      onComplete();
    } catch (err) {
      console.error("[SetupWizard] ❌ Self-hosted login failed:", err);
      let errorMessage = "Self-hosted login failed";
      if (err instanceof AuthServiceError) {
        if (err.code === "mfa_required" || err.code === "invalid_mfa_code") {
          setSelfHostedMfaRequired(true);
        }
        errorMessage = err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "string") {
        errorMessage = err;
      }
      if (
        errorMessage.toLowerCase().includes("mfa_required") ||
        errorMessage.toLowerCase().includes("invalid_mfa_code")
      ) {
        setSelfHostedMfaRequired(true);
      }
      console.error("[SetupWizard] Error message:", errorMessage);
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleSelfHostedOAuthSuccess = async (_userInfo: UserInfo) => {
    console.log("[SetupWizard] 🔐 OAuth login successful, completing setup");
    console.log(`[SetupWizard] Server: ${serverConfig?.url}`);

    if (!serverConfig) {
      console.error("[SetupWizard] ❌ No server configured");
      setError("No server configured");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log("[SetupWizard] Step 1: OAuth already completed");
      console.log("[SetupWizard] Step 2: Switching to self-hosted mode...");
      await connectionModeService.switchToSelfHosted(serverConfig);
      console.log("[SetupWizard] ✅ Switched to self-hosted mode");

      console.log("[SetupWizard] Step 3: Initializing external backend...");
      await tauriBackendService.initializeExternalBackend();
      console.log("[SetupWizard] ✅ External backend initialized");

      console.log("[SetupWizard] ✅ Setup complete, calling onComplete()");
      onComplete();
    } catch (err) {
      console.error(
        "[SetupWizard] ❌ Self-hosted OAuth login completion failed:",
        err,
      );
      const errorMessage =
        err instanceof Error ? err.message : "Failed to complete login";
      console.error("[SetupWizard] Error message:", errorMessage);
      setError(errorMessage);
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribePromise = listen<string>("deep-link", async (event) => {
      const url = event.payload;
      if (!url) return;

      try {
        const parsed = new URL(url);

        // Tokens arrive in the URL hash
        const hash = parsed.hash.replace(/^#/, "");
        const params = new URLSearchParams(hash);
        const type = params.get("type") || parsed.searchParams.get("type");
        // Self-hosted SSO deep links are normally handled by authService.loginWithSelfHostedOAuth.
        // Fallback here only if no in-flight auth listener exists (e.g. renderer reload mid-flow).
        if (type !== "sso" && type !== "sso-selfhosted") {
          return;
        }

        if (authService.isSelfHostedDeepLinkFlowActive()) {
          return;
        }

        const accessTokenFromHash = params.get("access_token");
        const accessTokenFromQuery = parsed.searchParams.get("access_token");
        const serverFromQuery = parsed.searchParams.get("server");
        const token = accessTokenFromHash || accessTokenFromQuery;
        const serverUrl =
          serverFromQuery || serverConfig?.url || DESKTOP_DEFAULT_SERVER_URL;
        if (!token || !serverUrl) {
          console.error(
            "[SetupWizard] Deep link missing token or server for SSO completion",
          );
          return;
        }

        setLoading(true);
        setError(null);

        await authService.completeSelfHostedSession(serverUrl, token);
        await connectionModeService.switchToSelfHosted({ url: serverUrl });
        await tauriBackendService.initializeExternalBackend();
        onComplete();
      } catch (err) {
        console.error("[SetupWizard] Failed to handle deep link", err);
        setError(
          err instanceof Error ? err.message : "Failed to complete sign-in",
        );
        setLoading(false);
      }
    });

    return () => {
      void unsubscribePromise.then((unsub) => unsub());
    };
  }, [onComplete, serverConfig?.url]);

  /**
   * Probe a server's login endpoint to discover SSO providers and the login
   * method, then land on the login screen for it. Network failure shows the
   * unreachable screen with retry / change-server / local fallbacks.
   */
  const loadServerConfig = useCallback(async (serverUrl: string) => {
    setServerChecking(true);
    setServerUnreachable(false);

    const savedUrl = serverUrl.replace(/\/+$/, "");
    let updatedConfig: ServerConfig = { url: savedUrl };

    try {
      const response = await fetch(
        `${savedUrl}/api/v1/proprietary/ui-data/login`,
      );

      if (response.ok) {
        const data = await response.json();
        const enabledProviders: SSOProviderConfig[] = [];
        const providerEntries = Object.entries(data.providerList || {});

        providerEntries.forEach(([path, label]) => {
          const id = path.split("/").pop();
          if (id) {
            enabledProviders.push({
              id,
              path,
              label: typeof label === "string" ? label : undefined,
            });
          }
        });

        updatedConfig = {
          ...updatedConfig,
          enabledOAuthProviders:
            enabledProviders.length > 0 ? enabledProviders : undefined,
          loginMethod: data.loginMethod || "all",
        };

        setServerConfig(updatedConfig);
        setServerChecking(false);
        setActiveStep(SetupStep.SelfHostedLogin);
      } else {
        // Server responded but with an error — still show login form
        updatedConfig = { ...updatedConfig, loginMethod: "all" };
        setServerConfig(updatedConfig);
        setServerChecking(false);
        setActiveStep(SetupStep.SelfHostedLogin);
      }
    } catch (err) {
      // Network error — server is unreachable
      console.error("[SetupWizard] Server unreachable:", err);
      setServerConfig(updatedConfig);
      setServerChecking(false);
      setServerUnreachable(true);
      setActiveStep(SetupStep.SelfHostedLogin);
    }
  }, []);

  /**
   * Initial flow: a provisioned (MDM-locked) server wins; otherwise start at
   * the login screen of the default server.
   */
  const loadInitialConfig = useCallback(async () => {
    const currentConfig = await connectionModeService.getCurrentConfig();
    const lockedUrl = currentConfig.lock_connection_mode
      ? currentConfig.server_config?.url
      : undefined;

    if (lockedUrl) {
      setLockConnectionMode(true);
      await loadServerConfig(lockedUrl);
      return;
    }

    await loadServerConfig(DESKTOP_DEFAULT_SERVER_URL);
  }, [loadServerConfig]);

  useEffect(() => {
    void loadInitialConfig();
  }, [loadInitialConfig]);

  const handleBack = () => {
    if (lockConnectionMode) {
      return;
    }
    setError(null);
    if (activeStep === SetupStep.SelfHostedLogin) {
      setSelfHostedMfaCode("");
      setSelfHostedMfaRequired(false);
      setActiveStep(SetupStep.ServerSelection);
    } else if (activeStep === SetupStep.ServerSelection) {
      // Back from manual server entry returns to the default server's login
      void loadServerConfig(DESKTOP_DEFAULT_SERVER_URL);
    }
  };

  const wizardContent = (
    <>
      {/* Step Content */}
      {!lockConnectionMode && activeStep === SetupStep.ServerSelection && (
        <ServerSelectionScreen
          onSelect={handleServerSelection}
          loading={loading}
          error={error}
        />
      )}

      {serverChecking && activeStep === SetupStep.SelfHostedLogin && (
        <Center py="xl">
          <Loader size="md" />
        </Center>
      )}

      {activeStep === SetupStep.SelfHostedLogin &&
        serverUnreachable &&
        !serverChecking && (
          <Stack gap="md" style={{ padding: "0.5rem 0" }}>
            <Alert
              color="orange"
              title={t(
                "setup.selfhosted.unreachable.title",
                "Cannot connect to server",
              )}
            >
              <Text size="sm">
                {t(
                  "setup.selfhosted.unreachable.message",
                  "Could not reach {{url}}. Check that the server is running and accessible.",
                  {
                    url: serverConfig?.url,
                  },
                )}
              </Text>
            </Alert>
            <Button
              variant="filled"
              color="blue"
              fullWidth
              loading={loading}
              onClick={() => {
                if (serverConfig?.url) {
                  void loadServerConfig(serverConfig.url);
                }
              }}
            >
              {t("setup.selfhosted.unreachable.retry", "Retry")}
            </Button>
            {lockConnectionMode ? (
              <DisabledButtonWithTooltip
                tooltip={t(
                  "setup.selfhosted.changeServerLocked",
                  "Your organisation has restricted this app to a specific server",
                )}
              >
                {t(
                  "setup.selfhosted.unreachable.changeServer",
                  "Connect to a different server",
                )}
              </DisabledButtonWithTooltip>
            ) : (
              <Button
                variant="light"
                color="blue"
                fullWidth
                loading={loading}
                onClick={() => {
                  setServerUnreachable(false);
                  setActiveStep(SetupStep.ServerSelection);
                }}
              >
                {t(
                  "setup.selfhosted.unreachable.changeServer",
                  "Connect to a different server",
                )}
              </Button>
            )}
            <Button
              variant="subtle"
              color="white"
              fullWidth
              onClick={handleLocalMode}
            >
              {t(
                "setup.selfhosted.unreachable.continueOffline",
                "Use local tools instead",
              )}
            </Button>
          </Stack>
        )}

      {activeStep === SetupStep.SelfHostedLogin &&
        !serverUnreachable &&
        !serverChecking && (
          <>
            <SelfHostedLoginScreen
              serverUrl={serverConfig?.url || ""}
              enabledOAuthProviders={serverConfig?.enabledOAuthProviders}
              loginMethod={serverConfig?.loginMethod}
              onLogin={handleSelfHostedLogin}
              onOAuthSuccess={handleSelfHostedOAuthSuccess}
              mfaCode={selfHostedMfaCode}
              setMfaCode={setSelfHostedMfaCode}
              requiresMfa={selfHostedMfaRequired}
              loading={loading}
              error={error}
            />
            <div
              className="navigation-link-container"
              style={{ marginTop: "1.5rem" }}
            >
              {!lockConnectionMode && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="navigation-link-button"
                  disabled={loading}
                >
                  {t(
                    "setup.selfhosted.unreachable.changeServer",
                    "Connect to a different server",
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={handleLocalMode}
                className="navigation-link-button"
                disabled={loading}
              >
                {t("setup.selfhosted.switchToLocal", "Use local tools instead")}
              </button>
            </div>
          </>
        )}

      {/* Back Button */}
      {!lockConnectionMode &&
        activeStep === SetupStep.ServerSelection &&
        !loading && (
          <div
            className="navigation-link-container"
            style={{ marginTop: "1.5rem" }}
          >
            <button
              type="button"
              onClick={handleBack}
              className="navigation-link-button"
            >
              {t("common.back", "Back")}
            </button>
          </div>
        )}
    </>
  );

  if (noLayout) {
    return <div style={{ padding: "2rem" }}>{wizardContent}</div>;
  }

  return <DesktopAuthLayout>{wizardContent}</DesktopAuthLayout>;
};
