import { BACKEND_EVENT, BackgroundSolanaConnection, Blockchain, confirmTransaction, customSplTokenAccounts, fetchSplMetadataUri, getLogger, NOTIFICATION_BLOCKCHAIN_KEYRING_CREATED, NOTIFICATION_BLOCKCHAIN_KEYRING_DELETED, NOTIFICATION_KEYRING_STORE_CREATED, NOTIFICATION_KEYRING_STORE_LOCKED, NOTIFICATION_KEYRING_STORE_UNLOCKED, NOTIFICATION_SOLANA_ACTIVE_WALLET_UPDATED, NOTIFICATION_SOLANA_CONNECTION_URL_UPDATED, NOTIFICATION_SOLANA_SPL_TOKENS_DID_UPDATE, } from "@coral-xyz/common";
import { Connection, PublicKey } from "@solana/web3.js";
const logger = getLogger("solana-connection-backend");
export const LOAD_SPL_TOKENS_REFRESH_INTERVAL = 10 * 1000;
export const RECENT_BLOCKHASH_REFRESH_INTERVAL = 10 * 1000;
// Time until cached values expire. This is arbitrary.
const CACHE_EXPIRY = 15000;
const NFT_CACHE_EXPIRY = 15 * 60000;
export function start(events) {
    const b = new SolanaConnectionBackend(events);
    b.start();
    return b;
}
export class SolanaConnectionBackend {
    constructor(events) {
        this.cache = new Map();
        this.pollIntervals = [];
        this.events = events;
        this.lastCustomSplTokenAccountsKey = "";
    }
    start() {
        this.setupEventListeners();
    }
    //
    // The connection backend needs to change its behavior based on what happens
    // in the core backend. E.g., if the keyring store gets locked, then we
    // need to stop polling.
    //
    setupEventListeners() {
        this.events.addListener(BACKEND_EVENT, (notif) => {
            logger.debug(`received notification: ${notif.name}`, notif);
            switch (notif.name) {
                case NOTIFICATION_KEYRING_STORE_CREATED:
                    handleKeyringStoreCreated(notif);
                    break;
                case NOTIFICATION_KEYRING_STORE_UNLOCKED:
                    handleKeyringStoreUnlocked(notif);
                    break;
                case NOTIFICATION_KEYRING_STORE_LOCKED:
                    handleKeyringStoreLocked(notif);
                    break;
                case NOTIFICATION_SOLANA_ACTIVE_WALLET_UPDATED:
                    handleActiveWalletUpdated(notif);
                    break;
                case NOTIFICATION_SOLANA_CONNECTION_URL_UPDATED:
                    handleConnectionUrlUpdated(notif);
                    break;
                case NOTIFICATION_BLOCKCHAIN_KEYRING_CREATED:
                    handleBlockchainKeyringCreated(notif);
                    break;
                case NOTIFICATION_BLOCKCHAIN_KEYRING_DELETED:
                    handleBlockchainKeyringDeleted(notif);
                    break;
                default:
                    break;
            }
        });
        const handleKeyringStoreCreated = (notif) => {
            handleKeyringStoreUnlocked(notif);
        };
        const handleKeyringStoreUnlocked = (notif) => {
            const { blockchainActiveWallets, solanaConnectionUrl, solanaCommitment } = notif.data;
            this.connection = new Connection(solanaConnectionUrl, solanaCommitment);
            this.url = solanaConnectionUrl;
            this.hookRpcRequest();
            const activeWallet = blockchainActiveWallets[Blockchain.SOLANA];
            if (activeWallet) {
                this.startPolling(new PublicKey(activeWallet));
            }
        };
        const handleKeyringStoreLocked = (_notif) => {
            this.stopPolling();
        };
        const handleActiveWalletUpdated = (notif) => {
            const { activeWallet } = notif.data;
            this.stopPolling();
            this.startPolling(new PublicKey(activeWallet));
        };
        const handleConnectionUrlUpdated = (notif) => {
            const { activeWallet, url } = notif.data;
            this.connection = new Connection(url, this.connection.commitment);
            this.url = url;
            // activeWallet can be null if the blockchain is disabled, in that case
            // we don't want to start polling
            if (activeWallet) {
                this.stopPolling();
                this.hookRpcRequest();
                this.startPolling(new PublicKey(activeWallet));
            }
        };
        const handleBlockchainKeyringCreated = (notif) => {
            const { blockchain, activeWallet } = notif.data;
            if (blockchain === Blockchain.SOLANA) {
                // Start polling if Solana was enabled in wallet settings
                this.startPolling(new PublicKey(activeWallet));
            }
        };
        const handleBlockchainKeyringDeleted = (notif) => {
            const { blockchain } = notif.data;
            if (blockchain === Blockchain.SOLANA) {
                this.stopPolling();
            }
        };
    }
    //
    // Poll for data in the background script so that, even if the popup closes
    // the data is still fresh.
    //
    async startPolling(activeWallet) {
        const connection = new Connection(this.url); // Unhooked connection.
        this.pollIntervals.push(setInterval(async () => {
            const data = await customSplTokenAccounts(connection, activeWallet);
            const dataKey = this.intoCustomSplTokenAccountsKey(data);
            if (dataKey === this.lastCustomSplTokenAccountsKey) {
                return;
            }
            this.lastCustomSplTokenAccountsKey = dataKey;
            const key = JSON.stringify({
                url: this.url,
                method: "customSplTokenAccounts",
                args: [activeWallet.toString()],
            });
            this.cache.set(key, {
                ts: Date.now(),
                value: data,
            });
            this.events.emit(BACKEND_EVENT, {
                name: NOTIFICATION_SOLANA_SPL_TOKENS_DID_UPDATE,
                data: {
                    connectionUrl: this.url,
                    publicKey: activeWallet.toString(),
                    customSplTokenAccounts: BackgroundSolanaConnection.customSplTokenAccountsToJson(data),
                },
            });
        }, LOAD_SPL_TOKENS_REFRESH_INTERVAL));
        this.pollIntervals.push(setInterval(async () => {
            const conn = new Connection(this.url); // Unhooked connection.
            const data = await conn.getLatestBlockhash();
            const key = JSON.stringify({
                url: this.url,
                method: "getLatestBlockhash",
                args: [],
            });
            this.cache.set(key, {
                ts: Date.now(),
                value: data,
            });
        }, RECENT_BLOCKHASH_REFRESH_INTERVAL));
    }
    intoCustomSplTokenAccountsKey(resp) {
        //
        // We sort the data so that we can have a consistent key when teh data
        // doesn't change. We remove the mints and metadata from the key because
        // it's not neceessary at all when calculating whether something has
        // changed.
        //
        return JSON.stringify({
            nfts: {
                nftTokens: resp.nfts.nftTokens
                    .slice()
                    .sort((a, b) => a.key.toString().localeCompare(b.key.toString())),
            },
            fts: {
                fungibleTokens: resp.fts.fungibleTokens
                    .slice()
                    .sort((a, b) => a.key.toString().localeCompare(b.key.toString())),
            },
        });
    }
    stopPolling() {
        this.pollIntervals.forEach((interval) => {
            clearInterval(interval);
        });
    }
    hookRpcRequest() {
        // @ts-ignore
        const _rpcRequest = this.connection._rpcRequest;
        // @ts-ignore
        this.connection._rpcRequest = async (method, args) => {
            const key = JSON.stringify({
                url: this.url,
                method,
                args,
            });
            // Only use cached values at most 15 seconds old.
            const value = this.cache.get(key);
            //
            // This should never expire, but some projects use mutable urls rather
            // than IPFS or Arweave :(.
            //
            if (value && value.ts + CACHE_EXPIRY > Date.now()) {
                return value.value;
            }
            const resp = await _rpcRequest(method, args);
            this.cache.set(key, {
                ts: Date.now(),
                value: resp,
            });
            return resp;
        };
    }
    //////////////////////////////////////////////////////////////////////////////
    // Custom endpoints.
    //////////////////////////////////////////////////////////////////////////////
    async customSplTokenAccounts(publicKey) {
        const key = JSON.stringify({
            url: this.url,
            method: "customSplTokenAccounts",
            args: [publicKey.toString()],
        });
        const value = this.cache.get(key);
        if (value && value.ts + CACHE_EXPIRY > Date.now()) {
            return value.value;
        }
        const resp = await customSplTokenAccounts(this.connection, publicKey);
        // Set once if the background poller hasn't run yet.
        if (this.lastCustomSplTokenAccountsKey === "") {
            this.lastCustomSplTokenAccountsKey =
                this.intoCustomSplTokenAccountsKey(resp);
        }
        this.cache.set(key, {
            ts: Date.now(),
            value: resp,
        });
        return resp;
    }
    async customSplMetadataUri(tokens, tokenMetadata) {
        const key = JSON.stringify({
            url: this.url,
            method: "customSplMetadataUri",
            args: [tokens.map((t) => t.key).sort()],
        });
        const value = this.cache.get(key);
        if (value && value.ts + NFT_CACHE_EXPIRY > Date.now()) {
            return value.value;
        }
        const resp = await fetchSplMetadataUri(tokens, tokenMetadata);
        this.cache.set(key, {
            ts: Date.now(),
            value: resp,
        });
        return resp;
    }
    //////////////////////////////////////////////////////////////////////////////
    // Solana Connection API.
    //////////////////////////////////////////////////////////////////////////////
    async getAccountInfo(publicKey, commitment) {
        return await this.connection.getAccountInfo(publicKey, commitment);
    }
    async getAccountInfoAndContext(publicKey, commitment) {
        return await this.connection.getAccountInfoAndContext(publicKey, commitment);
    }
    async getLatestBlockhash(commitment) {
        if (!this.connection) {
            throw new Error("inner connection not found");
        }
        const resp = await this.connection.getLatestBlockhash(commitment);
        return resp;
    }
    async getLatestBlockhashAndContext(commitment) {
        const resp = await this.connection.getLatestBlockhashAndContext(commitment);
        return resp;
    }
    async getTokenAccountsByOwner(ownerAddress, filter, commitment) {
        return await this.connection.getTokenAccountsByOwner(ownerAddress, filter, commitment);
    }
    async sendRawTransaction(rawTransaction, options) {
        return await this.connection.sendRawTransaction(rawTransaction, options);
    }
    async confirmTransaction(strategy, commitment) {
        const tx = await confirmTransaction(this.connection, strategy.signature, commitment === "confirmed" || commitment === "finalized"
            ? commitment
            : "confirmed");
        return {
            context: {
                slot: tx.slot,
            },
            value: {
                err: null,
            },
        };
    }
    async simulateTransaction(transactionOrMessage, configOrSigners, includeAccounts) {
        if ("message" in transactionOrMessage) {
            // VersionedTransaction
            if (Array.isArray(configOrSigners)) {
                throw new Error("Invalid arguments to simulateTransaction");
            }
            return await this.connection.simulateTransaction(transactionOrMessage, configOrSigners);
        }
        else {
            // Deprecated
            return await this.connection.simulateTransaction(transactionOrMessage, configOrSigners, includeAccounts);
        }
    }
    async getMultipleAccountsInfo(publicKeys, commitment) {
        return await this.connection.getMultipleAccountsInfo(publicKeys, commitment);
    }
    async getConfirmedSignaturesForAddress2(address, options, commitment) {
        return await this.connection.getConfirmedSignaturesForAddress2(address, options, commitment !== null && commitment !== void 0 ? commitment : "confirmed");
    }
    async getParsedTransactions(signatures, commitment) {
        return await this.connection.getParsedTransactions(signatures, commitment !== null && commitment !== void 0 ? commitment : "confirmed");
    }
    async getParsedTransaction(signature, commitment) {
        const conn = new Connection(this.url); // Unhooked connection.
        return await conn.getParsedTransaction(signature, commitment !== null && commitment !== void 0 ? commitment : "confirmed");
    }
    async getProgramAccounts(programId, configOrCommitment) {
        return await this.connection.getProgramAccounts(programId, configOrCommitment);
    }
    async getFeeForMessage(message, commitment) {
        const encodedMessage = Buffer.from(message.serialize()).toString("base64");
        return await this.connection.getFeeForMessage({
            serialize: () => ({
                toString: () => {
                    return encodedMessage;
                },
            }),
        }, commitment);
    }
    async getMinimumBalanceForRentExemption(dataLength, commitment) {
        return await this.connection.getMinimumBalanceForRentExemption(dataLength, commitment);
    }
    async getTokenAccountBalance(tokenAddress, commitment) {
        return await this.connection.getTokenAccountBalance(tokenAddress, commitment);
    }
    async getBalance(publicKey, commitment) {
        return await this.connection.getBalance(publicKey, commitment);
    }
    async getSlot(commitment) {
        return await this.connection.getSlot(commitment);
    }
    async getBlockTime(slot) {
        return await this.connection.getBlockTime(slot);
    }
    async getParsedTokenAccountsByOwner(ownerAddress, filter, commitment) {
        return await this.connection.getParsedTokenAccountsByOwner(ownerAddress, filter, commitment);
    }
    async getTokenLargestAccounts(mintAddress, commitment) {
        return await this.connection.getTokenLargestAccounts(mintAddress, commitment);
    }
    async getParsedAccountInfo(publicKey, commitment) {
        return await this.connection.getParsedAccountInfo(publicKey, commitment);
    }
    async getParsedProgramAccounts(programId, configOrCommitment) {
        return await this.connection.getParsedProgramAccounts(programId, configOrCommitment);
    }
    async getAddressLookupTable(programId, config) {
        return await this.connection.getAddressLookupTable(programId, config);
    }
    ///////////////////////////////////////////////////////////////////////////////
    // Methods below not used currently.
    ///////////////////////////////////////////////////////////////////////////////
    async getBalanceAndContext(publicKey, commitment) {
        throw new Error("not implemented");
    }
    async getMinimumLedgerSlot() {
        throw new Error("not implemented");
    }
    async getFirstAvailableBlock() {
        throw new Error("not implemented");
    }
    async getSupply(config) {
        throw new Error("not implemented");
    }
    async getTokenSupply(tokenMintAddress, commitment) {
        throw new Error("not implemented");
    }
    async getLargestAccounts(config) {
        throw new Error("not implemented");
    }
    async getMultipleAccountsInfoAndContext(publicKeys, commitment) {
        throw new Error("not implemented");
    }
    async getStakeActivation(publicKey, commitment, epoch) {
        throw new Error("not implemented");
    }
    getClusterNodes() {
        throw new Error("not implemented");
    }
    getVoteAccounts(commitment) {
        throw new Error("not implemented");
    }
    getSlotLeader(commitment) {
        throw new Error("not implemented");
    }
    getSlotLeaders(startSlot, limit) {
        throw new Error("not implemented");
    }
    getSignatureStatus(signature, config) {
        throw new Error("not implemented");
    }
    getSignatureStatuses(signatures, config) {
        throw new Error("not implemented");
    }
    getTransactionCount(commitment) {
        throw new Error("not implemented");
    }
    getTotalSupply(commitment) {
        throw new Error("not implemented");
    }
    getInflationGovernor(commitment) {
        throw new Error("not implemented");
    }
    getInflationReward(addresses, epoch, commitment) {
        throw new Error("not implemented");
    }
    getEpochInfo(commitment) {
        throw new Error("not implemented");
    }
    getEpochSchedule() {
        throw new Error("not implemented");
    }
    getLeaderSchedule() {
        throw new Error("not implemented");
    }
    getRecentBlockhashAndContext(commitment) {
        throw new Error("not implemented");
    }
    getRecentPerformanceSamples(limit) {
        throw new Error("not implemented");
    }
    getFeeCalculatorForBlockhash(blockhash, commitment) {
        throw new Error("not implemented");
    }
    getRecentBlockhash(commitment) {
        throw new Error("not implemented");
    }
    getVersion() {
        throw new Error("not implemented");
    }
    getGenesisHash() {
        throw new Error("not implemented");
    }
    getBlock(slot, opts) {
        throw new Error("not implemented");
    }
    getBlockHeight(commitment) {
        throw new Error("not implemented");
    }
    getBlockProduction(configOrCommitment) {
        throw new Error("not implemented");
    }
    getTransaction(signature, opts) {
        throw new Error("not implemented");
    }
    getConfirmedBlock(slot, commitment) {
        throw new Error("not implemented");
    }
    getBlocks(startSlot, endSlot, commitment) {
        throw new Error("not implemented");
    }
    getBlockSignatures(slot, commitment) {
        throw new Error("not implemented");
    }
    getConfirmedBlockSignatures(slot, commitment) {
        throw new Error("not implemented");
    }
    getConfirmedTransaction(signature, commitment) {
        throw new Error("not implemented");
    }
    getParsedConfirmedTransaction(signature, commitment) {
        throw new Error("not implemented");
    }
    getParsedConfirmedTransactions(signatures, commitment) {
        throw new Error("not implemented");
    }
    getConfirmedSignaturesForAddress(address, startSlot, endSlot) {
        throw new Error("not implemented");
    }
    getSignaturesForAddress(address, options, commitment) {
        throw new Error("not implemented");
    }
    getNonceAndContext(nonceAccount, commitment) {
        throw new Error("not implemented");
    }
    getNonce(nonceAccount, commitment) {
        throw new Error("not implemented");
    }
    requestAirdrop(to, lamports) {
        throw new Error("not implemented");
    }
    sendTransaction(transaction, signers, options) {
        throw new Error("not implemented");
    }
    sendEncodedTransaction(encodedTransaction, options) {
        throw new Error("not implemented");
    }
    onAccountChange(publicKey, callback, commitment) {
        throw new Error("not implemented");
    }
    removeAccountChangeListener(id) {
        throw new Error("not implemented");
    }
    onProgramAccountChange(programId, callback, commitment, filters) {
        throw new Error("not implemented");
    }
    removeProgramAccountChangeListener(id) {
        throw new Error("not implemented");
    }
    onLogs(filter, callback, commitment) {
        throw new Error("not implemented");
    }
    removeOnLogsListener(id) {
        throw new Error("not implemented");
    }
    onSlotChange(callback) {
        throw new Error("not implemented");
    }
    removeSlotChangeListener(id) {
        throw new Error("not implemented");
    }
    onSlotUpdate(callback) {
        throw new Error("not implemented");
    }
    removeSlotUpdateListener(id) {
        throw new Error("not implemented");
    }
    _buildArgs(args, override, encoding, extra) {
        throw new Error("not implemented");
    }
    onSignature(signature, callback, commitment) {
        throw new Error("not implemented");
    }
    onSignatureWithOptions(signature, callback, options) {
        throw new Error("not implemented");
    }
    removeSignatureListener(id) {
        throw new Error("not implemented");
    }
    onRootChange(callback) {
        throw new Error("not implemented");
    }
    removeRootChangeListener(id) {
        throw new Error("not implemented");
    }
}
//# sourceMappingURL=solana-connection.js.map