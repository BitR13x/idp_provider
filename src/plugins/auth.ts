import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { cookie } from "@elysiajs/cookie";
import { User } from "../database/entities/User";
import { config } from "../config";

export type session_payload = {
  sub: string;
  scope: string[];
  aud: string;
  iss: string;
  exp: number;
  iat: number;
};

export const sessionPlugin = new Elysia({ name: 'session' })
    .use(
        jwt({
            name: "sessionJwt",
            secret: config.oidc.jwt.sessionSecret,
            exp: "1d"
        })
    )
    .use(cookie())
    .resolve({ as: 'scoped' }, async ({ cookie: { idp_session }, sessionJwt, status }) => {
        const token = idp_session?.value;
        if (!token && typeof(token) !== "string") return { user: null };

        const dec_token = await sessionJwt.verify(token as string) as session_payload;
        if (!dec_token) return { user: null };

        const user = await User.findOneBy({ id: dec_token.sub });
        if (!user) {
            return status(401, "You're not logged in!");
        }
        return { user };
    });

export const isAuthenticated = new Elysia({ name: 'isAuthenticated' })
    .use(sessionPlugin)
    .as('scoped')
    .onBeforeHandle(({ user, status }) => {
        if (!user) {
            return status(401, "You're not logged in!");
        }
    });