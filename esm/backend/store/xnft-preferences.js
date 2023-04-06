import { LocalStorageDb } from "./db";
const KEY_XNFT_PREFERENCES_STORE = "xnft-preferences-store";
export async function getXnftPreferencesForUser(uuid) {
    return await LocalStorageDb.get(key(uuid));
}
export async function setXnftPreferencesForUser(uuid, preferences) {
    await LocalStorageDb.set(key(uuid), preferences);
}
function key(uuid) {
    return `${KEY_XNFT_PREFERENCES_STORE}_${uuid}`;
}
//# sourceMappingURL=xnft-preferences.js.map