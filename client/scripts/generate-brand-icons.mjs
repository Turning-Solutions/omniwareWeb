import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(root, "public", "Logo White.png");
const black = { r: 0, g: 0, b: 0 };

async function writeIcon(size, logoScale, outPath) {
    const flattened = await sharp(source)
        .flatten({ background: black })
        .png()
        .toBuffer();

    const logoSize = Math.max(8, Math.round(size * logoScale));
    const logo = await sharp(flattened)
        .resize(logoSize, logoSize, { fit: "contain", background: black })
        .removeAlpha()
        .png()
        .toBuffer();

    await sharp({
        create: {
            width: size,
            height: size,
            channels: 3,
            background: black,
        },
    })
        .composite([{ input: logo, gravity: "center" }])
        .removeAlpha()
        .png()
        .toFile(outPath);
}

async function writeOgImage(outPath) {
    const width = 1200;
    const height = 630;
    const logoSize = 360;
    const flattened = await sharp(source)
        .flatten({ background: black })
        .png()
        .toBuffer();
    const logo = await sharp(flattened)
        .resize(logoSize, logoSize, { fit: "contain", background: black })
        .removeAlpha()
        .png()
        .toBuffer();

    await sharp({
        create: {
            width,
            height,
            channels: 3,
            background: black,
        },
    })
        .composite([{ input: logo, gravity: "center" }])
        .removeAlpha()
        .png()
        .toFile(outPath);
}

// Smaller mark on black so the black border survives Google's circular crop.
const logoScale = 0.52;

await writeIcon(48, logoScale, path.join(root, "app", "icon.png"));
await writeIcon(180, logoScale, path.join(root, "app", "apple-icon.png"));
await writeIcon(48, logoScale, path.join(root, "public", "brand-icon.png"));
await writeIcon(32, logoScale, path.join(root, "public", "favicon.png"));
await writeIcon(180, logoScale, path.join(root, "public", "apple-touch-icon.png"));
await writeIcon(512, logoScale, path.join(root, "public", "site-brand-icon.png"));
await writeOgImage(path.join(root, "public", "og-default.png"));

console.log("Generated brand icons with solid black background");
