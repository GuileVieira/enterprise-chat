import { useState, useId } from 'react';
import * as Ariakit from '@ariakit/react';
import { DotsThree } from '@phosphor-icons/react';
import { DropdownPopup, TooltipAnchor, useMediaQuery } from '@librechat/client';
import useExportShare from '~/hooks/Chat/useExportShare';
import { useLocalize } from '~/hooks';

export default function ExportAndShareMenu({
  isSharedButtonEnabled,
}: {
  isSharedButtonEnabled: boolean;
}) {
  const localize = useLocalize();
  const menuId = useId();
  const [isPopoverActive, setIsPopoverActive] = useState(false);
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const { show, items, hasSharedLink, dialogs } = useExportShare({ isSharedButtonEnabled });

  if (!show) {
    return null;
  }

  const description = localize(
    hasSharedLink ? 'com_ui_export_share_link_active' : 'com_endpoint_export_share',
  );

  return (
    <>
      <DropdownPopup
        portal={true}
        menuId={menuId}
        focusLoop={true}
        unmountOnHide={true}
        isOpen={isPopoverActive}
        setIsOpen={setIsPopoverActive}
        trigger={
          <TooltipAnchor
            description={description}
            render={
              <Ariakit.MenuButton
                render={<button type="button" />}
                id="export-menu-button"
                aria-label={description}
                className="relative inline-flex size-9 flex-shrink-0 items-center justify-center rounded-xl border border-border-light bg-presentation text-text-primary transition-all ease-in-out hover:bg-surface-tertiary disabled:pointer-events-none disabled:opacity-50 radix-state-open:bg-surface-tertiary"
              >
                <DotsThree
                  weight="bold"
                  className="h-5 w-5 text-text-primary"
                  aria-hidden="true"
                  focusable="false"
                />
                {hasSharedLink && (
                  <span
                    className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-status-info ring-2 ring-presentation"
                    data-testid="header-shared-link-indicator"
                    aria-hidden="true"
                  />
                )}
              </Ariakit.MenuButton>
            }
          />
        }
        items={items}
        className={isSmallScreen ? '' : 'absolute right-0 top-0 mt-2'}
      />
      {dialogs}
    </>
  );
}
