import { Elysia, t } from "elysia";
import { User } from "../database/entities/User";
import { Client } from "../database/entities/Client";
import { sessionPlugin } from "../plugins/auth";
import argon2 from "argon2";
import { jwtCreateAccessToken } from "../utils/tokens";
import { config } from "../config";


const validateRedirect = async (url: string | undefined) => {
    if (!url) return "/";

    if (url.startsWith("/") && !url.startsWith("//")) {
        return url;
    }

    const clients = await Client.find();

    // not a best way
    for (const client of clients) {
        if (client.redirect_uris.includes(url)) {
            return url;
        }
    }

    return "/";
}

export const accountRoutes = new Elysia()
    .use(sessionPlugin)
    .get("/login", ({ query, user, redirect }) => {
        if (user) {
            return redirect(query.return_to || '/');
        }
        return Bun.file("public/login.html");
    }, {
        query: t.Object({
            return_to: t.Optional(t.String()),
            error: t.Optional(t.String())
        })
    })

    .post("/login", async ({ body, query, sessionJwt, cookie, redirect }) => {
        const { username, password } = body;
        const returnTo = query.return_to || "";

        const user = await User.findOneBy({ username });
        if (!user || !(await argon2.verify(user.hsPassword, password))) {
            const errorMsg = encodeURIComponent("Incorrect username or password");
            return redirect(`/login?error=${errorMsg}&return_to=${encodeURIComponent(returnTo)}`);
        };

        const token = await jwtCreateAccessToken(user, sessionJwt);
        cookie.idp_session.set({
            value: token,
            httpOnly: true,
            secure: config.env === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 86400, // 1 day
        });

        return redirect(await validateRedirect(returnTo));
    }, {
        body: t.Object({
            username: t.String(),
            password: t.String()
        }),
        query: t.Object({
            return_to: t.Optional(t.String())
        })
    })

    .get("/logout", ({ cookie, redirect }) => {
        cookie.idp_session.remove();
        return redirect("/login");
    })

    .get("/register", () => {
        return Bun.file("public/register.html");
    }, {
        query: t.Object({
            return_to: t.Optional(t.String()),
            error: t.Optional(t.String())
        })
    })
    .post("/register", async ({ body: { username, email, password }, query, sessionJwt, cookie, redirect }) => {
        const returnTo = query.return_to || "";

        const existing = await User.findOne({ where: [{ username }, { email }] });
        if (existing) {
            const errorMsg = encodeURIComponent("User already exists");
            return redirect(`/register?error=${errorMsg}&return_to=${encodeURIComponent(returnTo)}`);
        }

        const hashedPassword = await argon2.hash(password);

        try {
            const newUser = User.create({
                username,
                email,
                hsPassword: hashedPassword,
                // tokenVersion: 0, etc
            });
            await User.save(newUser);

            const jwtToken = await jwtCreateAccessToken(newUser, sessionJwt);
            cookie.idp_session.set({
                value: jwtToken,
                httpOnly: true,
                secure: config.env === "production",
                sameSite: "lax",
                path: "/",
                maxAge: 86400,
            });

            return redirect(await validateRedirect(returnTo));
        } catch (e) {
            const errorMsg = encodeURIComponent("Failed to create user");
            return redirect(`/register?error=${errorMsg}&return_to=${encodeURIComponent(returnTo)}`);
        }
    }, {
        body: t.Object({
            username: t.String(),
            email: t.String(),
            password: t.String()
        }),
        query: t.Object({
            return_to: t.Optional(t.String())
        })
    });