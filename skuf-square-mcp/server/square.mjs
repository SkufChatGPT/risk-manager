const POST_URL = 'https://www.binance.com/bapi/composite/v1/public/pgc/openApi/content/add';

export function hasPostingKey(env = process.env) {
  return Boolean(env.BINANCE_SQUARE_OPENAPI_KEY?.trim());
}

export async function publishSquareText({ text, title, confirmation }, { env = process.env, fetchImpl = fetch } = {}) {
  if (confirmation !== 'ПУБЛИКУЙ') {
    throw new Error('Требуется явное подтверждение пользователя: ПУБЛИКУЙ.');
  }
  if (typeof text !== 'string' || !text.trim()) throw new Error('Текст поста пуст.');
  if (title !== undefined && (typeof title !== 'string' || !title.trim())) throw new Error('Некорректный заголовок.');
  const key = env.BINANCE_SQUARE_OPENAPI_KEY?.trim();
  if (!key) throw new Error('BINANCE_SQUARE_OPENAPI_KEY не задан в окружении сервера.');

  const body = { contentType: title ? 2 : 1, bodyTextOnly: text };
  if (title) body.title = title;
  let response;
  try {
    response = await fetchImpl(POST_URL, {
      method: 'POST',
      headers: {
        'X-Square-OpenAPI-Key': key,
        'Content-Type': 'application/json',
        'clienttype': 'binanceSkill',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    // A transient failure may happen after Binance accepts the post; never retry automatically.
    throw new Error('Ошибка связи с Binance Square. Статус публикации неизвестен; не повторяйте запрос без проверки.');
  }
  if (response.status === 504) {
    // Official Binance Square skill treats 504 from /content/add as accepted but without post id.
    return { status: 'submitted_id_unavailable', postId: null, url: null, note: 'Binance Square не вернул ID после HTTP 504; не повторяйте автоматически.' };
  }
  const raw = await response.text();
  let parsed;
  try { parsed = JSON.parse(raw); } catch {
    throw new Error(`Binance Square ответил не-JSON (HTTP ${response.status}). Статус публикации может быть неизвестен; не повторяйте автоматически.`);
  }
  if (!response.ok || parsed.code !== '000000') {
    const code = String(parsed.code ?? response.status).slice(0, 40);
    const msg = String(parsed.message ?? 'API error').slice(0, 300);
    throw new Error(`Binance Square API: [${code}] ${msg}`);
  }
  const postId = parsed.data?.id ?? null;
  const fallbackUrl = postId != null && /^[0-9]+$/.test(String(postId))
    ? `https://www.binance.com/square/post/${postId}`
    : null;
  return { status: 'published', postId, url: parsed.data?.shareLink ?? fallbackUrl };
}
