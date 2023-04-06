import type { Blockchain, BlockchainKeyringJson } from "@coral-xyz/common";
import type { SecretPayload } from "../keyring/crypto";
/**
 * Persistent model for the keyring store json. This is encrypted and decrypted
 * before reading to/from local storage.
 */
export type KeyringStoreJson = {
    users: {
        [uuid: string]: UserKeyringJson;
    };
    lastUsedTs: number;
};
export type UserKeyringJson = {
    uuid: string;
    username: string;
    activeBlockchain: Blockchain;
    mnemonic?: string;
    blockchains: {
        [blockchain: string]: BlockchainKeyringJson;
    };
};
export declare function getKeyringStore(userInfo: {
    uuid: string;
    password: string;
}): Promise<KeyringStoreJson>;
export declare function getKeyringStore_NO_MIGRATION(password: string): Promise<any>;
export declare function setKeyringStore(json: KeyringStoreJson, password: string): Promise<void>;
export declare function getKeyringCiphertext(): Promise<SecretPayload>;
export declare function doesCiphertextExist(): Promise<boolean>;
//# sourceMappingURL=keyring.d.ts.map