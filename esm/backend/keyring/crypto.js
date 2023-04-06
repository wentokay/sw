import * as bs58 from "bs58";
import { pbkdf2 } from "crypto";
import { randomBytes, secretbox } from "tweetnacl";
export async function encrypt(plaintext, password) {
    const salt = randomBytes(16);
    const kdf = "pbkdf2";
    const iterations = 100000;
    const digest = "sha256";
    const key = await deriveEncryptionKey(password, salt, iterations, digest);
    const nonce = randomBytes(secretbox.nonceLength);
    const ciphertext = secretbox(Buffer.from(plaintext), nonce, key);
    return {
        ciphertext: bs58.encode(ciphertext),
        nonce: bs58.encode(nonce),
        kdf,
        salt: bs58.encode(salt),
        iterations,
        digest,
    };
}
export async function decrypt(cipherObj, password) {
    const { ciphertext: encodedCiphertext, nonce: encodedNonce, salt: encodedSalt, iterations, digest, } = cipherObj;
    const ciphertext = bs58.decode(encodedCiphertext);
    const nonce = bs58.decode(encodedNonce);
    const salt = bs58.decode(encodedSalt);
    const key = await deriveEncryptionKey(password, salt, iterations, digest);
    const plaintext = secretbox.open(ciphertext, nonce, key);
    if (!plaintext) {
        throw new Error("Incorrect password");
    }
    const decodedPlaintext = Buffer.from(plaintext).toString();
    return decodedPlaintext;
}
async function deriveEncryptionKey(password, salt, iterations, digest) {
    return new Promise((resolve, reject) => pbkdf2(password, salt, iterations, secretbox.keyLength, digest, (err, key) => (err ? reject(err) : resolve(key))));
}
//# sourceMappingURL=crypto.js.map