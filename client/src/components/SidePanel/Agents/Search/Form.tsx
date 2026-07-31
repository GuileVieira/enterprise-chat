import { useLocalize } from '~/hooks';
import Action from './Action';

export default function SearchForm() {
  const localize = useLocalize();

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center gap-2">
        <div className="flex flex-row items-center gap-1">
          <div className="flex items-center gap-1">
            <span className="text-token-text-primary block text-sm font-medium">
              {localize('com_ui_web_search')}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-start gap-2">
        <Action />
      </div>
    </div>
  );
}
