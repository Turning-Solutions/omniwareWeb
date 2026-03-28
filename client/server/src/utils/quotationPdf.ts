import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';

export type QuotationPdfItem = {
    title: string;
    qty: number;
    unitPrice: number;
};

function formatLkr(n: number): string {
    if (!Number.isFinite(n)) return 'LKR 0';
    // ASCII digits/commas only — some locales inject unicode spaces into toLocaleString and break WinAnsi fonts
    return `LKR ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

/** Standard 14 Helvetica fonts only support WinAnsi; strip/replace unsupported glyphs. */
function sanitizePdfText(text: string): string {
    const chars: string[] = [];
    for (const c of text) {
        const code = c.charCodeAt(0);
        if (code === 9 || code === 10 || code === 13) {
            chars.push(' ');
            continue;
        }
        if (code >= 32 && code <= 255) {
            chars.push(c);
            continue;
        }
        chars.push('?');
    }
    return chars.join('').replace(/\s+/g, ' ').trim();
}

function wrapTitle(title: string, maxLen: number, maxLines: number): string[] {
    const words = sanitizePdfText(title).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
        const next = cur ? `${cur} ${w}` : w;
        if (next.length <= maxLen) {
            cur = next;
        } else {
            if (cur) lines.push(cur);
            cur = w.length > maxLen ? `${w.slice(0, maxLen - 3)}...` : w;
            if (lines.length >= maxLines) break;
        }
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    if (lines.length > maxLines) return lines.slice(0, maxLines);
    return lines;
}

function resolveTemplatePath(): string | null {
    const fromEnv = process.env.QUOTATION_PDF_TEMPLATE_PATH?.trim();
    if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
    const pub = path.join(process.cwd(), 'public', 'QUOTATION-OMNI.pdf');
    if (fs.existsSync(pub)) return pub;
    return null;
}

function yFromTop(pageHeight: number, fromTopPt: number): number {
    return pageHeight - fromTopPt;
}

function textWidth(font: PDFFont, text: string, size: number): number {
    return font.widthOfTextAtSize(text, size);
}

function drawTextRight(
    page: PDFPage,
    text: string,
    rightX: number,
    y: number,
    size: number,
    font: PDFFont,
    color: ReturnType<typeof rgb>
) {
    const safe = sanitizePdfText(text);
    const w = textWidth(font, safe, size);
    page.drawText(safe, { x: rightX - w, y, size, font, color });
}

/**
 * Builds a quotation PDF on QUOTATION-OMNI.pdf (if present) or a blank A4 page.
 * Draw order: background panel & rules first, then all text on top (appears above template artwork).
 */
export async function buildQuotationPdfBuffer(input: {
    items: QuotationPdfItem[];
    subtotal: number;
    quotationId: string;
    quotationDate: Date;
}): Promise<Buffer> {
    const templatePath = resolveTemplatePath();
    let pdfDoc: PDFDocument;

    if (templatePath) {
        try {
            const bytes = fs.readFileSync(templatePath);
            pdfDoc = await PDFDocument.load(bytes);
        } catch {
            pdfDoc = await PDFDocument.create();
            pdfDoc.addPage([595.28, 841.89]);
        }
    } else {
        pdfDoc = await PDFDocument.create();
        pdfDoc.addPage([595.28, 841.89]);
    }

    const pages = pdfDoc.getPages();
    if (pages.length === 0) {
        pdfDoc.addPage([595.28, 841.89]);
    }
    const page: PDFPage = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    /** Push table + body content down into the template’s main box (tune via env if needed). */
    const tableTopFromTop = Number.parseInt(process.env.QUOTATION_PDF_TABLE_TOP_OFFSET ?? '330', 10) || 330;
    const dateFromTop = Number.parseInt(process.env.QUOTATION_PDF_DATE_TOP_OFFSET ?? '138', 10) || 138;
    const marginX = Number.parseInt(process.env.QUOTATION_PDF_MARGIN_X ?? '52', 10) || 52;

    const quoteDateLong = input.quotationDate.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const quoteDateShort = input.quotationDate.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });

    const idShort = String(input.quotationId).slice(-8).toUpperCase();
    const ink = rgb(0.06, 0.06, 0.06);
    const metaColor = rgb(0.32, 0.32, 0.32);
    const lineColor = rgb(0.72, 0.72, 0.72);
    const muted = rgb(0.38, 0.38, 0.38);

    const reservedBottom = Math.min(Math.max(height * 0.11, 64), height * 0.26);
    /** Y anchor (pt from bottom) for disclaimer text; do not redeclare elsewhere */
    const footBase = 56;
    const rightEdge = width - marginX;

    /** Vertical step between manually wrapped title lines (no maxWidth on drawText — avoids double-wrap overlap). */
    const rowLineHeight = 15;
    const sizes = {
        metaLabel: 10,
        metaDate: 14,
        metaRef: 11,
        th: 11,
        td: 10,
        tdBold: 10,
        total: 15,
        disc: 10,
    };

    let y = yFromTop(height, tableTopFromTop);
    const tableHeaderY = y;

    /** Full-width content panel — uses `footBase` above; opaque so overlay text wins vs template. */
    const panelBottom = footBase - 4;
    const panelTop = tableHeaderY + 22;
    const panelHeight = Math.max(0, panelTop - panelBottom);
    if (panelHeight > 8) {
        page.drawRectangle({
            x: marginX - 6,
            y: panelBottom,
            width: width - (marginX - 6) * 2,
            height: panelHeight,
            color: rgb(1, 1, 1),
            opacity: 1,
            borderColor: rgb(0.78, 0.78, 0.78),
            borderWidth: 0.85,
        });
    }

    /** Column layout — numeric columns right-aligned for clean edges */
    const col = {
        descLeft: marginX,
        descMax: rightEdge - marginX - 278,
        qtyRight: rightEdge - 228,
        unitRight: rightEdge - 118,
        lineRight: rightEdge,
    };

    // —— Horizontal rules (under panel, before text — text drawn after will still paint on top in stream order;
    //    redraw rules after text would cover them — so draw lines AFTER all text for table separators only)
    //    Here we draw thin rules first, then text on top so lines sit slightly under text baselines — OK.
    const lineY1 = tableHeaderY - 8;
    page.drawLine({
        start: { x: marginX, y: lineY1 },
        end: { x: rightEdge, y: lineY1 },
        thickness: 0.85,
        color: lineColor,
    });

    y -= 16;

    let shown = 0;
    for (const item of input.items) {
        const lineTotal = item.unitPrice * item.qty;
        const titleLines = wrapTitle(item.title, 36, 6);
        const blockH = Math.max(titleLines.length * rowLineHeight, rowLineHeight);

        if (y - blockH < reservedBottom) {
            const omitted = input.items.length - shown;
            const note =
                shown === 0
                    ? 'Line items could not be fully listed in the space above; the quoted total below includes every item in this quotation.'
                    : `...and ${omitted} more line item(s). Quoted total includes all items.`;
            page.drawText(note, {
                x: col.descLeft,
                y: y - 4,
                size: 9,
                font: fontBold,
                color: ink,
                maxWidth: rightEdge - marginX,
                lineHeight: 12,
            });
            break;
        }

        let ty = y;
        for (const line of titleLines) {
            // One baseline per string — do not pass maxWidth here; wrapTitle already splits lines.
            // pdf-lib would re-wrap each chunk and draw extra lines while we only stepped `ty` once → overlap.
            page.drawText(line, {
                x: col.descLeft,
                y: ty,
                size: sizes.td,
                font,
                color: ink,
            });
            ty -= rowLineHeight;
        }

        // Align Qty / prices to the vertical center of the description block (midpoint between first & last baselines).
        // Using blockH/2 was wrong for n>1 (counted an extra half-row), which made single- vs multi-line rows look inconsistent.
        const midY = y - ((titleLines.length - 1) * rowLineHeight) / 2;
        drawTextRight(page, String(item.qty), col.qtyRight, midY, sizes.td, font, ink);
        drawTextRight(page, formatLkr(item.unitPrice), col.unitRight, midY, sizes.td, font, ink);
        drawTextRight(page, formatLkr(lineTotal), col.lineRight, midY, sizes.tdBold, fontBold, ink);

        y -= blockH + 10;
        shown += 1;
    }

    const lineY2 = y - 2;
    page.drawLine({
        start: { x: marginX, y: lineY2 },
        end: { x: rightEdge, y: lineY2 },
        thickness: 0.55,
        color: lineColor,
    });
    y -= 24;

    const totalLabel = `Quoted total: ${formatLkr(input.subtotal)}`;
    drawTextRight(page, totalLabel, col.lineRight, y, sizes.total, fontBold, ink);

    const discW = rightEdge - marginX;
    const discTopY = footBase + 44;
    page.drawText(
        'Important: The final invoice total may differ from this quoted amount (taxes, shipping, promotions, or price changes may apply).',
        {
            x: marginX,
            y: discTopY,
            size: sizes.disc,
            font,
            color: muted,
            maxWidth: discW,
            lineHeight: 12,
        },
    );
    page.drawText(`This quotation is valid only for ${quoteDateShort} (the date this quotation was issued).`, {
        x: marginX,
        y: footBase + 14,
        size: sizes.disc,
        font: fontBold,
        color: ink,
        maxWidth: discW,
        lineHeight: 12,
    });

    // —— Text on top: meta + table header + column headers (drawn last so they sit above template & panel edges)
    const metaLabel = 'Quotation date';
    drawTextRight(page, metaLabel, rightEdge, yFromTop(height, dateFromTop), sizes.metaLabel, font, metaColor);

    const dateStr = sanitizePdfText(quoteDateLong);
    const dateY = yFromTop(height, dateFromTop) - 16;
    drawTextRight(page, dateStr, rightEdge, dateY, sizes.metaDate, fontBold, ink);

    const refStr = `Reference: ${idShort}`;
    const refY = dateY - 20;
    drawTextRight(page, refStr, rightEdge, refY, sizes.metaRef, font, metaColor);

    page.drawText('Item / description', {
        x: col.descLeft,
        y: tableHeaderY,
        size: sizes.th,
        font: fontBold,
        color: ink,
    });
    drawTextRight(page, 'Qty', col.qtyRight, tableHeaderY, sizes.th, fontBold, ink);
    drawTextRight(page, 'Unit price', col.unitRight, tableHeaderY, sizes.th, fontBold, ink);
    drawTextRight(page, 'Line total', col.lineRight, tableHeaderY, sizes.th, fontBold, ink);

    const bytesOut = await pdfDoc.save();
    return Buffer.from(bytesOut);
}
