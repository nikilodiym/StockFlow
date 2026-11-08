jest.mock('expo-haptics', () => ({
    notificationAsync: jest.fn().mockResolvedValue(undefined),
    NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));
jest.mock('expo-audio', () => ({
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    createAudioPlayer: jest.fn(() => ({
        play: jest.fn(),
        seekTo: jest.fn().mockResolvedValue(undefined),
        remove: jest.fn(),
        volume: 1,
    })),
}));
import * as Audio from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { ScanFeedbackService } from '../src/features/scanner/services/ScanFeedbackService';

afterEach(() => {
    ScanFeedbackService.release();
    jest.clearAllMocks();
});
it('does nothing when both scanner preferences are disabled', async () => {
    await ScanFeedbackService.play('success', { soundOn: false, vibrationOn: false });
    expect(Audio.createAudioPlayer).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
});
it('plays one success sound and one haptic after a successful scan', async () => {
    await ScanFeedbackService.play('success', { soundOn: true, vibrationOn: true });
    expect(Audio.createAudioPlayer).toHaveBeenCalledTimes(1);
    const player = jest.mocked(Audio.createAudioPlayer).mock.results[0].value;
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
});
it('rewinds the same player when scanning again', async () => {
    const prefs = { soundOn: true, vibrationOn: false };
    await ScanFeedbackService.play('success', prefs);
    await ScanFeedbackService.play('success', prefs);
    expect(Audio.createAudioPlayer).toHaveBeenCalledTimes(1);
    const player = jest.mocked(Audio.createAudioPlayer).mock.results[0].value;
    expect(player.seekTo).toHaveBeenCalledWith(0);
    expect(player.play).toHaveBeenCalledTimes(2);
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
});
it('supports vibration without sound and reports an error distinctly', async () => {
    await ScanFeedbackService.play('error', { soundOn: false, vibrationOn: true });
    expect(Audio.createAudioPlayer).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('error');
});
it('does not fail the product operation if native feedback fails', async () => {
    jest.mocked(Audio.setAudioModeAsync).mockRejectedValueOnce(new Error('No audio device'));
    jest.mocked(Haptics.notificationAsync).mockRejectedValueOnce(new Error('No motor'));
    await expect(ScanFeedbackService.play('error', { soundOn: true, vibrationOn: true })).resolves.toBeUndefined();
});
