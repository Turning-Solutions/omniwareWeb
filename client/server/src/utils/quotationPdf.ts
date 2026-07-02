import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont, type PDFImage } from 'pdf-lib';

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

function resolveHeaderImagePath(): string | null {
    const fromEnv = process.env.QUOTATION_PDF_HEADER_IMAGE_PATH?.trim();
    if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
    const pub = path.join(process.cwd(), 'public', 'QUOTATION header .png');
    if (fs.existsSync(pub)) return pub;
    return null;
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

function buildQuotationNumber(id: string, date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const shortId = String(id).slice(-6).toUpperCase();
    return `QTN-${y}${m}${d}-${shortId}`;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 50;
const RIGHT_EDGE = PAGE_WIDTH - MARGIN_X;
const ROW_LINE_HEIGHT = 15;
const FOOTER_RESERVED = 50; // room for the "Page x of y" footer on every page
const TOTALS_BLOCK_HEIGHT = 132; // total line + disclaimer paragraph, reserved on the last page

const SIZES = {
    metaLabel: 9,
    metaValue: 13,
    th: 10.5,
    td: 10,
    tdBold: 10,
    total: 15,
    disc: 9,
    pageNum: 8.5,
};

const INK = rgb(0.06, 0.06, 0.06);
const META_COLOR = rgb(0.4, 0.4, 0.4);
const LINE_COLOR = rgb(0.72, 0.72, 0.72);
const MUTED = rgb(0.4, 0.4, 0.4);
const HEADER_FILL = rgb(0.94, 0.94, 0.94);

const COL = {
    numLeft: MARGIN_X,
    descLeft: MARGIN_X + 26,
    qtyRight: RIGHT_EDGE - 232,
    unitRight: RIGHT_EDGE - 118,
    lineRight: RIGHT_EDGE,
};

type Row = {
    serial: number;
    titleLines: string[];
    blockH: number;
    qty: number;
    unitPrice: number;
    lineTotal: number;
};

function buildRows(items: QuotationPdfItem[]): Row[] {
    return items.map((item, index) => {
        const titleLines = wrapTitle(item.title, 34, 6);
        const blockH = Math.max(titleLines.length * ROW_LINE_HEIGHT, ROW_LINE_HEIGHT);
        return {
            serial: index + 1,
            titleLines,
            blockH,
            qty: item.qty,
            unitPrice: item.unitPrice,
            lineTotal: item.unitPrice * item.qty,
        };
    });
}

/** Draws the header artwork, quotation meta bar, and table column header on a page. Returns the y cursor for the first row. */
function drawPageHeader(
    page: PDFPage,
    headerImg: PDFImage | null,
    font: PDFFont,
    fontBold: PDFFont,
    quotationNumber: string,
    dateShort: string,
): number {
    let headerBottomY = PAGE_HEIGHT;

    if (headerImg) {
        const imgH = PAGE_WIDTH * (headerImg.height / headerImg.width);
        page.drawImage(headerImg, {
            x: 0,
            y: PAGE_HEIGHT - imgH,
            width: PAGE_WIDTH,
            height: imgH,
        });
        headerBottomY = PAGE_HEIGHT - imgH;
    } else {
        page.drawText('QUOTATION', { x: MARGIN_X, y: PAGE_HEIGHT - 60, size: 26, font: fontBold, color: INK });
        headerBottomY = PAGE_HEIGHT - 90;
    }

    const metaLabelY = headerBottomY - 26;
    const metaValueY = metaLabelY - 17;

    page.drawText('QUOTATION NO.', { x: MARGIN_X, y: metaLabelY, size: SIZES.metaLabel, font, color: META_COLOR });
    page.drawText(sanitizePdfText(quotationNumber), {
        x: MARGIN_X,
        y: metaValueY,
        size: SIZES.metaValue,
        font: fontBold,
        color: INK,
    });

    drawTextRight(page, 'DATE', RIGHT_EDGE, metaLabelY, SIZES.metaLabel, font, META_COLOR);
    drawTextRight(page, dateShort, RIGHT_EDGE, metaValueY, SIZES.metaValue, fontBold, INK);

    const ruleY = metaValueY - 14;
    page.drawLine({
        start: { x: MARGIN_X, y: ruleY },
        end: { x: RIGHT_EDGE, y: ruleY },
        thickness: 1,
        color: rgb(0.15, 0.15, 0.15),
    });

    const headerRowTop = ruleY - 22;
    page.drawRectangle({
        x: MARGIN_X - 6,
        y: headerRowTop - 6,
        width: RIGHT_EDGE - MARGIN_X + 12,
        height: 22,
        color: HEADER_FILL,
    });
    page.drawText('#', { x: COL.numLeft, y: headerRowTop, size: SIZES.th, font: fontBold, color: INK });
    page.drawText('Item / description', { x: COL.descLeft, y: headerRowTop, size: SIZES.th, font: fontBold, color: INK });
    drawTextRight(page, 'Qty', COL.qtyRight, headerRowTop, SIZES.th, fontBold, INK);
    drawTextRight(page, 'Unit price', COL.unitRight, headerRowTop, SIZES.th, fontBold, INK);
    drawTextRight(page, 'Line total', COL.lineRight, headerRowTop, SIZES.th, fontBold, INK);

    return headerRowTop - 20;
}

function drawFooter(page: PDFPage, font: PDFFont, pageIndex: number, pageCount: number) {
    const label = `Page ${pageIndex} of ${pageCount}`;
    const w = textWidth(font, label, SIZES.pageNum);
    page.drawText(label, {
        x: (PAGE_WIDTH - w) / 2,
        y: 24,
        size: SIZES.pageNum,
        font,
        color: MUTED,
    });
}

/**
 * Builds a multi-page quotation PDF. Page 1 (and every subsequent page) starts with the
 * "QUOTATION header .png" artwork, a quotation-number/date meta bar, and a table header row;
 * line items flow across as many pages as needed and the grand total + disclaimer are pinned
 * to the bottom of the last page (spilling to a fresh page if there isn't room).
 */
export async function buildQuotationPdfBuffer(input: {
    items: QuotationPdfItem[];
    subtotal: number;
    quotationId: string;
    quotationDate: Date;
}): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let headerImg: PDFImage | null = null;
    const headerImagePath = resolveHeaderImagePath();
    if (headerImagePath) {
        try {
            const bytes = fs.readFileSync(headerImagePath);
            headerImg = await pdfDoc.embedPng(bytes);
        } catch {
            headerImg = null;
        }
    }

    const quotationNumber = buildQuotationNumber(input.quotationId, input.quotationDate);
    const dateShort = input.quotationDate.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });

    const rows = buildRows(input.items);

    // —— Pass 1: paginate rows (no drawing) so we know the final page count up front for "Page x of y" footers.
    type PageLayout = { rows: Row[]; hasTotals: boolean };
    const pageLayouts: PageLayout[] = [];
    {
        let idx = 0;
        let current: Row[] = [];
        // y cursor mirrors drawPageHeader's returned first-row y for a page WITH the header drawn.
        const firstRowY = simulateHeaderBottom();
        let y = firstRowY;

        const flush = (hasTotals: boolean) => {
            pageLayouts.push({ rows: current, hasTotals });
            current = [];
            y = firstRowY;
        };

        while (idx < rows.length) {
            const row = rows[idx];
            const isLastRow = idx === rows.length - 1;
            const bottomReserve = isLastRow ? TOTALS_BLOCK_HEIGHT : FOOTER_RESERVED;
            if (y - row.blockH < bottomReserve) {
                flush(false);
                continue;
            }
            current.push(row);
            y -= row.blockH + 10;
            idx += 1;
        }
        // Trailing rows (or, for a zero-item quotation, an empty page) still need the totals block.
        flush(true);
    }

    const pageCount = pageLayouts.length;

    // —— Pass 2: actually draw.
    for (let p = 0; p < pageLayouts.length; p++) {
        const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        let y = drawPageHeader(page, headerImg, font, fontBold, quotationNumber, dateShort);

        for (const row of pageLayouts[p].rows) {
            let ty = y;
            for (const line of row.titleLines) {
                page.drawText(line, { x: COL.descLeft, y: ty, size: SIZES.td, font, color: INK });
                ty -= ROW_LINE_HEIGHT;
            }
            const midY = y - ((row.titleLines.length - 1) * ROW_LINE_HEIGHT) / 2;
            page.drawText(String(row.serial), { x: COL.numLeft, y: midY, size: SIZES.td, font, color: MUTED });
            drawTextRight(page, String(row.qty), COL.qtyRight, midY, SIZES.td, font, INK);
            drawTextRight(page, formatLkr(row.unitPrice), COL.unitRight, midY, SIZES.td, font, INK);
            drawTextRight(page, formatLkr(row.lineTotal), COL.lineRight, midY, SIZES.tdBold, fontBold, INK);

            y -= row.blockH + 10;
        }

        page.drawLine({
            start: { x: MARGIN_X, y: y - 2 },
            end: { x: RIGHT_EDGE, y: y - 2 },
            thickness: 0.6,
            color: LINE_COLOR,
        });
        y -= 26;

        if (pageLayouts[p].hasTotals) {
            const totalLabel = `Quoted total: ${formatLkr(input.subtotal)}`;
            drawTextRight(page, totalLabel, COL.lineRight, y, SIZES.total, fontBold, INK);
            y -= 30;

            const discW = RIGHT_EDGE - MARGIN_X;
            page.drawText(
                'Important: The final invoice total may differ from this quoted amount (taxes, shipping, promotions, or price changes may apply).',
                { x: MARGIN_X, y, size: SIZES.disc, font, color: MUTED, maxWidth: discW, lineHeight: 12 },
            );
            y -= 26;
            page.drawText(`This quotation is valid only for ${dateShort} (the date this quotation was issued).`, {
                x: MARGIN_X,
                y,
                size: SIZES.disc,
                font: fontBold,
                color: INK,
                maxWidth: discW,
                lineHeight: 12,
            });
        } else {
            const note = `...continued on next page. Quoted total includes every item in this quotation.`;
            page.drawText(sanitizePdfText(note), {
                x: MARGIN_X,
                y,
                size: SIZES.disc,
                font,
                color: MUTED,
                maxWidth: RIGHT_EDGE - MARGIN_X,
            });
        }

        drawFooter(page, font, p + 1, pageCount);
    }

    const bytesOut = await pdfDoc.save();
    return Buffer.from(bytesOut);

    /** Mirrors drawPageHeader's geometry (without needing a live page/image) to get the first-row y for pagination math. */
    function simulateHeaderBottom(): number {
        const imgH = headerImg ? PAGE_WIDTH * (headerImg.height / headerImg.width) : 90;
        const headerBottomY = headerImg ? PAGE_HEIGHT - imgH : PAGE_HEIGHT - 90;
        const metaLabelY = headerBottomY - 26;
        const metaValueY = metaLabelY - 17;
        const ruleY = metaValueY - 14;
        const headerRowTop = ruleY - 22;
        return headerRowTop - 20;
    }
}
