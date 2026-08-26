import type { ReactNode } from "react";

const MARKDOWN_LINK_RE = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;
const BARE_URL_RE = /(https?:\/\/[^\s<>()]+)/g;

/**
 * Renders plain text that may contain `[label](url)` markdown-style links and/or
 * bare URLs, turning both into clickable <a> tags while leaving the rest as text.
 * Lets admins hyperlink a word or phrase without exposing the raw URL.
 */
export function renderRichText(text: string | undefined | null, linkClassName = "text-[#D12B28] hover:underline"): ReactNode {
    if (!text) return text ?? null;

    const nodes: ReactNode[] = [];
    let key = 0;

    const pushPlainWithBareLinks = (segment: string) => {
        if (!segment) return;
        let last = 0;
        let m: RegExpExecArray | null;
        BARE_URL_RE.lastIndex = 0;
        while ((m = BARE_URL_RE.exec(segment))) {
            if (m.index > last) nodes.push(segment.slice(last, m.index));
            nodes.push(
                <a key={`u${key++}`} href={m[0]} target="_blank" rel="noopener noreferrer" className={linkClassName}>
                    {m[0]}
                </a>
            );
            last = m.index + m[0].length;
        }
        nodes.push(segment.slice(last));
    };

    let lastIndex = 0;
    let match: RegExpExecArray | null;
    MARKDOWN_LINK_RE.lastIndex = 0;
    while ((match = MARKDOWN_LINK_RE.exec(text))) {
        pushPlainWithBareLinks(text.slice(lastIndex, match.index));
        nodes.push(
            <a key={`l${key++}`} href={match[2]} target="_blank" rel="noopener noreferrer" className={linkClassName}>
                {match[1]}
            </a>
        );
        lastIndex = match.index + match[0].length;
    }
    pushPlainWithBareLinks(text.slice(lastIndex));

    return nodes;
}
