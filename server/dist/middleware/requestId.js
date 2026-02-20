"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = void 0;
const uuid_1 = require("uuid");
const requestIdMiddleware = (req, res, next) => {
    req.id = (0, uuid_1.v4)();
    next();
};
exports.requestIdMiddleware = requestIdMiddleware;
