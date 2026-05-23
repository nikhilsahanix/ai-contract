import type { ApiKey, Org, UserRole } from "@prisma/client";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
      orgId: string;
      role: UserRole;
      type: "access" | "refresh";
    };
    org?: Pick<Org, "id" | "slug" | "plan">;
    apiKey?: Pick<ApiKey, "id" | "orgId" | "name" | "rateLimit">;
  }
}
