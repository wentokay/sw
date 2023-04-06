import { TAB_NOTIFICATIONS, TAB_RECENT_ACTIVITY } from "@coral-xyz/common";
import { LocalStorageDb } from "./db";
const STORE_KEY_NAV = "nav-store7";
export async function getNav() {
    const nav = await LocalStorageDb.get(STORE_KEY_NAV);
    if (!nav) {
        return nav;
    }
    let needsMigration = false;
    if (nav[TAB_NOTIFICATIONS] === undefined) {
        needsMigration = true;
        nav[TAB_NOTIFICATIONS] = {
            id: TAB_NOTIFICATIONS,
            urls: [],
        };
    }
    if (nav[TAB_RECENT_ACTIVITY] === undefined) {
        needsMigration = true;
        nav[TAB_RECENT_ACTIVITY] = {
            id: TAB_RECENT_ACTIVITY,
            urls: [],
        };
    }
    if (needsMigration) {
        await setNav(nav);
    }
    return nav;
}
export async function setNav(nav) {
    await LocalStorageDb.set(STORE_KEY_NAV, nav);
}
//# sourceMappingURL=navigation.js.map