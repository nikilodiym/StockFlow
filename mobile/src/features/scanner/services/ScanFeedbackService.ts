import * as Haptics from 'expo-haptics';
import type { AudioPlayer } from 'expo-audio';

export type FeedbackPreferences = { soundOn: boolean; vibrationOn: boolean };
type Result = 'success' | 'error';
const players: Partial<Record<Result, AudioPlayer>> = {};
let audioReady: Promise<typeof import('expo-audio')> | undefined;
async function sound(result: Result) {
    audioReady ??= Promise.resolve()
        .then(async () => {
            const audio = require('expo-audio') as typeof import('expo-audio');
            await audio.setAudioModeAsync({
                playsInSilentMode: false,
                shouldPlayInBackground: false,
                interruptionMode: 'mixWithOthers',
            });
            return audio;
        })
        .catch((error) => {
            audioReady = undefined;
            throw error;
        });
    const audio = await audioReady;
    const existing = players[result];
    const player = (players[result] ??= audio.createAudioPlayer(
        result === 'success'
            ? require('../../../assets/sounds/scan-success.wav')
            : require('../../../assets/sounds/scan-error.wav'),
    ));
    player.volume = 0.65;
    if (existing) await player.seekTo(0);
    player.play();
}

export const ScanFeedbackService = {
    async play(result: Result, prefs: FeedbackPreferences): Promise<void> {
        await Promise.allSettled([
            prefs.soundOn ? sound(result) : Promise.resolve(),
            prefs.vibrationOn
                ? Promise.resolve().then(() =>
                      Haptics.notificationAsync(
                          result === 'success'
                              ? Haptics.NotificationFeedbackType.Success
                              : Haptics.NotificationFeedbackType.Error,
                      ),
                  )
                : Promise.resolve(),
        ]);
    },
    /** Release native resources when the app root unmounts. */
    release() {
        for (const key of Object.keys(players) as Result[]) {
            players[key]?.remove();
            delete players[key];
        }
        audioReady = undefined;
    },
};
