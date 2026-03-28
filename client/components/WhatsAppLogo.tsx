import Image from "next/image";

export const WHATSAPP_LOGO_PATH = "/logos/whatsapp_logo.png";

type WhatsAppLogoProps = {
    /** Width and height in pixels */
    size?: number;
    className?: string;
};

/** Brand mark for WhatsApp links and buttons (uses `public/logos/whatsapp_logo.png`). */
export default function WhatsAppLogo({ size = 20, className = "" }: WhatsAppLogoProps) {
    return (
        <Image
            src={WHATSAPP_LOGO_PATH}
            alt=""
            width={size}
            height={size}
            className={`shrink-0 object-contain ${className}`}
            aria-hidden
        />
    );
}
