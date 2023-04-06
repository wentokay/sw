import { LocalStorageDb } from "./db";
const STORE_KEY_WALLET_DATA = "wallet-data";
export async function getWalletDataForUser(uuid) {
    const data = await LocalStorageDb.get(key(uuid));
    if (data === undefined) {
        throw new Error(`wallet data for user ${uuid} is undefined`);
    }
    return data;
}
export async function setWalletDataForUser(uuid, data) {
    await LocalStorageDb.set(key(uuid), data);
}
export async function getWalletData_DEPRECATED() {
    const data = await LocalStorageDb.get(STORE_KEY_WALLET_DATA);
    return data;
}
export async function setWalletData_DEPRECATED(data) {
    await LocalStorageDb.set(STORE_KEY_WALLET_DATA, data);
}
function key(uuid) {
    return `${STORE_KEY_WALLET_DATA}_${uuid}`;
}
//# sourceMappingURL=preferences.js.map