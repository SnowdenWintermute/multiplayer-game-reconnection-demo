import sodium from "libsodium-wrappers";

export class EncryptionHelpers {
  static async encrypt<T>(token: T, secret: string): Promise<string> {
    await sodium.ready;

    const key = sodium.from_base64(secret, sodium.base64_variants.ORIGINAL);
    const nonce = sodium.randombytes_buf(
      sodium.crypto_secretbox_NONCEBYTES,
      "uint8array"
    );

    const ciphertext = sodium.crypto_secretbox_easy(
      JSON.stringify(token),
      nonce, //  Argument of type 'string | Uint8Array<ArrayBufferLike>' is not assignable to parameter of type 'Uint8Array<ArrayBufferLike>'. Type 'string' is not assignable to type 'Uint8Array<ArrayBufferLike>
      key
    );

    const combined = new Uint8Array(nonce.length + ciphertext.length);
    combined.set(nonce, 0);
    combined.set(ciphertext, nonce.length);

    return sodium.to_base64(combined, sodium.base64_variants.ORIGINAL);
  }

  static async decrypt<T>(encrypted: string, secret: string): Promise<T> {
    await sodium.ready;
    try {
      const key = sodium.from_base64(secret, sodium.base64_variants.ORIGINAL);
      const combined = sodium.from_base64(
        encrypted,
        sodium.base64_variants.ORIGINAL
      );

      const nonce = combined.slice(0, sodium.crypto_secretbox_NONCEBYTES);
      const ciphertext = combined.slice(sodium.crypto_secretbox_NONCEBYTES);

      const plaintext = sodium.crypto_secretbox_open_easy(
        ciphertext,
        nonce,
        key
      );

      return JSON.parse(Buffer.from(plaintext).toString("utf8")) as T;
    } catch (error) {
      throw new Error(`Error decrypting: ${error}`);
    }
  }

  static async createSecret() {
    await sodium.ready;
    const keyBytes = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);
    const secret = sodium.to_base64(keyBytes, sodium.base64_variants.ORIGINAL);
    return secret;
  }
}
