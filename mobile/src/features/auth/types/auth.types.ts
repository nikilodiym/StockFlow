export type UserData = {
    id?: number;
    name?: string;
    username?: string;
    email?: string;
    is_staff?: boolean;
    is_active?: boolean;
    memberships?: { warehouse: number; warehouse_name?: string; role: 'worker' | 'manager'; is_default?: boolean }[];
};

/** POST /api/auth/login/ response (older field names kept for compatibility). */
export type LoginResponse = {
    access?: string;
    refresh?: string;
    tokens?: { access?: string; refresh?: string };
    user?: UserData;
    profile?: UserData;
    detail?: string;
    message?: string;
    error?: string;
};

export type Session = {
    token: string;
    refresh: string | null;
    user: UserData | null;
};

export type AuthMode = 'pin' | 'email';
