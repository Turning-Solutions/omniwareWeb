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
        } else if (line.includes(":")) {
            const i = line.indexOf(":");
            name = line.slice(0, i);
            description = line.slice(i + 1);
        } else {
            name = line;
        }
        name = name.replace(/\*\*|__|`/g, "").trim();
        description = description.replace(/\*\*|__|`/g, "").trim();
        if (!name || /^specification$/i.test(name)) continue;
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
            { name: "Brand" },
            { name: "Series / Product Line" },
            { name: "Model / Part Number" },
            { name: "Memory Type", description: "DDR4 / DDR5" },
            { name: "Capacity", description: "8GB / 16GB / 32GB / 64GB etc." },
            { name: "Kit Configuration", description: "1×16GB / 2×16GB / 2×32GB etc." },
            { name: "Form Factor", description: "UDIMM" },
            { name: "Speed / Data Rate", description: "6000 MT/s" },
            { name: "Rated Specification", description: "DDR5-6000" },
            { name: "CAS Latency (CL)", description: "CL30 / CL36 etc." },
            { name: "Timings", description: "30-36-36-76" },
            { name: "Tested / Rated Voltage", description: "1.35V" },
            { name: "SPD Speed", description: "4800 MT/s" },
            { name: "SPD Voltage", description: "1.10V" },
            { name: "SPD Latency", description: "CL40" },
            { name: "Memory Profile", description: "AMD EXPO / Intel XMP / AMD EXPO + Intel XMP" },
            {
                name: "Platform Compatibility",
                description: "AMD 600 Series, AMD 800 Series, Intel 600 Series, Intel 700 Series, Intel 800 Series",
            },
            { name: "ECC", description: "Yes / No" },
            { name: "Buffered / Registered", description: "Unbuffered / Registered" },
            { name: "Rank", description: "1Rx8 / 2Rx8 / Not Specified" },
            { name: "Module Type", description: "Non-ECC Unbuffered DIMM" },
            { name: "Pin Count", description: "288-pin" },
            { name: "Heat Spreader", description: "Aluminum / None" },
            { name: "RGB", description: "Yes / No" },
            { name: "Memory Color", description: "Black / White / Grey etc." },
            { name: "PMIC", description: "Standard / Overclocking PMIC / Not Specified" },
            { name: "Dimensions", description: "L × W × H" },
        ],
    },
];
