import { keyringForBlockchain } from "@coral-xyz/blockchain-common";
import { BACKEND_API_URL, BACKEND_EVENT, Blockchain, DEFAULT_DARK_MODE, defaultPreferences, deserializeTransaction, EthereumConnectionUrl, EthereumExplorer, getAccountRecoveryPaths, getAddMessage, getRecoveryPaths, makeUrl, NOTIFICATION_ACTIVE_BLOCKCHAIN_UPDATED, NOTIFICATION_AGGREGATE_WALLETS_UPDATED, NOTIFICATION_APPROVED_ORIGINS_UPDATE, NOTIFICATION_AUTO_LOCK_SETTINGS_UPDATED, NOTIFICATION_BLOCKCHAIN_KEYRING_CREATED, NOTIFICATION_BLOCKCHAIN_KEYRING_DELETED, NOTIFICATION_DARK_MODE_UPDATED, NOTIFICATION_DEVELOPER_MODE_UPDATED, NOTIFICATION_ETHEREUM_ACTIVE_WALLET_UPDATED, NOTIFICATION_ETHEREUM_CHAIN_ID_UPDATED, NOTIFICATION_ETHEREUM_CONNECTION_URL_UPDATED, NOTIFICATION_ETHEREUM_EXPLORER_UPDATED, NOTIFICATION_FEATURE_GATES_UPDATED, NOTIFICATION_KEY_IS_COLD_UPDATE, NOTIFICATION_KEYNAME_UPDATE, NOTIFICATION_KEYRING_DERIVED_WALLET, NOTIFICATION_KEYRING_IMPORTED_SECRET_KEY, NOTIFICATION_KEYRING_IMPORTED_WALLET, NOTIFICATION_KEYRING_KEY_DELETE, NOTIFICATION_KEYRING_SET_MNEMONIC, NOTIFICATION_KEYRING_STORE_ACTIVE_USER_UPDATED, NOTIFICATION_KEYRING_STORE_CREATED, NOTIFICATION_KEYRING_STORE_LOCKED, NOTIFICATION_KEYRING_STORE_REMOVED_USER, NOTIFICATION_KEYRING_STORE_RESET, NOTIFICATION_KEYRING_STORE_UNLOCKED, NOTIFICATION_KEYRING_STORE_USERNAME_ACCOUNT_CREATED, NOTIFICATION_NAVIGATION_URL_DID_CHANGE, NOTIFICATION_SOLANA_ACTIVE_WALLET_UPDATED, NOTIFICATION_SOLANA_COMMITMENT_UPDATED, NOTIFICATION_SOLANA_CONNECTION_URL_UPDATED, NOTIFICATION_SOLANA_EXPLORER_UPDATED, NOTIFICATION_USER_ACCOUNT_AUTHENTICATED, NOTIFICATION_USER_ACCOUNT_PUBLIC_KEY_CREATED, NOTIFICATION_USER_ACCOUNT_PUBLIC_KEY_DELETED, NOTIFICATION_USER_ACCOUNT_PUBLIC_KEYS_UPDATED, NOTIFICATION_XNFT_PREFERENCE_UPDATED, SolanaCluster, SolanaExplorer, TAB_XNFT, } from "@coral-xyz/common";
import { KeyringStoreStateEnum, makeDefaultNav } from "@coral-xyz/recoil";
import { PublicKey, Transaction, TransactionInstruction, } from "@solana/web3.js";
import { validateMnemonic as _validateMnemonic } from "bip39";
import { ethers } from "ethers";
import { KeyringStore } from "./keyring";
import { getWalletDataForUser, setUser, setWalletDataForUser } from "./store";
import * as store from "./store";
const { base58: bs58 } = ethers.utils;
export function start(events, solanaB, ethereumB) {
    return new Backend(events, solanaB, ethereumB);
}
export class Backend {
    constructor(events, solanaB, ethereumB) {
        this.keyringStore = new KeyringStore(events);
        this.solanaConnectionBackend = solanaB;
        this.ethereumConnectionBackend = ethereumB;
        this.events = events;
        // TODO: remove once beta is over.
        this.xnftWhitelist = new Promise(async (resolve, reject) => {
            try {
                const resp = await fetch("https://app-store-api.backpack.workers.dev/api/curation/whitelist");
                const { whitelist } = await resp.json();
                resolve(whitelist);
            }
            catch (err) {
                console.error(err);
                reject(err);
            }
        });
    }
    ///////////////////////////////////////////////////////////////////////////////
    // Solana Provider.
    ///////////////////////////////////////////////////////////////////////////////
    async solanaSignAndSendTx(txStr, walletAddress, options) {
        // Sign the transaction.
        const signature = await this.solanaSignTransaction(txStr, walletAddress);
        const pubkey = new PublicKey(walletAddress);
        const tx = deserializeTransaction(txStr);
        tx.addSignature(pubkey, Buffer.from(bs58.decode(signature)));
        // Send it to the network.
        const uuid = this.keyringStore.activeUserKeyring.uuid;
        const commitment = await this.solanaCommitmentRead(uuid);
        return await this.solanaConnectionBackend.sendRawTransaction(tx.serialize(), options !== null && options !== void 0 ? options : {
            skipPreflight: false,
            preflightCommitment: commitment,
        });
    }
    async solanaSignAllTransactions(txs, walletAddress) {
        const signed = [];
        for (let k = 0; k < txs.length; k += 1) {
            signed.push(await this.solanaSignTransaction(txs[k], walletAddress));
        }
        return signed;
    }
    // Returns the signature.
    async solanaSignTransaction(txStr, walletAddress) {
        let tx = deserializeTransaction(txStr);
        const message = tx.message.serialize();
        const txMessage = bs58.encode(message);
        const blockchainKeyring = this.keyringStore.activeUserKeyring.keyringForBlockchain(Blockchain.SOLANA);
        const signature = await blockchainKeyring.signTransaction(txMessage, walletAddress);
        return signature;
    }
    async solanaSignMessage(msg, walletAddress) {
        const blockchainKeyring = this.keyringStore.activeUserKeyring.keyringForBlockchain(Blockchain.SOLANA);
        return await blockchainKeyring.signMessage(msg, walletAddress);
    }
    async solanaSimulate(txStr, addresses) {
        const tx = deserializeTransaction(txStr);
        const signersOrConf = "message" in tx
            ? {
                accounts: {
                    encoding: "base64",
                    addresses,
                },
            }
            : undefined;
        return await this.solanaConnectionBackend.simulateTransaction(tx, signersOrConf, addresses.length > 0 ? addresses.map((k) => new PublicKey(k)) : undefined);
    }
    async disconnect(origin) {
        return await this.approvedOriginsDelete(origin);
    }
    ///////////////////////////////////////////////////////////////////////////////
    // Solana.
    ///////////////////////////////////////////////////////////////////////////////
    async solanaRecentBlockhash(commitment) {
        const { blockhash } = await this.solanaConnectionBackend.getLatestBlockhash(commitment);
        return blockhash;
    }
    async solanaConnectionUrlRead(uuid) {
        var _a, _b;
        let data = await getWalletDataForUser(uuid);
        // migrate the old default RPC value, this can be removed in future
        const OLD_DEFAULT = "https://solana-rpc-nodes.projectserum.com";
        if (
        // if the current default RPC does not match the old one
        SolanaCluster.DEFAULT !== OLD_DEFAULT &&
            // and the user's RPC URL is that old default value
            ((_a = data.solana) === null || _a === void 0 ? void 0 : _a.cluster) === OLD_DEFAULT) {
            // set the user's RPC URL to the new default value
            data = {
                ...data,
                solana: {
                    ...data.solana,
                    cluster: SolanaCluster.DEFAULT,
                },
            };
            await setWalletDataForUser(uuid, data);
        }
        return (_b = (data.solana && data.solana.cluster)) !== null && _b !== void 0 ? _b : SolanaCluster.DEFAULT;
    }
    // Returns true if the url changed.
    async solanaConnectionUrlUpdate(cluster) {
        const uuid = this.keyringStore.activeUserKeyring.uuid;
        const data = await getWalletDataForUser(uuid);
        if (data.solana.cluster === cluster) {
            return false;
        }
        let keyring;
        try {
            keyring = this.keyringStore.activeUserKeyring.keyringForBlockchain(Blockchain.SOLANA);
        }
        catch {
            // Blockchain may be disabled
            keyring = null;
        }
        const activeWallet = keyring ? keyring.getActiveWallet() : null;
        await setWalletDataForUser(uuid, {
            ...data,
            solana: {
                ...data.solana,
                cluster,
            },
        });
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_SOLANA_CONNECTION_URL_UPDATED,
            data: {
                activeWallet,
                url: cluster,
            },
        });
        return true;
    }
    async solanaExplorerRead(uuid) {
        const data = await store.getWalletDataForUser(uuid);
        return data.solana && data.solana.explorer
            ? data.solana.explorer
            : SolanaExplorer.DEFAULT;
    }
    async solanaExplorerUpdate(explorer) {
        const uuid = this.keyringStore.activeUserKeyring.uuid;
        const data = await store.getWalletDataForUser(uuid);
        await store.setWalletDataForUser(uuid, {
            ...data,
            solana: {
                ...data.solana,
                explorer,
            },
        });
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_SOLANA_EXPLORER_UPDATED,
            data: {
                explorer,
            },
        });
        return SUCCESS_RESPONSE;
    }
    async solanaCommitmentRead(uuid) {
        const data = await store.getWalletDataForUser(uuid);
        return data.solana && data.solana.commitment
            ? data.solana.commitment
            : "processed";
    }
    async solanaCommitmentUpdate(commitment) {
        const uuid = this.keyringStore.activeUserKeyring.uuid;
        const data = await store.getWalletDataForUser(uuid);
        await store.setWalletDataForUser(uuid, {
            ...data,
            solana: {
                ...data.solana,
                commitment,
            },
        });
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_SOLANA_COMMITMENT_UPDATED,
            data: {
                commitment,
            },
        });
        return SUCCESS_RESPONSE;
    }
    ///////////////////////////////////////////////////////////////////////////////
    // Ethereum provider.
    ///////////////////////////////////////////////////////////////////////////////
    async ethereumSignTransaction(serializedTx, walletAddress) {
        const blockchainKeyring = this.keyringStore.activeUserKeyring.keyringForBlockchain(Blockchain.ETHEREUM);
        return await blockchainKeyring.signTransaction(serializedTx, walletAddress);
    }
    async ethereumSignAndSendTransaction(serializedTx, walletAddress) {
        const signedTx = await this.ethereumSignTransaction(serializedTx, walletAddress);
        return (await this.ethereumConnectionBackend.sendTransaction(signedTx))
            .hash;
    }
    async ethereumSignMessage(msg, walletAddress) {
        const blockchainKeyring = this.keyringStore.activeUserKeyring.keyringForBlockchain(Blockchain.ETHEREUM);
        return await blockchainKeyring.signMessage(msg, walletAddress);
    }
    ///////////////////////////////////////////////////////////////////////////////
    // Ethereum.
    ///////////////////////////////////////////////////////////////////////////////
    async ethereumExplorerRead(uuid) {
        const data = await store.getWalletDataForUser(uuid);
        return data.ethereum && data.ethereum.explorer
            ? data.ethereum.explorer
            : EthereumExplorer.DEFAULT;
    }
    async ethereumExplorerUpdate(explorer) {
        const uuid = this.keyringStore.activeUserKeyring.uuid;
        const data = await store.getWalletDataForUser(uuid);
        await store.setWalletDataForUser(uuid, {
            ...data,
            ethereum: {
                ...(data.ethereum || {}),
                explorer,
            },
        });
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_ETHEREUM_EXPLORER_UPDATED,
            data: {
                explorer,
            },
        });
        return SUCCESS_RESPONSE;
    }
    async ethereumConnectionUrlRead(uuid) {
        const data = await store.getWalletDataForUser(uuid);
        return data.ethereum && data.ethereum.connectionUrl
            ? data.ethereum.connectionUrl
            : EthereumConnectionUrl.DEFAULT;
    }
    async ethereumConnectionUrlUpdate(connectionUrl) {
        const uuid = this.keyringStore.activeUserKeyring.uuid;
        const data = await store.getWalletDataForUser(uuid);
        await store.setWalletDataForUser(uuid, {
            ...data,
            ethereum: {
                ...(data.ethereum || {}),
                connectionUrl,
            },
        });
        let keyring;
        try {
            keyring = this.keyringStore.activeUserKeyring.keyringForBlockchain(Blockchain.ETHEREUM);
        }
        catch {
            // Blockchain may be disabled
            keyring = null;
        }
        const activeWallet = keyring ? keyring.getActiveWallet() : null;
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_ETHEREUM_CONNECTION_URL_UPDATED,
            data: {
                activeWallet,
                connectionUrl,
            },
        });
        return SUCCESS_RESPONSE;
    }
    async ethereumChainIdRead() {
        const data = await store.getWalletDataForUser(this.keyringStore.activeUserKeyring.uuid);
        return data.ethereum && data.ethereum.chainId
            ? data.ethereum.chainId
            : // Default to mainnet
                "0x1";
    }
    async ethereumChainIdUpdate(chainId) {
        const uuid = this.keyringStore.activeUserKeyring.uuid;
        const data = await store.getWalletDataForUser(uuid);
        await store.setWalletDataForUser(uuid, {
            ...data,
            ethereum: {
                ...(data.ethereum || {}),
                chainId,
            },
        });
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_ETHEREUM_CHAIN_ID_UPDATED,
            data: {
                chainId,
            },
        });
        return SUCCESS_RESPONSE;
    }
    ///////////////////////////////////////////////////////////////////////////////
    // Misc
    ///////////////////////////////////////////////////////////////////////////////
    /**
     * Sign a message using a given public key. If the keyring store is not unlocked
     * keyring initialisation parameters must be provided that will initialise a
     * keyring to contain the given public key.
     *
     * This is used during onboarding to sign messages prior to the store being
     * initialised.
     */
    async signMessageForPublicKey(blockchain, publicKey, msg, keyringInit) {
        if (!keyringInit &&
            (await this.keyringStoreState()) !== KeyringStoreStateEnum.Unlocked) {
            throw new Error("provide a keyring init or unlock keyring to sign message");
        }
        let blockchainKeyring;
        // If keyring init parameters were provided then init the keyring
        if (keyringInit) {
            // Create an empty keyring to init
            blockchainKeyring = keyringForBlockchain(blockchain);
            if ("mnemonic" in keyringInit) {
                // If mnemonic wasn't actually passed retrieve it from the store. This
                // is to avoid having to pass the mnemonic to the client to make this
                // call
                if (keyringInit.mnemonic === true) {
                    keyringInit.mnemonic =
                        this.keyringStore.activeUserKeyring.exportMnemonic();
                }
            }
            await blockchainKeyring.init(keyringInit);
        }
        else {
            // We are unlocked, just use the keyring
            blockchainKeyring =
                this.keyringStore.activeUserKeyring.keyringForBlockchain(blockchain);
        }
        if (!blockchainKeyring.hasPublicKey(publicKey)) {
            throw new Error("could not find public key for signing");
        }
        if (blockchain === Blockchain.SOLANA) {
            // Setup a dummy transaction using the memo program for signing. This is
            // necessary because the Solana Ledger app does not support signMessage.
            const tx = new Transaction();
            tx.add(new TransactionInstruction({
                programId: new PublicKey(publicKey),
                keys: [],
                data: Buffer.from(bs58.decode(msg)),
            }));
            tx.feePayer = new PublicKey(publicKey);
            // Not actually needed as it's not transmitted to the network
            tx.recentBlockhash = tx.feePayer.toString();
            return await blockchainKeyring.signTransaction(bs58.encode(tx.serializeMessage()), publicKey);
        }
        return await blockchainKeyring.signMessage(msg, publicKey);
    }
    ///////////////////////////////////////////////////////////////////////////////
    // Keyring.
    ///////////////////////////////////////////////////////////////////////////////
    // Creates a brand new keyring store. Should be run once on initializtion.
    async keyringStoreCreate(username, password, keyringInit, uuid, jwt) {
        await this.keyringStore.init(username, password, keyringInit, uuid, jwt);
        // Notify all listeners.
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_KEYRING_STORE_CREATED,
            data: {
                blockchainActiveWallets: await this.blockchainActiveWallets(),
                ethereumConnectionUrl: await this.ethereumConnectionUrlRead(uuid),
                solanaConnectionUrl: await this.solanaConnectionUrlRead(uuid),
                solanaCommitment: await this.solanaCommitmentRead(uuid),
                preferences: await this.preferencesRead(uuid),
            },
        });
        return SUCCESS_RESPONSE;
    }
    async usernameAccountCreate(username, keyringInit, uuid, jwt) {
        await this.keyringStore.usernameKeyringCreate(username, keyringInit, uuid, jwt);
        const walletData = await this.keyringStoreReadAllPubkeyData();
        const preferences = await this.preferencesRead(uuid);
        const xnftPreferences = await this.getXnftPreferences();
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_KEYRING_STORE_USERNAME_ACCOUNT_CREATED,
            data: {
                user: {
                    username,
                    uuid,
                    jwt,
                },
                walletData,
                preferences,
                xnftPreferences,
            },
        });
        return SUCCESS_RESPONSE;
    }
    async activeUserUpdate(uuid) {
        // Change active user account.
        const { username, jwt } = await this.keyringStore.activeUserUpdate(uuid);
        // Get data to push back to the UI.
        const walletData = await this.keyringStoreReadAllPubkeyData();
        // Get preferences to push back to the UI.
        const preferences = await this.preferencesRead(uuid);
        const xnftPreferences = await this.getXnftPreferences();
        const blockchainKeyrings = await this.blockchainKeyringsRead();
        // Reset the navigation to the default everytime we switch users
        // but keep the active tab.
        const { activeTab } = (await store.getNav());
        await store.setNav({
            ...defaultNav,
            activeTab,
        });
        const url = defaultNav.data[activeTab].urls[0];
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_NAVIGATION_URL_DID_CHANGE,
            data: {
                url,
            },
        });
        // Push it.
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_KEYRING_STORE_ACTIVE_USER_UPDATED,
            data: {
                user: {
                    uuid,
                    username,
                    jwt,
                },
                walletData,
                preferences,
                xnftPreferences,
                blockchainKeyrings,
            },
        });
        // Done.
        return SUCCESS_RESPONSE;
    }
    async keyringStoreCheckPassword(password) {
        return await this.keyringStore.checkPassword(password);
    }
    async keyringStoreUnlock(password, uuid) {
        //
        // Note: we package the userInfo into an object so that it can be mutated
        //       by downstream functions. This is required, e.g., for migrating
        //       when a uuid doesn't yet exist on the client.
        //
        const userInfo = { password, uuid };
        await this.keyringStore.tryUnlock(userInfo);
        const activeUser = (await store.getUserData()).activeUser;
        const blockchainActiveWallets = await this.blockchainActiveWallets();
        const ethereumConnectionUrl = await this.ethereumConnectionUrlRead(userInfo.uuid);
        const ethereumChainId = await this.ethereumChainIdRead();
        const solanaConnectionUrl = await this.solanaConnectionUrlRead(userInfo.uuid);
        const solanaCommitment = await this.solanaCommitmentRead(userInfo.uuid);
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_KEYRING_STORE_UNLOCKED,
            data: {
                activeUser,
                blockchainActiveWallets,
                ethereumConnectionUrl,
                ethereumChainId,
                solanaConnectionUrl,
                solanaCommitment,
            },
        });
        return SUCCESS_RESPONSE;
    }
    keyringStoreAutoLockCountdownToggle(enable) {
        this.keyringStore.autoLockCountdownToggle(enable);
    }
    keyringStoreAutoLockCountdownRestart() {
        this.keyringStore.autoLockCountdownRestart();
    }
    keyringStoreAutoLockReset() {
        this.keyringStore.autoLockCountdownReset();
    }
    keyringStoreLock() {
        this.keyringStore.lock();
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_KEYRING_STORE_LOCKED,
        });
        return SUCCESS_RESPONSE;
    }
    async keyringStoreState() {
        return await this.keyringStore.state();
    }
    keyringStoreKeepAlive() {
        this.keyringStore.keepAlive();
        return SUCCESS_RESPONSE;
    }
    async keyringStoreReadAllPubkeyData() {
        const activePublicKeys = await this.activeWallets();
        const publicKeys = await this.keyringStoreReadAllPubkeys();
        const activeBlockchain = this.keyringStore.activeUserKeyring.activeBlockchain;
        return {
            activeBlockchain,
            activePublicKeys,
            publicKeys,
        };
    }
    // Returns all pubkeys available for signing.
    async keyringStoreReadAllPubkeys() {
        const publicKeys = await this.keyringStore.publicKeys();
        const namedPublicKeys = {};
        for (const [blockchain, blockchainKeyring] of Object.entries(publicKeys)) {
            namedPublicKeys[blockchain] = {};
            for (const [keyring, publicKeys] of Object.entries(blockchainKeyring)) {
                if (!namedPublicKeys[blockchain][keyring]) {
                    namedPublicKeys[blockchain][keyring] = [];
                }
                for (const publicKey of publicKeys) {
                    namedPublicKeys[blockchain][keyring].push({
                        publicKey,
                        name: await store.getKeyname(publicKey),
                        isCold: await store.getIsCold(publicKey),
                    });
                }
            }
        }
        return namedPublicKeys;
    }
    activeWalletForBlockchain(b) {
        return this.keyringStore.activeUserKeyring
            .keyringForBlockchain(b)
            .getActiveWallet();
    }
    async activeWallets() {
        return await this.keyringStore.activeWallets();
    }
    async preferencesRead(uuid) {
        //
        // First time onboarding this will throw an error, in which case
        // we return a default set of preferences.
        //
        try {
            return await store.getWalletDataForUser(uuid);
        }
        catch (err) {
            return defaultPreferences();
        }
    }
    async activeWalletUpdate(newActivePublicKey, blockchain) {
        const keyring = this.keyringStore.activeUserKeyring.keyringForBlockchain(blockchain);
        const oldBlockchain = this.keyringStore.activeUserKeyring.activeBlockchain;
        const oldActivePublicKey = keyring.getActiveWallet();
        await this.keyringStore.activeWalletUpdate(newActivePublicKey, blockchain);
        if (newActivePublicKey !== oldActivePublicKey) {
            // Public key has changed, emit an event
            // TODO: remove the blockchain specific events in favour of a single event
            if (blockchain === Blockchain.SOLANA) {
                this.events.emit(BACKEND_EVENT, {
                    name: NOTIFICATION_SOLANA_ACTIVE_WALLET_UPDATED,
                    data: {
                        activeWallet: newActivePublicKey,
                        activeWallets: await this.activeWallets(),
                    },
                });
            }
            else if (blockchain === Blockchain.ETHEREUM) {
                this.events.emit(BACKEND_EVENT, {
                    name: NOTIFICATION_ETHEREUM_ACTIVE_WALLET_UPDATED,
                    data: {
                        activeWallet: newActivePublicKey,
                        activeWallets: await this.activeWallets(),
                    },
                });
            }
        }
        if (blockchain !== oldBlockchain) {
            this.events.emit(BACKEND_EVENT, {
                name: NOTIFICATION_ACTIVE_BLOCKCHAIN_UPDATED,
                data: {
                    oldBlockchain,
                    newBlockchain: blockchain,
                },
            });
        }
        return SUCCESS_RESPONSE;
    }
    // Map of blockchain to the active public key for that blockchain.
    async blockchainActiveWallets() {
        return Object.fromEntries((await this.activeWallets()).map((publicKey) => {
            return [
                this.keyringStore.activeUserKeyring.blockchainForPublicKey(publicKey),
                publicKey,
            ];
        }));
    }
    async keyringReadNextDerivationPath(blockchain, keyring) {
        return this.keyringStore.nextDerivationPath(blockchain, keyring);
    }
    /**
     * Add a new wallet to the keyring using the next derived wallet for the mnemonic.
     * @param blockchain - Blockchain to add the wallet for
     */
    async keyringImportWallet(signedWalletDescriptor) {
        const { blockchain } = signedWalletDescriptor;
        const { publicKey, name } = await this.keyringStore.addDerivationPath(blockchain, signedWalletDescriptor.derivationPath);
        try {
            await this.userAccountPublicKeyCreate(blockchain, publicKey, signedWalletDescriptor.signature);
        }
        catch (error) {
            // Something went wrong persisting to server, roll back changes to the
            // keyring. This is not a complete rollback of state changes, because
            // the next account index gets incremented. This is the correct behaviour
            // because it should allow for sensible retries on conflicts.
            await this.keyringKeyDelete(blockchain, publicKey);
            throw error;
        }
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_KEYRING_IMPORTED_WALLET,
            data: {
                blockchain,
                publicKey,
                name,
            },
        });
        // Set the active wallet to the newly added public key
        await this.activeWalletUpdate(publicKey, blockchain);
        // Return the newly added public key
        return publicKey.toString();
    }
    /**
     * Add a new wallet to the keyring using the next derived wallet for the mnemonic.
     * @param blockchain - Blockchain to add the wallet for
     */
    async keyringDeriveWallet(blockchain, retries = 0) {
        const { publicKey, name } = await this.keyringStore.deriveNextKey(blockchain);
        try {
            await this.userAccountPublicKeyCreate(blockchain, publicKey);
        }
        catch (error) {
            // Something went wrong persisting to server, roll back changes to the
            // keyring. This is not a complete rollback of state changes, because
            // the next account index gets incremented. This is the correct behaviour
            // because it should allow for sensible retries on conflicts.
            await this.keyringKeyDelete(blockchain, publicKey);
            if (retries < 10) {
                // Key conflict with already exist account, retry
                // Last key will be skipped because the wallet index will have incremented
                return await this.keyringDeriveWallet(blockchain, retries);
            }
            throw error;
        }
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_KEYRING_DERIVED_WALLET,
            data: {
                blockchain,
                publicKey,
                name,
            },
        });
        // Set the active wallet to the newly added public key
        await this.activeWalletUpdate(publicKey, blockchain);
        // Return the newly added public key
        return publicKey.toString();
    }
    async keyIsCold(publicKey) {
        return await store.getIsCold(publicKey);
    }
    async keyIsColdUpdate(publicKey, isCold) {
        await store.setIsCold(publicKey, isCold);
        const walletData = await this.keyringStoreReadAllPubkeyData();
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_KEY_IS_COLD_UPDATE,
            data: {
                publicKey,
                isCold,
                walletData,
            },
        });
        return SUCCESS_RESPONSE;
    }
    /**
     * Read the name associated with a public key in the local store.
     * @param publicKey - public key to read the name for
     */
    async keynameRead(publicKey) {
        return await store.getKeyname(publicKey);
    }
    /**
     * Update the name associated with a public key in the local store.
     * @param publicKey - public key to update the name for
     * @param newName - new name to associate with the public key
     */
    async keynameUpdate(publicKey, newName) {
        await store.setKeyname(publicKey, newName);
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_KEYNAME_UPDATE,
            data: {
                publicKey,
                name: newName,
            },
        });
        return SUCCESS_RESPONSE;
    }
    /**
     * Remove a wallet from the keyring and delete the public key record on the
     * server. If the public key was the last public key on the keyring then also
     * remove the entire blockchain keyring.
     * @param blockchain - Blockchain for the public key
     * @param publicKey - Public key to remove
     */
    async keyringKeyDelete(blockchain, publicKey) {
        const keyring = this.keyringStore.activeUserKeyring.keyringForBlockchain(blockchain);
        let nextActivePublicKey;
        const activeWallet = keyring.getActiveWallet();
        // If we're removing the currently active key then we need to update it
        // first.
        if (activeWallet === publicKey) {
            // Find remaining public keys
            nextActivePublicKey = Object.values(keyring.publicKeys())
                .flat()
                .find((k) => k !== keyring.getActiveWallet());
            // Set the next active public key if we deleted the active one. Note this
            // is a local state change so it needs to come after the API request to
            // remove the public key
            if (nextActivePublicKey) {
                // Set the active public key to another public key on the same
                // blockchain if possible
                await this.activeWalletUpdate(nextActivePublicKey, blockchain);
            }
            else {
                // No public key on the currently active blockchain could be found,
                // which means that we've removed the last public key from the active
                // blockchain keyring. We need to set a new active blockchain and
                // public key.
                const newBlockchain = (await this.blockchainKeyringsRead()).find((b) => b !== blockchain);
                if (!newBlockchain) {
                    throw new Error("cannot delete the last public key");
                }
                const newPublicKey = Object.values((await this.keyringStoreReadAllPubkeys())[newBlockchain]).flat()[0].publicKey;
                // Update the active wallet
                await this.activeWalletUpdate(newPublicKey, newBlockchain);
            }
        }
        // Remove the public key from the Backpack API
        await this.userAccountPublicKeyDelete(blockchain, publicKey);
        await this.keyringStore.keyDelete(blockchain, publicKey);
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_KEYRING_KEY_DELETE,
            data: {
                blockchain,
                deletedPublicKey: publicKey,
            },
        });
        const emptyKeyring = Object.values(keyring.publicKeys()).flat().length === 0;
        if (emptyKeyring) {
            // Keyring has no public keys, remove
            await this.keyringStore.blockchainKeyringRemove(blockchain);
            const publicKeyData = await this.keyringStoreReadAllPubkeyData();
            this.events.emit(BACKEND_EVENT, {
                name: NOTIFICATION_BLOCKCHAIN_KEYRING_DELETED,
                data: {
                    blockchain,
                    publicKeyData,
                },
            });
        }
        return SUCCESS_RESPONSE;
    }
    // Returns the active username.
    // We read this directly from storage so that we can use it even when the
    // keyring is locked.
    async userRead() {
        try {
            const user = await store.getActiveUser();
            return user;
        }
        catch (err) {
            return { username: "", uuid: "", jwt: "" };
        }
    }
    async userJwtUpdate(uuid, jwt) {
        await setUser(uuid, { jwt });
        const walletData = await this.keyringStoreReadAllPubkeyData();
        const preferences = await this.preferencesRead(uuid);
        const xnftPreferences = await this.getXnftPreferences();
        const blockchainKeyrings = await this.blockchainKeyringsRead();
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_KEYRING_STORE_ACTIVE_USER_UPDATED,
            data: {
                user: {
                    uuid,
                    username: this.keyringStore.activeUserKeyring.username,
                    jwt,
                },
                walletData,
                preferences,
                xnftPreferences,
                blockchainKeyrings,
            },
        });
        return SUCCESS_RESPONSE;
    }
    async allUsersRead() {
        const userData = await store.getUserData();
        return userData.users;
    }
    async passwordUpdate(currentPassword, newPassword) {
        await this.keyringStore.passwordUpdate(currentPassword, newPassword);
        return SUCCESS_RESPONSE;
    }
    async importSecretKey(blockchain, secretKey, name) {
        const [publicKey, _name] = await this.keyringStore.importSecretKey(blockchain, secretKey, name);
        try {
            await this.userAccountPublicKeyCreate(blockchain, publicKey);
        }
        catch (error) {
            // Something went wrong persisting to server, roll back changes to the
            // keyring.
            await this.keyringKeyDelete(blockchain, publicKey);
            throw error;
        }
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_KEYRING_IMPORTED_SECRET_KEY,
            data: {
                blockchain,
                publicKey,
                name: _name,
            },
        });
        // Set the active wallet to the newly added public key
        await this.activeWalletUpdate(publicKey, blockchain);
        return publicKey;
    }
    keyringExportSecretKey(password, pubkey) {
        return this.keyringStore.exportSecretKey(password, pubkey);
    }
    keyringExportMnemonic(password) {
        return this.keyringStore.exportMnemonic(password);
    }
    async keyringAutoLockSettingsRead(uuid) {
        const data = await store.getWalletDataForUser(uuid);
        return data.autoLockSettings;
    }
    async keyringAutoLockSettingsUpdate(seconds, option) {
        await this.keyringStore.autoLockSettingsUpdate(seconds, option);
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_AUTO_LOCK_SETTINGS_UPDATED,
            data: {
                autoLockSettings: {
                    seconds,
                    option,
                },
            },
        });
        return SUCCESS_RESPONSE;
    }
    async keyringReset() {
        await this.keyringStore.reset();
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_KEYRING_STORE_RESET,
        });
        return SUCCESS_RESPONSE;
    }
    async ledgerImport(signedWalletDescriptor) {
        const { signature, ...walletDescriptor } = signedWalletDescriptor;
        const { blockchain, publicKey } = walletDescriptor;
        await this.keyringStore.ledgerImport(walletDescriptor);
        try {
            await this.userAccountPublicKeyCreate(blockchain, publicKey, signature);
        }
        catch (error) {
            // Something went wrong persisting to server, roll back changes to the
            // keyring.
            await this.keyringKeyDelete(blockchain, publicKey);
            throw error;
        }
        // Set the active wallet to the newly added public key
        await this.activeWalletUpdate(publicKey, blockchain);
        return SUCCESS_RESPONSE;
    }
    validateMnemonic(mnemonic) {
        return _validateMnemonic(mnemonic);
    }
    async mnemonicCreate(strength) {
        return this.keyringStore.createMnemonic(strength);
    }
    /**
     * Attempt to recover unrecovered wallets that exist on the keyring mnemonic.
     */
    async mnemonicSync(serverPublicKeys) {
        const blockchains = [...new Set(serverPublicKeys.map((x) => x.blockchain))];
        for (const blockchain of blockchains) {
            const recoveryPaths = getRecoveryPaths(blockchain);
            const mnemonic = this.keyringStore.activeUserKeyring.exportMnemonic();
            const publicKeys = await this.previewPubkeys(blockchain, mnemonic, recoveryPaths);
            //
            // The set of all keys currently in the keyring store. Don't try to sync
            // a key if it's already client side.
            //
            const allLocalKeys = Object.values(await this.keyringStoreReadAllPubkeys())
                .map((p) => p.hdPublicKeys
                .concat(p.importedPublicKeys)
                .concat(p.ledgerPublicKeys)
                .map((p) => p.publicKey))
                .reduce((a, b) => a.concat(b), []);
            const searchPublicKeys = serverPublicKeys
                .filter((b) => b.blockchain === blockchain)
                .map((p) => p.publicKey)
                .filter((p) => !allLocalKeys.includes(p));
            for (const searchPublicKey of searchPublicKeys) {
                const index = publicKeys.findIndex((p) => p === searchPublicKey);
                if (index !== -1) {
                    // There is a match among the recovery paths
                    let blockchainKeyring = undefined;
                    // Check if the blockchain keyring already exists
                    try {
                        blockchainKeyring =
                            this.keyringStore.activeUserKeyring.keyringForBlockchain(blockchain);
                    }
                    catch {
                        // Doesn't exist, we can create it
                    }
                    if (blockchainKeyring) {
                        let [publicKey, name] = await (async () => {
                            const derivationPath = recoveryPaths[index];
                            if (!blockchainKeyring.hasHdKeyring()) {
                                const [[publicKey, name]] = await blockchainKeyring.initHdKeyring(mnemonic, [
                                    derivationPath,
                                ]);
                                return [publicKey, name];
                            }
                            else {
                                // Exists, just add the missing derivation path
                                const { publicKey, name } = await this.keyringStore.activeUserKeyring
                                    .keyringForBlockchain(blockchain)
                                    .addDerivationPath(derivationPath);
                                return [publicKey, name];
                            }
                        })();
                        this.events.emit(BACKEND_EVENT, {
                            name: NOTIFICATION_KEYRING_DERIVED_WALLET,
                            data: {
                                blockchain,
                                publicKey,
                                name,
                            },
                        });
                    }
                    else {
                        // Create blockchain keyring
                        const walletDescriptor = {
                            blockchain,
                            publicKey: publicKeys[index],
                            derivationPath: recoveryPaths[index],
                        };
                        await this.blockchainKeyringsAdd({
                            mnemonic,
                            signedWalletDescriptors: [
                                {
                                    ...walletDescriptor,
                                    signature: "",
                                },
                            ],
                        });
                    }
                }
            }
        }
    }
    keyringHasMnemonic() {
        return this.keyringStore.activeUserKeyring.hasMnemonic();
    }
    keyringSetMnemonic(mnemonic) {
        this.keyringStore.activeUserKeyring.setMnemonic(mnemonic);
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_KEYRING_SET_MNEMONIC,
        });
    }
    async previewPubkeys(blockchain, mnemonic, derivationPaths) {
        return this.keyringStore.previewPubkeys(blockchain, mnemonic, derivationPaths);
    }
    ///////////////////////////////////////////////////////////////////////////////
    // User account.
    ///////////////////////////////////////////////////////////////////////////////
    /**
     * Add a public key to a Backpack account via the Backpack API.
     */
    async userAccountPublicKeyCreate(blockchain, publicKey, signature) {
        // Persist the newly added public key to the Backpack API
        if (!signature) {
            // Signature should only be undefined for non hardware wallets
            signature = await this.signMessageForPublicKey(blockchain, publicKey, bs58.encode(Buffer.from(getAddMessage(publicKey), "utf-8")));
        }
        const response = await fetch(`${BACKEND_API_URL}/users/publicKeys`, {
            method: "POST",
            body: JSON.stringify({
                blockchain,
                signature,
                publicKey,
            }),
            headers: {
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) {
            throw new Error((await response.json()).msg);
        }
        // 204 => the key was already created on the server previously.
        if (response.status === 204) {
            return;
        }
        const primary = (await response.json()).isPrimary;
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_USER_ACCOUNT_PUBLIC_KEY_CREATED,
            data: {
                blockchain,
                publicKey,
                primary,
            },
        });
    }
    /**
     * Remove a public key from a Backpack account via the Backpack API.
     */
    async userAccountPublicKeyDelete(blockchain, publicKey) {
        // Remove the key from the server
        const response = await fetch(`${BACKEND_API_URL}/users/publicKeys`, {
            method: "DELETE",
            body: JSON.stringify({
                blockchain,
                publicKey,
            }),
            headers: {
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) {
            throw new Error("could not remove public key");
        }
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_USER_ACCOUNT_PUBLIC_KEY_DELETED,
            data: {
                blockchain,
                publicKey,
            },
        });
        return SUCCESS_RESPONSE;
    }
    /**
     * Attempt to authenticate a Backpack account using the Backpack API.
     */
    async userAccountAuth(blockchain, publicKey, message, signature) {
        const response = await fetch(`${BACKEND_API_URL}/authenticate`, {
            method: "POST",
            body: JSON.stringify({
                blockchain,
                publicKey,
                message: bs58.encode(Buffer.from(message, "utf-8")),
                signature,
            }),
            headers: {
                "Content-Type": "application/json",
            },
        });
        if (response.status !== 200)
            throw new Error(`could not authenticate`);
        const json = await response.json();
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_USER_ACCOUNT_AUTHENTICATED,
            data: {
                username: json.username,
                uuid: json.id,
                jwt: json.jwt,
            },
        });
        return json;
    }
    /**
     * Logout a Backpack account using the Backpack API.
     */
    async userAccountLogout(uuid) {
        // Clear the jwt cookie if it exists. Don't block.
        await fetch(`${BACKEND_API_URL}/authenticate`, {
            method: "DELETE",
        });
        //
        // If we're logging out the last user, reset the entire app.
        //
        const data = await store.getUserData();
        if (data.users.length === 1) {
            await this.keyringReset();
            return SUCCESS_RESPONSE;
        }
        //
        // If we have more users available, just remove the user.
        //
        const isNewActiveUser = await this.keyringStore.removeUser(uuid);
        //
        // If the user changed, notify the UI.
        //
        if (isNewActiveUser) {
            const user = await this.userRead();
            const walletData = await this.keyringStoreReadAllPubkeyData();
            const preferences = await this.preferencesRead(uuid);
            const xnftPreferences = await this.getXnftPreferences();
            const blockchainKeyrings = await this.blockchainKeyringsRead();
            this.events.emit(BACKEND_EVENT, {
                name: NOTIFICATION_KEYRING_STORE_ACTIVE_USER_UPDATED,
                data: {
                    user,
                    walletData,
                    preferences,
                    xnftPreferences,
                    blockchainKeyrings,
                },
            });
        }
        else {
            //
            // Notify the UI about the removal.
            //
            this.events.emit(BACKEND_EVENT, {
                name: NOTIFICATION_KEYRING_STORE_REMOVED_USER,
            });
        }
        //
        // Done.
        //
        return SUCCESS_RESPONSE;
    }
    /**
     * Read a Backpack account from the Backpack API.
     */
    async userAccountRead(jwt) {
        const headers = {
            "Content-Type": "application/json",
            ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        };
        const response = await fetch(`${BACKEND_API_URL}/users/me`, {
            method: "GET",
            headers,
        });
        if (response.status === 403) {
            throw new Error("user not authenticated");
        }
        else if (response.status === 404) {
            // User does not exist on server, how to handle?
            throw new Error("user does not exist");
        }
        else if (response.status !== 200) {
            throw new Error(`could not fetch user`);
        }
        const json = await response.json();
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_USER_ACCOUNT_AUTHENTICATED,
            data: {
                username: json.username,
                uuid: json.id,
                jwt: json.jwt,
            },
        });
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_USER_ACCOUNT_PUBLIC_KEYS_UPDATED,
            data: {
                publicKeys: json.publicKeys,
            },
        });
        return json;
    }
    /**
     * Find a `WalletDescriptor` that can be used to create a new account.
     * This requires that the sub wallets on the account index are not used by a
     * existing user account. This is checked by querying the Backpack API.
     *
     * This only works for mnemonics or a keyring store unlocked with a mnemonic
     * because the background service worker can't use a Ledger.
     */
    async findWalletDescriptor(blockchain, accountIndex = 0, mnemonic) {
        // If mnemonic is not passed as an argument, use the keyring store stored mnemonic.
        // Wallet must be unlocked.
        if (!mnemonic)
            mnemonic = this.keyringStore.activeUserKeyring.exportMnemonic();
        const recoveryPaths = getAccountRecoveryPaths(blockchain, accountIndex);
        const publicKeys = await this.previewPubkeys(blockchain, mnemonic, recoveryPaths);
        const users = await this.findServerPublicKeyConflicts(publicKeys.map((publicKey) => ({
            blockchain,
            publicKey,
        })));
        if (users.length === 0) {
            // No users for any of the passed public keys, good to go
            // Take the root for the public key path
            const publicKey = publicKeys[0];
            const derivationPath = recoveryPaths[0];
            return {
                blockchain,
                derivationPath,
                publicKey,
            };
        }
        else {
            // Iterate on account index
            return this.findWalletDescriptor(blockchain, accountIndex + 1, mnemonic);
        }
    }
    /**
     * Query the Backpack API to check if a user has already used any of the
     * blockchain/public key pairs from a list.
     */
    async findServerPublicKeyConflicts(serverPublicKeys) {
        const url = `${BACKEND_API_URL}/publicKeys`;
        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify(serverPublicKeys),
            headers: {
                "Content-Type": "application/json",
            },
        }).then((r) => r.json());
        return response;
    }
    ///////////////////////////////////////////////////////////////////////////////
    // Preferences.
    ///////////////////////////////////////////////////////////////////////////////
    async darkModeRead(uuid) {
        var _a;
        const state = await this.keyringStoreState();
        if (state === "needs-onboarding") {
            return DEFAULT_DARK_MODE;
        }
        const data = await store.getWalletDataForUser(uuid);
        return (_a = data.darkMode) !== null && _a !== void 0 ? _a : DEFAULT_DARK_MODE;
    }
    async darkModeUpdate(darkMode) {
        const uuid = this.keyringStore.activeUserKeyring.uuid;
        const data = await store.getWalletDataForUser(uuid);
        await store.setWalletDataForUser(uuid, {
            ...data,
            darkMode,
        });
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_DARK_MODE_UPDATED,
            data: {
                darkMode,
            },
        });
        return SUCCESS_RESPONSE;
    }
    async developerModeRead(uuid) {
        var _a;
        const data = await store.getWalletDataForUser(uuid);
        return (_a = data.developerMode) !== null && _a !== void 0 ? _a : false;
    }
    async developerModeUpdate(developerMode) {
        const uuid = this.keyringStore.activeUserKeyring.uuid;
        const data = await store.getWalletDataForUser(uuid);
        await store.setWalletDataForUser(uuid, {
            ...data,
            developerMode,
        });
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_DEVELOPER_MODE_UPDATED,
            data: {
                developerMode,
            },
        });
        return SUCCESS_RESPONSE;
    }
    async aggregateWalletsUpdate(aggregateWallets) {
        const uuid = this.keyringStore.activeUserKeyring.uuid;
        const data = await store.getWalletDataForUser(uuid);
        await store.setWalletDataForUser(uuid, {
            ...data,
            aggregateWallets,
        });
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_AGGREGATE_WALLETS_UPDATED,
            data: {
                aggregateWallets,
            },
        });
        return SUCCESS_RESPONSE;
    }
    async isApprovedOrigin(origin) {
        const { uuid } = await this.userRead();
        const data = await store.getWalletDataForUser(uuid);
        if (!data.approvedOrigins) {
            return false;
        }
        const found = data.approvedOrigins.find((o) => o === origin);
        return found !== undefined;
    }
    async approvedOriginsRead(uuid) {
        const data = await store.getWalletDataForUser(uuid);
        return data.approvedOrigins;
    }
    async approvedOriginsUpdate(approvedOrigins) {
        const uuid = this.keyringStore.activeUserKeyring.uuid;
        const data = await store.getWalletDataForUser(uuid);
        await store.setWalletDataForUser(uuid, {
            ...data,
            approvedOrigins,
        });
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_APPROVED_ORIGINS_UPDATE,
            data: {
                approvedOrigins,
            },
        });
        return SUCCESS_RESPONSE;
    }
    async approvedOriginsDelete(origin) {
        const uuid = this.keyringStore.activeUserKeyring.uuid;
        const data = await store.getWalletDataForUser(uuid);
        const approvedOrigins = data.approvedOrigins.filter((o) => o !== origin);
        await store.setWalletDataForUser(uuid, {
            ...data,
            approvedOrigins,
        });
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_APPROVED_ORIGINS_UPDATE,
            data: {
                approvedOrigins,
            },
        });
        return SUCCESS_RESPONSE;
    }
    ///////////////////////////////////////////////////////////////////////////////
    // Blockchains
    ///////////////////////////////////////////////////////////////////////////////
    /**
     * Add a new blockchain keyring to the keyring store (i.e. initialize it).
     */
    async blockchainKeyringsAdd(keyringInit) {
        const { blockchain, signature, publicKey } = "signedWalletDescriptors" in keyringInit
            ? keyringInit.signedWalletDescriptors[0]
            : keyringInit;
        await this.keyringStore.blockchainKeyringAdd(blockchain, keyringInit);
        // Add the new public key to the API
        try {
            await this.userAccountPublicKeyCreate(blockchain, publicKey, signature);
        }
        catch (error) {
            // Roll back the added blockchain keyring
            await this.keyringStore.blockchainKeyringRemove(blockchain);
            throw error;
        }
        const publicKeyData = await this.keyringStoreReadAllPubkeyData();
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_BLOCKCHAIN_KEYRING_CREATED,
            data: {
                blockchain,
                activeWallet: publicKey,
                publicKeyData,
            },
        });
        return publicKey;
    }
    /**
     * Return all blockchains that have initialised keyrings, even if they are not
     * enabled.
     */
    async blockchainKeyringsRead() {
        return this.keyringStore.activeUserKeyring.blockchainKeyrings();
    }
    async setFeatureGates(gates) {
        await store.setFeatureGates(gates);
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_FEATURE_GATES_UPDATED,
            data: {
                gates,
            },
        });
    }
    async getFeatureGates() {
        return await store.getFeatureGates();
    }
    async setXnftPreferences(xnftId, preference) {
        const uuid = this.keyringStore.activeUserKeyring.uuid;
        const currentPreferences = (await store.getXnftPreferencesForUser(uuid)) || {};
        const updatedPreferences = {
            ...currentPreferences,
            [xnftId]: {
                ...(currentPreferences[xnftId] || {}),
                ...preference,
            },
        };
        await store.setXnftPreferencesForUser(uuid, updatedPreferences);
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_XNFT_PREFERENCE_UPDATED,
            data: { updatedPreferences },
        });
    }
    async getXnftPreferences() {
        const uuid = this.keyringStore.activeUserKeyring.uuid;
        return await store.getXnftPreferencesForUser(uuid);
    }
    ///////////////////////////////////////////////////////////////////////////////
    // Navigation.
    ///////////////////////////////////////////////////////////////////////////////
    async navigationPush(url, tab, pushAboveRoot) {
        var _a;
        let nav = await store.getNav();
        if (!nav) {
            throw new Error("nav not found");
        }
        const targetTab = tab !== null && tab !== void 0 ? tab : nav.activeTab;
        // This is a temporary measure for the duration of the private beta in order
        // to control the xNFTs that can be opened from within Backpack AND
        // externally using the injected provider's `openXnft` function.
        //
        // The whitelist is controlled internally and exposed through the xNFT
        // library's worker API to check the address of the xNFT attempting to be
        // opened by the user.
        if (targetTab === TAB_XNFT) {
            const pk = url.split("/")[1];
            const cachedWhitelist = await this.xnftWhitelist;
            if (!cachedWhitelist.includes(pk)) {
                // Secondary lazy check to ensure there wasn't a whitelist update in-between cache updates
                const resp = await fetch(`https://app-store-api.backpack.workers.dev/api/curation/whitelist/check?address=${pk}`);
                const { whitelisted } = await resp.json();
                if (!whitelisted) {
                    throw new Error("opening an xnft that is not whitelisted");
                }
            }
        }
        else {
            delete nav.data[TAB_XNFT];
        }
        nav.data[targetTab] = (_a = nav.data[targetTab]) !== null && _a !== void 0 ? _a : { id: targetTab, urls: [] };
        const urls = nav.data[targetTab].urls;
        if (urls.length > 0 && urls[urls.length - 1] === url) {
            return SUCCESS_RESPONSE;
        }
        if (pushAboveRoot && nav.data[targetTab].urls[0]) {
            nav.data[targetTab].urls = [nav.data[targetTab].urls[0]];
        }
        nav.data[targetTab].urls.push(url);
        await store.setNav(nav);
        url = setSearchParam(url, "nav", "push");
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_NAVIGATION_URL_DID_CHANGE,
            data: {
                url,
            },
        });
        return SUCCESS_RESPONSE;
    }
    async navigationPop(tab) {
        var _a;
        let nav = await store.getNav();
        if (!nav) {
            throw new Error("nav not found");
        }
        const targetTab = tab !== null && tab !== void 0 ? tab : nav.activeTab;
        nav.data[targetTab] = (_a = nav.data[targetTab]) !== null && _a !== void 0 ? _a : { id: targetTab, urls: [] };
        nav.data[targetTab].urls.pop();
        await store.setNav(nav);
        const urls = nav.data[targetTab].urls.length > 0
            ? nav.data[targetTab].urls
            : nav.data[nav.activeTab].urls;
        let url = urls[urls.length - 1];
        url = setSearchParam(url, "nav", "pop");
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_NAVIGATION_URL_DID_CHANGE,
            data: {
                url,
            },
        });
        return SUCCESS_RESPONSE;
    }
    async navigationToDefault() {
        await store.setNav(defaultNav);
        return SUCCESS_RESPONSE;
    }
    async navigationToRoot() {
        let nav = await store.getNav();
        if (!nav) {
            throw new Error("nav not found");
        }
        delete nav.data[TAB_XNFT];
        const urls = nav.data[nav.activeTab].urls;
        if (urls.length <= 1) {
            return SUCCESS_RESPONSE;
        }
        let url = urls[0];
        nav.data[nav.activeTab].urls = [url];
        await store.setNav(nav);
        url = setSearchParam(url, "nav", "pop");
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_NAVIGATION_URL_DID_CHANGE,
            data: {
                url,
            },
        });
        return SUCCESS_RESPONSE;
    }
    async navRead() {
        let nav = await store.getNav();
        if (!nav) {
            await store.setNav(defaultNav);
            nav = defaultNav;
        }
        // @ts-ignore
        return nav;
    }
    async navReadUrl() {
        var _a;
        const nav = await this.navRead();
        let urls = nav.data[nav.activeTab].urls;
        if (((_a = nav.data[TAB_XNFT]) === null || _a === void 0 ? void 0 : _a.urls.length) > 0) {
            urls = nav.data[TAB_XNFT].urls;
        }
        return urls[urls.length - 1];
    }
    async navigationActiveTabUpdate(activeTab) {
        const currNav = await store.getNav();
        if (!currNav) {
            throw new Error("invariant violation");
        }
        const nav = {
            ...currNav,
            activeTab,
        };
        if (activeTab !== TAB_XNFT) {
            delete nav.data[TAB_XNFT];
        }
        // Newly introduced messages tab needs to be added to the
        // store for backward compatability
        if (activeTab === "messages" && !nav.data[activeTab]) {
            nav.data[activeTab] = {
                id: "messages",
                urls: [makeUrl("messages", { title: "Messages", props: {} })],
            };
        }
        await store.setNav(nav);
        const navData = nav.data[activeTab];
        let url = navData.urls[navData.urls.length - 1];
        url = setSearchParam(url, "nav", "tab");
        this.events.emit(BACKEND_EVENT, {
            name: NOTIFICATION_NAVIGATION_URL_DID_CHANGE,
            data: {
                url,
            },
        });
        return SUCCESS_RESPONSE;
    }
    async navigationOpenChat(chatName) {
        console.log("openchat");
        return SUCCESS_RESPONSE;
    }
    async navigationCurrentUrlUpdate(url, activeTab) {
        // Get the tab nav.
        const currNav = await store.getNav();
        if (!currNav) {
            throw new Error("invariant violation");
        }
        if (activeTab !== TAB_XNFT) {
            delete currNav.data[TAB_XNFT];
        }
        // Update the active tab's nav stack.
        const navData = currNav.data[activeTab !== null && activeTab !== void 0 ? activeTab : currNav.activeTab];
        if (!navData) {
            // We exit gracefully so that we don't crash the app.
            console.error(`navData not found for tab ${activeTab}`);
            return SUCCESS_RESPONSE;
        }
        navData.urls[navData.urls.length - 1] = url;
        currNav.data[activeTab !== null && activeTab !== void 0 ? activeTab : currNav.activeTab] = navData;
        // Save the change.
        await store.setNav(currNav);
        // Only navigate if the user hasn't already moved away from this tab
        // or if the user didn't explicitly send an activeTab
        if (!activeTab || activeTab === currNav.activeTab) {
            // Notify listeners.
            this.events.emit(BACKEND_EVENT, {
                name: NOTIFICATION_NAVIGATION_URL_DID_CHANGE,
                data: {
                    url,
                    nav: "tab",
                },
            });
        }
        return SUCCESS_RESPONSE;
    }
}
export const SUCCESS_RESPONSE = "success";
const defaultNav = makeDefaultNav();
function setSearchParam(url, key, value) {
    const [path, search] = url.split("?");
    const searchParams = new URLSearchParams(search);
    searchParams.delete(key);
    searchParams.append(key, value);
    return `${path}?${searchParams.toString()}`;
}
//# sourceMappingURL=core.js.map