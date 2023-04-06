import type { BlockchainKeyring } from "@coral-xyz/blockchain-keyring";
import type { AutolockSettingsOption, Blockchain, EventEmitter, LedgerKeyringInit, MnemonicKeyringInit, PrivateKeyKeyringInit, WalletDescriptor } from "@coral-xyz/common";
import type { KeyringStoreState } from "@coral-xyz/recoil";
import type { User, UserKeyringJson } from "../store";
/**
 * KeyringStore API for managing all wallet keys .
 */
export declare class KeyringStore {
    private lastUsedTs;
    private password?;
    private autoLockCountdown;
    private events;
    private users;
    private activeUserUuid?;
    get activeUserKeyring(): UserKeyring;
    constructor(events: EventEmitter);
    init(username: string, password: string, keyringInit: MnemonicKeyringInit | LedgerKeyringInit | PrivateKeyKeyringInit, uuid: string, jwt: string): Promise<void>;
    usernameKeyringCreate(username: string, keyringInit: MnemonicKeyringInit | LedgerKeyringInit | PrivateKeyKeyringInit, uuid: string, jwt: string): Promise<void>;
    _usernameKeyringCreate(username: string, keyringInit: MnemonicKeyringInit | LedgerKeyringInit | PrivateKeyKeyringInit, uuid: string, jwt: string): Promise<void>;
    state(): Promise<KeyringStoreState>;
    private isLocked;
    private isUnlocked;
    /**
     * Returns true if the active user was removed (and thus chanaged).
     */
    removeUser(uuid: string): Promise<boolean>;
    tryUnlock(userInfo: {
        password: string;
        uuid: string;
    }): Promise<void>;
    /**
     * Check if a password is valid by attempting to decrypt the stored keyring.
     */
    checkPassword(password: string): Promise<boolean>;
    lock(): void;
    previewPubkeys(blockchain: Blockchain, mnemonic: string | true, derivationPaths: Array<string>): Promise<string[]>;
    reset(): Promise<void>;
    passwordUpdate(currentPassword: string, newPassword: string): Promise<void>;
    /**
     * Create a random mnemonic.
     */
    createMnemonic(strength: number): string;
    activeUserUpdate(uuid: string): Promise<User>;
    autoLockSettingsUpdate(seconds?: number, option?: AutolockSettingsOption): Promise<void>;
    keepAlive(): void;
    autoLockCountdownToggle(enable: boolean): void;
    autoLockCountdownRestart(): void;
    autoLockCountdownReset(): void;
    /**
     * Initialise a blockchain keyring.
     */
    blockchainKeyringAdd(blockchain: Blockchain, keyringInit: MnemonicKeyringInit | LedgerKeyringInit | PrivateKeyKeyringInit, persist?: boolean): Promise<void>;
    /**
     * Remove a keyring. This shouldn't be exposed to the client as it can
     * use the blockchain disable method to soft remove a keyring and still be
     * able to enable it later without any reonboarding (signatures, etc). It
     * is used by the backend to revert state changes for non atomic call
     * sequences.
     */
    blockchainKeyringRemove(blockchain: Blockchain, persist?: boolean): Promise<void>;
    importSecretKey(blockchain: Blockchain, secretKey: string, name: string): Promise<[string, string]>;
    nextDerivationPath(blockchain: Blockchain, keyring: "hd" | "ledger"): Promise<string>;
    addDerivationPath(blockchain: Blockchain, derivationPath: string): Promise<{
        publicKey: string;
        name: string;
    }>;
    deriveNextKey(blockchain: Blockchain): Promise<{
        publicKey: string;
        derivationPath: string;
        name: string;
    }>;
    keyDelete(blockchain: Blockchain, publicKey: string): Promise<void>;
    ledgerImport(walletDescriptor: WalletDescriptor): Promise<void>;
    /**
     * Update the active public key for the given blockchain.
     */
    activeWalletUpdate(newActivePublicKey: string, blockchain: Blockchain): Promise<void>;
    /**
     * Return the public keys of all blockchain keyrings in the keyring.
     */
    publicKeys(): Promise<{
        [key: string]: {
            hdPublicKeys: Array<string>;
            importedPublicKeys: Array<string>;
            ledgerPublicKeys: Array<string>;
        };
    }>;
    /**
     * Return all the active public keys for all enabled blockchains.
     */
    activeWallets(): Promise<string[]>;
    exportSecretKey(password: string, publicKey: string): string;
    exportMnemonic(password: string): string;
    /**
     * Set the mnemonic to be used by the hd keyring.
     */
    setMnemonic(mnemonic: string): Promise<void>;
    private withUnlockAndPersist;
    private withUnlock;
    private withLock;
    private withPasswordAndPersist;
    private withPassword;
    private persist;
    private updateLastUsed;
    private toJson;
    private fromJson;
}
declare class UserKeyring {
    blockchains: Map<string, BlockchainKeyring>;
    username: string;
    uuid: string;
    private mnemonic?;
    activeBlockchain: Blockchain;
    constructor();
    static init(username: string, keyringInit: MnemonicKeyringInit | LedgerKeyringInit | PrivateKeyKeyringInit, uuid: string): Promise<UserKeyring>;
    hasMnemonic(): boolean;
    /**
     * Return all the blockchains that have an initialised keyring even if they
     * are not enabled.
     */
    blockchainKeyrings(): Array<Blockchain>;
    publicKeys(): Promise<{
        [key: string]: {
            hdPublicKeys: Array<string>;
            importedPublicKeys: Array<string>;
            ledgerPublicKeys: Array<string>;
        };
    }>;
    /**
     * Returns the keyring for a given blockchain.
     */
    keyringForBlockchain(blockchain: Blockchain): BlockchainKeyring;
    /**
     * Returns the keyring for a given public key.
     */
    keyringForPublicKey(publicKey: string): BlockchainKeyring;
    /**
     * Returns the blockchain for a given public key.
     */
    blockchainForPublicKey(publicKey: string): Blockchain;
    activeWallets(): Promise<string[]>;
    blockchainKeyringAdd(blockchain: Blockchain, keyringInit: MnemonicKeyringInit | LedgerKeyringInit | PrivateKeyKeyringInit): Promise<void>;
    blockchainKeyringRemove(blockchain: Blockchain): Promise<void>;
    importSecretKey(blockchain: Blockchain, secretKey: string, name: string): Promise<[string, string]>;
    /**
     * Update the active public key for the given blockchain.
     */
    activeWalletUpdate(newActivePublicKey: string, blockchain: Blockchain): Promise<void>;
    nextDerivationPath(blockchain: Blockchain, keyring: "hd" | "ledger"): string;
    addDerivationPath(blockchain: Blockchain, derivationPath: string): Promise<{
        publicKey: string;
        name: string;
    }>;
    /**
     * Get the next derived key for the mnemonic.
     */
    deriveNextKey(blockchain: Blockchain): Promise<{
        publicKey: string;
        derivationPath: string;
        name: string;
    }>;
    exportSecretKey(publicKey: string): string;
    exportMnemonic(): string;
    setMnemonic(mnemonic: string): void;
    ledgerImport(walletDescriptor: WalletDescriptor): Promise<void>;
    keyDelete(blockchain: Blockchain, pubkey: string): Promise<void>;
    toJson(): UserKeyringJson;
    static fromJson(json: UserKeyringJson): UserKeyring;
}
export {};
//# sourceMappingURL=index.d.ts.map