import React, { useState } from 'react';
import { SystemRoles } from 'librechat-data-provider';
import {
  Button,
  OGDialog,
  OGDialogContent,
  OGDialogTitle,
  OGDialogDescription,
  OGDialogTrigger,
} from '@librechat/client';
import { useAuthContext, useLocalize } from '~/hooks';
import Catalog from './Catalog';
import Keys from './Keys';

export default function TenantApi({ tenantId: targetTenant }: { tenantId?: string }) {
  const localize = useLocalize();
  const { user } = useAuthContext();
  const [open, setOpen] = useState(false);
  const tenantId = targetTenant ?? user?.tenantId;
  if (user?.role !== SystemRoles.OWNER && user?.role !== SystemRoles.ADMIN) return null;
  if (!tenantId || tenantId === '__SYSTEM__' || tenantId === 'default') return null;
  if (user.role !== SystemRoles.ADMIN && tenantId !== user.tenantId) return null;

  return (
    <div className="flex items-center justify-between gap-2">
      <span>{localize('com_ui_tenant_api_title')}</span>
      <OGDialog open={open} onOpenChange={setOpen}>
        <OGDialogTrigger asChild>
          <Button type="button" variant="outline">
            {localize('com_ui_manage')}
          </Button>
        </OGDialogTrigger>
        <OGDialogContent className="flex max-h-[90dvh] w-11/12 max-w-4xl flex-col gap-0 overflow-hidden bg-surface-dialog p-0 text-text-primary">
          <header className="shrink-0 space-y-1 border-b border-border-light px-6 py-5 pr-12">
            <OGDialogTitle>{localize('com_ui_tenant_api_title')}</OGDialogTitle>
            <OGDialogDescription className="text-sm text-text-secondary">
              {localize('com_ui_tenant_api_intro')}
            </OGDialogDescription>
            <p className="break-all text-xs text-text-secondary">{tenantId}</p>
          </header>
          {open && (
            <div
              key={tenantId}
              className="min-h-0 space-y-6 overflow-y-auto overscroll-contain p-6"
            >
              <Keys tenantId={tenantId} />
              <Catalog tenantId={tenantId} />
            </div>
          )}
        </OGDialogContent>
      </OGDialog>
    </div>
  );
}
