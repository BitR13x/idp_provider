import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, CreateDateColumn } from "typeorm";

@Entity()
export class User extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    username!: string;

    @Column({ unique: true })
    email!: string;

/*     @Column({ nullable: true })
    phone: string; */

    @Column()
    hsPassword!: string;

    @CreateDateColumn({ type: "date" })
    createdAt!: Date;
}
