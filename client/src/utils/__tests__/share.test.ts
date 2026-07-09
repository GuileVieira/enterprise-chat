jest.mock(
  'librechat-data-provider',
  () => ({
    apiBaseUrl: jest.fn(),
  }),
  { virtual: true },
);

import { apiBaseUrl } from 'librechat-data-provider';
import { buildShareLinkUrl, buildTenantShareLinkUrl, findShareArtifactId } from '../share';

describe('buildShareLinkUrl', () => {
  it('includes the base path for subdirectory deployments', () => {
    (apiBaseUrl as jest.Mock).mockReturnValue('/librechat');
    expect(buildShareLinkUrl('reW8SsFGQEH1b1uzSHe4I')).toBe(
      'http://localhost:3080/librechat/share/reW8SsFGQEH1b1uzSHe4I',
    );
  });

  it('works when base path is root', () => {
    (apiBaseUrl as jest.Mock).mockReturnValue('');
    expect(buildShareLinkUrl('reW8SsFGQEH1b1uzSHe4I')).toBe(
      'http://localhost:3080/share/reW8SsFGQEH1b1uzSHe4I',
    );
  });

  it('builds tenant share links under the base path', () => {
    (apiBaseUrl as jest.Mock).mockReturnValue('/librechat');
    expect(buildTenantShareLinkUrl('tenantShareId')).toBe(
      'http://localhost:3080/librechat/share/tenant/tenantShareId',
    );
  });

  it('adds artifact deep-link params', () => {
    (apiBaseUrl as jest.Mock).mockReturnValue('');
    expect(
      buildShareLinkUrl('shareId', { artifactId: 'tool-artifact-file', artifactIndex: 2 }),
    ).toBe('http://localhost:3080/share/shareId?artifact=tool-artifact-file&artifactIndex=2');
    expect(buildTenantShareLinkUrl('tenantShareId', { artifactIndex: 2 })).toBe(
      'http://localhost:3080/share/tenant/tenantShareId?artifactIndex=2',
    );
  });

  it('uses configured share base url when provided', () => {
    (apiBaseUrl as jest.Mock).mockReturnValue('');
    expect(buildShareLinkUrl('shareId', undefined, 'https://app.orqest.com/app')).toBe(
      'https://app.orqest.com/app/share/shareId',
    );
  });

  it('matches shared artifacts by stable id before index fallback', () => {
    const artifacts = {
      stable_html_report_msg_anonymized: {
        id: 'stable_html_report_msg_anonymized',
        lastUpdateTime: 1,
      },
      other_html_report_msg_anonymized: {
        id: 'other_html_report_msg_anonymized',
        index: 0,
        lastUpdateTime: 1,
      },
    };

    expect(findShareArtifactId(artifacts, 'stable_html_report_original-message', '0')).toBe(
      'stable_html_report_msg_anonymized',
    );
  });
});
