import { BrowserRuntimeCommon } from "@coral-xyz/common";
export class LocalStorageDb {
    static async get(key) {
        return await BrowserRuntimeCommon.getLocalStorage(key);
    }
    static async set(key, value) {
        await BrowserRuntimeCommon.setLocalStorage(key, value);
    }
    static async reset() {
        await BrowserRuntimeCommon.clearLocalStorage();
    }
}
//# sourceMappingURL=db.js.map