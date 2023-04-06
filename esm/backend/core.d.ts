import type { AutolockSettingsOption, EventEmitter, FEATURE_GATES_MAP, LedgerKeyringInit, MnemonicKeyringInit, Preferences, PrivateKeyKeyringInit, ServerPublicKey, SignedWalletDescriptor, WalletDescriptor, XnftPreference } from "@coral-xyz/common";
import { Blockchain } from "@coral-xyz/common";
import type { KeyringStoreState } from "@coral-xyz/recoil";
import type { Commitment, SendOptions } from "@solana/web3.js";
import type { PublicKeyData, PublicKeyType } from "../types";
import type { EthereumConnectionBackend } from "./ethereum-connection";
import type { SolanaConnectionBackend } from "./solana-connection";
import type { Nav, User } from "./store";
export declare function start(events: EventEmitter, solanaB: SolanaConnectionBackend, ethereumB: EthereumConnectionBackend): Backend;
export declare class Backend {
    private keyringStore;
    private solanaConnectionBackend;
    private ethereumConnectionBackend;
    private events;
    private xnftWhitelist;
    constructor(events: EventEmitter, solanaB: SolanaConnectionBackend, ethereumB: EthereumConnectionBackend);
    solanaSignAndSendTx(txStr: string, walletAddress: string, options?: SendOptions): Promise<string>;
    solanaSignAllTransactions(txs: Array<string>, walletAddress: string): Promise<Array<string>>;
    solanaSignTransaction(txStr: string, walletAddress: string): Promise<string>;
    solanaSignMessage(msg: string, walletAddress: string): Promise<string>;
    solanaSimulate(txStr: string, addresses: Array<string>): Promise<any>;
    disconnect(origin: string): Promise<string>;
    solanaRecentBlockhash(commitment?: Commitment): Promise<string>;
    solanaConnectionUrlRead(uuid: string): Promise<string>;
    solanaConnectionUrlUpdate(cluster: string): Promise<boolean>;
    solanaExplorerRead(uuid: string): Promise<string>;
    solanaExplorerUpdate(explorer: string): Promise<string>;
    solanaCommitmentRead(uuid: string): Promise<Commitment>;
    solanaCommitmentUpdate(commitment: Commitment): Promise<string>;
    ethereumSignTransaction(serializedTx: string, walletAddress: string): Promise<string>;
    ethereumSignAndSendTransaction(serializedTx: string, walletAddress: string): Promise<string>;
    ethereumSignMessage(msg: string, walletAddress: string): Promise<string>;
    ethereumExplorerRead(uuid: string): Promise<string>;
    ethereumExplorerUpdate(explorer: string): Promise<string>;
    ethereumConnectionUrlRead(uuid: string): Promise<string>;
    ethereumConnectionUrlUpdate(connectionUrl: string): Promise<string>;
    ethereumChainIdRead(): Promise<string>;
    ethereumChainIdUpdate(chainId: string): Promise<string>;
    /**
     * Sign a message using a given public key. If the keyring store is not unlocked
     * keyring initialisation parameters must be provided that will initialise a
     * keyring to contain the given public key.
     *
     * This is used during onboarding to sign messages prior to the store being
     * initialised.
     */
    signMessageForPublicKey(blockchain: Blockchain, publicKey: string, msg: string, keyringInit?: MnemonicKeyringInit | LedgerKeyringInit | PrivateKeyKeyringInit): Promise<string>;
    keyringStoreCreate(username: string, password: string, keyringInit: MnemonicKeyringInit | LedgerKeyringInit | PrivateKeyKeyringInit, uuid: string, jwt: string): Promise<string>;
    usernameAccountCreate(username: string, keyringInit: MnemonicKeyringInit | LedgerKeyringInit | PrivateKeyKeyringInit, uuid: string, jwt: string): Promise<string>;
    activeUserUpdate(uuid: string): Promise<string>;
    keyringStoreCheckPassword(password: string): Promise<boolean>;
    keyringStoreUnlock(password: string, uuid: string): Promise<string>;
    keyringStoreAutoLockCountdownToggle(enable: boolean): void;
    keyringStoreAutoLockCountdownRestart(): void;
    keyringStoreAutoLockReset(): void;
    keyringStoreLock(): string;
    keyringStoreState(): Promise<KeyringStoreState>;
    keyringStoreKeepAlive(): string;
    keyringStoreReadAllPubkeyData(): Promise<PublicKeyData>;
    keyringStoreReadAllPubkeys(): Promise<PublicKeyType>;
    activeWalletForBlockchain(b: Blockchain): string | undefined;
    private activeWallets;
    preferencesRead(uuid: string): Promise<Preferences>;
    activeWalletUpdate(newActivePublicKey: string, blockchain: Blockchain): Promise<string>;
    blockchainActiveWallets(): Promise<{
        [k: string]: string;
    }>;
    keyringReadNextDerivationPath(blockchain: Blockchain, keyring: "hd" | "ledger"): Promise<string>;
    /**
     * Add a new wallet to the keyring using the next derived wallet for the mnemonic.
     * @param blockchain - Blockchain to add the wallet for
     */
    keyringImportWallet(signedWalletDescriptor: SignedWalletDescriptor): Promise<string>;
    /**
     * Add a new wallet to the keyring using the next derived wallet for the mnemonic.
     * @param blockchain - Blockchain to add the wallet for
     */
    keyringDeriveWallet(blockchain: Blockchain, retries?: number): Promise<string>;
    keyIsCold(publicKey: string): Promise<boolean>;
    keyIsColdUpdate(publicKey: string, isCold: boolean): Promise<string>;
    /**
     * Read the name associated with a public key in the local store.
     * @param publicKey - public key to read the name for
     */
    keynameRead(publicKey: string): Promise<string>;
    /**
     * Update the name associated with a public key in the local store.
     * @param publicKey - public key to update the name for
     * @param newName - new name to associate with the public key
     */
    keynameUpdate(publicKey: string, newName: string): Promise<string>;
    /**
     * Remove a wallet from the keyring and delete the public key record on the
     * server. If the public key was the last public key on the keyring then also
     * remove the entire blockchain keyring.
     * @param blockchain - Blockchain for the public key
     * @param publicKey - Public key to remove
     */
    keyringKeyDelete(blockchain: Blockchain, publicKey: string): Promise<string>;
    userRead(): Promise<User>;
    userJwtUpdate(uuid: string, jwt: string): Promise<string>;
    allUsersRead(): Promise<Array<User>>;
    passwordUpdate(currentPassword: string, newPassword: string): Promise<string>;
    importSecretKey(blockchain: Blockchain, secretKey: string, name: string): Promise<string>;
    keyringExportSecretKey(password: string, pubkey: string): string;
    keyringExportMnemonic(password: string): string;
    keyringAutoLockSettingsRead(uuid: string): Promise<import("@coral-xyz/common").AutolockSettings>;
    keyringAutoLockSettingsUpdate(seconds?: number, option?: AutolockSettingsOption): Promise<string>;
    keyringReset(): Promise<string>;
    ledgerImport(signedWalletDescriptor: SignedWalletDescriptor): Promise<string>;
    validateMnemonic(mnemonic: string): boolean;
    mnemonicCreate(strength: number): Promise<string>;
    /**
     * Attempt to recover unrecovered wallets that exist on the keyring mnemonic.
     */
    mnemonicSync(serverPublicKeys: Array<{
        blockchain: Blockchain;
        publicKey: string;
    }>): Promise<void>;
    keyringHasMnemonic(): boolean;
    keyringSetMnemonic(mnemonic: string): void;
    previewPubkeys(blockchain: Blockchain, mnemonic: string, derivationPaths: Array<string>): Promise<string[]>;
    /**
     * Add a public key to a Backpack account via the Backpack API.
     */
    userAccountPublicKeyCreate(blockchain: Blockchain, publicKey: string, signature?: string): Promise<void>;
    /**
     * Remove a public key from a Backpack account via the Backpack API.
     */
    userAccountPublicKeyDelete(blockchain: Blockchain, publicKey: string): Promise<string>;
    /**
     * Attempt to authenticate a Backpack account using the Backpack API.
     */
    userAccountAuth(blockchain: Blockchain, publicKey: string, message: string, signature: string): Promise<any>;
    /**
     * Logout a Backpack account using the Backpack API.
     */
    userAccountLogout(uuid: string): Promise<string>;
    /**
     * Read a Backpack account from the Backpack API.
     */
    userAccountRead(jwt?: string): Promise<any>;
    /**
     * Find a `WalletDescriptor` that can be used to create a new account.
     * This requires that the sub wallets on the account index are not used by a
     * existing user account. This is checked by querying the Backpack API.
     *
     * This only works for mnemonics or a keyring store unlocked with a mnemonic
     * because the background service worker can't use a Ledger.
     */
    findWalletDescriptor(blockchain: Blockchain, accountIndex?: number, mnemonic?: string): Promise<WalletDescriptor>;
    /**
     * Query the Backpack API to check if a user has already used any of the
     * blockchain/public key pairs from a list.
     */
    findServerPublicKeyConflicts(serverPublicKeys: ServerPublicKey[]): Promise<string[]>;
    darkModeRead(uuid: string): Promise<boolean>;
    darkModeUpdate(darkMode: boolean): Promise<string>;
    developerModeRead(uuid: string): Promise<boolean>;
    developerModeUpdate(developerMode: boolean): Promise<string>;
    aggregateWalletsUpdate(aggregateWallets: boolean): Promise<string>;
    isApprovedOrigin(origin: string): Promise<boolean>;
    approvedOriginsRead(uuid: string): Promise<Array<string>>;
    approvedOriginsUpdate(approvedOrigins: Array<string>): Promise<string>;
    approvedOriginsDelete(origin: string): Promise<string>;
    /**
     * Add a new blockchain keyring to the keyring store (i.e. initialize it).
     */
    blockchainKeyringsAdd(keyringInit: MnemonicKeyringInit | LedgerKeyringInit | PrivateKeyKeyringInit): Promise<string>;
    /**
     * Return all blockchains that have initialised keyrings, even if they are not
     * enabled.
     */
    blockchainKeyringsRead(): Promise<Array<Blockchain>>;
    setFeatureGates(gates: FEATURE_GATES_MAP): Promise<void>;
    getFeatureGates(): Promise<{
        readonly STRIPE_ENABLED: false;
        readonly PRIMARY_PUBKEY_ENABLED: true;
        readonly SWAP_FEES_ENABLED: false;
        readonly DROPZONE_ENABLED: false;
        readonly STICKER_ENABLED: false;
        readonly BARTER_ENABLED: false;
    }>;
    setXnftPreferences(xnftId: string, preference: XnftPreference): Promise<void>;
    getXnftPreferences(): Promise<import("@coral-xyz/common").XnftPreferenceStore>;
    navigationPush(url: string, tab?: string, pushAboveRoot?: boolean): Promise<string>;
    navigationPop(tab?: string): Promise<string>;
    navigationToDefault(): Promise<string>;
    navigationToRoot(): Promise<string>;
    navRead(): Promise<Nav>;
    navReadUrl(): Promise<string>;
    navigationActiveTabUpdate(activeTab: string): Promise<string>;
    navigationOpenChat(chatName: string): Promise<string>;
    navigationCurrentUrlUpdate(url: string, activeTab?: string): Promise<string>;
}
export declare const SUCCESS_RESPONSE = "success";
//# sourceMappingURL=core.d.ts.map