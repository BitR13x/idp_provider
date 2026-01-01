import { Entity, PrimaryColumn, Column, ManyToOne, BaseEntity } from "typeorm";
import { User } from "./User";
import { Client } from "./Client";

@Entity()
export class AuthCode extends BaseEntity {
    @PrimaryColumn()
    code: string;

    @ManyToOne(() => User)
    user: User;

    @ManyToOne(() => Client)
    client: Client;

    @Column("simple-array", { nullable: true })
    scope: string[];

    @Column({ nullable: true })
    nonce: string | undefined; // OIDC nonce

    @Column()
    expiresAt: Date;
}
