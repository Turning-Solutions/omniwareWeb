import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(root, "public", "Logo White.png");
const black = { r: 0, g: 0, b: 0 };

async function writeIcon(size, outPath) {
    await sharp(source)
        .flatten({ background: black })
        .resize(size, size, { fit: "contain", background: black })
        .removeAlpha()
        .png()
        .toFile(outPath);
}

async function writeOgImage(outPath) {
    const width = 1200;
    const height = 630;
    const flattened = await sharp(source)
        .flatten({ background: black })
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
        .composite([{
            input: await sharp(flattened)
                .resize(480, 480, { fit: "contain", background: black })
                .removeAlpha()
                .png()
                .toBuffer(),
            gravity: "center",
        }])
        .removeAlpha()
        .png()
        .toFile(outPath);
}

await writeIcon(48, path.join(root, "app", "icon.png"));
await writeIcon(180, path.join(root, "app", "apple-icon.png"));
await writeIcon(48, path.join(root, "public", "brand-icon.png"));
await writeIcon(32, path.join(root, "public", "favicon.png"));
await writeIcon(180, path.join(root, "public", "apple-touch-icon.png"));
await writeIcon(512, path.join(root, "public", "site-brand-icon.png"));
await writeOgImage(path.join(root, "public", "og-default.png"));

console.log("Generated brand icons with solid black background");
