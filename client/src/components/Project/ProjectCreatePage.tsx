import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLocalize } from '~/hooks';

export default function ProjectCreatePage() {
  const localize = useLocalize();
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {localize('com_ui_back')}
      </button>
      <h1 className="text-lg font-semibold text-text-primary">{localize('com_ui_new_project')}</h1>
      <p className="text-sm text-text-secondary">Create project form coming soon.</p>
    </div>
  );
}
