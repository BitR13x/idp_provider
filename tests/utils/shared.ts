import { AppDataSource } from "../../src/database/ormconfig";

export const setupDatabase = async () => {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
};