import { getRequestErrorMessage } from './errors';

describe('Meta Ads request errors', () => {
  it('shows the backend reason and validation fields instead of the HTTP summary', () => {
    const error = Object.assign(new Error('Request failed with status code 400'), {
      response: {
        data: {
          message: 'Invalid Meta Ads creative rules.',
          details: ['pauseHighCost.minCreativesInScope'],
        },
      },
    });
    expect(getRequestErrorMessage(error, 'Fallback')).toBe(
      'Invalid Meta Ads creative rules. (pauseHighCost.minCreativesInScope)',
    );
  });

  it('retains provider codes and trace without including arbitrary payload fields', () => {
    expect(
      getRequestErrorMessage(
        {
          response: {
            data: {
              message: 'Meta account access denied',
              details: {
                code: 100,
                error_subcode: 33,
                fbtrace_id: 'trace_fixture',
                access_token: 'DO_NOT_EXPORT_TOKEN',
              },
            },
          },
        },
        'Fallback',
      ),
    ).toBe('Meta account access denied (subcode 33 | code 100 | trace trace_fixture)');
  });

  it('keeps network errors and handles absent errors', () => {
    expect(getRequestErrorMessage(new Error('Network Error'), 'Fallback')).toBe('Network Error');
    expect(getRequestErrorMessage(null, 'Fallback')).toBe('Fallback');
    expect(getRequestErrorMessage(undefined, 'Fallback')).toBe('Fallback');
  });
});
