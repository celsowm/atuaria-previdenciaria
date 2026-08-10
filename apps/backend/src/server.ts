import { createExpressApp } from "adorn-api";
import { initializeDatabase } from "./db.js";
import {
  EvaluationController,
  LlmProviderController,
  MappingProfileController,
  SystemController
} from "./api/controllers.js";

async function start() {
  await initializeDatabase();

  const app = await createExpressApp({
    controllers: [
      SystemController,
      EvaluationController,
      MappingProfileController,
      LlmProviderController
    ],
    inputCoercion: "safe",
    validation: { enabled: true, mode: "strict" },
    openApi: {
      info: {
        title: "ATUAS API",
        version: "0.0.1",
        description: "Actuarial valuation, data studio, assumptions, drafting and AI orchestration API."
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
