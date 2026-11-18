import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { dataService, QueryKeys } from 'librechat-data-provider';
import { Button, OGDialog, OGDialogTemplate, useToastContext } from '@librechat/client';
import { useLocalize } from '~/hooks';

type Preview = Awaited<ReturnType<typeof dataService.previewAgentImport>>;

export default function AgentPortability({
  agentId,
  agentName,
  canCreate,
  canExport,
  onImported,
}: {
  agentId?: string;
  agentName?: string | null;
  canCreate: boolean;
  canExport: boolean;
  onImported: (id: string) => void;
}) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<Preview>();
  const [loading, setLoading] = useState(false);
  const localizeWarning = (warning: string) => {
    const reconnect = 'Reconnect tool in destination: ';
    const reuse = 'Reuse unchanged skill in destination: ';
    if (warning.startsWith(reconnect)) {
      return localize('com_agent_import_warning_reconnect', {
        name: warning.slice(reconnect.length),
      });
    }
    if (warning.startsWith(reuse)) {
      return localize('com_agent_import_warning_reuse', { name: warning.slice(reuse.length) });
    }
    if (warning === 'All skills scope uses the destination catalog.') {
      return localize('com_agent_import_warning_all_skills');
    }
    return warning;
  };
  const error = () => showToast({ message: localize('com_ui_error'), status: 'error' });
  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setFile(undefined);
      setPreview(undefined);
    }
  };
  const download = async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const blob = await dataService.exportAgent(agentId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${agentName || 'agent'}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      error();
    } finally {
      setLoading(false);
    }
  };
  const submit = async () => {
    if (!file) return;
    setLoading(true);
    try {
      if (!preview) {
        setPreview(await dataService.previewAgentImport(file));
      } else {
        const agent = await dataService.importAgent(file);
        await queryClient.invalidateQueries([QueryKeys.agents]);
        onImported(agent.id);
        close(false);
        showToast({ message: localize('com_agent_import_success'), status: 'success' });
      }
    } catch {
      error();
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex w-full gap-2">
      {canCreate && (
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          {localize('com_agent_import_zip')}
        </Button>
      )}
      {canExport && agentId && (
        <Button type="button" variant="outline" disabled={loading} onClick={download}>
          {localize('com_agent_export_zip')}
        </Button>
      )}
      <OGDialog open={open} onOpenChange={(next) => !loading && close(next)}>
        <OGDialogTemplate
          title={localize('com_agent_import_zip')}
          main={
            <div className="space-y-3">
              <p>{localize('com_agent_import_notice')}</p>
              <label className="block">
                {localize('com_agent_import_file')}
                <input
                  className="block w-full"
                  type="file"
                  accept=".zip,application/zip"
                  disabled={loading}
                  onChange={(event) => {
                    setFile(event.target.files?.[0]);
                    setPreview(undefined);
                  }}
                />
              </label>
              {preview && (
                <div className="space-y-2">
                  <p className="font-semibold">{preview.name}</p>
                  {(
                    [
                      ['com_agent_import_skills', preview.skills],
                      ['com_agent_import_tools', preview.tools],
                      ['com_agent_import_warnings', preview.warnings],
                    ] as const
                  ).map(([key, items]) => (
                    <div key={key}>
                      <strong>{localize(key)}</strong>
                      <ul className="list-inside list-disc">
                        {items.map((item, index) => (
                          <li key={`${index}-${item}`}>
                            {key === 'com_agent_import_warnings' ? localizeWarning(item) : item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          }
          selection={
            <Button type="button" disabled={!file || loading} onClick={submit}>
              {localize(preview ? 'com_ui_import' : 'com_ui_preview')}
            </Button>
          }
        />
      </OGDialog>
    </div>
  );
}
