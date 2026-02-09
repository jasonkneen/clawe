"use client";

import {
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
} from "@dashboard/page-header";
import { TelegramIntegrationCard } from "./_components/telegram-integration-card";

const IntegrationsSettingsPage = () => {
  return (
    <>
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle>Integrations</PageHeaderTitle>
        </PageHeaderRow>
      </PageHeader>

      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Connect your tools and communication channels.
        </p>
        <div className="flex flex-wrap gap-4">
          <TelegramIntegrationCard />
        </div>
      </div>
    </>
  );
};

export default IntegrationsSettingsPage;
