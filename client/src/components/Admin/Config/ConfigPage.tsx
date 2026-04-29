import React from 'react';
import { Settings, Info } from 'lucide-react';

// Placeholder data - will be replaced with real API data
const configSections = [
  {
    title: 'Endpoints',
    description: 'Configure AI model endpoints and providers',
    status: 'Configured',
  },
  {
    title: 'Registration',
    description: 'User registration and authentication settings',
    status: 'Enabled',
  },
  {
    title: 'Interface',
    description: 'UI features and interface customization',
    status: 'Default',
  },
  {
    title: 'Speech',
    description: 'Text-to-speech and speech-to-text settings',
    status: 'Disabled',
  },
];

const ConfigPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Configuration</h1>
        <p className="mt-1 text-sm text-text-secondary">
          View and manage system configuration.
        </p>
      </div>

      <div className="space-y-3">
        {configSections.map((section) => (
          <div
            key={section.title}
            className="flex items-center justify-between rounded-xl border border-border-medium bg-surface-secondary p-5"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-tertiary">
                <Settings className="h-5 w-5 text-text-primary" />
              </div>
              <div>
                <h3 className="text-base font-medium text-text-primary">{section.title}</h3>
                <p className="text-sm text-text-secondary">{section.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  section.status === 'Disabled'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {section.status}
              </span>
              <Info className="h-4 w-4 text-text-secondary" />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border-medium bg-surface-tertiary p-4">
        <p className="text-sm text-text-secondary">
          Configuration management UI is coming soon. For now, configuration is managed via{' '}
          <code className="rounded bg-surface-secondary px-1.5 py-0.5 text-xs">librechat.yaml</code>{' '}
          and environment variables.
        </p>
      </div>
    </div>
  );
};

export default ConfigPage;
