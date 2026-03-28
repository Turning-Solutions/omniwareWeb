import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Review from '../models/Review';

function paramId(raw: string | string[] | undefined): string {
    if (raw == null) return "";
    return Array.isArray(raw) ? raw[0] ?? "" : raw;
}

export async function listAdminReviews(req: Request, res: Response) {
    try {
        const statusRaw = req.query.status;
        const kindRaw = req.query.kind;
        const statusFilter = typeof statusRaw === "string" ? statusRaw : "all";
        const kindFilter = typeof kindRaw === "string" ? kindRaw : "all";

        const filter: Record<string, unknown> = {};
        if (kindFilter !== "all" && ["shop", "product"].includes(kindFilter)) {
            filter.kind = kindFilter;
        }
        if (statusFilter !== "all" && ["pending", "approved", "rejected"].includes(statusFilter)) {
            if (statusFilter === "approved") {
                filter.status = "approved";
            } else if (statusFilter === "pending") {
                filter.$or = [{ status: "pending" }, { status: { $exists: false } }];
            } else {
                filter.status = statusFilter;
            }
        }

        const reviews = await Review.find(filter)
            .sort({ createdAt: -1 })
            .limit(500)
            .populate("productId", "title slug")
            .lean();

        res.json({ reviews });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to load reviews" });
    }
}

export async function updateReviewStatus(req: Request, res: Response) {
    try {
        const id = paramId(req.params.id).trim();
        const bodyStatus = (req.body as { status?: unknown })?.status;
        const fromBody = typeof bodyStatus === "string" ? bodyStatus.trim().toLowerCase() : "";
        const q = req.query.status;
        const fromQuery =
            typeof q === "string"
                ? q.trim().toLowerCase()
                : Array.isArray(q) && typeof q[0] === "string"
                  ? q[0].trim().toLowerCase()
                  : "";
        const normalized = fromBody || fromQuery;

        if (!id) {
            res.status(400).json({ message: "Invalid review id" });
            return;
        }

        let oid: mongoose.Types.ObjectId;
        try {
            oid = new mongoose.Types.ObjectId(id);
        } catch {
            res.status(400).json({ message: "Invalid review id" });
            return;
        }

        if (normalized !== "approved" && normalized !== "rejected" && normalized !== "pending") {
            res.status(400).json({ message: "status must be pending, approved, or rejected" });
            return;
        }

        const status = normalized as "approved" | "rejected" | "pending";

        const updated = await Review.findOneAndUpdate(
            { _id: oid },
            { $set: { status } },
            { new: true }
        )
            .populate("productId", "title slug")
            .lean();

        if (!updated) {
            res.status(404).json({ message: "Review not found" });
            return;
        }
        res.json({ review: updated });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Could not update review" });
    }
}

export async function deleteAdminReview(req: Request, res: Response) {
    try {
        const id = paramId(req.params.id);
        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: "Invalid review id" });
            return;
        }
        const deleted = await Review.findByIdAndDelete(id).lean();
        if (!deleted) {
            res.status(404).json({ message: "Review not found" });
            return;
        }
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Could not delete review" });
    }
}
