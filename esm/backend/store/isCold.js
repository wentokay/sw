import { LocalStorageDb } from "./db";
const KEY_IS_COLD_STORE = "is-cold-store";
export async function setIsCold(publicKey, isCold) {
    let keynames = await LocalStorageDb.get(key());
    if (!keynames) {
        keynames = {};
    }
    keynames[publicKey] = isCold;
    await LocalStorageDb.set(KEY_IS_COLD_STORE, keynames);
}
export async function getIsCold(publicKey) {
    const isColdKeys = await LocalStorageDb.get(key());
    const isCold = isColdKeys === null || isColdKeys === void 0 ? void 0 : isColdKeys[publicKey];
    if (!isCold) {
        return false;
    }
    return isCold;
}
function key() {
    return `${KEY_IS_COLD_STORE}`;
}
//# sourceMappingURL=isCold.js.map