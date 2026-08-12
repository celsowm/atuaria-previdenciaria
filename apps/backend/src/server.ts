import "./load-env.js";
import { createExpressApp } from "adorn-api";
import { getApplicationName } from "./application-config.js";
import { bootstrapAdminFromEnvironment, verifyBearerToken } from "./auth/auth-service.js";
import { AuthController, UsuarioController } from "./api/auth-controller.js";
import { PlanoController } from "./api/plano-controller.js";
import { PrevidenciaController } from "./api/previdencia-controller.js";
import { ParametrizacaoController } from "./api/parametrizacao-controller.js";
import { CalculoController } from "./api/calculo-controller.js";
import { FechamentoController } from "./api/fechamento-controller.js";
import {
  CriticaController,
  AvaliacaoController,
  ImportacaoController,
  ProvedorLlmController,
  PerfilMapeamentoController,
  SystemController
} from "./api/controllers.js";
import { TabuaBiometriaController, VersaoBiometriaController } from "./api/biometria-controller.js";
import { AderenciaCandidatoController, EstudoAderenciaController } from "./api/aderencia-controller.js";
import { closeDatabase, initializeDatabase } from "./db.js";

async function start() {
  const databasePath = await initializeDatabase();
  await bootstrapAdminFromEnvironment();
  const applicationName = getApplicationName();

  const app = await createExpressApp({
    controllers: [
      AuthController,
      UsuarioController,
      SystemController,
      PlanoController,
      PrevidenciaController,
      AvaliacaoController,
      ParametrizacaoController,
      CalculoController,
      FechamentoController,
      PerfilMapeamentoController,
      ImportacaoController,
      CriticaController,
      TabuaBiometriaController,
      VersaoBiometriaController,
      EstudoAderenciaController,
      AderenciaCandidatoController,
      ProvedorLlmController
    ],
    bearerAuth: { verifyToken: verifyBearerToken },
    inputCoercion: "safe",
    validation: { enabled: true, mode: "strict" },
    multipart: {
      storage: "memory",
      maxFileSize: 100 * 1024 * 1024,
      maxFiles: 1
    },
    openApi: {
      info: {
        title: `${applicationName} API`,
        version: "0.0.1",
        description: "Actuarial valuation, pension plans, versioned plan rules, data studio, biometrics, adherence studies, parametrizacao, deterministic calculation, drafting and AI orchestration API."
      },
      path: "/openapi.json",
      docs: { path: "/docs" }
    }
  });

  const port = Number(process.env.PORT ?? 3001);
  const server = app.listen(port, () => {
    console.log(`${applicationName} API: http://localhost:${port}`);
    console.log(`OpenAPI: http://localhost:${port}/openapi.json`);
    console.log(`Swagger: http://localhost:${port}/docs`);
    console.log(`SQLite: ${databasePath}`);
  });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeDatabase();
  };

  process.once("SIGINT", () => void shutdown().finally(() => process.exit(0)));
  process.once("SIGTERM", () => void shutdown().finally(() => process.exit(0)));
}

start().catch((error) => {
  console.error(error);
  void closeDatabase().finally(() => process.exit(1));
});
