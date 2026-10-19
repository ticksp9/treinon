/**
 * PDFs everywhere: on the web the file is downloaded (or opened to print); inside the
 * iPhone/iPad app (where downloads and printing from the page do not work) it is saved and
 * the share sheet opens — from there it goes to Files, WhatsApp, Mail or the printer.
 */
import type jsPDF from 'jspdf';

export const isNativeApp = (): boolean =>
  typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

/** Hand a PDF to the person: download on the web, share sheet in the app. */
export async function deliverPdf(doc: jsPDF, fileName: string, opts: { print?: boolean; title?: string } = {}): Promise<void> {
  if (isNativeApp()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const data = doc.output('datauristring').split(',')[1];
    const saved = await Filesystem.writeFile({ path: fileName, data, directory: Directory.Cache });
    await Share.share({ title: opts.title ?? fileName, files: [saved.uri] }).catch(() => { /* closed */ });
    return;
  }
  if (opts.print) {
    doc.autoPrint();
    const win = window.open(doc.output('bloburl') as unknown as string, '_blank');
    if (win) return;
  }
  doc.save(fileName);
}
