import { createExpressApp } from "adorn-api";
import { initializeDatabase } from "./db.js";
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

async function start() {
  await initializeDatabase();

  const app = await createExpressApp({
    controllers: [
      SystemController,
      EvaluationController,
      MappingProfileController,
      ImportController,
      CritiqueController,
      BiometricTableController,
      BiometricVersionController,
      AdherenceStudyController,
      AdherenceCandidateController,
      LlmProviderController
    ],
    inputCoercion: "safe",
    validation: { enabled: true, mode: "strict" },
    multipart: {
      storage: "memory",
      maxFileSize: 100 * 1024 * 1024,
      maxFiles: 1
    },
    openApi: {
      info: {
        title: "ATUAS API",
        version: "0.0.1",
        description: "Actuarial valuation, data studio, biometrics, adherence studies, assumptions, drafting and AI orchestration API."
      },
      path: "/openapi.json",
      docs: { path: "/docs" }
    }
  });

  const port = Number(process.env.PORT ?? 3001);
  app.listen(port, () => {
    console.log(`ATUAS API: http://localhost:${port}`);
    console.log(`OpenAPI: http://localhost:${port}/openapi.json`);
    console.log(`Swagger: http://localhost:${port}/docs`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
