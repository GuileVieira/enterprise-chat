import type { TCustomConfigSpeechResponse } from 'librechat-data-provider';
import { isSpeechFeatureDisabled, isSpeechFeatureEnabled } from './speech';

describe('speech config helpers', () => {
  it('treats explicit false as admin-disabled', () => {
    const config = { textToSpeech: false } as TCustomConfigSpeechResponse;

    expect(isSpeechFeatureDisabled(config, 'textToSpeech')).toBe(true);
    expect(isSpeechFeatureEnabled(config, 'textToSpeech')).toBe(false);
  });

  it('does not disable when config is absent or not_found', () => {
    const notFound = { message: 'not_found' } as TCustomConfigSpeechResponse;

    expect(isSpeechFeatureDisabled(undefined, 'textToSpeech')).toBe(false);
    expect(isSpeechFeatureEnabled(notFound, 'speechToText')).toBe(true);
  });

  it('keeps feature enabled when config provides defaults object values', () => {
    const config = { textToSpeech: true, speechToText: true } as TCustomConfigSpeechResponse;

    expect(isSpeechFeatureEnabled(config, 'textToSpeech')).toBe(true);
    expect(isSpeechFeatureEnabled(config, 'speechToText')).toBe(true);
  });
});
