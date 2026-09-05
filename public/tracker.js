/**
 * track.tanisexavierdezordi.com.br — script de captura client-side.
 *
 * Uso no site principal (em TODO subdomínio que for rastreado):
 *   <script src="https://track.tanisexavierdezordi.com.br/tracker.js" async></script>
 *
 * Carrega o Meta Pixel e o gtag.js dinamicamente (pixel_id/measurement_id
 * vêm do painel, não hardcoded), identifica o visitante, dispara PageView
 * automático em toda troca de rota (inclusive navegação client-side de SPA —
 * pushState/replaceState/popstate interceptados, sem precisar de chamada
 * manual por página) e expõe:
 *
 *   window.trckUserId          -> string, usar em links de checkout/WhatsApp
 *   window.trackEvent(name, params) -> dispara pro pixel, pro gtag e pro
 *                                       servidor (Meta CAPI dedup via event_id).
 *                                       params aceita value/currency/content_*
 *                                       (ecommerce) e também email/phone/name
 *                                       (identidade — ex: formulário de lead;
 *                                       sem isso o servidor nunca sabe quem é
 *                                       o visitante, só o trck_user_id).
 *   window.trckCheckoutUrl(url) -> Promise<string>, retorna a url do checkout
 *                                       com utm_term=trck_user_id + demais
 *                                       utms da LP anexados. Usar sempre que
 *                                       o link de checkout for montado/navegado
 *                                       via JS (não um <a href> estático) —
 *                                       ex: popup de lead que redireciona
 *                                       via window.location.href.
 *
 * Recipe pro popup "form de lead -> redireciona pro checkout" (padrão nas
 * LPs de tanisexavierdezordi.com.br): no handler de submit, ANTES do redirect:
 *   window.trackEvent("Lead", { name: form.name, email: form.email, phone: form.whatsapp });
 *   window.trckCheckoutUrl(checkoutUrl).then(function (url) {
 *     window.trackEvent("InitiateCheckout", {});
 *     window.location.href = url;
 *   });
 *
 * Persistência do trck_user_id: cookie no domínio raiz (ex: .tanisexavierdezordi.com.br,
 * não no subdomínio atual) — assim o id sobrevive entre movimentosemdor.tanisexavierdezordi.com.br,
 * checkout.tanisexavierdezordi.com.br etc (a maior parte do tráfego entra por
 * movimentosemdor.tanisexavierdezordi.com.br). localStorage sozinho NÃO funcionaria aqui
 * (é isolado por subdomínio). Cookie setado pela nossa API (track.tanisexavierdezordi.com.br)
 * também não serviria — é cross-origin em relação ao site, cairia no
 * domínio errado. Por isso o cookie é setado aqui, pelo próprio script,
 * rodando no contexto do subdomínio do site.
 *
 * Limitação conhecida: Safari (ITP) limita a 7 dias cookies escritos via JS
 * (document.cookie) quando classificados como tracking — mesma limitação que
 * o _fbp/_fbc do próprio Meta Pixel sofrem. Sem workaround client-side limpo;
 * o fallback de matching por email/telefone no webhook (Fase 4) cobre esse caso.
 */
(function () {
  "use strict";

  var currentScript = document.currentScript;
  var API_BASE = currentScript ? new URL(currentScript.src).origin : "";

  var STORAGE_KEY = "trck_uid";
  var LANDING_KEY = "trck_landing_url";
  var COOKIE_DAYS = 730;

  function getRootDomain() {
    var host = window.location.hostname;
    if (host === "localhost" || /^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return null;
    var parts = host.split(".");
    if (parts.length <= 2) return host;
    return parts.slice(-2).join(".");
  }

  var ROOT_DOMAIN = getRootDomain();

  function getCookie(name) {
    var match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setCookie(name, value, days) {
    var expires = new Date(Date.now() + days * 86400000).toUTCString();
    var cookie = name + "=" + encodeURIComponent(value) + "; expires=" + expires + "; path=/; SameSite=Lax";
    if (ROOT_DOMAIN) cookie += "; domain=." + ROOT_DOMAIN;
    document.cookie = cookie;
  }

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  var CAPTURED_UTMS = {
    utm_source: getQueryParam("utm_source"),
    utm_medium: getQueryParam("utm_medium"),
    utm_campaign: getQueryParam("utm_campaign"),
    utm_content: getQueryParam("utm_content"),
  };

  function getStoredTrckUserId() {
    var fromCookie = getCookie(STORAGE_KEY);
    if (fromCookie) return fromCookie;
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function storeTrckUserId(id) {
    setCookie(STORAGE_KEY, id, COOKIE_DAYS);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* localStorage indisponível (modo privado etc) — o cookie já cobre a persistência */
    }
  }

  function getLandingUrl() {
    var stored = getCookie(LANDING_KEY);
    if (stored) return stored;
    setCookie(LANDING_KEY, window.location.href, COOKIE_DAYS);
    return window.location.href;
  }

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  var gaMeasurementId = null;

  function loadMetaPixel(pixelIds) {
    if (!window.fbq) {
      /* eslint-disable */
      !(function (f, b, e, v, n, t, s) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = true;
        n.version = "2.0";
        n.queue = [];
        t = b.createElement(e);
        t.async = true;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      /* eslint-enable */
    }
    pixelIds.forEach(function (id) {
      window.fbq("init", id);
    });
  }

  function loadGa4(measurementIds) {
    gaMeasurementId = measurementIds[0];
    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function () {
        window.dataLayer.push(arguments);
      };
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(gaMeasurementId);
    document.head.appendChild(script);
    window.gtag("js", new Date());
    measurementIds.forEach(function (id) {
      window.gtag("config", id);
    });
  }

  function getGaIds() {
    return new Promise(function (resolve) {
      if (typeof window.gtag !== "function" || !gaMeasurementId) {
        return resolve({ clientId: null, sessionId: null });
      }
      var clientId = null;
      var sessionId = null;
      var pending = 2;
      function done() {
        pending -= 1;
        if (pending === 0) resolve({ clientId: clientId, sessionId: sessionId });
      }
      window.gtag("get", gaMeasurementId, "client_id", function (id) {
        clientId = id || null;
        done();
      });
      window.gtag("get", gaMeasurementId, "session_id", function (id) {
        sessionId = id || null;
        done();
      });
    });
  }

  function identify() {
    return getGaIds().then(function (gaIds) {
      var body = {
        trck_user_id: getStoredTrckUserId() || undefined,
        fbp: getCookie("_fbp") || undefined,
        fbc: getCookie("_fbc") || undefined,
        ga_client_id: gaIds.clientId || undefined,
        ga_session_id: gaIds.sessionId || undefined,
        utm_source: CAPTURED_UTMS.utm_source || undefined,
        utm_medium: CAPTURED_UTMS.utm_medium || undefined,
        utm_campaign: CAPTURED_UTMS.utm_campaign || undefined,
        utm_term: getQueryParam("utm_term") || undefined,
        utm_content: CAPTURED_UTMS.utm_content || undefined,
        referrer: document.referrer || undefined,
        landing_url: getLandingUrl(),
      };
      return fetch(API_BASE + "/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          storeTrckUserId(data.trck_user_id);
          window.trckUserId = data.trck_user_id;
          return data.trck_user_id;
        });
    });
  }

  var configPromise = fetch(API_BASE + "/api/config/public")
    .then(function (res) {
      return res.json();
    })
    .catch(function () {
      return { ga4_measurement_ids: [], meta_pixel_ids: [] };
    });

  var identifyPromise = configPromise.then(function (config) {
    if (config.meta_pixel_ids && config.meta_pixel_ids.length) loadMetaPixel(config.meta_pixel_ids);
    if (config.ga4_measurement_ids && config.ga4_measurement_ids.length) loadGa4(config.ga4_measurement_ids);
    return identify();
  });

  // Guarda contra chamada duplicada de trackEvent() pro MESMO evento (mesmo
  // nome, mesma página, mesmos params) em sequência rápida — descoberto via
  // auditoria de dados reais: InitiateCheckout duplicando (event_id
  // diferente a cada vez, então não é reenvio de rede/dedup — é o botão de
  // checkout da LP disparando trackEvent() mais de uma vez por clique,
  // provável handler duplicado no elemento). Não resolve a causa raiz (isso
  // é do lado da LP), mas evita que o Meta/GA4/painel recebam o sinal
  // inflado enquanto isso não é corrigido lá. Janela de 3s cobre o maior
  // intervalo observado entre disparos duplicados (~2.2s).
  var DEDUP_WINDOW_MS = 3000;
  var lastEventFingerprint = null;
  var lastEventAt = 0;

  function trackEvent(eventName, params) {
    params = params || {};

    var fingerprint = eventName + "|" + window.location.href + "|" + JSON.stringify(params);
    var now = Date.now();
    if (fingerprint === lastEventFingerprint && now - lastEventAt < DEDUP_WINDOW_MS) {
      return Promise.resolve(null);
    }
    lastEventFingerprint = fingerprint;
    lastEventAt = now;

    var eventId = uuid();

    return identifyPromise.then(function (trckUserId) {
      if (window.fbq) window.fbq("track", eventName, params, { eventID: eventId });
      if (window.gtag) window.gtag("event", eventName, params);

      return getGaIds().then(function (gaIds) {
        var body = {
          event_id: eventId,
          event_name: eventName,
          trck_user_id: trckUserId,
          event_source_url: window.location.href,
          value: params.value,
          currency: params.currency,
          content_ids: params.content_ids,
          content_name: params.content_name,
          content_type: params.content_type,
          email: params.email,
          phone: params.phone,
          name: params.name,
          utm_source: CAPTURED_UTMS.utm_source || undefined,
          utm_medium: CAPTURED_UTMS.utm_medium || undefined,
          utm_campaign: CAPTURED_UTMS.utm_campaign || undefined,
          utm_term: getQueryParam("utm_term") || undefined,
          utm_content: CAPTURED_UTMS.utm_content || undefined,
          fbp: getCookie("_fbp") || undefined,
          fbc: getCookie("_fbc") || undefined,
          ga_client_id: gaIds.clientId || undefined,
          ga_session_id: gaIds.sessionId || undefined,
        };
        fetch(API_BASE + "/api/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          keepalive: true,
        }).catch(function () {});
        return eventId;
      });
    });
  }

  // Pra links de checkout/WhatsApp montados em runtime (ex: popup de lead que
  // redireciona via window.location.href): injeta utm_term=trck_user_id (o
  // que viaja pro webhook da Guru pro matching) + as demais utms capturadas
  // na LP, preservando os query params que a URL já tiver. Async porque
  // pode ser chamado antes do identify() resolver.
  function buildCheckoutUrl(baseUrl, trckUserId) {
    var url;
    try {
      url = new URL(baseUrl, window.location.href);
    } catch {
      return baseUrl;
    }
    Object.keys(CAPTURED_UTMS).forEach(function (key) {
      if (CAPTURED_UTMS[key]) url.searchParams.set(key, CAPTURED_UTMS[key]);
    });
    if (trckUserId) url.searchParams.set("utm_term", trckUserId);
    return url.toString();
  }

  window.trckIdentify = function () {
    return identifyPromise;
  };
  window.trackEvent = trackEvent;
  window.trckCheckoutUrl = function (baseUrl) {
    return identifyPromise.then(function (trckUserId) {
      return buildCheckoutUrl(baseUrl, trckUserId);
    });
  };

  // PageView automático — o Meta Pixel não dispara sozinho, precisa do track().
  identifyPromise.then(function () {
    trackEvent("PageView", {});
  });

  // Detecção de navegação client-side de SPA (React Router e afins): sem
  // isso, um site com rota trocada via pushState/replaceState — sem reload —
  // nunca dispara PageView de novo (esse script só roda uma vez, no load
  // inicial), então páginas visitadas só por navegação interna (ex: links de
  // rodapé pra Termos de Uso/Política de Privacidade) nunca apareceriam com
  // a URL certa no painel — tudo ficaria atribuído à URL de entrada. Técnica
  // padrão de scripts de analytics em SPA: interceptar as funções que mudam
  // a URL sem reload + escutar popstate (botão voltar/avançar do navegador).
  var lastPageViewUrl = window.location.href;
  function maybeTrackPageView() {
    if (window.location.href === lastPageViewUrl) return;
    lastPageViewUrl = window.location.href;
    trackEvent("PageView", {});
  }
  ["pushState", "replaceState"].forEach(function (method) {
    var original = history[method];
    history[method] = function () {
      var result = original.apply(this, arguments);
      maybeTrackPageView();
      return result;
    };
  });
  window.addEventListener("popstate", maybeTrackPageView);
})();
