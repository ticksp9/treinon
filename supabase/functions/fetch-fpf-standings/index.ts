import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Standing {
  position: number;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

interface FPFResponse {
  success: boolean;
  standings?: Standing[];
  competitions?: { id: string; name: string }[];
  series?: string[];
  selectedSeries?: string;
  error?: string;
}

const normalize = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

const extractSeriesBlocks = (markdown: string) => {
  const lines = markdown
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const seriesStarts: { name: string; index: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const nl = normalize(l);

    // Examples seen on FPF pages: "SERIE 1", "SÉRIE 2", "Série 2"
    if (/^SERIE\s+\d+/.test(nl)) {
      seriesStarts.push({ name: l, index: i });
    }
  }

  if (seriesStarts.length === 0) {
    return [{ name: 'GERAL', lines }];
  }

  const blocks: { name: string; lines: string[] }[] = [];
  for (let s = 0; s < seriesStarts.length; s++) {
    const start = seriesStarts[s].index;
    const end = s + 1 < seriesStarts.length ? seriesStarts[s + 1].index : lines.length;
    blocks.push({
      name: seriesStarts[s].name,
      lines: lines.slice(start, end),
    });
  }

  return blocks;
};

const parseStandingsFromLines = (lines: string[]): Standing[] => {
  // We expect the page to contain a standings table with header "POS"
  const startIdx = lines.findIndex((l) => normalize(l) === 'POS');
  if (startIdx === -1) return [];

  const standings: Standing[] = [];

  let currentTeam: Partial<Standing> = {};
  let fieldIndex = 0;

  // Field order after teamName: JGS, V, E, D, GM, GS, PTS
  const headerTokens = new Set(['POS', 'EQUIPA', 'EQUIPAS', 'JGS', 'V', 'E', 'D', 'GM', 'GS', 'PTS']);

  for (let i = startIdx + 1; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    const nline = normalize(line);

    if (!line) continue;

    // Skip header tokens
    if (headerTokens.has(nline)) continue;

    // Stop if we hit another series block header (when parsing the whole page)
    if (/^SERIE\s+\d+/.test(nline) && standings.length > 0) break;

    const num = parseInt(line, 10);

    if (!Number.isNaN(num) && fieldIndex === 0 && num >= 1 && num <= 50) {
      // New position row
      if (currentTeam.teamName && currentTeam.points !== undefined) {
        standings.push(currentTeam as Standing);
      }
      currentTeam = { position: num };
      fieldIndex = 1;
      continue;
    }

    if (fieldIndex === 1 && Number.isNaN(num)) {
      currentTeam.teamName = line;
      fieldIndex = 2;
      continue;
    }

    if (fieldIndex >= 2 && !Number.isNaN(num)) {
      switch (fieldIndex) {
        case 2:
          currentTeam.played = num;
          break;
        case 3:
          currentTeam.won = num;
          break;
        case 4:
          currentTeam.drawn = num;
          break;
        case 5:
          currentTeam.lost = num;
          break;
        case 6:
          currentTeam.goalsFor = num;
          break;
        case 7:
          currentTeam.goalsAgainst = num;
          break;
        case 8:
          currentTeam.points = num;
          fieldIndex = -1; // will become 0 after increment
          break;
      }
      fieldIndex++;
    }
  }

  if (currentTeam.teamName && currentTeam.points !== undefined) {
    standings.push(currentTeam as Standing);
  }

  return standings;
};

async function scrapeMarkdown(url: string, apiKey: string, waitFor?: number) {
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
      onlyMainContent: true,
      waitFor,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    console.error('Firecrawl error:', data);
    throw new Error('Firecrawl scrape failed');
  }

  return (data.data?.markdown || data.markdown || '') as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Authentication check: require a valid Supabase JWT
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  try {
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (_e) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { action, competitionId, associationId, seasonId, series } = await req.json();

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(JSON.stringify({ success: false, error: 'Firecrawl not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'getCompetitions') {
      const url = `https://resultados.fpf.pt/Competition/GetCompetitionsByAssociation?associationId=${associationId || 219}&seasonId=${seasonId || 98}`;
      console.log('Fetching competitions from:', url);

      const markdown = await scrapeMarkdown(url, apiKey);

      const competitions: { id: string; name: string }[] = [];
      const linkRegex = /\[([^\]]+)\]\(https:\/\/resultados\.fpf\.pt\/Competition\/Details\?competitionId=(\d+)/g;
      let match;
      while ((match = linkRegex.exec(markdown)) !== null) {
        competitions.push({ name: match[1], id: match[2] });
      }

      return new Response(JSON.stringify({ success: true, competitions } satisfies FPFResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'getSeries') {
      if (!competitionId) {
        return new Response(JSON.stringify({ success: false, error: 'competitionId is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const url = `https://resultados.fpf.pt/Competition/Details?competitionId=${competitionId}&seasonId=${seasonId || 98}`;
      console.log('Fetching series from:', url);

      const markdown = await scrapeMarkdown(url, apiKey, 2000);
      const blocks = extractSeriesBlocks(markdown);
      const seriesList = blocks
        .map((b) => b.name)
        .filter((s) => normalize(s) !== 'GERAL');

      return new Response(
        JSON.stringify({ success: true, series: seriesList.length ? seriesList : undefined } satisfies FPFResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'getStandings') {
      if (!competitionId) {
        return new Response(JSON.stringify({ success: false, error: 'competitionId is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const url = `https://resultados.fpf.pt/Competition/Details?competitionId=${competitionId}&seasonId=${seasonId || 98}`;
      console.log('Fetching standings from:', url);
      console.log('Requested series:', series);

      const markdown = await scrapeMarkdown(url, apiKey, 2000);
      console.log('Received markdown length:', markdown.length);

      const blocks = extractSeriesBlocks(markdown);
      const availableSeries = blocks.map((b) => b.name).filter((s) => normalize(s) !== 'GERAL');

      const requested = typeof series === 'string' ? series.trim() : '';
      const selectedBlock = requested
        ? blocks.find((b) => {
            const nb = normalize(b.name);
            const nr = normalize(requested);
            return nb === nr || nb.includes(nr) || nr.includes(nb);
          })
        : blocks[0];

      const selectedSeries = selectedBlock?.name;
      const standings = selectedBlock ? parseStandingsFromLines(selectedBlock.lines) : [];

      console.log('Detected series:', availableSeries);
      console.log('Selected series:', selectedSeries);
      console.log('Parsed standings count:', standings.length);

      return new Response(
        JSON.stringify({
          success: true,
          standings,
          series: availableSeries.length ? availableSeries : undefined,
          selectedSeries,
        } satisfies FPFResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action. Use "getCompetitions", "getSeries" or "getStandings"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage } satisfies FPFResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

