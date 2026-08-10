import { Column, Entity, PrimaryKey, col } from "metal-orm";

@Entity({ tableName: "users" })
export class User {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.unique(col.text())))
  email!: string;

  @Column(col.notNull(col.text()))
  displayName!: string;

  @Column(col.notNull(col.text()))
  passwordHash!: string;

  @Column(col.notNull(col.text()))
  role!: string;

  @Column(col.notNull(col.int()))
  active!: number;

  @Column(col.notNull(col.text()))
  createdAt!: string;

  @Column(col.notNull(col.text()))
  updatedAt!: string;

  @Column(col.text())
  lastLoginAt?: string | null;
}

@Entity({ tableName: "user_sessions" })
export class UserSession {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "users",
    column: "id",
    onDelete: "CASCADE"
  })))
  userId!: string;

  @Column(col.notNull(col.unique(col.text())))
  tokenHash!: string;

  @Column(col.notNull(col.text()))
  createdAt!: string;

  @Column(col.notNull(col.text()))
  expiresAt!: string;

  @Column(col.text())
  revokedAt?: string | null;
}
