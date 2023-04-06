import { LocalStorageDb } from "./db";
const KEY_FEATURE_GATES_STORE = "feature-gates-store";
export async function getFeatureGates() {
    return await LocalStorageDb.get(KEY_FEATURE_GATES_STORE);
}
export async function setFeatureGates(gates) {
    await LocalStorageDb.set(KEY_FEATURE_GATES_STORE, gates);
}
//# sourceMappingURL=feature-gates.js.map