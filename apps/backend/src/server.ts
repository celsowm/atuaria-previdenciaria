import { createExpressApp } from "adorn-api";
import { getApplicationName } from "./application-config.js";
import { bootstrapAdminFromEnvironment, verifyBearerToken } from "./auth/auth-service.js";
import { AuthController, UserController } from "./api/auth-controller.js";
import { PlanController } from "./api/plan-controller.js";
import { ParameterizationController } from "./api/parameterization-controller.js";
import {
  CritiqueController,
  EvaluationController,
  ImportController,
  LlmProviderController,
  MappingProfileController,
  SystemController
} from "./api/controllers.js";
import { BiometricTableController, BiometricVersionController } from "./api/biometric-controller.js";
import { AdherenceCandidateController, AdherenceStudyController } from "./api/adherence-controller.js";
import { closeDatabase, initializeDatabase } from "./db.js";

async function start() {
  const databasePath = await initializeDatabase();
  await bootstrapAdminFromEnvironment();
  const applicationName = getApplicationName();

  const app = await createExpressApp({
    controllers: [
      AuthController,
      UserController,
      SystemController,
      PlanController,
      EvaluationController,
      ParameterizationController,
      MappingProfileController,
      ImportController,
      CritiqueController,
      BiometricTableController,
      BiometricVersionController,
      AdherenceStudyController,
      AdherenceCandidateController,
      LlmProviderController
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
        description: "Actuarial valuation, pension plans, data studio, biometrics, adherence studies, assumptions, drafting and AI orchestration API."
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
