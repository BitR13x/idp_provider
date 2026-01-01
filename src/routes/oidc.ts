import { Elysia, t } from 'elysia';
import { AppDataSource } from '../database/ormconfig';
import { User } from '../database/entities/User';
import { Client } from '../database/entities/Client';
import { AuthCode } from '../database/entities/AuthCode';
import { getPrivateKey, getJWKS } from '../utils/keys';
import { logger } from '../utils/logger';
import { config } from '../config';
import * as jose from 'jose';
import { v4 as uuidv4 } from 'uuid';
import { sessionPlugin } from '../plugins/auth';
import { RefreshToken } from '../database/entities/RefreshToken';

export const oidcRoutes = new Elysia({ prefix: '/oidc' })
    .use(sessionPlugin)
    .get('/.well-known/openid-configuration', () => {
        const issuer = config.oidc.issuer;
        return {
            issuer: issuer,
            authorization_endpoint: `${issuer}/authorize`,
            token_endpoint: `${issuer}/token`,
            userinfo_endpoint: `${issuer}/userinfo`,
            jwks_uri: `${issuer}/.well-known/jwks.json`,
            id_token_signing_alg_values_supported: ['RS256'],
            scopes_supported: ['openid', 'profile', 'email']
        };
    })

    .get('/.well-known/jwks.json', () => {
        return getJWKS();
    })

    .get('/authorize', async ({ query: { client_id, redirect_uri, scope, state, nonce }, redirect, status, user, request }) => {
        const clientRepo = AppDataSource.getRepository(Client);
        const client = await clientRepo.findOneBy({ id: client_id });

        if (!client) {
            return status(400, "Invalid client_id");
        }
        if (!client.redirect_uris.includes(redirect_uri)) {
            return status(400, "Invalid redirect_uri");
        }

        const requestedScopes = (scope || '').split(' ');
        const allowed = requestedScopes.every(s => client.allowed_scopes.includes(s) || s === 'default');
        if (!allowed) {
            logger.audit("Authorization Failed", "Unknown", { reason: "Invalid Scope", scope });
            return status(400, "Invalid scope");
        };

        if (!user) {
            const currentUrl = request.url;
            return redirect(`/login?return_to=${encodeURIComponent(currentUrl)}`);
        };

        const code = uuidv4();
        await AuthCode.create({
            code: code,
            client: client,
            user: user,
            scope: requestedScopes,
            nonce: nonce,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 mins
        }).save();

        logger.audit("Authorization Granted", user.id, { client_id, scope: requestedScopes });

        const redirectUrl = new URL(redirect_uri);
        redirectUrl.searchParams.set('code', code);
        if (state) redirectUrl.searchParams.set('state', state);

        return redirect(redirectUrl.toString());
    }, {
        query: t.Object({
            client_id: t.String(),
            redirect_uri: t.String(),
            scope: t.Optional(t.String()),
            state: t.Optional(t.String()),
            nonce: t.Optional(t.String())
        })
    })

    .post('/token', async ({ body: { client_id, client_secret, code, api_aud, refresh_token }, status }) => {
        const clientRepo = AppDataSource.getRepository(Client);
        const client = await clientRepo.findOneBy({ id: client_id });

        if (!client || client.secret !== client_secret) {
            logger.audit("Token Exchange Failed", "System", { reason: "Invalid Client Credentials", client_id });
            return status(401, { error: "invalid_client" });
        }

        const privateKey = getPrivateKey();
        const issuer = config.oidc.issuer;

        let user: User;
        let scopes: string[];
        let nonce: string | undefined;

        if (code) {
            const authCode = await AuthCode.findOne({
                where: { code },
                relations: ["user", "client"]
            });

            if (!authCode) return status(400, { error: "invalid_grant", error_description: "Invalid code" });
            if (authCode.client.id !== client_id) return status(400, { error: "invalid_grant", error_description: "Code does not belong to client" });
            if (authCode.expiresAt < new Date()) {
                await AuthCode.remove(authCode);
                return status(400, { error: "invalid_grant", error_description: "Code expired" });
            };

            user = authCode.user;
            scopes = authCode.scope || [];
            nonce = authCode.nonce;

            await AuthCode.remove(authCode);
        } else if (refresh_token) {
            const tokenRecord = await RefreshToken.findOne({
                where: { id: refresh_token },
                relations: ["user", "client"]
            });

            if (!tokenRecord) return status(400, { error: "invalid_grant", error_description: "Invalid refresh token" });
            if (tokenRecord.client.id !== client_id) return status(400, { error: "invalid_grant", error_description: "Token does not belong to client" });
            if (tokenRecord.expiresAt < new Date()) {
                await RefreshToken.remove(tokenRecord);
                return status(400, { error: "invalid_grant", error_description: "Refresh token expired" });
            };

            user = tokenRecord.user;
            scopes = tokenRecord.scope;
            await RefreshToken.remove(tokenRecord);
        } else {
            return status(400, { error: "unsupported_grant_type" });
        };

        // ID Token (OIDC)
        const idToken = await new jose.SignJWT({
            sub: user.id,
            name: user.username,
            email: user.email,
            nonce: nonce,
            aud: client_id,
            iss: issuer,
        })
            .setProtectedHeader({ alg: 'RS256', kid: config.oidc.jwt.kid })
            .setIssuedAt()
            .setExpirationTime(config.oidc.jwt.idTokenExpiration)
            .sign(privateKey);

        // Access Token (OAuth2)
        const accessToken = await new jose.SignJWT({
            sub: user.id,
            scope: scopes,
            aud: api_aud,
            iss: issuer
        })
            .setProtectedHeader({ alg: 'RS256', kid: config.oidc.jwt.kid })
            .setIssuedAt()
            .setExpirationTime(config.oidc.jwt.accessTokenExpiration)
            .sign(privateKey);

        logger.audit("Token Issued", user.id, { client_id });

        const newRefreshToken = await RefreshToken.create({
            user: user,
            client: client,
            scope: scopes,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days 
        }).save();


        return {
            access_token: accessToken,
            id_token: idToken,
            refresh_token: newRefreshToken,
            token_type: 'Bearer',
            expires_in: 7200
        };
    }, {
        body: t.Object({
            client_id: t.String(),
            client_secret: t.String(),
            code: t.Optional(t.String()),
            refresh_token: t.Optional(t.String()),
            api_aud: t.String({ minLength: 3 })
        })
    })

    .get('/userinfo', async ({ headers, status }) => {
        const authHeader = headers['authorization'];
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

        if (!token) return status(401, { error: "invalid_token", message: "You're not logged in!" });

        try {
            const { keys } = getJWKS();
            const jwk = keys[0];
            const publicKey = await jose.importJWK(jwk, 'RS256');

            const { payload } = await jose.jwtVerify(token, publicKey);

            const userRepo = AppDataSource.getRepository(User);
            const user = await userRepo.findOneBy({ id: payload.sub });

            if (!user) {
                return status(404, { error: "user_not_found" });
            }

            return {
                sub: user.id,
                name: user.username,
                email: user.email,
                email_verified: true
            };

        } catch (e) {
            return status(401, { error: "invalid_token", message: "You're not logged in!" });
        }
    }, {
        headers: t.Object({
            authorization: t.String()
        })
    });
