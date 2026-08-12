import { Entity, col } from "metal-orm";
import { Column, PrimaryKey } from "./colunas-portuguesas.js";

@Entity({ tableName: "usuarios" })
export class Usuario {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.unique(col.text())))
  email!: string;

  @Column(col.notNull(col.text()))
  nomeExibicao!: string;

  @Column(col.notNull(col.text()))
  resumoSenha!: string;

  @Column(col.notNull(col.text()))
  perfil!: string;

  @Column(col.notNull(col.int()))
  ativo!: number;

  @Column(col.notNull(col.text()))
  criadoEm!: string;

  @Column(col.notNull(col.text()))
  atualizadoEm!: string;

  @Column(col.text())
  ultimoAcessoEm?: string | null;
}

@Entity({ tableName: "user_sessions" })
export class SessaoUsuario {
  @PrimaryKey(col.text())
  id!: string;

  @Column(col.notNull(col.references(col.text(), {
    table: "usuarios",
    column: "id",
    onDelete: "CASCADE"
  })))
  usuarioId!: string;

  @Column(col.notNull(col.unique(col.text())))
  resumoToken!: string;

  @Column(col.notNull(col.text()))
  criadoEm!: string;

  @Column(col.notNull(col.text()))
  expiraEm!: string;

  @Column(col.text())
  revogadoEm?: string | null;
}
