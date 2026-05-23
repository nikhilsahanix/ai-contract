import pino from "pino";
import { env } from "../config/env.js";

const isDev = env.NODE_ENV !== "production";

export const logger = pino({
  level: isDev ? "debug" : "info",
  redact: ["req.headers.authorization", "body.password", "body.token"],

  serializers: {
    req(req: any) {
      return { method: req.method, url: req.url };
    },
    res(res: any) {
      return { statusCode: res.statusCode };
    },
    err: pino.stdSerializers.err,
  },

  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        colorizeObjects: false,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname,reqId,remoteAddress,remotePort,req,res,responseTime",
        levelFirst: true,
      },
    },
  }),
});
