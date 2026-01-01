import { Entity, PrimaryColumn, Column, BaseEntity } from "typeorm";

@Entity()
export class Client extends BaseEntity {
    @PrimaryColumn()
    id: string;

    @Column()
    secret: string;

    @Column("simple-array")
    redirect_uris: string[];

    @Column("simple-array")
    allowed_scopes: string[];

    @Column()
    name: string;
}
