import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { staticPlugin } from "@elysiajs/static";
import { AppDataSource } from "./database/ormconfig";
import { initializeKeys } from "./utils/keys";
import { oidcRoutes } from "./routes/oidc";
import { accountRoutes } from "./routes/account";
import { Client } from "./database/entities/Client";
import { logger } from "./utils/logger";
import { config } from "./config";

const app = new Elysia()
    .use(swagger())
    .use(staticPlugin({
        assets: "public",
        prefix: "/"
    }))
    .use(accountRoutes) // Login/Register UI
    .use(oidcRoutes)    // OIDC Protocol
    .get("/", () => "Identity Provider is running. Go to /swagger for API docs.");

async function bootstrap() {
    try {
        await AppDataSource.initialize();
        logger.info("Database connected");

        await initializeKeys();
        if (config.demo.seed) {
            const clientRepo = AppDataSource.getRepository(Client);
            const demoClient = await clientRepo.findOneBy({ id: config.demo.clientId });
            if (!demoClient) {
                await clientRepo.save({
                    id: config.demo.clientId,
                    secret: config.demo.clientSecret,
                    redirect_uris: [`${config.oidc.publicUrl}/callback`, "https://oauth.pstmn.io/v1/callback"],
                    allowed_scopes: ["default", "profile", "email", "api:read", "api:write"],
                    name: "Demo Application"
                });
                logger.info(`Seeded '${config.demo.clientId}'`);
            }
        }

        // 4. Start Server
        app.listen({ port: config.port, hostname: "localhost" });
        logger.info(`🦊 IDP running at http://${app.server?.hostname}:${app.server?.port}`);

    } catch (error) {
        logger.error("Failed to start server", error);
        process.exit(1);
    }
}

bootstrap();
