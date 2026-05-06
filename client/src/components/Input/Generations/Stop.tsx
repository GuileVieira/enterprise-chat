import { Square } from '@phosphor-icons/react';
import type { TGenButtonProps } from '~/common';
import { useLocalize } from '~/hooks';
import Button from './Button';

export default function Stop({ onClick }: TGenButtonProps) {
  const localize = useLocalize();

  return (
    <Button type="stop" onClick={onClick}>
      <Square size={18} weight="fill" className="text-gray-600/90 dark:text-gray-400" />
      {localize('com_ui_stop')}
    </Button>
  );
}
