export type SpeechFeatureKey = 'speechToText' | 'textToSpeech';

type SpeechFeatureValue = boolean | string | number | undefined;
export type SpeechConfig = Record<string, SpeechFeatureValue> & {
  message?: string;
  speechToText?: SpeechFeatureValue;
  textToSpeech?: SpeechFeatureValue;
};

const getSpeechFeatureValue = (
  config: SpeechConfig | undefined,
  key: SpeechFeatureKey,
): SpeechFeatureValue => {
  return config?.[key];
};

export const isSpeechFeatureDisabled = (
  config: SpeechConfig | undefined,
  key: SpeechFeatureKey,
): boolean => {
  if (!config || config.message === 'not_found') {
    return false;
  }
  return getSpeechFeatureValue(config, key) === false;
};

export const isSpeechFeatureEnabled = (
  config: SpeechConfig | undefined,
  key: SpeechFeatureKey,
): boolean => !isSpeechFeatureDisabled(config, key);
