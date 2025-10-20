// Файл: /api/proxy.js (Фінальна версія для Vercel)

const ALLOWED_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 's-maxage=300, stale-while-revalidate'
};

module.exports = async (request, response) => {
    // Ця частина використовується для Node.js Serverless Functions на Vercel
    const method = request.method || (request.headers && request.headers.get('method'));

    // Обробка OPTIONS-запитів для CORS preflight
    if (method === 'OPTIONS') {
        const headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || 'Content-Type',
            'Access-Control-Max-Age': '86400', 
            ...ALLOWED_HEADERS
        };
        // Для Serverless Functions
        if (response) {
            response.writeHead(204, headers);
            response.end();
            return;
        }
        // Для Edge Functions (як запасний варіант)
        return new Response(null, { status: 204, headers });
    }

    // Використовуємо request.url для Edge Functions або Node.js Environment
    const url = new URL(request.url || `http://localhost${request.url}`);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
        const errorResponse = { error: 'Параметр "url" не указан' };
        if (response) {
            response.status(400).json(errorResponse);
            return;
        }
        return new Response(JSON.stringify(errorResponse), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...ALLOWED_HEADERS },
        });
    }

    try {
        const fetchResponse = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Vercel IPTV Proxy)',
                'Referer': new URL(targetUrl).origin
            }
        });

        if (!fetchResponse.ok) {
            const errorBody = await fetchResponse.text();
            const errorResponse = { 
                error: `Ошибка загрузки потока: ${fetchResponse.status} ${fetchResponse.statusText}`,
                details: errorBody.substring(0, 200)
            };
            if (response) {
                response.status(fetchResponse.status).json(errorResponse);
                return;
            }
            return new Response(JSON.stringify(errorResponse), {
                status: fetchResponse.status,
                headers: { 'Content-Type': 'application/json', ...ALLOWED_HEADERS },
            });
        }
        
        const contentType = fetchResponse.headers.get('Content-Type') || 'application/vnd.apple.mpegurl';

        const headers = { 
            ...ALLOWED_HEADERS,
            'Content-Type': contentType,
            'X-Proxied-Url': targetUrl
        };
        
        // Для Serverless Functions (Node.js)
        if (response && fetchResponse.body && typeof fetchResponse.body.pipe === 'function') {
            response.writeHead(fetchResponse.status, headers);
            fetchResponse.body.pipe(response);
            return;
        }

        // Для Edge Functions
        return new Response(fetchResponse.body, { status: fetchResponse.status, headers });

    } catch (error) {
        console.error('Proxy Fetch Error:', error);
        const errorResponse = { error: 'Ошибка прокси-сервера', details: error.message };
        if (response) {
            response.status(500).json(errorResponse);
            return;
        }
        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...ALLOWED_HEADERS },
        });
    }
};