import { afterEach, describe, expect, it, vi } from 'vitest';
import { deliverPdf, isNativeApp } from '@/lib/native-files';

const fakeDoc = () => ({
  save: vi.fn(),
  autoPrint: vi.fn(),
  output: vi.fn(() => 'blob:x'),
});

afterEach(() => {
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  vi.restoreAllMocks();
});

describe('native-files', () => {
  it('is not the native app in the browser', () => {
    expect(isNativeApp()).toBe(false);
    (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => true };
    expect(isNativeApp()).toBe(true);
  });

  it('downloads the PDF on the web', async () => {
    const doc = fakeDoc();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deliverPdf(doc as any, 'a.pdf');
    expect(doc.save).toHaveBeenCalledWith('a.pdf');
  });

  it('opens it to print, and downloads if the pop-up is blocked', async () => {
    const doc = fakeDoc();
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deliverPdf(doc as any, 'a.pdf', { print: true });
    expect(doc.autoPrint).toHaveBeenCalled();
    expect(doc.save).not.toHaveBeenCalled();
    open.mockReturnValue(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deliverPdf(doc as any, 'a.pdf', { print: true });
    expect(doc.save).toHaveBeenCalledWith('a.pdf');
  });
});
