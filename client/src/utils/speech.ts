import type { TCustomConfigSpeechResponse } from 'librechat-data-provider';

export type SpeechFeatureKey = 'speechToText' | 'textToSpeech';

type SpeechFeatureValue = boolean | string | number | undefined;
type SpeechConfig = TCustomConfigSpeechResponse &
  Partial<Record<SpeechFeatureKey, SpeechFeatureValue>> & {
    message?: string;
  };

const getSpeechFeatureValue = (
  config: TCustomConfigSpeechResponse | undefined,
  key: SpeechFeatureKey,
): SpeechFeatureValue => {
  return (config as SpeechConfig | undefined)?.[key];
};

export const isSpeechFeatureDisabled = (
  config: TCustomConfigSpeechResponse | undefined,
  key: SpeechFeatureKey,
): boolean => {
  const speechConfig = config as SpeechConfig | undefined;
  if (!speechConfig || speechConfig.message === 'not_found') {
    return false;
  }
  return getSpeechFeatureValue(config, key) === false;
};

export const isSpeechFeatureEnabled = (
  config: TCustomConfigSpeechResponse | undefined,
  key: SpeechFeatureKey,
): boolean => !isSpeechFeatureDisabled(config, key);
