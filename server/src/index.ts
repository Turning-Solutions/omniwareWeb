import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db';
import authRoutes from './routes/authRoutes';
import productRoutes from './routes/productRoutes';
import orderRoutes from './routes/orderRoutes';
import adminRoutes from './routes/adminRoutes';
import builderRoutes from './routes/builderRoutes';
import adminProductRoutes from './routes/admin.products';

import analyticsRoutes from './routes/analyticsRoutes';
import featuredSpecsRoutes from './routes/featuredSpecsRoutes';
import { errorHandler } from './middleware/errorMiddleware';
import { requestIdMiddleware } from './middleware/requestId';

dotenv.config();

connectDB();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://192.168.1.3:3000'],
    credentials: true
}));
app.use(express.json());
app.use(requestIdMiddleware);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/orders', orderRoutes);

app.use('/api/v1/admin/products', adminProductRoutes);
app.use('/api/v1/admin/categories', featuredSpecsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/builder', builderRoutes);
app.use('/api/v1/analytics', analyticsRoutes); // Mount analytics routes

app.get('/', (req, res) => {
    res.send('Omniware API is running');
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
