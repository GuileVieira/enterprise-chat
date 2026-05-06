import React from 'react';
import { Controller } from 'react-hook-form';
import { Wrench } from '@phosphor-icons/react';
import { useTenantFunctionsQuery } from '~/data-provider';
import type { Control } from 'react-hook-form';
import type { AgentForm } from '~/common';

interface TenantFunctionsSectionProps {
  agentId: string | null | undefined;
  tools: Array<string | { type: string }> | undefined;
  control: Control<AgentForm>;
}

const TenantFunctionsSection: React.FC<TenantFunctionsSectionProps> = ({ tools, control }) => {
  const { data, isLoading } = useTenantFunctionsQuery();
  const functions = data?.functions ?? [];

  const toolSet = new Set((tools ?? []).map((t) => (typeof t === 'string' ? t : '')));

  if (isLoading || functions.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <label className="text-token-text-primary mb-2 block text-sm font-medium">
        Tenant Functions
      </label>
      <div className="space-y-2">
        {functions.map((fn) => {
          const isSelected = toolSet.has(fn.id);
          return (
            <Controller
              key={fn.id}
              name="tools"
              control={control}
              render={({ field }) => {
                const current = (field.value ?? []) as string[];
                return (
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border-light bg-surface-secondary px-3 py-2 transition-colors hover:bg-surface-tertiary">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          field.onChange([...current, fn.id]);
                        } else {
                          field.onChange(current.filter((t) => t !== fn.id));
                        }
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-border-medium text-green-500 focus:ring-green-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-text-primary">{fn.name}</div>
                        {fn.hasAuth && (
                          <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            Secure
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-tertiary">{fn.description}</div>
                    </div>
                    <Wrench className="h-4 w-4 text-text-tertiary" />
                  </label>
                );
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default TenantFunctionsSection;
