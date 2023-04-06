import type { EventEmitter } from "@coral-xyz/common";
import type { BigNumber } from "ethers";
import { ethers } from "ethers";
export declare const ETHEREUM_TOKENS_REFRESH_INTERVAL: number;
export declare const ETHEREUM_FEE_DATA_REFRESH_INTERVAL: number;
export declare function start(events: EventEmitter): EthereumConnectionBackend;
export declare class EthereumConnectionBackend {
    private cache;
    private url?;
    private chainId?;
    private pollIntervals;
    private events;
    provider?: ethers.providers.JsonRpcProvider;
    constructor(events: EventEmitter);
    start(): void;
    private setupEventListeners;
    private startPolling;
    private stopPolling;
    sendTransaction(signedTx: string): Promise<ethers.providers.TransactionResponse>;
    getBalance(address: string, blockTag?: string): Promise<BigNumber>;
    getCode(address: string, blockTag?: string): Promise<string>;
    getStorageAt(address: string, position: BigNumber, blockTag?: string): Promise<string>;
    getTransactionCount(address: string, blockTag?: string): Promise<number>;
    getBlock(block: number): Promise<ethers.providers.Block>;
    getBlockWithTransactions(block: number): Promise<import("@ethersproject/abstract-provider").BlockWithTransactions>;
    lookupAddress(name: string): Promise<string | null>;
    resolveName(name: string): Promise<string | null>;
    getNetwork(): Promise<ethers.providers.Network>;
    getBlockNumber(): Promise<number>;
    getGasPrice(): Promise<BigNumber>;
    getFeeData(): Promise<ethers.providers.FeeData>;
    call(tx: any, blockTag?: string): Promise<string>;
    estimateGas(tx: any): Promise<BigNumber>;
    getTransaction(hash: any): Promise<ethers.providers.TransactionResponse>;
    getTransactionReceipt(hash: string): Promise<ethers.providers.TransactionReceipt>;
    waitForTransaction(hash: string, confirms?: number, timeout?: number): Promise<ethers.providers.TransactionReceipt>;
}
//# sourceMappingURL=ethereum-connection.d.ts.map