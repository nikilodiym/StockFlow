jest.mock('../src/services/storage/Storage', () => ({
    Storage: { get: jest.fn(), set: jest.fn().mockResolvedValue(undefined) },
}));
import { SettingsService } from '../src/features/settings/services/SettingsService';
import { Storage } from '../src/services/storage/Storage';
import { STORAGE_KEYS } from '../src/constants/config';
beforeEach(() => jest.clearAllMocks());
it('defaults scanner feedback to enabled for an existing installation', async () => {
    jest.mocked(Storage.get).mockResolvedValue(null);
    expect(await SettingsService.load()).toMatchObject({ soundOn: true, vibrationOn: true });
});
it('restores disabled sound and vibration on restart', async () => {
    jest.mocked(Storage.get).mockImplementation(async (key) =>
        [STORAGE_KEYS.soundOn, STORAGE_KEYS.vibrationOn].includes(key as typeof STORAGE_KEYS.soundOn) ? 'false' : null,
    );
    expect(await SettingsService.load()).toMatchObject({ soundOn: false, vibrationOn: false });
});
it('saves the two switches independently', async () => {
    await SettingsService.saveSound(false);
    await SettingsService.saveVibration(true);
    expect(Storage.set).toHaveBeenNthCalledWith(1, STORAGE_KEYS.soundOn, 'false');
    expect(Storage.set).toHaveBeenNthCalledWith(2, STORAGE_KEYS.vibrationOn, 'true');
});
