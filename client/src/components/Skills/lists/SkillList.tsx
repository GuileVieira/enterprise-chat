import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { dataService } from 'librechat-data-provider';
import { ChevronRight, Download, LoaderCircle } from 'lucide-react';
import { Skeleton, TooltipAnchor, useToastContext } from '@librechat/client';
import type { TSkillSummary } from 'librechat-data-provider';
import SkillListItem from './SkillListItem';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface SkillListProps {
  skills: TSkillSummary[];
  isLoading?: boolean;
  activeSkillId?: string;
  sectionOpen?: boolean;
  onSectionOpenChange?: (open: boolean) => void;
}

/** Collapsible skill list. Active/inactive toggling lives in the detail view. */
export default function SkillList({
  skills,
  isLoading = false,
  activeSkillId,
  sectionOpen: controlledSectionOpen,
  onSectionOpenChange,
}: SkillListProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const [searchParams] = useSearchParams();
  const activeFile = searchParams.get('file');
  const [internalSectionOpen, setInternalSectionOpen] = useState(true);
  const sectionOpen = controlledSectionOpen ?? internalSectionOpen;
  const setSectionOpen = (open: boolean) => {
    setInternalSectionOpen(open);
    onSectionOpenChange?.(open);
  };
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(activeSkillId ?? null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const allSelected = skills.length > 0 && skills.every(({ _id }) => selectedIds.has(_id));

  const toggleSelected = (skillId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(skills.map(({ _id }) => _id)));
  };

  const exportSelected = async () => {
    if (selectedIds.size === 0 || exporting) {
      return;
    }
    setExporting(true);
    try {
      const response = await dataService.exportSkills([...selectedIds]);
      const disposition = response.headers['content-disposition'];
      const filename = /filename="([^"]+)"/.exec(disposition ?? '')?.[1] ?? 'skills-export.zip';
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      showToast({ status: 'error', message: localize('com_ui_skill_export_error') });
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 px-2 pt-2">
        <Skeleton className="h-8 w-full rounded-lg" />
        <Skeleton className="h-8 w-full rounded-lg" />
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-px">
      {/* Section header */}
      <div className="flex items-center justify-between px-2 pb-2">
        <button
          type="button"
          onClick={() => setSectionOpen(!sectionOpen)}
          className="flex cursor-pointer items-center gap-1.5"
          aria-expanded={sectionOpen}
        >
          <ChevronRight
            className={cn(
              'size-3 shrink-0 text-text-secondary transition-transform duration-200',
              sectionOpen && 'rotate-90',
            )}
            aria-hidden="true"
          />
          <span className="text-xs text-text-secondary">{localize('com_ui_my_skills')}</span>
        </button>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            aria-label={localize('com_ui_skill_select_all')}
            className="size-4 accent-green-600"
          />
          {selectedIds.size > 0 && (
            <TooltipAnchor
              side="top"
              description={localize('com_ui_skill_export_selected')}
              render={
                <button
                  type="button"
                  onClick={exportSelected}
                  disabled={exporting}
                  aria-label={localize('com_ui_skill_export_selected')}
                  className="inline-flex size-7 items-center justify-center rounded-md text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-50"
                >
                  {exporting ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                </button>
              }
            />
          )}
        </div>
      </div>

      {/* Skill items */}
      {sectionOpen && (
        <div className="flex flex-col gap-px">
          {skills.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-text-secondary">
              {localize('com_ui_skills_empty')}
            </p>
          ) : (
            skills.map((skill) => (
              <SkillListItem
                key={skill._id}
                skill={skill}
                selected={selectedIds.has(skill._id)}
                isActive={skill._id === activeSkillId}
                isExpanded={skill._id === expandedSkillId}
                activeFile={skill._id === activeSkillId ? activeFile : null}
                onToggleExpand={(id) => setExpandedSkillId((prev) => (prev === id ? null : id))}
                onToggleSelected={toggleSelected}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
