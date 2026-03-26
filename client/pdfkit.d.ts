declare module 'pdfkit' {
    // We only need this for TypeScript compatibility in the build.
    // The app uses pdfkit at runtime; if you later want proper typings,
    // install `@types/pdfkit` or write richer declarations.
    const PDFDocument: any;
    export default PDFDocument;
}

