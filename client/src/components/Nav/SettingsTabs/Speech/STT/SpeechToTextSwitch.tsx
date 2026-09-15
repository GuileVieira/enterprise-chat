import { useGetCustomConfigSpeechQuery } from 'librechat-data-provider/react-query';
import { isSpeechFeatureDisabled } from '~/utils/speech';
import ToggleSwitch from '../../ToggleSwitch';
import store from '~/store';

export default function SpeechToTextSwitch({
  onCheckedChange,
  disabled = false,
}: {
  onCheckedChange?: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { data: speechConfig } = useGetCustomConfigSpeechQuery();
  const isDisabled = disabled || isSpeechFeatureDisabled(speechConfig, 'speechToText');

  return (
    <ToggleSwitch
      stateAtom={store.speechToText}
      localizationKey={'com_nav_speech_to_text' as const}
      switchId="SpeechToText"
      onCheckedChange={onCheckedChange}
      disabled={isDisabled}
      strongLabel={true}
    />
  );
}
