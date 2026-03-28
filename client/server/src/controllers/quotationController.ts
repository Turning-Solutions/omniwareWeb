import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import Quotation from '../models/Quotation';
import { buildQuotationPdfBuffer } from '../utils/quotationPdf';

const quotationItemSchema = z.object({
    productId: z.string().optional(),
    title: z.string().trim().min(1).max(250),
    qty: z.number().int().positive().max(1000),
    unitPrice: z.number().positive().max(1_000_000_000),
    image: z.string().optional(),
});

const createQuotationBodySchema = z.object({
    items: z.array(quotationItemSchema).min(1).max(200),
});

export async function createQuotationPdf(req: Request, res: Response, next: NextFunction) {
    try {
        const parsed = createQuotationBodySchema.safeParse(req.body);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            return res.status(400).json({ message: first?.message || 'Invalid quotation payload' });
        }

        const items = parsed.data.items.map((i) => ({
            productId: i.productId,
            title: i.title,
            qty: i.qty,
            unitPrice: i.unitPrice,
            image: i.image,
        }));

        const subtotal = items.reduce((acc, i) => acc + i.unitPrice * i.qty, 0);

        const quotation = await Quotation.create({
            items,
            currency: 'LKR',
            subtotal,
        });

        const createdAt = quotation.createdAt ? new Date(quotation.createdAt) : new Date();

        const pdfBuffer = await buildQuotationPdfBuffer({
            items: items.map((i) => ({ title: i.title, qty: i.qty, unitPrice: i.unitPrice })),
            subtotal,
            quotationId: String(quotation._id),
            quotationDate: createdAt,
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="quotation-${quotation._id}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[quotation pdf]', error);
        next(error);
    }
}

export async function getAdminQuotes(req: Request, res: Response) {
    const { q, page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const match: Record<string, unknown> = {};
    if (q && String(q).trim()) {
        match['items.title'] = { $regex: String(q).trim(), $options: 'i' };
    }

    const [quotes, total] = await Promise.all([
        Quotation.find(match)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .select('_id createdAt items subtotal currency')
            .lean(),
        Quotation.countDocuments(match),
    ]);

    res.json({
        data: quotes,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
        },
    });
}

export async function getAdminQuoteById(req: Request, res: Response) {
    const { id } = req.params;
    const quote = await Quotation.findById(id).select('_id createdAt items subtotal currency').lean();

    if (!quote) {
        return res.status(404).json({ message: 'Quotation not found' });
    }

    res.json(quote);
}

