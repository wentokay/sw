import { LocalStorageDb } from "./db";
const KEY_KEYNAME_STORE = "keyname-store";
export async function setKeyname(publicKey, name) {
    let keynames = await LocalStorageDb.get(key());
    if (!keynames) {
        keynames = {};
    }
    keynames[publicKey] = name;
    await LocalStorageDb.set(KEY_KEYNAME_STORE, keynames);
}
export async function getKeyname(publicKey) {
    const names = await LocalStorageDb.get(key());
    const name = names[publicKey];
    if (!name) {
        throw Error(`unable to find name for key: ${publicKey.toString()}`);
    }
    return name;
}
function key() {
    return `${KEY_KEYNAME_STORE}`;
}
export const DefaultKeyname = {
    defaultDerived(index) {
        return `Wallet ${index}`;
    },
    defaultImported(index) {
        return `Imported Wallet ${index}`;
    },
    defaultLedger(index) {
        return `Ledger ${index}`;
    },
};
//# sourceMappingURL=keyname.js.map