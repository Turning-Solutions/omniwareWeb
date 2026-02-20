"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errorHandler = (err, req, res, next) => {
    const statusCode = err.status || res.statusCode || 500;
    // Ensure we don't send back 200 for an error (standard Express default if no status set)
    res.status(statusCode === 200 ? 500 : statusCode);
    res.json({
        error: {
            code: err.code || 'INTERNAL_SERVER_ERROR',
            message: err.message || 'An unexpected error occurred',
            details: err.details,
            requestId: req.id // set by requestId middleware
        }
    });
    // We can also stringify standard Node errors if we want, but the prompt mandates this exact structure.
};
exports.errorHandler = errorHandler;
