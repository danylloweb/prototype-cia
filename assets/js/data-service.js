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

  /* Converte o JSON publicado pelo backend ({ bundle: {...} }) para o
     formato interno do site. Só aceita as seções conhecidas; `plans` do
     backend hoje vem como linhas de banco (id/group/priceFrom) e não no
     formato plans.byUnit que o site renderiza — enquanto o backend não
     publicar nesse formato, os planos continuam vindo da seed. */
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
    if (b.plans && b.plans.byUnit) out.plans = b.plans;
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
      fetch(REMOTE_URL, { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
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
