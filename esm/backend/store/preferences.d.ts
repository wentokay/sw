import type { DeprecatedWalletDataDoNotUse, Preferences } from "@coral-xyz/common";
export declare function getWalletDataForUser(uuid: string): Promise<Preferences>;
export declare function setWalletDataForUser(uuid: string, data?: Preferences): Promise<void>;
export declare function getWalletData_DEPRECATED(): Promise<DeprecatedWalletDataDoNotUse | undefined>;
export declare function setWalletData_DEPRECATED(data: undefined | DeprecatedWalletDataDoNotUse): Promise<void>;
//# sourceMappingURL=preferences.d.ts.map