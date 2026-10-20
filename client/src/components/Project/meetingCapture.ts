export async function captureMeetingCall(onEnded: () => void): Promise<{
  stream: MediaStream;
  stop: () => void;
}> {
  const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  let microphone: MediaStream | undefined;
  let context: AudioContext | undefined;
  const tracks = display.getTracks();
  const stop = () => {
    tracks.forEach((track) => track.removeEventListener('ended', onEnded));
    display.getTracks().forEach((track) => track.stop());
    microphone?.getTracks().forEach((track) => track.stop());
    void context?.close();
  };
  try {
    if (!display.getAudioTracks().length) {
      throw new DOMException('Select a tab with shared audio', 'NotSupportedError');
    }
    microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
    context = new AudioContext();
    const destination = context.createMediaStreamDestination();
    context.createMediaStreamSource(display).connect(destination);
    context.createMediaStreamSource(microphone).connect(destination);
    await context.resume();
    tracks.forEach((track) => track.addEventListener('ended', onEnded, { once: true }));
    return { stream: destination.stream, stop };
  } catch (error) {
    stop();
    throw error;
  }
}
