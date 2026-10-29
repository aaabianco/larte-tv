/*
 * SERVICE WORKER DO MENU BOARD — para o Fire Stick não ficar na mão.
 *
 * O aparelho da loja perde o Wi-Fi por qualquer coisa. Enquanto a página está
 * aberta isso não aparece: o player já guarda os JSONs e as fotos que já
 * baixou. O problema é o RELOAD — o Stick reinicia, o navegador tenta abrir a
 * página, não tem rede, e mostra erro. Aí alguém tem que digitar o endereço de
 * novo, no controle remoto, em cima do horário do almoço.
 *
 * Com este arquivo a página inteira (HTML + fotos + grade) fica gravada no
 * aparelho. Sem rede, abre igual e continua tocando o que estava tocando; a
 * rede, quando volta, só serve para atualizar.
 *
 * Regra por tipo de arquivo:
 *   navegação → rede primeiro (para pegar versão nova), cache se falhar
 *   .jpg      → cache primeiro (foto não muda de conteúdo, muda de nome)
 *   .json     → rede primeiro (é o que traz a programação nova), cache se falhar
 */
const CACHE = 'larte-tv-v1';
const CASCA = ['./', './index.html'];

/** Chave de cache sem o ?v=… que o player usa para furar cache do navegador. */
const semQuery = (url) => {
  const u = new URL(url);
  u.search = '';
  return u.toString();
};

self.addEventListener('install', (e) => {
  /* addAll falha inteiro se um item falhar; a casca é pequena e sempre existe. */
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CASCA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ns) => Promise.all(ns.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

/**
 * Apaga do cache as fotos que saíram do ar.
 *
 * Sem isto o cache só cresce: cada campanha nova deixa a anterior gravada no
 * aparelho para sempre. A lista boa é a do slides.json, que é gerado junto com
 * as fotos — o que não está lá não é mostrado por ninguém.
 */
async function podar(slidesJson) {
  let vivos;
  try {
    vivos = new Set((JSON.parse(slidesJson).slides || []).map((s) => s.arquivo));
  } catch (e) {
    return; // JSON estranho: não apaga nada, que é o lado seguro
  }
  if (!vivos.size) return;
  const cache = await caches.open(CACHE);
  for (const req of await cache.keys()) {
    const nome = new URL(req.url).pathname.split('/').pop();
    if (/\.jpg$/i.test(nome) && !vivos.has(nome)) await cache.delete(req);
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          // Só o player vira a cópia offline; os atalhos /1../7 são só um redirecionamento.
          const doPlayer = new URL('./', self.registration.scope).pathname;
          if (r.ok && (url.pathname === doPlayer || url.pathname === doPlayer + 'index.html')) {
            const copia = r.clone();
            caches.open(CACHE).then((c) => c.put('./index.html', copia));
          }
          return r;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./'))),
    );
    return;
  }

  if (/\.jpg$/i.test(url.pathname)) {
    e.respondWith(
      caches.match(semQuery(req.url)).then(
        (guardada) =>
          guardada ||
          fetch(req).then((r) => {
            if (r.ok) {
              const copia = r.clone();
              caches.open(CACHE).then((c) => c.put(semQuery(req.url), copia));
            }
            return r;
          }),
      ),
    );
    return;
  }

  if (/\.json$/i.test(url.pathname)) {
    e.respondWith(
      fetch(req)
        .then(async (r) => {
          if (r.ok) {
            const texto = await r.clone().text();
            const cache = await caches.open(CACHE);
            await cache.put(semQuery(req.url), new Response(texto, { headers: { 'Content-Type': 'application/json' } }));
            if (url.pathname.endsWith('slides.json')) await podar(texto);
          }
          return r;
        })
        .catch(() => caches.match(semQuery(req.url))),
    );
  }
});
