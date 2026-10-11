/** Standard attribute list for a category: the names products should use, with example values. */
export type TemplateAttribute = { name: string; description?: string };

/**
 * Parse a pasted list into template attributes. Accepts a Markdown table
 * (`| **Name** | examples |`), "Name | examples" lines, "Name: examples" lines, or bare names.
 */
export function parseTemplateText(text: string): TemplateAttribute[] {
    const out: TemplateAttribute[] = [];
    const seen = new Set<string>();
    for (const rawLine of text.split(/\r?\n/)) {
        let line = rawLine.trim();
        if (!line) continue;
        // Markdown table separators and header row.
        if (/^\|?\s*:?-{2,}/.test(line)) continue;
        let name: string;
        let description = "";
        if (line.includes("|")) {
            line = line.replace(/^\|/, "").replace(/\|$/, "");
            const cells = line.split("|").map((c) => c.trim());
            name = cells[0] ?? "";
            description = cells.slice(1).filter(Boolean).join(" | ");
        } else if (/^\*[^*]+\*\s+\S/.test(line)) {
            // "*Capacity*   16GB" — name in asterisks followed by an example value
            const m = /^\*([^*]+)\*\s+(.*)$/.exec(line)!;
            name = m[1];
            description = m[2];
        } else if (line.includes(":")) {
            const i = line.indexOf(":");
            name = line.slice(0, i);
            description = line.slice(i + 1);
        } else {
            name = line;
        }
        name = name.replace(/\*\*|\*|__|`/g, "").trim();
        description = description.replace(/\*\*|\*|__|`/g, "").trim();
        if (!name || /^specification$/i.test(name) || /^-+$/.test(name)) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(description ? { name, description } : { name });
    }
    return out;
}

/** Serialise template attributes back to the editable "Name | examples" text form. */
export const templateToText = (attrs: TemplateAttribute[]) =>
    attrs.map((a) => (a.description ? `${a.name} | ${a.description}` : a.name)).join("\n");

/** Ready-made standard lists the admin can load as a starting point. */
export const TEMPLATE_PRESETS: { id: string; label: string; attributes: TemplateAttribute[] }[] = [
    {
        id: "ram",
        label: "RAM (desktop memory)",
        attributes: [
            { name: "Capacity", description: "16GB" },
            { name: "Module Configuration", description: "1 × 16GB" },
            { name: "Memory Type", description: "DDR5" },
            { name: "Memory Speed", description: "6000 MT/s" },
            { name: "CAS Latency", description: "CL38" },
            { name: "Timings", description: "38-38-38-78" },
            { name: "Voltage", description: "1.35V" },
            { name: "Performance Profile", description: "Intel XMP 3.0 / AMD EXPO" },
            { name: "Memory Compatibility", description: "Intel / AMD" },
            { name: "Memory Channel", description: "Single" },
            { name: "ECC", description: "Non-ECC" },
            { name: "Registered / Unbuffered", description: "Unbuffered" },
            { name: "Form Factor", description: "UDIMM" },
            { name: "Pin Count", description: "288-Pin" },
            { name: "RGB", description: "Yes" },
            { name: "Color", description: "Black" },
        ],
    },
];
