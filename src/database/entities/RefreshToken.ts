import { Entity, Column, ManyToOne, BaseEntity, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./User";
import { Client } from "./Client";

@Entity()
export class RefreshToken extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => User)
    user: User;

    @ManyToOne(() => Client)
    client: Client;

    @Column("simple-array")
    scope: string[];

    @Column({ default: 1 })
    version: number;

    @Column()
    expiresAt: Date;
}
