"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const featuredSpecsController_1 = require("../controllers/featuredSpecsController");
const router = express_1.default.Router({ mergeParams: true });
router.get('/:categoryKey/spec-keys', featuredSpecsController_1.getAvailableSpecKeys);
router.get('/:categoryKey/featured-specs', featuredSpecsController_1.getFeaturedSpecs);
router.put('/:categoryKey/featured-specs', featuredSpecsController_1.updateFeaturedSpecs);
router.delete('/:categoryKey/featured-specs', featuredSpecsController_1.deleteFeaturedSpecs);
exports.default = router;
