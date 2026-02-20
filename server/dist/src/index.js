"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const db_1 = __importDefault(require("./config/db"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const productRoutes_1 = __importDefault(require("./routes/productRoutes"));
const orderRoutes_1 = __importDefault(require("./routes/orderRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const builderRoutes_1 = __importDefault(require("./routes/builderRoutes"));
const admin_products_1 = __importDefault(require("./routes/admin.products"));
const analyticsRoutes_1 = __importDefault(require("./routes/analyticsRoutes"));
const featuredSpecsRoutes_1 = __importDefault(require("./routes/featuredSpecsRoutes"));
const errorMiddleware_1 = require("./middleware/errorMiddleware");
const requestId_1 = require("./middleware/requestId");
dotenv_1.default.config();
(0, db_1.default)();
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
app.use((0, cors_1.default)({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://192.168.1.3:3000'],
    credentials: true
}));
app.use(express_1.default.json());
app.use(requestId_1.requestIdMiddleware);
app.use('/api/v1/auth', authRoutes_1.default);
app.use('/api/v1/products', productRoutes_1.default);
app.use('/api/v1/orders', orderRoutes_1.default);
app.use('/api/v1/admin/products', admin_products_1.default);
app.use('/api/v1/admin/categories', featuredSpecsRoutes_1.default);
app.use('/api/v1/admin', adminRoutes_1.default);
app.use('/api/v1/builder', builderRoutes_1.default);
app.use('/api/v1/analytics', analyticsRoutes_1.default); // Mount analytics routes
app.get('/', (req, res) => {
    res.send('Omniware API is running');
});
app.use(errorMiddleware_1.errorHandler);
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
