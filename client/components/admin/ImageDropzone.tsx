"use client";

import { useState } from "react";
import Image from "next/image";
import { Upload, Image as ImageIcon, X } from "lucide-react";

interface ImageDropzoneProps {
    label: string;
    value: string;
    onUploadFile: (file: File) => void | Promise<void>;
    onUrlChange: (url: string) => void;
    onClear: () => void;
    uploading?: boolean;
    previewAspect?: "cover" | "contain";
    height?: string;
    uploadHint?: string;
    urlPlaceholder?: string;
    disabled?: boolean;
}

export default function ImageDropzone({
    label,
    value,
    onUploadFile,
    onUrlChange,
    onClear,
    uploading = false,
    previewAspect = "cover",
    height = "h-28",
    uploadHint = "Click to upload image",
    urlPlaceholder = "Or paste image URL",
    disabled = false,
}: ImageDropzoneProps) {
    const [fileInputKey, setFileInputKey] = useState(0);

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await onUploadFile(file);
        setFileInputKey((k) => k + 1);
    };

    return (
        <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-sub">{label}</label>
            {value ? (
                <div className={`relative mb-2 w-full ${height} overflow-hidden rounded-xl border border-border-soft ${previewAspect === "contain" ? "bg-base" : ""}`}>
                    <Image
                        src={value}
                        alt="Preview"
                        fill
                        className={previewAspect === "contain" ? "object-contain p-3" : "object-cover"}
                        sizes="512px"
                    />
                    <button
                        type="button"
                        onClick={onClear}
                        className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            ) : (
                <label
                    className={`mb-2 flex ${height} w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border-soft bg-base transition-colors hover:border-accent ${
                        disabled ? "pointer-events-none opacity-60" : ""
                    }`}
                >
                    {uploading ? (
                        <span className="text-sm text-sub">Uploading…</span>
                    ) : (
                        <>
                            <Upload className="mb-1 h-6 w-6 text-sub" />
                            <span className="text-sm text-sub">{uploadHint}</span>
                        </>
                    )}
                    <input
                        key={fileInputKey}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleChange}
                        disabled={disabled}
                    />
                </label>
            )}
            <div className="mt-1 flex items-center gap-2">
                <ImageIcon className="h-4 w-4 shrink-0 text-sub" />
                <input
                    type="text"
                    placeholder={urlPlaceholder}
                    value={value}
                    onChange={(e) => onUrlChange(e.target.value)}
                    className="flex-1 rounded-lg border border-border-soft bg-base px-3 py-1.5 text-sm text-main placeholder:text-sub focus:outline-none focus:border-accent"
                />
            </div>
        </div>
    );
}
