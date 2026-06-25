/* ============================================================
   CIA DO CORPO — Data Service (client-side)
   Resolve a configuração ativa e persiste edições do admin.
   Hierarquia: localStorage (edições) > seed (config.js).
   Preparado para no futuro plugar um backend (API) sem trocar o site.
   ============================================================ */

(function (w) {
  var LS_KEY = "cdc_site_config_v4";

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

  var DataService = {
    seed: function () { return deepClone(w.CDC_DEFAULT_CONFIG || {}); },

    /* Configuração ativa usada pelo site público e pelo admin */
    get: function () {
      var cfg = this.seed();
      try {
        var saved = localStorage.getItem(LS_KEY);
        if (saved) cfg = deepMerge(cfg, JSON.parse(saved));
      } catch (e) { /* ignore */ }
      return cfg;
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
})(window);
