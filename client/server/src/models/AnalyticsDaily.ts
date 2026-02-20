import mongoose, { Document, Schema } from 'mongoose';

export interface IAnalyticsDaily extends Document {
    date: string; // YYYY-MM-DD
    revenue: number;
    orders: number;
    aov: number;
    uniqueVisitors: number;
    productViews: number;
    addToCarts: number;
    checkoutStarted: number;
    paymentSuccess: number;
    conversionRate: number;
    topProducts: Array<{
        productId: mongoose.Types.ObjectId;
        title: string;
        views: number;
        purchases: number;
    }>;
    topCategories: Array<{
        category: string;
        views: number;
        purchases: number;
    }>;
    topBrands: Array<{
        brand: string;
        views: number;
        purchases: number;
    }>;
    searchTerms: Array<{
        term: string;
        count: number;
        noResultCount: number;
    }>;
    filterUsage: Array<{
        key: string;
        value: string;
        count: number;
    }>;
}

const analyticsDailySchema = new Schema<IAnalyticsDaily>({
    date: { type: String, required: true, unique: true },
    revenue: { type: Number, default: 0 },
    orders: { type: Number, default: 0 },
    aov: { type: Number, default: 0 },
    uniqueVisitors: { type: Number, default: 0 },
    productViews: { type: Number, default: 0 },
    addToCarts: { type: Number, default: 0 },
    checkoutStarted: { type: Number, default: 0 },
    paymentSuccess: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
    topProducts: [{
        productId: { type: Schema.Types.ObjectId, ref: 'Product' },
        title: String,
        views: Number,
        purchases: Number
    }],
    topCategories: [{
        category: String,
        views: Number,
        purchases: Number
    }],
    topBrands: [{
        brand: String,
        views: Number,
        purchases: Number
    }],
    searchTerms: [{
        term: String,
        count: Number,
        noResultCount: Number
    }],
    filterUsage: [{
        key: String,
        value: String,
        count: Number
    }]
}, {
    timestamps: true
});

export const AnalyticsDaily = (mongoose.models?.AnalyticsDaily as mongoose.Model<IAnalyticsDaily>) ?? mongoose.model<IAnalyticsDaily>('AnalyticsDaily', analyticsDailySchema);
