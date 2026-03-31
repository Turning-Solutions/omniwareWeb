import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import Partner from "../models/Partner";
import { AppError } from "../middleware/errorMiddleware";

const starterPartners = [
    "AMD",
    "INTEL",
    "NVIDIA",
    "ASUS",
    "MSI",
    "GIGABYTE",
    "ZOTAG",
    "CORSAIR",
    "NZXT",
    "ANTEC",
    "PROLINK",
    "OMIKUMA",
    "WD",
    "SAMSUNG",
] as const;

const partnerSchema = z.object({
    name: z.string().min(1, "Name is required"),
    logoUrl: z.string().default(""),
    isActive: z.boolean().default(true),
    sortOrder: z.number().default(0),
});

const updateSchema = partnerSchema.partial();

async function ensureStarterPartners(): Promise<void> {
    const existingCount = await Partner.countDocuments();
    if (existingCount > 0) return;

    await Partner.insertMany(
        starterPartners.map((name, idx) => ({
            name,
            logoUrl: "",
            isActive: true,
            sortOrder: idx,
        }))
    );
}

export const getActivePartners = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        await ensureStarterPartners();
        const partners = await Partner.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 });
        res.json(partners);
    } catch (error) {
        next(error);
    }
};

export const getAllPartners = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        await ensureStarterPartners();
        const partners = await Partner.find().sort({ sortOrder: 1, createdAt: 1 });
        res.json(partners);
    } catch (error) {
        next(error);
    }
};

export const createPartner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const result = partnerSchema.safeParse(req.body);
        if (!result.success) {
            const err: AppError = new Error("Invalid input");
            err.code = "VALIDATION_ERROR";
            err.status = 400;
            err.details = result.error.format();
            return next(err);
        }

        const partner = await Partner.create(result.data);
        res.status(201).json(partner);
    } catch (error: unknown) {
        const mongoError = error as { code?: number };
        if (mongoError?.code === 11000) {
            const err: AppError = new Error("A partner with this name already exists");
            err.code = "DUPLICATE_KEY";
            err.status = 409;
            return next(err);
        }
        next(error);
    }
};

export const updatePartner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const result = updateSchema.safeParse(req.body);
        if (!result.success) {
            const err: AppError = new Error("Invalid input");
            err.code = "VALIDATION_ERROR";
            err.status = 400;
            err.details = result.error.format();
            return next(err);
        }

        const partner = await Partner.findByIdAndUpdate(id, result.data, { new: true, runValidators: true });
        if (!partner) {
            const err: AppError = new Error("Partner not found");
            err.code = "NOT_FOUND";
            err.status = 404;
            return next(err);
        }

        res.json(partner);
    } catch (error: unknown) {
        const mongoError = error as { code?: number };
        if (mongoError?.code === 11000) {
            const err: AppError = new Error("A partner with this name already exists");
            err.code = "DUPLICATE_KEY";
            err.status = 409;
            return next(err);
        }
        next(error);
    }
};

export const deletePartner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const partner = await Partner.findByIdAndDelete(id);
        if (!partner) {
            const err: AppError = new Error("Partner not found");
            err.code = "NOT_FOUND";
            err.status = 404;
            return next(err);
        }
        res.json({ message: "Partner deleted" });
    } catch (error) {
        next(error);
    }
};
