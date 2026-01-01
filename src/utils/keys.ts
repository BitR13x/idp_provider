import * as jose from 'jose';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from '../config';

let privateKey: jose.KeyObject;
let publicKey: jose.KeyObject;
let jwks: { keys: jose.JWK[] };

export const initializeKeys = async () => {
    try {
        const privateKeyPath = join(import.meta.dir, '../config/private.pem');
        const publicKeyPath = join(import.meta.dir, '../config/public.pem');

        const privateKeyPEM = readFileSync(privateKeyPath, 'utf8');
        const publicKeyPEM = readFileSync(publicKeyPath, 'utf8');

        privateKey = await jose.importPKCS8(privateKeyPEM, 'RS256');
        publicKey = await jose.importSPKI(publicKeyPEM, 'RS256');

        const jwk = await jose.exportJWK(publicKey);
        jwk.kid = config.oidc.jwt.kid;
        jwk.use = 'sig';
        jwk.alg = 'RS256';

        jwks = {
            keys: [jwk]
        };

        console.log("[KEYS] RSA keys loaded from file.");
    } catch (error) {
        console.error("[KEYS] Failed to load PEM keys. Ensure src/config/private.pem and public.pem exist.", error);
        throw error;
    };
};

export const getPrivateKey = () => {
    return privateKey;
};

export const getJWKS = () => {
    return jwks;
};
