
export const saveState = (key: string, value: any) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error("Failed to save state persistence", e);
    }
};

export const loadState = (key: string, defaultValue: any = null) => {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
        console.error("Failed to load state persistence", e);
        return defaultValue;
    }
};

export const KEYS = {
    ACTIVE_TAB: 'subtracker_active_tab',
    SUB_VIEW_MODE: 'subtracker_sub_view_mode',
};
