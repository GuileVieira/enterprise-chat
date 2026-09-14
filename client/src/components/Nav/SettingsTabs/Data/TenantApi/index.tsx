import React, { useState } from 'react';
import { SystemRoles } from 'librechat-data-provider';
import {
  Button,
  OGDialog,
  OGDialogContent,
  OGDialogTitle,
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
        <OGDialogContent className="max-h-[85vh] w-11/12 max-w-3xl overflow-y-auto bg-background text-text-primary">
          <OGDialogTitle>{localize('com_ui_tenant_api_title')}</OGDialogTitle>
          <p className="break-all text-sm text-text-secondary">{tenantId}</p>
          {open && (
            <div key={tenantId} className="space-y-5">
              <Keys tenantId={tenantId} />
              <Catalog tenantId={tenantId} />
            </div>
          )}
        </OGDialogContent>
      </OGDialog>
    </div>
  );
}
