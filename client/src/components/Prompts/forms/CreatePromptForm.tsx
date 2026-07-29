import { useEffect, useState } from 'react';
import { Buildings, FileText, Plus, X } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { Button, TextareaAutosize, Input } from '@librechat/client';
import { useForm, Controller, FormProvider } from 'react-hook-form';
import {
  SystemRoles,
  Permissions,
  LocalStorageKeys,
  PermissionTypes,
} from 'librechat-data-provider';
import OpenSidebar from '~/components/Chat/Menus/OpenSidebar';
import CategorySelector from '../fields/CategorySelector';
import VariablesDropdown from '../editor/VariablesDropdown';
import PromptVariables from '../display/PromptVariables';
import Description from '../fields/Description';
import { usePromptGroupsContext } from '~/Providers';
import { useLocalize, useHasAccess, useAuthContext } from '~/hooks';
import Command from '../fields/Command';
import { useCreatePrompt } from '~/data-provider';
import { useListAdminTenants } from '~/data-provider/admin';
import { cn } from '~/utils';

type CreateFormValues = {
  name: string;
  prompt: string;
  type: 'text' | 'chat';
  category: string;
  oneliner?: string;
  command?: string;
};

const defaultPrompt: CreateFormValues = {
  name: '',
  prompt: '',
  type: 'text',
  category: '',
  oneliner: undefined,
  command: undefined,
};

const CreatePromptForm = ({
  defaultValues = defaultPrompt,
  onSuccess,
}: {
  defaultValues?: CreateFormValues;
  onSuccess?: (groupId: string) => void;
}) => {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const isAdmin = user?.role === SystemRoles.ADMIN;
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [tenantToAdd, setTenantToAdd] = useState('');
  const { hasAccess: hasUseAccess } = usePromptGroupsContext() ?? {};
  const hasCreateAccess = useHasAccess({
    permissionType: PermissionTypes.PROMPTS,
    permission: Permissions.CREATE,
  });
  const hasAccess = hasUseAccess && hasCreateAccess;

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (!hasAccess && !onSuccess) {
      timeoutId = setTimeout(() => {
        navigate('/c/new');
      }, 1000);
    }
    return () => {
      clearTimeout(timeoutId);
    };
  }, [hasAccess, navigate, onSuccess]);

  const methods = useForm({
    defaultValues: {
      ...defaultValues,
      category: localStorage.getItem(LocalStorageKeys.LAST_PROMPT_CATEGORY) ?? '',
    },
  });

  const {
    watch,
    control,
    handleSubmit,
    formState: { isDirty, isSubmitting, errors, isValid },
  } = methods;
  const { data: tenantsData } = useListAdminTenants({ enabled: isAdmin && hasAccess });

  const createPromptMutation = useCreatePrompt({
    onSuccess: (response) => {
      const groupId = response.prompt.groupId;
      if (onSuccess && groupId) {
        onSuccess(groupId);
      } else {
        navigate(`/prompts/${groupId}`, { replace: true });
      }
    },
  });

  const promptText = watch('prompt');
  const availableTenants =
    tenantsData?.tenants.filter((tenant) => !selectedTenantIds.includes(tenant.id)) ?? [];

  const onSubmit = (data: CreateFormValues) => {
    const { name, category, oneliner, command, ...rest } = data;
    const groupData = { name, category } as Pick<
      CreateFormValues,
      'name' | 'category' | 'oneliner' | 'command'
    >;
    if ((oneliner?.length ?? 0) > 0) {
      groupData.oneliner = oneliner;
    }
    if ((command?.length ?? 0) > 0) {
      groupData.command = command;
    }
    createPromptMutation.mutate({
      prompt: rest,
      group: groupData,
      ...(isAdmin && selectedTenantIds.length > 0 ? { shareTenantIds: selectedTenantIds } : {}),
    });
  };

  if (!hasAccess) {
    return null;
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="w-full px-4 py-2">
        <h1 className="sr-only">{localize('com_ui_create_prompt_page')}</h1>
        <div className="mb-2 flex items-center justify-between gap-2 sm:hidden">
          <OpenSidebar />
          <CategorySelector />
        </div>
        <div className="mb-1 flex flex-col items-center justify-between font-bold sm:text-xl md:mb-0 md:text-2xl">
          <div className="flex w-full flex-col items-center justify-between sm:flex-row">
            <Controller
              name="name"
              control={control}
              rules={{ required: localize('com_ui_prompt_name_required') }}
              render={({ field }) => (
                <div className="relative mb-1 flex w-full flex-col sm:w-auto md:mb-0">
                  <Input
                    {...field}
                    id="prompt-name"
                    type="text"
                    className="peer mr-2 w-full border border-border-medium p-2 text-2xl text-text-primary"
                    placeholder=" "
                    tabIndex={0}
                    aria-label={localize('com_ui_prompt_name')}
                    aria-required="true"
                  />
                  <label
                    htmlFor="prompt-name"
                    className="pointer-events-none absolute -top-1 left-3 origin-[0] translate-y-3 scale-100 rounded bg-presentation px-1 text-base text-text-secondary transition-transform duration-200 peer-placeholder-shown:translate-y-3 peer-placeholder-shown:scale-100 peer-focus:-translate-y-2 peer-focus:scale-75 peer-focus:text-text-primary peer-[:not(:placeholder-shown)]:-translate-y-2 peer-[:not(:placeholder-shown)]:scale-75"
                  >
                    {localize('com_ui_prompt_name')}*
                  </label>
                  <div
                    className={cn(
                      'mt-1 w-56 text-sm text-red-500',
                      errors.name ? 'visible h-auto' : 'invisible h-0',
                    )}
                  >
                    {errors.name ? errors.name.message : ' '}
                  </div>
                </div>
              )}
            />
            <div className="hidden sm:block">
              <CategorySelector />
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col gap-4 md:mt-[1.075rem]">
          <div className="flex flex-col">
            <header className="flex items-center justify-between rounded-t-xl border border-border-medium bg-transparent p-2">
              <div className="ml-1 flex items-center gap-2">
                <FileText className="size-4 text-text-secondary" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-text-primary">
                  {localize('com_ui_prompt_text')}*
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <VariablesDropdown fieldName="prompt" />
              </div>
            </header>
            <div className="min-h-32 rounded-b-xl border border-t-0 border-border-medium p-3 sm:p-4">
              <Controller
                name="prompt"
                control={control}
                rules={{ required: localize('com_ui_prompt_text_required') }}
                render={({ field }) => (
                  <div>
                    <TextareaAutosize
                      {...field}
                      className="w-full resize-none overflow-y-auto bg-transparent font-mono text-sm leading-relaxed text-text-primary placeholder:text-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary sm:text-base"
                      minRows={4}
                      maxRows={16}
                      tabIndex={0}
                      placeholder={localize('com_ui_prompt_input')}
                      aria-label={localize('com_ui_prompt_input_field')}
                      aria-required="true"
                    />
                    <div
                      className={cn(
                        'mt-1 text-sm text-red-500',
                        errors.prompt ? 'visible h-auto' : 'invisible h-0',
                      )}
                    >
                      {errors.prompt ? errors.prompt.message : ' '}
                    </div>
                  </div>
                )}
              />
            </div>
          </div>
          <PromptVariables promptText={promptText} />
          <Description
            onValueChange={(value) => methods.setValue('oneliner', value)}
            tabIndex={0}
          />
          <Command onValueChange={(value) => methods.setValue('command', value)} tabIndex={0} />
          {isAdmin && (tenantsData?.tenants?.length ?? 0) > 0 && (
            <div className="bg-surface-secondary/40 rounded-lg border border-border-light p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <Buildings className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-text-primary">
                    {localize('com_ui_share_with_tenants')}
                  </h2>
                </div>
                <div className="flex min-w-0 gap-2 sm:w-[28rem]">
                  <select
                    className="focus:ring-ring-primary/20 h-10 min-w-0 flex-1 rounded-md border border-border-medium bg-surface-primary px-3 text-sm text-text-primary outline-none transition-colors hover:border-border-xheavy focus:border-border-xheavy focus:ring-2"
                    value={tenantToAdd}
                    onChange={(event) => setTenantToAdd(event.target.value)}
                    aria-label={localize('com_ui_select_tenant')}
                  >
                    <option value="">{localize('com_ui_select_tenant')}</option>
                    {availableTenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.id}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    type="button"
                    className="h-10 shrink-0 gap-1.5"
                    disabled={!tenantToAdd}
                    onClick={() => {
                      if (!tenantToAdd) {
                        return;
                      }
                      setSelectedTenantIds((current) => [...current, tenantToAdd]);
                      setTenantToAdd('');
                    }}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    {localize('com_ui_add')}
                  </Button>
                </div>
              </div>
              {selectedTenantIds.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedTenantIds.map((tenantId) => (
                    <span
                      key={tenantId}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border-light bg-surface-primary px-2.5 py-1.5 text-sm font-medium text-text-primary"
                    >
                      <span className="max-w-56 truncate">{tenantId}</span>
                      <button
                        type="button"
                        className="focus:ring-ring-primary/30 rounded-sm text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus:ring-2"
                        aria-label={localize('com_ui_remove_user', { 0: tenantId })}
                        onClick={() =>
                          setSelectedTenantIds((current) =>
                            current.filter((selectedTenantId) => selectedTenantId !== tenantId),
                          )
                        }
                      >
                        <X className="size-3.5" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button
              aria-label={localize('com_ui_create_prompt')}
              className={cn(
                'w-full sm:w-auto',
                (!isDirty || isSubmitting || !isValid) && 'opacity-50',
              )}
              tabIndex={0}
              type="submit"
              aria-disabled={!isDirty || isSubmitting || !isValid || undefined}
              onClick={(e: React.MouseEvent) => {
                if (!isDirty || isSubmitting || !isValid) {
                  e.preventDefault();
                }
              }}
            >
              {localize('com_ui_create_prompt')}
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
};

export default CreatePromptForm;
