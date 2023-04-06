export type SecretPayload = {
    ciphertext: string;
    nonce: string;
    salt: string;
    kdf: string;
    iterations: number;
    digest: string;
};
export declare function encrypt(plaintext: string, password: string): Promise<SecretPayload>;
export declare function decrypt(cipherObj: SecretPayload, password: string): Promise<string>;
//# sourceMappingURL=crypto.d.ts.map