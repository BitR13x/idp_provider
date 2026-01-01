import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "./entities/User";
import { Client } from "./entities/Client";
import { AuthCode } from "./entities/AuthCode";
import { config } from "../config";
import { RefreshToken } from "./entities/RefreshToken";

const models = {
   entities: [User, Client, AuthCode, RefreshToken],
   migrations: [],
   subscribers: []
}

//export const AppDataSource = new DataSource({
//   type: "postgres",
//   host: config.database.DB_HOST,
//   port: 5432,
//   username: config.database.DB_USER,
//   password: config.database.DB_PASS,
//   database: config.database.database,
//   synchronize: true,
//   logging: true,
//   ...models
//})

export const AppDataSource = new DataSource({
   type: "sqlite",
   database: "idp.sqlite",
   synchronize: true,
   logging: false,
   ...models
});