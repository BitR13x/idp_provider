import { User } from "../src/database/entities/User";
import { AppDataSource } from "../src/database/ormconfig";

import argon2 from "argon2";
import { expect, test, describe, beforeAll, afterAll } from "bun:test";

beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
});

afterAll(async () => {
    if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
    }
});

describe("Database Test", () => {
    test("should create a user ", async () => {
        let user = await User.findOneBy({username: "test"})
        if (user) {
            await user.remove();
        };
        await User.create({
            username: "test",
            email: "test@example",
            hsPassword: await argon2.hash("testpassword"),
        }).save()
    });

    test("should remove a user", async () => {
        let user = await User.findOneBy({username: "test"});
        if (user) {
            await user.remove();
        }
        let test_user = await User.findOneBy({username: "test"});
        expect(test_user).toBeNull();
    });

    test("should matched hashed password", async () => {
        let hash = await argon2.hash("testpassword")
        expect(await argon2.verify(hash, "testpassword")).toBeTrue();
    });
});

