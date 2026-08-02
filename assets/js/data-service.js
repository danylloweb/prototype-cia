/* ============================================================
   CIA DO CORPO — Data Service (client-side)
   Resolve a configuração ativa e persiste edições do admin.
   Hierarquia: localStorage (edições do admin) > backend (S3) > seed (config.js).
   O backend publica em REMOTE_URL um JSON no formato { bundle: {...} };
   as seções presentes no bundle sobrepõem a seed e as ausentes caem
   no fallback da seed.
   ============================================================ */

(function (w) {
  var LS_KEY = "cdc_site_config_v4";
  var REMOTE_URL = w.CDC_REMOTE_CONFIG_URL || "https://msadmin.s3.amazonaws.com/config.json";
  /* O bucket S3 não responde com Access-Control-Allow-Origin, então o
     navegador bloqueia a leitura do config publicado. O painel serve o
     mesmo conteúdo com CORS liberado — usado quando o S3 falha. */
  var REMOTE_FALLBACK_URL = w.CDC_REMOTE_CONFIG_FALLBACK || "https://portalcia.impactadigital.net/public-config";
  var REMOTE_KEY = "cdc_remote_config_v1";

  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  function deepMerge(base, over) {
    if (Array.isArray(over)) return over.slice();
    if (over && typeof over === "object") {
      var out = Object.assign({}, base);
      Object.keys(over).forEach(function (k) {
        out[k] = (base && typeof base[k] === "object" && !Array.isArray(base[k]))
          ? deepMerge(base[k] || {}, over[k]) : over[k];
      });
      return out;
    }
    return over;
  }

  function moneyBR(v) {
    var s = Number(v).toFixed(2).split(".");
    return "R$ " + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + s[1];
  }

  /* `plans` publicado pelo painel (Sales-Cia) vem como linhas de preço por
     grupo: { id: <nº>, group: 1|2|3, groupLabel, priceFrom, matricula,
     recurring, status, ... }. Vira um overlay de preços sobre os cards da
     seed: texto, badges e features continuam locais; o painel controla só os
     valores. Uma linha casa com as unidades do mesmo `group` (ou todas, se
     não tiver group) e escolhe o card assim: key/plan explícito se bater com
     um item; senão recurring=true vai no Basic+ (recorrência) e o restante no
     card destacado (Anual VIP). Linhas com status=false são ignoradas.
     priceFrom numérico substitui só o valor dentro do formato do card
     ("12x de R$ 109,90" mantém o "12x de"). */
  function plansFromRows(rows, units) {
    var seedPlans = (w.CDC_DEFAULT_CONFIG || {}).plans;
    if (!seedPlans || !seedPlans.byUnit) return null;
    var plans = deepClone(seedPlans);
    var unitInfo = {};
    ((units && units.length ? units : (w.CDC_DEFAULT_CONFIG.units || []))).forEach(function (u) {
      if (u && u.id) unitInfo[u.id] = { group: u.group, tier: String(u.tier || "").toLowerCase() };
    });
    var applied = false;
    Object.keys(plans.byUnit).forEach(function (unitId) {
      var items = plans.byUnit[unitId].items || [];
      rows.forEach(function (row) {
        if (!row || typeof row !== "object") return;
        if (row.status === false) return;
        // Casa a linha com a unidade pelo groupLabel ↔ tier ("Exclusive" ↔
        // "exclusive"), que é o dado confiável do cadastro; o número do
        // `group` é só fallback — no painel ele está errado para as unidades
        // exclusive (todas publicadas como 1/Standard).
        var info = unitInfo[unitId] || {};
        var rowLabel = String(row.groupLabel || "").toLowerCase();
        if (rowLabel && info.tier) {
          if (rowLabel !== info.tier) return;
        } else if (row.group != null && info.group != null && row.group !== info.group) {
          return;
        }
        var key = String(row.key || row.planKey || row.plan || "").toLowerCase();
        var item = items.filter(function (i) { return i.key === key; })[0];
        if (!item && row.recurring === true) item = items.filter(function (i) { return i.key === "basic"; })[0];
        if (!item) item = items.filter(function (i) { return i.featured; })[0];
        if (!item) return;
        if (typeof row.priceFrom === "number" && row.priceFrom > 0) {
          item.price = /R\$\s?[\d.,]+/.test(item.price)
            ? item.price.replace(/R\$\s?[\d.,]+/, moneyBR(row.priceFrom))
            : moneyBR(row.priceFrom);
          applied = true;
        } else if (typeof row.priceFrom === "string" && row.priceFrom.trim()) {
          item.price = row.priceFrom.trim();
          applied = true;
        }
        if (typeof row.matricula === "number") {
          item.note = row.matricula > 0 ? "+ " + moneyBR(row.matricula) : "";
          applied = true;
        } else if (typeof row.matricula === "string" && row.matricula.trim()) {
          var m = row.matricula.trim();
          item.note = /^\+/.test(m) ? m : "+ " + m;
          applied = true;
        }
      });
    });
    return applied ? plans : null;
  }

  /* Converte o JSON publicado pelo backend ({ bundle: {...} }) para o
     formato interno do site. Só aceita as seções conhecidas. `plans` é
     aceito em dois formatos: plans.byUnit completo (formato do site) ou
     array de linhas do banco, convertido por plansFromRows(). */
  function normalizeRemote(raw) {
    var b = (raw && raw.bundle) ? raw.bundle : raw;
    if (!b || typeof b !== "object") return null;
    var out = {};
    ["meta", "telemetry", "integrations", "offer", "units", "modalities",
     "conceptExtraModalities", "totalpass", "acceptsWellhub", "experimental",
     "popups", "classesGrid", "testimonials", "partners", "partnerCategories",
     "partnersClub"].forEach(function (k) {
      if (b[k] !== undefined) out[k] = b[k];
    });
    if (b.plans && b.plans.byUnit) {
      out.plans = b.plans;
    } else if (Array.isArray(b.plans) && b.plans.length) {
      var converted = plansFromRows(b.plans, b.units);
      if (converted) out.plans = converted;
      // Linhas cruas ficam disponíveis para o envio de leads (plan_id do painel)
      out.planRows = b.plans;
    }
    return out;
  }

  function remoteCfg() {
    try {
      var s = localStorage.getItem(REMOTE_KEY);
      return s ? JSON.parse(s) : null;
    } catch (e) { return null; }
  }

  var DataService = {
    seed: function () { return deepClone(w.CDC_DEFAULT_CONFIG || {}); },

    /* Configuração ativa usada pelo site público e pelo admin */
    get: function () {
      var cfg = this.seed();
      var remote = remoteCfg();
      if (remote) cfg = deepMerge(cfg, remote);
      try {
        var saved = localStorage.getItem(LS_KEY);
        if (saved) cfg = deepMerge(cfg, JSON.parse(saved));
      } catch (e) { /* ignore */ }
      return cfg;
    },

    /* Busca a configuração publicada pelo backend e atualiza o cache local.
       Na primeira visita (sem cache) a página já renderizou com a seed,
       então recarrega uma única vez para exibir os dados publicados. */
    refreshRemote: function () {
      var self = this;
      if (!w.fetch || !REMOTE_URL) return;
      function buscar(url) {
        return fetch(url, { cache: "no-store" }).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        });
      }
      // S3 primeiro; se o CORS bloquear (ou der erro), tenta o painel
      buscar(REMOTE_URL).catch(function () {
        return REMOTE_FALLBACK_URL ? buscar(REMOTE_FALLBACK_URL) : Promise.reject();
      }).then(function (raw) {
        var norm = normalizeRemote(raw);
        if (!norm) return;
        var str = JSON.stringify(norm);
        var prev = null;
        try { prev = localStorage.getItem(REMOTE_KEY); } catch (e) {}
        if (prev === str) return;
        try { localStorage.setItem(REMOTE_KEY, str); } catch (e) {}
        try { w.dispatchEvent(new CustomEvent("cdc:config-updated", { detail: self.get() })); } catch (e) {}
        var flag = "cdc_remote_reload_" + ((norm.meta && norm.meta.version) || "0");
        try {
          if (!prev && !sessionStorage.getItem(flag)) {
            sessionStorage.setItem(flag, "1");
            w.location.reload();
          }
        } catch (e) {}
      }).catch(function () { /* offline ou CORS bloqueado: segue com cache/seed */ });
    },

    /* Salva configuração completa (admin) */
    save: function (cfg) {
      cfg.meta = cfg.meta || {};
      cfg.meta.updatedAt = new Date().toISOString().slice(0, 10);
      cfg.meta.version = (cfg.meta.version || 0) + 1;
      localStorage.setItem(LS_KEY, JSON.stringify(cfg));
      try { w.dispatchEvent(new CustomEvent("cdc:config-updated", { detail: cfg })); } catch (e) {}
      return cfg;
    },

    reset: function () { localStorage.removeItem(LS_KEY); },

    export: function () { return JSON.stringify(this.get(), null, 2); },

    import: function (jsonStr) {
      var parsed = JSON.parse(jsonStr);
      return this.save(parsed);
    },

    /* Helpers de domínio */
    activeUnits: function () {
      return this.get().units.filter(function (u) { return u.active !== false; });
    },
    unitById: function (id) {
      return this.get().units.filter(function (u) { return u.id === id; })[0] || null;
    },
    defaultUnit: function () {
      return this.activeUnits()[0] || null;
    }
  };

  w.CDC = w.CDC || {};
  w.CDC.data = DataService;
  DataService.refreshRemote();
})(window);
