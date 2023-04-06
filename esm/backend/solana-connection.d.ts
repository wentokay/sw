/// <reference types="node" />
import type { CustomSplTokenAccountsResponse, EventEmitter, SolanaTokenAccountWithKeyString, SplNftMetadataString, TokenMetadataString } from "@coral-xyz/common";
import type { AccountBalancePair, AccountChangeCallback, AccountInfo, AddressLookupTableAccount, Blockhash, BlockheightBasedTransactionConfirmationStrategy, BlockProduction, BlockResponse, BlockSignatures, Commitment, ConfirmedBlock, ConfirmedSignatureInfo, ConfirmedSignaturesForAddress2Options, ConfirmedTransaction, ContactInfo, EpochInfo, EpochSchedule, FeeCalculator, Finality, GetAccountInfoConfig, GetBlockProductionConfig, GetLargestAccountsConfig, GetParsedProgramAccountsConfig, GetProgramAccountsConfig, GetProgramAccountsFilter, GetSupplyConfig, InflationGovernor, InflationReward, LeaderSchedule, LogsCallback, LogsFilter, Message, NonceAccount, ParsedAccountData, ParsedConfirmedTransaction, PerfSample, ProgramAccountChangeCallback, RootChangeCallback, RpcResponseAndContext, SendOptions, SignatureResult, SignatureResultCallback, SignaturesForAddressOptions, SignatureStatus, SignatureStatusConfig, SignatureSubscriptionCallback, SignatureSubscriptionOptions, Signer, SimulatedTransactionResponse, SimulateTransactionConfig, SlotChangeCallback, SlotUpdateCallback, StakeActivationData, Supply, TokenAccountBalancePair, TokenAccountsFilter, TokenAmount, Transaction, TransactionResponse, TransactionSignature, Version, VersionedMessage, VersionedTransaction, VoteAccountStatus } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
export declare const LOAD_SPL_TOKENS_REFRESH_INTERVAL: number;
export declare const RECENT_BLOCKHASH_REFRESH_INTERVAL: number;
export declare function start(events: EventEmitter): SolanaConnectionBackend;
export declare class SolanaConnectionBackend {
    private cache;
    private connection?;
    private url?;
    private pollIntervals;
    private events;
    private lastCustomSplTokenAccountsKey;
    constructor(events: EventEmitter);
    start(): void;
    private setupEventListeners;
    private startPolling;
    private intoCustomSplTokenAccountsKey;
    private stopPolling;
    private hookRpcRequest;
    customSplTokenAccounts(publicKey: PublicKey): Promise<CustomSplTokenAccountsResponse>;
    customSplMetadataUri(tokens: Array<SolanaTokenAccountWithKeyString>, tokenMetadata: Array<TokenMetadataString | null>): Promise<Array<[string, SplNftMetadataString]>>;
    getAccountInfo(publicKey: PublicKey, commitment?: Commitment): Promise<AccountInfo<Buffer> | null>;
    getAccountInfoAndContext(publicKey: PublicKey, commitment?: Commitment): Promise<RpcResponseAndContext<AccountInfo<Buffer> | null>>;
    getLatestBlockhash(commitment?: Commitment): Promise<{
        blockhash: Blockhash;
        lastValidBlockHeight: number;
    }>;
    getLatestBlockhashAndContext(commitment?: Commitment): Promise<RpcResponseAndContext<{
        blockhash: Blockhash;
        lastValidBlockHeight: number;
    }>>;
    getTokenAccountsByOwner(ownerAddress: PublicKey, filter: TokenAccountsFilter, commitment?: Commitment): Promise<RpcResponseAndContext<Array<{
        pubkey: PublicKey;
        account: AccountInfo<Buffer>;
    }>>>;
    sendRawTransaction(rawTransaction: Buffer | Uint8Array | Array<number>, options?: SendOptions): Promise<TransactionSignature>;
    confirmTransaction(strategy: BlockheightBasedTransactionConfirmationStrategy, commitment?: Commitment): Promise<RpcResponseAndContext<SignatureResult>>;
    simulateTransaction(transactionOrMessage: Transaction | VersionedTransaction | Message, configOrSigners?: Array<Signer> | SimulateTransactionConfig, includeAccounts?: boolean | Array<PublicKey>): Promise<RpcResponseAndContext<SimulatedTransactionResponse>>;
    getMultipleAccountsInfo(publicKeys: PublicKey[], commitment?: Commitment): Promise<(AccountInfo<Buffer> | null)[]>;
    getConfirmedSignaturesForAddress2(address: PublicKey, options?: ConfirmedSignaturesForAddress2Options, commitment?: Finality): Promise<Array<ConfirmedSignatureInfo>>;
    getParsedTransactions(signatures: TransactionSignature[], commitment?: Finality): Promise<(ParsedConfirmedTransaction | null)[]>;
    getParsedTransaction(signature: TransactionSignature, commitment?: Finality): Promise<ParsedConfirmedTransaction | null>;
    getProgramAccounts(programId: PublicKey, configOrCommitment?: GetProgramAccountsConfig | Commitment): Promise<Array<{
        pubkey: PublicKey;
        account: AccountInfo<Buffer>;
    }>>;
    getFeeForMessage(message: VersionedMessage, commitment?: Commitment): Promise<RpcResponseAndContext<number>>;
    getMinimumBalanceForRentExemption(dataLength: number, commitment?: Commitment): Promise<number>;
    getTokenAccountBalance(tokenAddress: PublicKey, commitment?: Commitment): Promise<RpcResponseAndContext<TokenAmount>>;
    getBalance(publicKey: PublicKey, commitment?: Commitment): Promise<number>;
    getSlot(commitment?: Commitment): Promise<number>;
    getBlockTime(slot: number): Promise<number | null>;
    getParsedTokenAccountsByOwner(ownerAddress: PublicKey, filter: TokenAccountsFilter, commitment?: Commitment): Promise<RpcResponseAndContext<Array<{
        pubkey: PublicKey;
        account: AccountInfo<ParsedAccountData>;
    }>>>;
    getTokenLargestAccounts(mintAddress: PublicKey, commitment?: Commitment): Promise<RpcResponseAndContext<Array<TokenAccountBalancePair>>>;
    getParsedAccountInfo(publicKey: PublicKey, commitment?: Commitment): Promise<RpcResponseAndContext<AccountInfo<Buffer | ParsedAccountData> | null>>;
    getParsedProgramAccounts(programId: PublicKey, configOrCommitment?: GetParsedProgramAccountsConfig | Commitment): Promise<Array<{
        pubkey: PublicKey;
        account: AccountInfo<Buffer | ParsedAccountData>;
    }>>;
    getAddressLookupTable(programId: PublicKey, config?: GetAccountInfoConfig): Promise<RpcResponseAndContext<AddressLookupTableAccount | null>>;
    getBalanceAndContext(publicKey: PublicKey, commitment?: Commitment): Promise<RpcResponseAndContext<number>>;
    getMinimumLedgerSlot(): Promise<number>;
    getFirstAvailableBlock(): Promise<number>;
    getSupply(config?: GetSupplyConfig | Commitment): Promise<RpcResponseAndContext<Supply>>;
    getTokenSupply(tokenMintAddress: PublicKey, commitment?: Commitment): Promise<RpcResponseAndContext<TokenAmount>>;
    getLargestAccounts(config?: GetLargestAccountsConfig): Promise<RpcResponseAndContext<Array<AccountBalancePair>>>;
    getMultipleAccountsInfoAndContext(publicKeys: PublicKey[], commitment?: Commitment): Promise<RpcResponseAndContext<(AccountInfo<Buffer> | null)[]>>;
    getStakeActivation(publicKey: PublicKey, commitment?: Commitment, epoch?: number): Promise<StakeActivationData>;
    getClusterNodes(): Promise<Array<ContactInfo>>;
    getVoteAccounts(commitment?: Commitment): Promise<VoteAccountStatus>;
    getSlotLeader(commitment?: Commitment): Promise<string>;
    getSlotLeaders(startSlot: number, limit: number): Promise<Array<PublicKey>>;
    getSignatureStatus(signature: TransactionSignature, config?: SignatureStatusConfig): Promise<RpcResponseAndContext<SignatureStatus | null>>;
    getSignatureStatuses(signatures: Array<TransactionSignature>, config?: SignatureStatusConfig): Promise<RpcResponseAndContext<Array<SignatureStatus | null>>>;
    getTransactionCount(commitment?: Commitment): Promise<number>;
    getTotalSupply(commitment?: Commitment): Promise<number>;
    getInflationGovernor(commitment?: Commitment): Promise<InflationGovernor>;
    getInflationReward(addresses: PublicKey[], epoch?: number, commitment?: Commitment): Promise<(InflationReward | null)[]>;
    getEpochInfo(commitment?: Commitment): Promise<EpochInfo>;
    getEpochSchedule(): Promise<EpochSchedule>;
    getLeaderSchedule(): Promise<LeaderSchedule>;
    getRecentBlockhashAndContext(commitment?: Commitment): Promise<RpcResponseAndContext<{
        blockhash: Blockhash;
        feeCalculator: FeeCalculator;
    }>>;
    getRecentPerformanceSamples(limit?: number): Promise<Array<PerfSample>>;
    getFeeCalculatorForBlockhash(blockhash: Blockhash, commitment?: Commitment): Promise<RpcResponseAndContext<FeeCalculator | null>>;
    getRecentBlockhash(commitment?: Commitment): Promise<{
        blockhash: Blockhash;
        feeCalculator: FeeCalculator;
    }>;
    getVersion(): Promise<Version>;
    getGenesisHash(): Promise<string>;
    getBlock(slot: number, opts?: {
        commitment?: Finality;
    }): Promise<BlockResponse | null>;
    getBlockHeight(commitment?: Commitment): Promise<number>;
    getBlockProduction(configOrCommitment?: GetBlockProductionConfig | Commitment): Promise<RpcResponseAndContext<BlockProduction>>;
    getTransaction(signature: string, opts?: {
        commitment?: Finality;
    }): Promise<TransactionResponse | null>;
    getConfirmedBlock(slot: number, commitment?: Finality): Promise<ConfirmedBlock>;
    getBlocks(startSlot: number, endSlot?: number, commitment?: Finality): Promise<Array<number>>;
    getBlockSignatures(slot: number, commitment?: Finality): Promise<BlockSignatures>;
    getConfirmedBlockSignatures(slot: number, commitment?: Finality): Promise<BlockSignatures>;
    getConfirmedTransaction(signature: TransactionSignature, commitment?: Finality): Promise<ConfirmedTransaction | null>;
    getParsedConfirmedTransaction(signature: TransactionSignature, commitment?: Finality): Promise<ParsedConfirmedTransaction | null>;
    getParsedConfirmedTransactions(signatures: TransactionSignature[], commitment?: Finality): Promise<(ParsedConfirmedTransaction | null)[]>;
    getConfirmedSignaturesForAddress(address: PublicKey, startSlot: number, endSlot: number): Promise<Array<TransactionSignature>>;
    getSignaturesForAddress(address: PublicKey, options?: SignaturesForAddressOptions, commitment?: Finality): Promise<Array<ConfirmedSignatureInfo>>;
    getNonceAndContext(nonceAccount: PublicKey, commitment?: Commitment): Promise<RpcResponseAndContext<NonceAccount | null>>;
    getNonce(nonceAccount: PublicKey, commitment?: Commitment): Promise<NonceAccount | null>;
    requestAirdrop(to: PublicKey, lamports: number): Promise<TransactionSignature>;
    sendTransaction(transaction: Transaction, signers: Array<Signer>, options?: SendOptions): Promise<TransactionSignature>;
    sendEncodedTransaction(encodedTransaction: string, options?: SendOptions): Promise<TransactionSignature>;
    onAccountChange(publicKey: PublicKey, callback: AccountChangeCallback, commitment?: Commitment): number;
    removeAccountChangeListener(id: number): Promise<void>;
    onProgramAccountChange(programId: PublicKey, callback: ProgramAccountChangeCallback, commitment?: Commitment, filters?: GetProgramAccountsFilter[]): number;
    removeProgramAccountChangeListener(id: number): Promise<void>;
    onLogs(filter: LogsFilter, callback: LogsCallback, commitment?: Commitment): number;
    removeOnLogsListener(id: number): Promise<void>;
    onSlotChange(callback: SlotChangeCallback): number;
    removeSlotChangeListener(id: number): Promise<void>;
    onSlotUpdate(callback: SlotUpdateCallback): number;
    removeSlotUpdateListener(id: number): Promise<void>;
    _buildArgs(args: Array<any>, override?: Commitment, encoding?: "jsonParsed" | "base64", extra?: any): Array<any>;
    onSignature(signature: TransactionSignature, callback: SignatureResultCallback, commitment?: Commitment): number;
    onSignatureWithOptions(signature: TransactionSignature, callback: SignatureSubscriptionCallback, options?: SignatureSubscriptionOptions): number;
    removeSignatureListener(id: number): Promise<void>;
    onRootChange(callback: RootChangeCallback): number;
    removeRootChangeListener(id: number): Promise<void>;
}
//# sourceMappingURL=solana-connection.d.ts.map