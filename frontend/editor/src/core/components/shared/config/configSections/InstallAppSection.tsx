import React, { useState } from "react";
import { Alert, Button, List, Paper, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import LocalIcon from "@app/components/shared/LocalIcon";
import { usePwaInstall } from "@app/hooks/usePwaInstall";
import { promptInstall } from "@app/utils/pwaInstall";

const isIos = (): boolean =>
  typeof navigator !== "undefined" &&
  /iphone|ipad|ipod/i.test(navigator.userAgent);

const InstallAppSection: React.FC = () => {
  const { t } = useTranslation();
  const { installable, installed } = usePwaInstall();
  const [pending, setPending] = useState(false);

  const handleInstall = async () => {
    setPending(true);
    try {
      await promptInstall();
    } finally {
      setPending(false);
    }
  };

  const intro = (
    <div>
      <Text fw={600} size="sm">
        {t("settings.installApp.title", "Install App")}
      </Text>
      <Text size="xs" c="dimmed" mt={4}>
        {t(
          "settings.installApp.description",
          "Install AziralPDF on this computer to open it from your desktop in its own window.",
        )}
      </Text>
    </div>
  );

  if (installed) {
    return (
      <Stack gap="lg">
        <Paper withBorder p="md" radius="md">
          <Stack gap="md">
            {intro}
            <Alert
              variant="light"
              color="green"
              icon={<LocalIcon icon="check-circle-rounded" width="1.25rem" />}
            >
              {t(
                "settings.installApp.installed",
                "AziralPDF is already installed on this device.",
              )}
            </Alert>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          {intro}

          {installable ? (
            <Button
              variant="filled"
              size="sm"
              loading={pending}
              leftSection={
                <LocalIcon icon="download-rounded" width="1rem" height="1rem" />
              }
              onClick={handleInstall}
              style={{ alignSelf: "flex-start" }}
            >
              {t("settings.installApp.install", "Install on this computer")}
            </Button>
          ) : isIos() ? (
            <div>
              <Text size="sm" mb={6}>
                {t(
                  "settings.installApp.iosHint",
                  "In Safari, add AziralPDF to your Home Screen:",
                )}
              </Text>
              <List size="sm" spacing={4}>
                <List.Item>
                  {t("settings.installApp.iosStep1", "Tap the Share button.")}
                </List.Item>
                <List.Item>
                  {t(
                    "settings.installApp.iosStep2",
                    'Choose "Add to Home Screen".',
                  )}
                </List.Item>
              </List>
            </div>
          ) : (
            <div>
              <Text size="sm" mb={6}>
                {t(
                  "settings.installApp.manualHint",
                  "Your browser does not offer one-click install here. You can still install it manually:",
                )}
              </Text>
              <List size="sm" spacing={4}>
                <List.Item>
                  {t(
                    "settings.installApp.manualStep1",
                    "Open your browser menu (the ⋮ icon, top-right).",
                  )}
                </List.Item>
                <List.Item>
                  {t(
                    "settings.installApp.manualStep2",
                    'Choose "Install AziralPDF" or "Install app".',
                  )}
                </List.Item>
              </List>
            </div>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
};

export default InstallAppSection;
