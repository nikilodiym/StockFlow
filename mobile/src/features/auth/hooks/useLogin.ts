/** Login form logic: email/password, PIN unlock, error dialogs. */
import { useState } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useDialog } from '../../../app/providers/DialogProvider';
import { useSettings } from '../../../app/providers/SettingsProvider';
import { formatLoginError } from '../utils/loginErrors';
import type { AuthMode } from '../types/auth.types';

export function useLogin() {
    const { signIn, unlockWithPin, storedPin } = useAuth();
    const { serverUrl } = useSettings();
    const { showDialog } = useDialog();
    const [mode, setMode] = useState<AuthMode>(storedPin ? 'pin' : 'email');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [pin, setPin] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const submitEmail = async () => {
        if (!email.trim() || !password) {
            showDialog('Введіть дані для входу', 'Вкажіть email і пароль, щоб продовжити.', undefined, 'error');
            return;
        }
        setSubmitting(true);
        try {
            await signIn(email, password);
            setPassword('');
        } catch (error) {
            showDialog('Не вдалося увійти', formatLoginError(error, serverUrl), undefined, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const submitPin = () => {
        if (pin.length !== 4) return;
        if (!unlockWithPin(pin)) {
            setPin('');
            showDialog('Невірний PIN-код', 'Перевірте код або увійдіть через email і пароль.', undefined, 'error');
        }
    };

    const forgotPassword = () => showDialog('Відновлення пароля', 'Зверніться до адміністратора складу.');

    return { mode, setMode, email, setEmail, password, setPassword, pin, setPin, hasPin: !!storedPin, submitting, submitEmail, submitPin, forgotPassword };
}
