import fp from "fastify-plugin";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireApiKey } from "../middleware/requireApiKey.js";
import { requireOrg } from "../middleware/requireOrg.js";

export default fp(async (app) => {
  app.decorate("requireAuth", requireAuth);
  app.decorate("requireApiKey", requireApiKey);
  app.decorate("requireOrg", requireOrg);
});
