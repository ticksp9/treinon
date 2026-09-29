/**
 * Share text the way coaches actually communicate: WhatsApp groups.
 * Uses the native share sheet on phones (WhatsApp, Messenger, SMS…) and falls
 * back to WhatsApp Web on computers.
 */
export async function shareText(text: string, title = 'TreinON'): Promise<'shared' | 'whatsapp' | 'cancelled'> {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void>; canShare?: (d: ShareData) => boolean };
  const isTouch = window.matchMedia?.('(pointer: coarse)').matches;
  if (nav.share && isTouch) {
    try {
      await nav.share({ title, text });
      return 'shared';
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelled';
    }
  }
  window.open(whatsappUrl(text), '_blank', 'noopener');
  return 'whatsapp';
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
