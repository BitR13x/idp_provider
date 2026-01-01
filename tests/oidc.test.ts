import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import { oidcRoutes } from "../src/routes/oidc";
import { accountRoutes } from "../src/routes/account";
import { AppDataSource } from "../src/database/ormconfig";
import { initializeKeys } from "../src/utils/keys";
import { Client } from "../src/database/entities/Client";
import { User } from "../src/database/entities/User";
import { config } from "../src/config";
import * as jose from 'jose';
import { v4 as uuidv4 } from 'uuid';
import argon2 from "argon2";

// Helper to start the app for testing
const app = new Elysia().use(accountRoutes).use(oidcRoutes);

describe("OIDC Provider Tests", () => {
    let testClient: Client;
    let testUser: User;
    let authCode: string;
    let accessToken: string;
    let idToken: string;
    let sessionCookie: string;

    beforeAll(async () => {
        // Initialize DB and Keys
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }
        await initializeKeys();

        // Seed Test Data
        const clientRepo = AppDataSource.getRepository(Client);
        testClient = await clientRepo.save({
            id: "test-client",
            secret: "test-secret",
            redirect_uris: ["http://localhost:3000/callback"],
            allowed_scopes: ["openid", "profile", "email"],
            name: "Test App"
        });

        const userRepo = AppDataSource.getRepository(User);
        testUser = await userRepo.findOneBy({ username: "testuser" }) as User;

        const validHash = await argon2.hash("testpassword");

        if (!testUser) {
            testUser = new User();
            testUser.id = uuidv4();
            testUser.username = "testuser";
            testUser.email = "testuser@example.com";
            testUser.hsPassword = validHash;
            await userRepo.save(testUser);
        } else {
            // Update to a valid hash if it was seeded with dummy data
            testUser.hsPassword = validHash;
            await userRepo.save(testUser);
        }

        // Perform real login to get the cookie
        const loginRes = await app.handle(
            new Request("http://localhost/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: "testuser", password: "testpassword" })
            })
        );

        if (loginRes.status >= 400) {
            const errBody = await loginRes.text();
            throw new Error(`Login failed with status ${loginRes.status}: ${errBody}`);
        }

        const setCookie = loginRes.headers.get("Set-Cookie");
        if (!setCookie) {
            // Debug: check all headers
            const allHeaders: any = {};
            loginRes.headers.forEach((v: any, k: any) => allHeaders[k] = v);
            throw new Error(`Login success but no Set-Cookie header. Headers: ${JSON.stringify(allHeaders)}`);
        }

        // Extract the idp_session part
        sessionCookie = setCookie.split(';')[0];
    });

    afterAll(async () => {
        // Cleanup
    });

    it("GET /.well-known/openid-configuration returns valid metadata", async () => {
        const response = await app.handle(
            new Request("http://localhost/oidc/.well-known/openid-configuration")
        );
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.issuer).toBe(config.oidc.issuer);
    });

    it("GET /jwks.json returns public keys", async () => {
        const response = await app.handle(
            new Request("http://localhost/oidc/.well-known/jwks.json")
        );
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.keys).toBeArray();
    });

    it("GET /authorize redirects to login if no session", async () => {
        const params = new URLSearchParams({
            client_id: "test-client",
            redirect_uri: "http://localhost:3000/callback",
            response_type: "code",
            scope: "openid profile"
        });

        const response = await app.handle(
            new Request(`http://localhost/oidc/authorize?${params.toString()}`)
        );

        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toContain("/login");
    });

    it("GET /authorize redirects with code if session exists", async () => {
        const params = new URLSearchParams({
            client_id: "test-client",
            redirect_uri: "http://localhost:3000/callback",
            response_type: "code",
            scope: "openid profile",
            state: "xyz123"
        });

        const response = await app.handle(
            new Request(`http://localhost/oidc/authorize?${params.toString()}`, {
                headers: { "cookie": sessionCookie } // Use lowercase for consistency
            })
        );

        expect(response.status).toBe(302);
        const location = response.headers.get("Location")!;

        // Handle relative or absolute URL
        const absoluteLocation = location.startsWith('http') ? location : `http://localhost${location}`;
        const url = new URL(absoluteLocation);

        // If it's still redirecting to login, it means session was not valid
        if (url.pathname === '/login') {
            throw new Error(`Redirected to login instead of callback. Location: ${location}`);
        }

        authCode = url.searchParams.get("code")!;
        expect(authCode).toBeDefined();
        expect(url.searchParams.get("state")).toBe("xyz123");
    });

    it("POST /token exchanges code for tokens", async () => {
        if (!authCode) {
            throw new Error("authCode is undefined, cannot run token exchange test");
        }
        console.log("Exchanging Auth Code:", authCode);

        const body = {
            client_id: "test-client",
            client_secret: "test-secret",
            code: authCode,
            grant_type: "authorization_code",
            api_aud: "http://test-api.com", // Add required audience
            redirect_uri: "http://localhost:3000/callback"
        };

        const response = await app.handle(
            new Request("http://localhost/oidc/token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            })
        );
        
        if (response.status !== 200) {
            console.log("Token Endpoint Error:", await response.text());
        }

        const json = await response.json();
        expect(response.status).toBe(200);
        accessToken = json.access_token;
        idToken = json.id_token;
    });

    it("GET /userinfo returns profile", async () => {
        const response = await app.handle(
            new Request("http://localhost/oidc/userinfo", {
                headers: { "Authorization": `Bearer ${accessToken}` }
            })
        );

        const json = await response.json();
        expect(response.status).toBe(200);
        expect(json.name).toBe("testuser");
    });
});
