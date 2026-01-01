import { describe, expect, test } from "bun:test";
import { User } from "../src/database/entities/User";
import argon2 from "argon2";
import { setupDatabase } from "./utils/shared";

describe("Creation", async () => {
    await setupDatabase();
    test("should create admin account", async () => {
        const username = "admin";
        const passwordHash = await argon2.hash("adminadmin");

        await User.create({
            username: username,
            hsPassword: passwordHash,
        }).save();

        const check = await User.findOneBy({ username: username });
        expect(check).toBeDefined();
    });
});