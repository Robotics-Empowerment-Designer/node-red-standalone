const winston = require("winston");
const path = require("path");

/**
 * Creates a Winston logger instance.
 * @param {any} callingModule - The module that is calling the logger factory.
 * @returns {winston.Logger} - A Winston logger instance.
 */
const loggerFactory = function (callingModule) {
    const filename = callingModule.filename.split(path.sep).slice(-2).join(path.sep);

    return winston.createLogger({
        level: process.env.NODE_RED_LOG_LEVEL || "warn",
        format: winston.format.combine(
            winston.format((info) => {
                info.filename = filename;
                return info;
            })(),
            winston.format.timestamp({
                format: "DD.MM.YYYY HH:mm:ss.SSS",
            }),
            winston.format.errors({stack: true}),
            winston.format.printf(({level, message, timestamp, stack, filename}) => {
                if (stack) {
                    return `${timestamp} - [${level}] [${filename}]: ${message}\n${stack}`;
                }
                return `${timestamp} - [${level}]\t[${filename}]: ${message}`;
            })
        ),
        transports: [new winston.transports.Console()],
    });
};

module.exports = loggerFactory;
