import { supabase } from './supabase';
export const ADMIN_PREFERENCES_KEY = 'rebites-admin-preferences';
export const ADMIN_PREFERENCES_EVENT = 'rebites-admin-preferences-updated';
export const ADMIN_NOTIF_LAST_SEEN_KEY = 'rebites-admin-notif-last-seen';
export const ADMIN_NOTIF_READ_IDS_KEY = 'rebites-admin-notif-read-ids';
export const ADMIN_NOTIF_EVENT = 'rebites-admin-notifications-updated';
export const ADMIN_ROLE_DECISIONS_SEEN_KEY = 'rebites-admin-role-decisions-seen';
export const ADMIN_ROLE_DECISIONS_EVENT = 'rebites-admin-role-decisions-updated';
export const MAX_SEEN_ROLE_DECISIONS = 100;
export const ADMIN_SHIPMENTS_SEEN_KEY = 'rebites-admin-shipments-seen';
export const ADMIN_SHIPMENTS_SEEN_EVENT = 'rebites-admin-shipments-seen-updated';
export const ADMIN_ACTIVITY_SEEN_KEY = 'rebites-admin-activity-seen';
export const ADMIN_ACTIVITY_SEEN_EVENT = 'rebites-admin-activity-seen-updated';
export const ADMIN_SIDEBAR_COLLAPSED_KEY = 'rebites-admin-sidebar-collapsed';
export interface AdminPreferences {
    showNotificationBell: boolean;
    realtimeActivity: boolean;
    compactTable: boolean;
    tableRowHover: boolean;
}
export const DEFAULT_ADMIN_PREFERENCES: AdminPreferences = {
    showNotificationBell: true,
    realtimeActivity: true,
    compactTable: false,
    tableRowHover: true,
};
function isBrowser(): boolean {
    return typeof window !== 'undefined';
}
export function readAdminPreferences(): AdminPreferences {
    if (!isBrowser())
        return DEFAULT_ADMIN_PREFERENCES;
    try {
        const raw = window.localStorage.getItem(ADMIN_PREFERENCES_KEY);
        if (!raw)
            return DEFAULT_ADMIN_PREFERENCES;
        const parsed = JSON.parse(raw) as Partial<AdminPreferences> | null;
        if (!parsed || typeof parsed !== 'object')
            return DEFAULT_ADMIN_PREFERENCES;
        return {
            showNotificationBell: typeof parsed.showNotificationBell === 'boolean'
                ? parsed.showNotificationBell
                : DEFAULT_ADMIN_PREFERENCES.showNotificationBell,
            realtimeActivity: typeof parsed.realtimeActivity === 'boolean'
                ? parsed.realtimeActivity
                : DEFAULT_ADMIN_PREFERENCES.realtimeActivity,
            compactTable: typeof parsed.compactTable === 'boolean'
                ? parsed.compactTable
                : DEFAULT_ADMIN_PREFERENCES.compactTable,
            tableRowHover: typeof parsed.tableRowHover === 'boolean'
                ? parsed.tableRowHover
                : DEFAULT_ADMIN_PREFERENCES.tableRowHover,
        };
    }
    catch {
        return DEFAULT_ADMIN_PREFERENCES;
    }
}
export function writeAdminPreferences(preferences: AdminPreferences): void {
    if (!isBrowser())
        throw new Error('Penyimpanan hanya tersedia di browser.');
    window.localStorage.setItem(ADMIN_PREFERENCES_KEY, JSON.stringify(preferences));
    window.dispatchEvent(new Event(ADMIN_PREFERENCES_EVENT));
    void pushAdminPreferenceData({ preferences });
}
export function markAllAdminNotificationsRead(): void {
    if (!isBrowser())
        return;
    const now = new Date().toISOString();
    window.localStorage.setItem(ADMIN_NOTIF_LAST_SEEN_KEY, now);
    window.localStorage.removeItem(ADMIN_NOTIF_READ_IDS_KEY);
    window.dispatchEvent(new Event(ADMIN_NOTIF_EVENT));
    void pushAdminPreferenceData({ notifLastSeen: now, notifReadIds: [] });
}
export function clearAdminNotificationReadState(): void {
    if (!isBrowser())
        return;
    window.localStorage.removeItem(ADMIN_NOTIF_LAST_SEEN_KEY);
    window.localStorage.removeItem(ADMIN_NOTIF_READ_IDS_KEY);
    window.dispatchEvent(new Event(ADMIN_NOTIF_EVENT));
    void pushAdminPreferenceData({ notifLastSeen: null, notifReadIds: [] });
}
export function readSeenRoleDecisionIds(): Set<string> {
    if (!isBrowser())
        return new Set();
    try {
        const raw = window.localStorage.getItem(ADMIN_ROLE_DECISIONS_SEEN_KEY);
        if (!raw)
            return new Set();
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed))
            return new Set();
        return new Set(parsed.filter((v): v is string => typeof v === 'string'));
    }
    catch {
        return new Set();
    }
}
export function markRoleDecisionsSeen(ids: readonly string[]): void {
    if (!isBrowser() || ids.length === 0)
        return;
    try {
        const merged = readSeenRoleDecisionIds();
        for (const id of ids)
            merged.add(id);
        const trimmed = Array.from(merged).slice(-MAX_SEEN_ROLE_DECISIONS);
        window.localStorage.setItem(ADMIN_ROLE_DECISIONS_SEEN_KEY, JSON.stringify(trimmed));
        window.dispatchEvent(new Event(ADMIN_ROLE_DECISIONS_EVENT));
        void pushAdminPreferenceData({ roleDecisionsSeen: trimmed });
    }
    catch {
    }
}
export function readShipmentsSeenAt(): string | null {
    if (!isBrowser())
        return null;
    try {
        const raw = window.localStorage.getItem(ADMIN_SHIPMENTS_SEEN_KEY);
        if (!raw || Number.isNaN(new Date(raw).getTime()))
            return null;
        return raw;
    }
    catch {
        return null;
    }
}
export function ensureShipmentsSeenBaseline(): string {
    const existing = readShipmentsSeenAt();
    if (existing)
        return existing;
    const now = new Date().toISOString();
    try {
        window.localStorage.setItem(ADMIN_SHIPMENTS_SEEN_KEY, now);
        void pushAdminPreferenceData({ shipmentsSeenAt: now });
    }
    catch {
    }
    return now;
}
export function markShipmentsSeen(): void {
    if (!isBrowser())
        return;
    const now = new Date().toISOString();
    try {
        window.localStorage.setItem(ADMIN_SHIPMENTS_SEEN_KEY, now);
        window.dispatchEvent(new Event(ADMIN_SHIPMENTS_SEEN_EVENT));
        void pushAdminPreferenceData({ shipmentsSeenAt: now });
    }
    catch {
    }
}
export function readActivitySeenAt(): string | null {
    if (!isBrowser())
        return null;
    try {
        const raw = window.localStorage.getItem(ADMIN_ACTIVITY_SEEN_KEY);
        if (!raw || Number.isNaN(new Date(raw).getTime()))
            return null;
        return raw;
    }
    catch {
        return null;
    }
}
export function ensureActivitySeenBaseline(): string {
    const existing = readActivitySeenAt();
    if (existing)
        return existing;
    const now = new Date().toISOString();
    try {
        window.localStorage.setItem(ADMIN_ACTIVITY_SEEN_KEY, now);
        void pushAdminPreferenceData({ activitySeenAt: now });
    }
    catch {
    }
    return now;
}
export function markActivitySeen(): void {
    if (!isBrowser())
        return;
    const now = new Date().toISOString();
    try {
        window.localStorage.setItem(ADMIN_ACTIVITY_SEEN_KEY, now);
        window.dispatchEvent(new Event(ADMIN_ACTIVITY_SEEN_EVENT));
        void pushAdminPreferenceData({ activitySeenAt: now });
    }
    catch {
    }
}
export const ADMIN_LOCAL_STORAGE_KEYS = [
    ADMIN_PREFERENCES_KEY,
    ADMIN_NOTIF_LAST_SEEN_KEY,
    ADMIN_NOTIF_READ_IDS_KEY,
    ADMIN_SIDEBAR_COLLAPSED_KEY,
    ADMIN_SHIPMENTS_SEEN_KEY,
    ADMIN_ROLE_DECISIONS_SEEN_KEY,
    ADMIN_ACTIVITY_SEEN_KEY,
] as const;
export interface AdminLocalStorageInfo {
    present: number;
    bytes: number;
    entries: {
        key: string;
        bytes: number;
    }[];
}
export function getAdminLocalStorageInfo(): AdminLocalStorageInfo {
    if (!isBrowser())
        return { present: 0, bytes: 0, entries: [] };
    const entries: {
        key: string;
        bytes: number;
    }[] = [];
    let bytes = 0;
    for (const key of ADMIN_LOCAL_STORAGE_KEYS) {
        const value = window.localStorage.getItem(key);
        if (value === null)
            continue;
        const size = key.length + value.length;
        bytes += size;
        entries.push({ key, bytes: size });
    }
    return { present: entries.length, bytes, entries };
}
export function clearAdminLocalData(): void {
    if (!isBrowser())
        throw new Error('Penyimpanan hanya tersedia di browser.');
    for (const key of ADMIN_LOCAL_STORAGE_KEYS) {
        window.localStorage.removeItem(key);
    }
    window.dispatchEvent(new Event(ADMIN_PREFERENCES_EVENT));
    window.dispatchEvent(new Event(ADMIN_NOTIF_EVENT));
    void pushAdminPreferenceData({
        preferences: DEFAULT_ADMIN_PREFERENCES,
        notifLastSeen: null,
        notifReadIds: [],
        roleDecisionsSeen: [],
        shipmentsSeenAt: null,
        activitySeenAt: null,
    });
}
export interface AdminRemotePreferenceData {
    preferences?: Partial<AdminPreferences>;
    notifLastSeen?: string | null;
    notifReadIds?: string[];
    roleDecisionsSeen?: string[];
    shipmentsSeenAt?: string | null;
    activitySeenAt?: string | null;
}
export async function syncAdminPreferencesFromServer(): Promise<void> {
    if (!isBrowser())
        return;
    try {
        const { data: { session }, } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (!uid)
            return;
        const { data, error } = await supabase
            .from('user_preferences')
            .select('data')
            .eq('user_id', uid)
            .maybeSingle();
        if (error) {
            console.warn('[admin-preferences] gagal memuat preferensi server:', error.message);
            return;
        }
        const remote = (data?.data ?? null) as AdminRemotePreferenceData | null;
        const remoteEmpty = !remote ||
            typeof remote !== 'object' ||
            Object.keys(remote as Record<string, unknown>).length === 0;
        if (remoteEmpty) {
            await pushAdminPreferenceData({
                preferences: readAdminPreferences(),
                notifLastSeen: window.localStorage.getItem(ADMIN_NOTIF_LAST_SEEN_KEY),
                notifReadIds: (() => {
                    try {
                        const raw = window.localStorage.getItem(ADMIN_NOTIF_READ_IDS_KEY);
                        const parsed = raw ? (JSON.parse(raw) as unknown) : [];
                        return Array.isArray(parsed)
                            ? parsed.filter((v): v is string => typeof v === 'string')
                            : [];
                    }
                    catch {
                        return [];
                    }
                })(),
                roleDecisionsSeen: Array.from(readSeenRoleDecisionIds()),
                shipmentsSeenAt: readShipmentsSeenAt(),
                activitySeenAt: readActivitySeenAt(),
            });
            return;
        }
        if (remote.preferences && typeof remote.preferences === 'object') {
            const merged = { ...DEFAULT_ADMIN_PREFERENCES, ...remote.preferences };
            try {
                window.localStorage.setItem(ADMIN_PREFERENCES_KEY, JSON.stringify(merged));
            }
            catch {
            }
            window.dispatchEvent(new Event(ADMIN_PREFERENCES_EVENT));
        }
        try {
            if (typeof remote.notifLastSeen === 'string') {
                window.localStorage.setItem(ADMIN_NOTIF_LAST_SEEN_KEY, remote.notifLastSeen);
            }
            else {
                window.localStorage.removeItem(ADMIN_NOTIF_LAST_SEEN_KEY);
            }
            if (Array.isArray(remote.notifReadIds)) {
                window.localStorage.setItem(ADMIN_NOTIF_READ_IDS_KEY, JSON.stringify(remote.notifReadIds.slice(-MAX_SEEN_ROLE_DECISIONS)));
            }
            else {
                window.localStorage.removeItem(ADMIN_NOTIF_READ_IDS_KEY);
            }
        }
        catch {
        }
        window.dispatchEvent(new Event(ADMIN_NOTIF_EVENT));
        if (Array.isArray(remote.roleDecisionsSeen)) {
            try {
                window.localStorage.setItem(ADMIN_ROLE_DECISIONS_SEEN_KEY, JSON.stringify(remote.roleDecisionsSeen.slice(-MAX_SEEN_ROLE_DECISIONS)));
            }
            catch {
            }
            window.dispatchEvent(new Event(ADMIN_ROLE_DECISIONS_EVENT));
        }
        try {
            if (typeof remote.shipmentsSeenAt === 'string') {
                window.localStorage.setItem(ADMIN_SHIPMENTS_SEEN_KEY, remote.shipmentsSeenAt);
            }
            else {
                window.localStorage.removeItem(ADMIN_SHIPMENTS_SEEN_KEY);
            }
            if (typeof remote.activitySeenAt === 'string') {
                window.localStorage.setItem(ADMIN_ACTIVITY_SEEN_KEY, remote.activitySeenAt);
            }
            else {
                window.localStorage.removeItem(ADMIN_ACTIVITY_SEEN_KEY);
            }
        }
        catch {
        }
        window.dispatchEvent(new Event(ADMIN_SHIPMENTS_SEEN_EVENT));
        window.dispatchEvent(new Event(ADMIN_ACTIVITY_SEEN_EVENT));
    }
    catch (err) {
        console.warn('[admin-preferences] sinkronisasi preferensi gagal:', err);
    }
}
export async function pushAdminPreferenceData(patch: AdminRemotePreferenceData): Promise<void> {
    if (!isBrowser())
        return;
    try {
        const { data: { session }, } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (!uid)
            return;
        const { data: existing, error: readErr } = await supabase
            .from('user_preferences')
            .select('data')
            .eq('user_id', uid)
            .maybeSingle();
        if (readErr) {
            console.warn('[admin-preferences] gagal membaca preferensi server:', readErr.message);
            return;
        }
        const current = existing?.data && typeof existing.data === 'object'
            ? (existing.data as AdminRemotePreferenceData)
            : {};
        const merged: AdminRemotePreferenceData = { ...current, ...patch };
        const { error: writeErr } = await supabase.from('user_preferences').upsert({ user_id: uid, data: merged, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        if (writeErr) {
            console.warn('[admin-preferences] gagal menyimpan preferensi ke server:', writeErr.message);
        }
    }
    catch (err) {
        console.warn('[admin-preferences] penyimpanan preferensi gagal:', err);
    }
}
