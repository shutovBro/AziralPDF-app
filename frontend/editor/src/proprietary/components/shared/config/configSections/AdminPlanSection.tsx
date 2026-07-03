import React from "react";
import { Anchor, Group, Paper, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import LocalIcon from "@app/components/shared/LocalIcon";

/**
 * AziralPDF — Plan section.
 *
 * The upstream Stirling-PDF pricing/upgrade storefront (Free/Server/Enterprise
 * cards, Stripe checkout, "self-hosted user limit reached" warnings, license
 * keys) has been removed. AziralPDF is sold as a hosted SaaS with its own
 * tariffs (published on the AziralPDF website; see PRICING.md). The free-tier
 * seat cap was already lifted in the backend.
 *
 * This lightweight placeholder keeps the /settings/adminPlan route harmless for
 * any lingering "upgrade" links elsewhere in the UI: instead of the upstream
 * storefront (or a blank panel) they land on a neutral AziralPDF notice.
 */
const AdminPlanSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Stack gap="lg">
      <Paper withBorder p="lg" radius="md">
        <Group gap="sm" align="center" mb="xs">
          <LocalIcon icon="star-rounded" width="1.25rem" height="1.25rem" />
          <Text fw={600} size="md">
            AziralPDF
          </Text>
        </Group>
        <Text size="sm" c="dimmed">
          {t(
            "plan.aziral.notice",
            "You are using AziralPDF. Subscription plans and billing are managed on the AziralPDF website. For team and business subscriptions (incl. invoicing for companies) contact us.",
          )}
        </Text>
        <Group gap="lg" mt="md">
          <Anchor href="mailto:sales@aziral.com" size="sm">
            sales@aziral.com
          </Anchor>
          <Anchor href="https://pdf.aziral.com" target="_blank" size="sm">
            pdf.aziral.com
          </Anchor>
        </Group>
      </Paper>
    </Stack>
  );
};

export default AdminPlanSection;
