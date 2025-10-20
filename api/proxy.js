// Файл: /api/proxy.js

const ALLOWED_HEADERS = {
    'Access-Control-Allow-Origin': '*', // Разрешаем доступ с любого домена
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 's-maxage=300, stale-while-revalidate' // Кэширование на 5 минут
};

export default async function handler(request) {
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: ALLOWED_HEADERS,
        });
    }

    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
        return new Response(JSON.stringify({ error: 'Параметр "url" не указан' }), {
            status: 400,
            headers: { ...ALLOWED_HEADERS, 'Content-Type': 'application/json' },
        });
    }

    try {
        // Запрос к целевому URL (серверу IPTV)
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                // Имитация обычного браузерного запроса
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
                'Referer': new URL(targetUrl).origin
            }
        });

        if (!response.ok) {
            return new Response(JSON.stringify({ 
                error: `Ошибка загрузки потока: ${response.status} ${response.statusText}`,
                status: response.status
            }), {
                status: response.status,
                headers: { ...ALLOWED_HEADERS, 'Content-Type': 'application/json' },
            });
        }

        const contentType = response.headers.get('Content-Type') || 'application/vnd.apple.mpegurl';

        // Передача содержимого и заголовков CORS
        const proxiedResponse = new Response(response.body, {
            status: response.status,
            headers: { 
                ...ALLOWED_HEADERS,
                'Content-Type': contentType,
                'X-Proxied-Url': targetUrl
            }
        });

        return proxiedResponse;

    } catch (error) {
        console.error('Proxy Fetch Error:', error);
        return new Response(JSON.stringify({ error: 'Ошибка прокси-сервера', details: error.message }), {
            status: 500,
            headers: { ...ALLOWED_HEADERS, 'Content-Type': 'application/json' },
        });
    }
}