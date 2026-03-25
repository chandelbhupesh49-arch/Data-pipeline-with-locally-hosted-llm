import winston from "winston";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const tsFormat = "ddd YYYY-MM-DD HH:mm:ss";

// __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// project root = data-pipeline (two levels up from utils/logger/)
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

// logs folder at root (same level as utils)
const LOG_DIR = path.join(PROJECT_ROOT, "Logs");

fs.mkdirSync(LOG_DIR, { recursive: true });


const baseFormat = winston.format.combine(
    winston.format.timestamp({ format: tsFormat }),
    //   winston.format.errors({ stack: true })
);


const droppedOnly = winston.format((info) => {
    return info.dropped === true ? info : false;
});

const fileFormat = winston.format.combine(baseFormat, winston.format.json());

const droppedFileFormat = winston.format.combine(
    droppedOnly(),
    baseFormat,
    winston.format.json()
);


// CONSOLE: colored + pretty
const consoleFormat = winston.format.combine(
    baseFormat,
    // winston.format.colorize({ all: true }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        // const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
        return `[${timestamp}] [${level}]: ${message}`;
    })
);

const logger = winston.createLogger({
    level: "info",
    transports: [
        new winston.transports.File({
            filename: path.join(LOG_DIR, "error.log"),
            level: "error",
            format: fileFormat,
        }),
        new winston.transports.File({
            filename: path.join(LOG_DIR, "combined.log"),
            level: "info",
            format: fileFormat,
        }),
        new winston.transports.File({
            filename: path.join(LOG_DIR, "dropped_feilds.log"),
            level: "warn",
            format: droppedFileFormat,
        }),
    ],
})

logger.add(
    new winston.transports.Console({
        format: consoleFormat,
    })
);

export default logger;