import { captureMeetingCall } from '../meetingCapture';

describe('meeting call capture', () => {
  const stopDisplay = jest.fn();
  const stopMicrophone = jest.fn();
  const close = jest.fn().mockResolvedValue(undefined);
  const connect = jest.fn();
  const createSource = jest.fn(() => ({ connect }));
  const getUserMedia = jest.fn();
  const getDisplayMedia = jest.fn();
  const addEventListener = jest.fn();
  const removeEventListener = jest.fn();
  const display = {
    getAudioTracks: () => [{}],
    getTracks: () => [{ stop: stopDisplay, addEventListener, removeEventListener }],
  };
  const microphone = { getTracks: () => [{ stop: stopMicrophone }] };
  const mixed = { id: 'mixed' };

  beforeEach(() => {
    jest.clearAllMocks();
    getDisplayMedia.mockResolvedValue(display);
    getUserMedia.mockResolvedValue(microphone);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getDisplayMedia, getUserMedia },
    });
    Object.defineProperty(global, 'AudioContext', {
      configurable: true,
      value: class {
        createMediaStreamDestination = () => ({ stream: mixed });
        createMediaStreamSource = createSource;
        resume = async () => undefined;
        close = close;
      },
    });
  });

  it('mixes both sources and releases every input when stopped', async () => {
    const capture = await captureMeetingCall(jest.fn());
    expect(capture.stream).toBe(mixed);
    expect(createSource.mock.calls).toEqual([[display], [microphone]]);
    expect(connect).toHaveBeenCalledTimes(2);
    capture.stop();
    expect(stopDisplay).toHaveBeenCalledTimes(1);
    expect(stopMicrophone).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('connects sharing end to finalization and detaches the handler during cleanup', async () => {
    const onEnded = jest.fn();
    const capture = await captureMeetingCall(onEnded);
    expect(addEventListener).toHaveBeenCalledWith('ended', onEnded, { once: true });
    addEventListener.mock.calls[0][1]();
    expect(onEnded).toHaveBeenCalledTimes(1);
    capture.stop();
    expect(removeEventListener).toHaveBeenCalledWith('ended', onEnded);
  });

  it('rejects sharing without audio and releases the display', async () => {
    getDisplayMedia.mockResolvedValueOnce({ ...display, getAudioTracks: () => [] });
    await expect(captureMeetingCall(jest.fn())).rejects.toMatchObject({
      name: 'NotSupportedError',
    });
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(stopDisplay).toHaveBeenCalledTimes(1);
  });

  it('releases display capture when microphone permission fails', async () => {
    const error = new DOMException('Denied', 'NotAllowedError');
    getUserMedia.mockRejectedValueOnce(error);
    await expect(captureMeetingCall(jest.fn())).rejects.toBe(error);
    expect(stopDisplay).toHaveBeenCalledTimes(1);
  });
});
