/**
 * CinemaCity Scraper — TypeScript rewrite with proxy support
 */
import * as cheerio from 'cheerio';
import { request } from 'undici';
import { makeProxyToken } from './proxy';

const MAIN_URL = 'https://cinemacity.cc';
const CINEMACITY_HEADERS: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
    'Cookie': 'dle_user_id=32729; dle_password=894171c6a8dab18ee594d5c652009a35;',
    'Referer': MAIN_URL + '/'
};

const TMDB_API_KEY = '1865f43a0549ca50d341dd9ab8b29f49';

function atobPolyfill(str: string): string {
    try {
        return Buffer.from(str, 'base64').toString('utf8');
    } catch {
        return '';
    }
}

async function fetchText(url: string): Promise<string> {
    const { body } = await request(url, { headers: CINEMACITY_HEADERS });
    return await body.text();
}

async function searchCinemaCity(query: string): Promise<string | null> {
    const searchUrl = `${MAIN_URL}/index.php?do=search&subaction=search&story=${encodeURIComponent(query)}`;
    console.log(`[CinemaCity] Searching: ${query}`);
    const searchHtml = await fetchText(searchUrl);
    const $ = cheerio.load(searchHtml);

    let mediaUrl: string | null = null;

    $('div.dar-short_item').each((_i: number, el: any) => {
        if (mediaUrl) return;
        const anchor = $(el).find("a[href*='.html']").first();
        if (!anchor.length) return;
        const href = anchor.attr('href');
        if (href) {
            mediaUrl = href;
            console.log('[CinemaCity] Found:', href);
        }
    });

    return mediaUrl;
}

export async function getCinemaCityStreams(
    tmdbId: string,
    mediaType: string,
    season?: string,
    episode?: string,
    preferredLang?: string
): Promise<{ name: string; title: string; url: string }[]> {
    try {
        const lang = preferredLang || 'en';
        console.log(`[CinemaCity] id=${tmdbId}, type=${mediaType}, S=${season}, E=${episode}, lang=${lang}`);

        // 1. Fetch TMDB info — get IMDB ID + title
        const tmdbType = mediaType === 'series' ? 'tv' : 'movie';
        const tmdbUrl = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
        const { body: tmdbBody } = await request(tmdbUrl);
        const tmdbData: any = await tmdbBody.json();

        const imdbId: string | null = tmdbData?.imdb_id || tmdbData?.external_ids?.imdb_id || null;
        let animeTitle: string | null = null;

        // Try title in preferred language
        if (lang !== 'en') {
            const tmdbLangUrl = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=${lang}`;
            try {
                const { body } = await request(tmdbLangUrl);
                const data: any = await body.json();
                animeTitle = data?.title || data?.name || null;
            } catch { /* fallback below */ }
        }
        if (!animeTitle) {
            animeTitle = tmdbData?.title || tmdbData?.name || null;
        }

        console.log(`[CinemaCity] IMDB: ${imdbId}, Title: ${animeTitle}`);

        if (!imdbId && !animeTitle) return [];

        // 2. Search on CinemaCity — try IMDB ID first, then fallback to title
        let mediaUrl: string | null = null;

        if (imdbId) {
            mediaUrl = await searchCinemaCity(imdbId);
        }
        if (!mediaUrl && animeTitle) {
            mediaUrl = await searchCinemaCity(animeTitle);
        }

        if (!mediaUrl) {
            console.log('[CinemaCity] No results found');
            return [];
        }

        // 3. Fetch page and extract file data from atob-encoded scripts
        const pageHtml = await fetchText(mediaUrl);
        const $page = cheerio.load(pageHtml);

        let fileData: any = null;

        $page('script').each((_i: number, el: any) => {
            if (fileData) return;
            const html = $page(el).html();
            if (!html || !html.includes('atob')) return;

            const regex = /atob\s*\(\s*(['"])(.*?)\1\s*\)/g;
            let match;
            while ((match = regex.exec(html)) !== null) {
                const decoded = atobPolyfill(match[2]);
                const fileMatch =
                    decoded.match(/file\s*:\s*(['"])(.*?)\1/s) ||
                    decoded.match(/file\s*:\s*(\[.*?\])/s) ||
                    decoded.match(/sources\s*:\s*(\[.*?\])/s);

                if (fileMatch) {
                    let rawFile = fileMatch[2] || fileMatch[1];
                    try {
                        if (rawFile.startsWith('[') || rawFile.startsWith('{')) {
                            rawFile = rawFile.replace(/\\(.)/g, '$1');
                            fileData = JSON.parse(rawFile);
                        } else {
                            fileData = rawFile;
                        }
                    } catch {
                        fileData = rawFile;
                    }
                    console.log('[CinemaCity] File data found');
                }
            }
        });

        if (!fileData) return [];

        // 4. Build streams
        const streams: { name: string; title: string; url: string }[] = [];

        const addStream = (rawUrl: string, title: string) => {
            if (!rawUrl) return;
            let url = rawUrl;

            if (url.includes(',')) {
                const parts = url.split(',');
                const base = parts[0];
                const master = parts.find(p => p.includes('.m3u8'));
                const mp4 = parts.find(p => p.includes('.mp4'));
                if (master) url = base + master;
                else if (mp4) url = base + mp4;
            }

            if (url.startsWith('//')) url = 'https:' + url;

            // Wrap through addon proxy so requesting IP = playback IP
            if (url.includes('.m3u8')) {
                const proxyToken = makeProxyToken(url, CINEMACITY_HEADERS);
                streams.push({
                    name: 'CinemaCity',
                    title: `🎬 ${title}`,
                    url: `/proxy/hls/manifest.m3u8?token=${proxyToken}`
                });
            } else {
                // MP4 — use behaviorHints proxy (Stremio handles these)
                streams.push({
                    name: 'CinemaCity',
                    title: `🎬 ${title}`,
                    url
                });
            }
        };

        const displayTitle = animeTitle || 'CinemaCity';

        if (mediaType === 'movie') {
            if (Array.isArray(fileData)) {
                const obj = fileData.find((f: any) => f.file) || fileData[0];
                if (obj?.file) addStream(obj.file, displayTitle);
            } else if (typeof fileData === 'string') {
                addStream(fileData, displayTitle);
            }
        }

        // TODO: series handling can be added here for season/episode

        console.log(`[CinemaCity] Done: ${streams.length} streams`);
        return streams;
    } catch (err: any) {
        console.error('[CinemaCity] Error:', err?.message || err);
        return [];
    }
}
