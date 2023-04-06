/**
 * Persistent model for the naming of wallet keys.
 */
export type Keyname = {
    [publicKeyStr: string]: string;
};
export declare function setKeyname(publicKey: string, name: string): Promise<void>;
export declare function getKeyname(publicKey: string): Promise<string>;
export declare const DefaultKeyname: {
    defaultDerived(index: number): string;
    defaultImported(index: number): string;
    defaultLedger(index: number): string;
};
//# sourceMappingURL=keyname.d.ts.map