import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

import { announcementText, callupSummary, callupText, noticeSummary, whatsappUrl } from '@/lib/notice';

describe('notices leaving the app', () => {
  it('tells the coach plainly what happened with the email', () => {
    expect(noticeSummary({ configured: true, total: 12, sent: 12, failed: 0 })).toEqual({ level: 'success', text: 'Email enviado a 12 pessoas.' });
    expect(noticeSummary({ configured: true, total: 1, sent: 1, failed: 0 }).text).toBe('Email enviado a 1 pessoa.');
    expect(noticeSummary({ configured: true, total: 5, sent: 3, failed: 2 }).text).toContain('2 falharam');
    expect(noticeSummary({ configured: true, total: 0, sent: 0 }).text).toContain('WhatsApp');
    expect(noticeSummary({ configured: false, total: 4 }).level).toBe('info');
    expect(noticeSummary({ error: 'boom' }).level).toBe('error');
  });

  it('says who received the call-up, and stays quiet when nothing was to be sent', () => {
    expect(callupSummary({ configured: true, sent: 13, groups: { coordenador: 1, pais: 12 } })).toEqual({ level: 'success', text: 'Convocatória enviada por email — coordenador: 1 · pais: 12' });
    expect(callupSummary({ configured: true, sent: 1, groups: { coordenador: 1, jogadores: 0 } })!.text).toContain('jogadores: sem email');
    expect(callupSummary({ configured: true, sent: 0, groups: {} })).toBeNull();
    expect(callupSummary({ error: 'boom' })!.level).toBe('error');
  });

  it('writes the call-up ready to paste in the parents group', () => {
    const t = callupText({ team: 'Sub-13', opponent: 'Rival FC', date: '2026-10-10T10:30:00', location: 'Campo n.º 2', players: ['7 · Rui', '9 · Ana'], message: 'Concentração 45 min antes.' });
    expect(t).toContain('*Convocatória Sub-13 vs Rival FC*');
    expect(t).toContain('10 de outubro às 10:30');
    expect(t).toContain('Campo n.º 2');
    expect(t).toContain('Concentração 45 min antes.');
    expect(t).toContain('Convocados (2):');
    expect(t).toContain('• 9 · Ana');
  });

  it('WhatsApp link carries the whole text, accents and line breaks included', () => {
    const text = announcementText({ title: 'Treino cancelado', content: 'Amanhã não há treino.\nAté sábado!', priority: 'important' });
    const url = whatsappUrl(text);
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(url.split('text=')[1])).toBe(text);
    expect(text.startsWith('❗ *Treino cancelado*')).toBe(true);
  });
});
