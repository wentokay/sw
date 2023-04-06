/**
 * Persistent model for the naming of wallet keys.
 */
export type IsColdKeys = {
    [publicKeyStr: string]: boolean;
};
export declare function setIsCold(publicKey: string, isCold?: boolean): Promise<void>;
export declare function getIsCold(publicKey: string): Promise<boolean>;
//# sourceMappingURL=isCold.d.ts.map