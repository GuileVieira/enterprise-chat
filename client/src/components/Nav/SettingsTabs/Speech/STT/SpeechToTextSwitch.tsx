import ToggleSwitch from '../../ToggleSwitch';
import store from '~/store';

export default function SpeechToTextSwitch({
  onCheckedChange,
  disabled = false,
}: {
  onCheckedChange?: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <ToggleSwitch
      stateAtom={store.speechToText}
      localizationKey={'com_nav_speech_to_text' as const}
      switchId="SpeechToText"
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      strongLabel={true}
    />
  );
}
