import { Request, Response } from 'express';
import BuildRequest from '../models/BuildRequest';

export const createBuildRequest = async (req: Request, res: Response) => {
    try {
        const buildRequest = new BuildRequest(req.body);
        const createdRequest = await buildRequest.save();
        res.status(201).json(createdRequest);
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
};
