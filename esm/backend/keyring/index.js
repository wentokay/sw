import { hdFactoryForBlockchain, keyringForBlockchain, } from "@coral-xyz/blockchain-common";
import { BACKEND_API_URL, BACKEND_EVENT, DEFAULT_AUTO_LOCK_INTERVAL_SECS, defaultPreferences, NOTIFICATION_KEYRING_STORE_LOCKED, } from "@coral-xyz/common";
import { KeyringStoreStateEnum } from "@coral-xyz/recoil";
import { generateMnemonic } from "bip39";
import * as store from "../store";
import { DefaultKeyname } from "../store";
/**
 * KeyringStore API for managing all wallet keys .
 */
export class KeyringStore {
    ///////////////////////////////////////////////////////////////////////////////
    // Getters.
    ///////////////////////////////////////////////////////////////////////////////
    get activeUserKeyring() {
        if (!this.activeUserUuid) {
            throw new Error("invariant violation: activeUserUuid is undefined");
        }
        const kr = this.users.get(this.activeUserUuid);
        if (!kr) {
            throw new Error("invariant violation: activeUserKeyring not found");
        }
        return kr;
    }
    ///////////////////////////////////////////////////////////////////////////////
    // Initialization.
    ///////////////////////////////////////////////////////////////////////////////
    constructor(events) {
        this.users = new Map();
        this.lastUsedTs = 0;
        this.events = events;
        this.autoLockCountdown = (() => {
            var _a;
            let autoLockCountdownTimer;
            let secondsUntilAutoLock;
            let autoLockIsEnabled = true;
            let shouldLockImmediatelyWhenClosed = false;
            let lockImmediatelyWhenClosedCountdown;
            const SECONDS_UNTIL_LOCK_WHEN_CLOSED = 0.5;
            const lock = () => {
                if (!autoLockIsEnabled)
                    return;
                this.lock();
                this.events.emit(BACKEND_EVENT, {
                    name: NOTIFICATION_KEYRING_STORE_LOCKED,
                });
            };
            const startAutoLockCountdownTimer = () => {
                stopAutoLockCountdownTimer();
                stopLockWhenClosedCountdownTimer();
                if (!secondsUntilAutoLock || !autoLockIsEnabled)
                    return;
                autoLockCountdownTimer = setTimeout(lock, secondsUntilAutoLock * 1000);
            };
            const stopAutoLockCountdownTimer = () => {
                if (autoLockCountdownTimer)
                    clearTimeout(autoLockCountdownTimer);
            };
            const stopLockWhenClosedCountdownTimer = () => {
                if (lockImmediatelyWhenClosedCountdown)
                    clearTimeout(lockImmediatelyWhenClosedCountdown);
            };
            (_a = globalThis.chrome) === null || _a === void 0 ? void 0 : _a.runtime.onConnect.addListener((port) => {
                port.onDisconnect.addListener(() => {
                    // Force-enable the auto-lock countdown if the popup is closed
                    autoLockIsEnabled = true;
                    if (shouldLockImmediatelyWhenClosed) {
                        lockImmediatelyWhenClosedCountdown = setTimeout(() => {
                            stopAutoLockCountdownTimer();
                            lock();
                        }, SECONDS_UNTIL_LOCK_WHEN_CLOSED * 1000);
                    }
                    else {
                        startAutoLockCountdownTimer();
                    }
                });
            });
            return {
                start: () => {
                    // Get the auto-lock interval from the
                    // user's preferences and start the countdown timer.
                    store
                        .getWalletDataForUser(this.activeUserUuid)
                        .then(({ autoLockSettings, autoLockSecs }) => {
                        switch (autoLockSettings === null || autoLockSettings === void 0 ? void 0 : autoLockSettings.option) {
                            case "never":
                                shouldLockImmediatelyWhenClosed = false;
                                secondsUntilAutoLock = undefined;
                                break;
                            case "onClose":
                                shouldLockImmediatelyWhenClosed = true;
                                secondsUntilAutoLock = undefined;
                                break;
                            default:
                                shouldLockImmediatelyWhenClosed = false;
                                secondsUntilAutoLock =
                                    // Try to use read the new style (>0.4.0) value first
                                    (autoLockSettings === null || autoLockSettings === void 0 ? void 0 : autoLockSettings.seconds) ||
                                        // if that doesn't exist check for a legacy (<=0.4.0) value
                                        autoLockSecs ||
                                        // otherwise fall back to the default value
                                        DEFAULT_AUTO_LOCK_INTERVAL_SECS;
                        }
                        startAutoLockCountdownTimer();
                    });
                },
                restart: () => {
                    // Reset the countdown timer and start it again.
                    startAutoLockCountdownTimer();
                },
                toggle: (enabled) => {
                    autoLockIsEnabled = enabled;
                    startAutoLockCountdownTimer();
                },
            };
        })();
    }
    // Initializes the keystore for the first time.
    async init(username, password, keyringInit, uuid, jwt) {
        this.password = password;
        // Setup the user.
        await this._usernameKeyringCreate(username, keyringInit, uuid, jwt);
        // Persist the encrypted data to then store.
        await this.persist(true);
        // Automatically lock the store when idle.
        await this.tryUnlock({ password, uuid });
    }
    async usernameKeyringCreate(username, keyringInit, uuid, jwt) {
        return await this.withUnlockAndPersist(async () => {
            return await this._usernameKeyringCreate(username, keyringInit, uuid, jwt);
        });
    }
    async _usernameKeyringCreate(username, keyringInit, uuid, jwt) {
        // Store unlocked keyring in memory.
        this.users.set(uuid, await UserKeyring.init(username, keyringInit, uuid));
        this.activeUserUuid = uuid;
        // Per user preferences.
        await store.setWalletDataForUser(uuid, defaultPreferences());
        // Persist active user to disk.
        await store.setActiveUser({
            username,
            uuid,
            jwt,
        });
    }
    ///////////////////////////////////////////////////////////////////////////////
    // Internal state machine queries.
    ///////////////////////////////////////////////////////////////////////////////
    async state() {
        if (this.isUnlocked()) {
            return KeyringStoreStateEnum.Unlocked;
        }
        if (await this.isLocked()) {
            return KeyringStoreStateEnum.Locked;
        }
        return KeyringStoreStateEnum.NeedsOnboarding;
    }
    async isLocked() {
        if (this.isUnlocked()) {
            return false;
        }
        return await store.doesCiphertextExist();
    }
    isUnlocked() {
        return (this.activeUserUuid !== undefined &&
            this.activeUserKeyring.blockchains.size > 0 &&
            this.lastUsedTs !== 0);
    }
    ///////////////////////////////////////////////////////////////////////////////
    // Actions.
    ///////////////////////////////////////////////////////////////////////////////
    /**
     * Returns true if the active user was removed (and thus chanaged).
     */
    async removeUser(uuid) {
        if (this.users.size <= 1) {
            throw new Error("invariant violation: users map size must be greater than 1");
        }
        return await this.withUnlockAndPersist(async () => {
            const user = this.users.get(uuid);
            if (!user) {
                throw new Error(`User not found: ${uuid}`);
            }
            this.users.delete(uuid);
            await store.setWalletDataForUser(uuid, undefined);
            //
            // If the active user is being removed, then auto switch it.
            //
            if (this.activeUserUuid === uuid) {
                const userData = await store.getUserData();
                const users = userData.users.filter((user) => user.uuid !== uuid);
                await store.setUserData({
                    activeUser: users[0],
                    users,
                });
                this.activeUserUuid = users[0].uuid;
                return true;
            }
            else {
                return false;
            }
        });
    }
    async tryUnlock(userInfo) {
        return this.withLock(async () => {
            const json = await store.getKeyringStore(userInfo);
            await this.fromJson(json);
            // Must use this object, because the uuid may have been set during migration.
            // This will only happen in the event that the given uuid is empty.
            this.activeUserUuid = userInfo.uuid;
            this.password = userInfo.password;
            // Automatically lock the store when idle.
            // this.autoLockStart();
            this.autoLockCountdown.start();
        });
    }
    /**
     * Check if a password is valid by attempting to decrypt the stored keyring.
     */
    async checkPassword(password) {
        try {
            await store.getKeyringStore_NO_MIGRATION(password);
            return true;
        }
        catch (err) {
            return false;
        }
    }
    lock() {
        this.activeUserUuid = undefined; // Must be set to undefined here.
        this.users = new Map();
        this.lastUsedTs = 0;
    }
    // Preview public keys for a given mnemonic and derivation path without
    // importing the mnemonic.
    async previewPubkeys(blockchain, mnemonic, derivationPaths) {
        const factory = hdFactoryForBlockchain(blockchain);
        if (mnemonic === true) {
            // Read the mnemonic from the store
            return await this.withUnlock(async () => {
                mnemonic = this.activeUserKeyring.exportMnemonic();
                return factory.init(mnemonic, derivationPaths).publicKeys();
            });
        }
        else {
            return factory.init(mnemonic, derivationPaths).publicKeys();
        }
    }
    reset() {
        // First lock to clear the keyring memory.
        this.lock();
        // Clear the jwt cookie if it exists.
        fetch(`${BACKEND_API_URL}/authenticate`, {
            method: "DELETE",
        });
        // Then reset persistent disk storage.
        return store.reset();
    }
    async passwordUpdate(currentPassword, newPassword) {
        return this.withPasswordAndPersist(currentPassword, () => {
            this.password = newPassword;
        });
    }
    /**
     * Create a random mnemonic.
     */
    createMnemonic(strength) {
        return generateMnemonic(strength);
    }
    async activeUserUpdate(uuid) {
        const userData = await store.getUserData();
        const user = userData.users.filter((u) => u.uuid === uuid)[0];
        this.activeUserUuid = uuid;
        await store.setActiveUser(user);
        return user;
    }
    ///////////////////////////////////////////////////////////////////////////////
    // Locking methods methods
    ///////////////////////////////////////////////////////////////////////////////
    async autoLockSettingsUpdate(seconds, option) {
        return await this.withUnlock(async () => {
            const data = await store.getWalletDataForUser(this.activeUserUuid);
            await store.setWalletDataForUser(this.activeUserUuid, {
                ...data,
                autoLockSettings: {
                    seconds,
                    option,
                },
            });
            this.autoLockCountdown.start();
        });
    }
    keepAlive() {
        return this.withUnlock(() => { });
    }
    autoLockCountdownToggle(enable) {
        this.autoLockCountdown.toggle(enable);
    }
    autoLockCountdownRestart() {
        this.autoLockCountdown.restart();
    }
    autoLockCountdownReset() {
        this.autoLockCountdown.start();
    }
    ///////////////////////////////////////////////////////////////////////////////
    // Passes through to the active username keyring.
    ///////////////////////////////////////////////////////////////////////////////
    /**
     * Initialise a blockchain keyring.
     */
    async blockchainKeyringAdd(blockchain, keyringInit, persist = true) {
        await this.activeUserKeyring.blockchainKeyringAdd(blockchain, keyringInit);
        if (persist) {
            await this.persist();
        }
    }
    /**
     * Remove a keyring. This shouldn't be exposed to the client as it can
     * use the blockchain disable method to soft remove a keyring and still be
     * able to enable it later without any reonboarding (signatures, etc). It
     * is used by the backend to revert state changes for non atomic call
     * sequences.
     */
    async blockchainKeyringRemove(blockchain, persist = true) {
        await this.activeUserKeyring.blockchainKeyringRemove(blockchain);
        if (persist) {
            await this.persist();
        }
    }
    // Import a secret key for the given blockchain.
    // TODO handle initialisation, allow init blockchain without mnemonic?
    async importSecretKey(blockchain, secretKey, name) {
        return await this.withUnlockAndPersist(async () => {
            return await this.activeUserKeyring.importSecretKey(blockchain, secretKey, name);
        });
    }
    async nextDerivationPath(blockchain, keyring) {
        return await this.withUnlock(async () => {
            return this.activeUserKeyring.nextDerivationPath(blockchain, keyring);
        });
    }
    async addDerivationPath(blockchain, derivationPath) {
        return await this.withUnlock(async () => {
            return this.activeUserKeyring.addDerivationPath(blockchain, derivationPath);
        });
    }
    // Derive the next key for the given blockchain.
    async deriveNextKey(blockchain) {
        return await this.withUnlockAndPersist(async () => {
            return await this.activeUserKeyring.deriveNextKey(blockchain);
        });
    }
    async keyDelete(blockchain, publicKey) {
        return await this.withUnlockAndPersist(async () => {
            return await this.activeUserKeyring.keyDelete(blockchain, publicKey);
        });
    }
    async ledgerImport(walletDescriptor) {
        return await this.withUnlockAndPersist(async () => {
            return await this.activeUserKeyring.ledgerImport(walletDescriptor);
        });
    }
    /**
     * Update the active public key for the given blockchain.
     */
    async activeWalletUpdate(newActivePublicKey, blockchain) {
        return await this.withUnlockAndPersist(async () => {
            return await this.activeUserKeyring.activeWalletUpdate(newActivePublicKey, blockchain);
        });
    }
    /**
     * Return the public keys of all blockchain keyrings in the keyring.
     */
    async publicKeys() {
        return await this.withUnlock(async () => {
            return await this.activeUserKeyring.publicKeys();
        });
    }
    /**
     * Return all the active public keys for all enabled blockchains.
     */
    async activeWallets() {
        return this.withUnlock(async () => {
            return await this.activeUserKeyring.activeWallets();
        });
    }
    exportSecretKey(password, publicKey) {
        return this.withPassword(password, () => {
            return this.activeUserKeyring.exportSecretKey(publicKey);
        });
    }
    exportMnemonic(password) {
        return this.withPassword(password, () => {
            return this.activeUserKeyring.exportMnemonic();
        });
    }
    /**
     * Set the mnemonic to be used by the hd keyring.
     */
    async setMnemonic(mnemonic) {
        return await this.withUnlockAndPersist(async () => {
            this.activeUserKeyring.setMnemonic(mnemonic);
        });
    }
    ///////////////////////////////////////////////////////////////////////////////
    // Utilities.
    ///////////////////////////////////////////////////////////////////////////////
    async withUnlockAndPersist(fn) {
        return await this.withUnlock(async () => {
            const resp = await fn();
            await this.persist();
            return resp;
        });
    }
    // Utility for asserting the wallet is currently unlocked.
    withUnlock(fn) {
        if (!this.isUnlocked()) {
            throw new Error("keyring store is not unlocked");
        }
        const resp = fn();
        this.updateLastUsed();
        return resp;
    }
    // Utility for asserting the wallet is currently locked.
    withLock(fn) {
        if (this.isUnlocked()) {
            throw new Error("keyring store is not locked");
        }
        const resp = fn();
        this.updateLastUsed();
        return resp;
    }
    withPasswordAndPersist(currentPassword, fn) {
        return this.withPassword(currentPassword, () => {
            const resp = fn();
            this.persist();
            return resp;
        });
    }
    // Utility for asserting the wallet is unlocked and the correct password was
    // given.
    withPassword(currentPassword, fn) {
        return this.withUnlock(() => {
            if (currentPassword !== this.password) {
                throw new Error("incorrect password");
            }
            return fn();
        });
    }
    async persist(forceBecauseCalledFromInit = false) {
        if (!forceBecauseCalledFromInit && !this.isUnlocked()) {
            throw new Error("attempted persist of locked keyring");
        }
        await store.setKeyringStore(this.toJson(), this.password);
    }
    updateLastUsed() {
        this.lastUsedTs = Date.now() / 1000;
    }
    ///////////////////////////////////////////////////////////////////////////////
    // Serialization.
    ///////////////////////////////////////////////////////////////////////////////
    toJson() {
        // toJson on all the users
        const users = Object.fromEntries([...this.users].map(([k, v]) => [k, v.toJson()]));
        return {
            users,
            lastUsedTs: this.lastUsedTs,
        };
    }
    async fromJson(json) {
        const { users } = json;
        this.users = new Map(Object.entries(users).map(([username, obj]) => {
            return [username, UserKeyring.fromJson(obj)];
        }));
    }
}
// Holds all keys for a given username.
class UserKeyring {
    ///////////////////////////////////////////////////////////////////////////////
    // Initialization.
    ///////////////////////////////////////////////////////////////////////////////
    constructor() {
        this.blockchains = new Map();
    }
    static async init(username, keyringInit, uuid) {
        const keyring = new UserKeyring();
        keyring.uuid = uuid;
        keyring.username = username;
        if ("mnemonic" in keyringInit) {
            if (keyringInit.mnemonic === true) {
                throw new Error("invalid mnemonic");
            }
            keyring.mnemonic = keyringInit.mnemonic;
        }
        // Ledger and mnemonic keyring init have signedWalletDescriptors
        if ("signedWalletDescriptors" in keyringInit) {
            for (const signedWalletDescriptor of keyringInit.signedWalletDescriptors) {
                const blockchain = signedWalletDescriptor.blockchain;
                // No blockchain keyring, create it, filtering the signed wallet descriptors
                // to only the ones for this blockchain
                await keyring.blockchainKeyringAdd(blockchain, {
                    ...keyringInit,
                    signedWalletDescriptors: keyringInit.signedWalletDescriptors.filter((s) => s.blockchain === blockchain),
                });
            }
            // Set the active blockchain to the first signed wallet descriptor
            keyring.activeBlockchain =
                keyringInit.signedWalletDescriptors[0].blockchain;
        }
        if ("privateKey" in keyringInit) {
            keyring.activeBlockchain = keyringInit.blockchain;
            const blockchainKeyring = keyring.blockchains.get(keyringInit.blockchain);
            if (blockchainKeyring) {
                // Blockchain keyring already exists, just add the private key
                await blockchainKeyring.importSecretKey(keyringInit.privateKey, "New");
            }
            else {
                // No blockchain keyring, create it
                await keyring.blockchainKeyringAdd(keyringInit.blockchain, keyringInit);
            }
        }
        return keyring;
    }
    ///////////////////////////////////////////////////////////////////////////////
    // State selectors.
    ///////////////////////////////////////////////////////////////////////////////
    hasMnemonic() {
        return !!this.mnemonic;
    }
    /**
     * Return all the blockchains that have an initialised keyring even if they
     * are not enabled.
     */
    blockchainKeyrings() {
        return [...this.blockchains.keys()].map((b) => b);
    }
    async publicKeys() {
        const entries = this.blockchainKeyrings().map((blockchain) => {
            const keyring = this.keyringForBlockchain(blockchain);
            return [blockchain, keyring.publicKeys()];
        });
        return Object.fromEntries(entries);
    }
    /**
     * Returns the keyring for a given blockchain.
     */
    keyringForBlockchain(blockchain) {
        const keyring = this.blockchains.get(blockchain);
        if (keyring) {
            return keyring;
        }
        throw new Error(`no keyring for ${blockchain}`);
    }
    /**
     * Returns the keyring for a given public key.
     */
    keyringForPublicKey(publicKey) {
        for (const keyring of this.blockchains.values()) {
            if (keyring.hasPublicKey(publicKey)) {
                return keyring;
            }
        }
        throw new Error(`no keyring for ${publicKey}`);
    }
    /**
     * Returns the blockchain for a given public key.
     */
    blockchainForPublicKey(publicKey) {
        for (const [blockchain, keyring] of this.blockchains) {
            if (keyring.hasPublicKey(publicKey)) {
                return blockchain;
            }
        }
        throw new Error(`no blockchain for ${publicKey}`);
    }
    async activeWallets() {
        return this.blockchainKeyrings()
            .map((blockchain) => this.keyringForBlockchain(blockchain).getActiveWallet())
            .filter((w) => w !== undefined);
    }
    ///////////////////////////////////////////////////////////////////////////////
    // Actions.
    ///////////////////////////////////////////////////////////////////////////////
    async blockchainKeyringAdd(blockchain, keyringInit) {
        const keyring = keyringForBlockchain(blockchain);
        if ("mnemonic" in keyringInit) {
            if (keyringInit.mnemonic === true) {
                keyringInit.mnemonic = this.mnemonic;
            }
        }
        await keyring.init(keyringInit);
        this.blockchains.set(blockchain, keyring);
    }
    async blockchainKeyringRemove(blockchain) {
        this.blockchains.delete(blockchain);
    }
    async importSecretKey(blockchain, secretKey, name) {
        const keyring = this.keyringForBlockchain(blockchain);
        const [publicKey, _name] = await keyring.importSecretKey(secretKey, name);
        return [publicKey, _name];
    }
    /**
     * Update the active public key for the given blockchain.
     */
    async activeWalletUpdate(newActivePublicKey, blockchain) {
        const keyring = this.keyringForBlockchain(blockchain);
        await keyring.activeWalletUpdate(newActivePublicKey);
        this.activeBlockchain = blockchain;
    }
    nextDerivationPath(blockchain, keyring) {
        let blockchainKeyring = this.blockchains.get(blockchain);
        if (!blockchainKeyring) {
            throw new Error("blockchain keyring not initialised");
        }
        else {
            return blockchainKeyring.nextDerivationPath(keyring);
        }
    }
    async addDerivationPath(blockchain, derivationPath) {
        let blockchainKeyring = this.blockchains.get(blockchain);
        if (!blockchainKeyring) {
            throw new Error("blockchain keyring not initialised");
        }
        else if (!blockchainKeyring.hasHdKeyring()) {
            // Hd keyring not initialised, ibitialise it if possible
            if (!this.mnemonic) {
                throw new Error("hd keyring not initialised");
            }
            const accounts = await blockchainKeyring.initHdKeyring(this.mnemonic, [
                derivationPath,
            ]);
            return {
                publicKey: accounts[0][0],
                name: accounts[0][1],
            };
        }
        else {
            return blockchainKeyring.addDerivationPath(derivationPath);
        }
    }
    /**
     * Get the next derived key for the mnemonic.
     */
    async deriveNextKey(blockchain) {
        let blockchainKeyring = this.blockchains.get(blockchain);
        if (!blockchainKeyring) {
            throw new Error("blockchain keyring not initialised");
        }
        else {
            return await blockchainKeyring.deriveNextKey();
        }
    }
    exportSecretKey(publicKey) {
        const keyring = this.keyringForPublicKey(publicKey);
        return keyring.exportSecretKey(publicKey);
    }
    exportMnemonic() {
        if (!this.mnemonic) {
            throw new Error("keyring does not have a mnemonic");
        }
        return this.mnemonic;
    }
    setMnemonic(mnemonic) {
        if (this.mnemonic) {
            throw new Error("keyring already has a mnemonic set");
        }
        this.mnemonic = mnemonic;
    }
    async ledgerImport(walletDescriptor) {
        const blockchainKeyring = this.blockchains.get(walletDescriptor.blockchain);
        const ledgerKeyring = blockchainKeyring.ledgerKeyring;
        await ledgerKeyring.add(walletDescriptor);
        const name = DefaultKeyname.defaultLedger(ledgerKeyring.publicKeys().length);
        await store.setKeyname(walletDescriptor.publicKey, name);
        await store.setIsCold(walletDescriptor.publicKey, true);
    }
    async keyDelete(blockchain, pubkey) {
        const blockchainKeyring = this.blockchains.get(blockchain);
        await blockchainKeyring.keyDelete(pubkey);
    }
    ///////////////////////////////////////////////////////////////////////////////
    // Serialization.
    ///////////////////////////////////////////////////////////////////////////////
    toJson() {
        // toJson on all the keyrings
        const blockchains = Object.fromEntries([...this.blockchains].map(([k, v]) => [k, v.toJson()]));
        return {
            uuid: this.uuid,
            username: this.username,
            activeBlockchain: this.activeBlockchain,
            mnemonic: this.mnemonic,
            blockchains,
        };
    }
    static fromJson(json) {
        const { uuid, username, activeBlockchain, mnemonic, blockchains } = json;
        const u = new UserKeyring();
        u.uuid = uuid;
        u.username = username;
        u.mnemonic = mnemonic;
        u.blockchains = new Map(Object.entries(blockchains).map(([blockchain, obj]) => {
            const blockchainKeyring = keyringForBlockchain(blockchain);
            blockchainKeyring.fromJson(obj);
            return [blockchain, blockchainKeyring];
        }));
        u.activeBlockchain = activeBlockchain !== null && activeBlockchain !== void 0 ? activeBlockchain : Object.keys(blockchains)[0];
        return u;
    }
}
//# sourceMappingURL=index.js.map