import type { SpeechConfig } from './speech';
import { isSpeechFeatureDisabled, isSpeechFeatureEnabled } from './speech';

describe('speech config helpers', () => {
  it('treats explicit false as admin-disabled', () => {
    const config: SpeechConfig = { textToSpeech: false };

    expect(isSpeechFeatureDisabled(config, 'textToSpeech')).toBe(true);
    expect(isSpeechFeatureEnabled(config, 'textToSpeech')).toBe(false);
  });

  it('does not disable when config is absent or not_found', () => {
    const notFound: SpeechConfig = { message: 'not_found' };

    expect(isSpeechFeatureDisabled(undefined, 'textToSpeech')).toBe(false);
    expect(isSpeechFeatureEnabled(notFound, 'speechToText')).toBe(true);
  });

  it('keeps feature enabled when config provides defaults object values', () => {
    const config: SpeechConfig = { textToSpeech: true, speechToText: true };

    expect(isSpeechFeatureEnabled(config, 'textToSpeech')).toBe(true);
    expect(isSpeechFeatureEnabled(config, 'speechToText')).toBe(true);
  });
});
