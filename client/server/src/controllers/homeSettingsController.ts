import { Request, Response } from "express";
import HomeSettings from "../models/HomeSettings";
import { triggerRevalidation } from "../utils/revalidate";

const DEFAULT_HOME_SETTINGS = {
    showDiscountedProductsRow: true,
};

export async function getHomeSettings(_req: Request, res: Response) {
    const settings = await HomeSettings.findOne().lean();
    res.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    return res.json({
        ...DEFAULT_HOME_SETTINGS,
        ...(settings ?? {}),
    });
}

export async function updateHomeSettings(req: Request, res: Response) {
    const { showDiscountedProductsRow } = req.body as { showDiscountedProductsRow?: unknown };

    if (typeof showDiscountedProductsRow !== "boolean") {
        return res.status(400).json({ message: "showDiscountedProductsRow must be a boolean" });
    }

    const updated = await HomeSettings.findOneAndUpdate(
        {},
        { $set: { showDiscountedProductsRow } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    triggerRevalidation(['/']);

    return res.json({
        ...DEFAULT_HOME_SETTINGS,
        ...(updated ?? {}),
    });
}
