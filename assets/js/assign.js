/**
 * Assinatura digital (assign.html)
 * Carrega o contrato, exige leitura dos termos, captura assinatura e foto
 * para reconhecimento facial e envia tudo em duas requisições.
 */
(function (w, d) {
  'use strict';

  var API_BASE = 'https://portalcia.impactadigital.net/signature/';
  var TERMS_FALLBACK = '/assets/terms-default.txt';
  var PHOTO_MAX_SIDE = 1024;
  var PHOTO_QUALITY = 0.82;

  var TYPE_LABELS = {
    monthly: 'Mensal', quarterly: 'Trimestral', semiannual: 'Semestral',
    semester: 'Semestral', annual: 'Anual', yearly: 'Anual'
  };

  function byId(id) { return d.getElementById(id); }
  function all(sel, root) { return Array.prototype.slice.call((root || d).querySelectorAll(sel)); }
  function setText(id, text) { var el = byId(id); if (el) el.textContent = text; }

  /* ------------------------------------------------------------ avisos */

  function toast(message, kind) {
    var host = byId('assignToasts');
    if (!host) return;
    var el = d.createElement('div');
    el.className = 'an-toast' + (kind ? ' is-' + kind : '');
    var icon = kind === 'bad'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M20 6L9 17l-5-5"/></svg>';
    el.innerHTML = icon + '<span></span>';
    el.lastChild.textContent = message;
    host.appendChild(el);
    w.setTimeout(function () {
      el.classList.add('leaving');
      w.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }, 3200);
  }

  function setErr(id, message) {
    var el = byId(id);
    if (!el) return;
    if (message) {
      el.lastElementChild.textContent = message;
      el.classList.add('show');
    } else {
      el.classList.remove('show');
    }
  }

  function clearErrors() {
    all('.an-err.show').forEach(function (e) { e.classList.remove('show'); });
    var wrap = byId('assignSignWrap');
    if (wrap) wrap.classList.remove('has-error');
  }

  /* ------------------------------------------------------------ formato */

  function formatCPF(cpf) {
    var s = String(cpf || '').replace(/\D/g, '');
    return s.length === 11 ? s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : (cpf || '');
  }

  function formatPhone(phone) {
    var s = String(phone || '').replace(/\D/g, '');
    if (s.length === 11) return s.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (s.length === 10) return s.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return phone || '';
  }

  function formatMoney(n) {
    var v = Number(n);
    if (!isFinite(v)) return null;
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* ------------------------------------------------------------ estado */

  var state = {
    step: 1,
    maxSteps: 4,
    code: null,
    contract: null,
    termsVersion: null,
    termsRead: false,
    termsAccepted: false,
    signature: null,
    photo: null,
    photoMirrored: false,
    stream: null,
    cameraStarting: false,
    submitting: false
  };

  var SCREENS = ['stLoading', 'stError', 'stForm', 'stSubmitting', 'stSuccess'];
  function showScreen(name) {
    SCREENS.forEach(function (id) {
      var el = byId(id);
      if (el) el.hidden = id !== name;
    });
    if (name !== 'stForm') stopCamera();
  }

  function showLoadError(title, text, canRetry) {
    setText('assignErrorTitle', title);
    setText('assignErrorText', text);
    var retry = byId('assignRetryBtn');
    if (retry) retry.hidden = !canRetry;
    showScreen('stError');
  }

  /* ------------------------------------------------------------ contrato */

  function extractCode() {
    var params = new URLSearchParams(w.location.search);
    state.code = (params.get('code') || '').trim() || null;
    return !!state.code;
  }

  function loadContract() {
    if (!state.code) {
      showLoadError('Link incompleto', 'Este link não tem o código do contrato. Peça um novo link para a unidade.', false);
      return;
    }
    showScreen('stLoading');

    fetch(API_BASE + encodeURIComponent(state.code), { headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (res.status === 404 || res.status === 410) {
          throw Object.assign(new Error('not-found'), { permanent: true });
        }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (result) {
        if (!result || !result.success || !result.data) throw new Error('Resposta inválida');
        state.contract = result.data;
        state.termsVersion = result.data.termsVersion || null;
        renderContract();
        return loadTerms();
      })
      .then(function () {
        showScreen('stForm');
        goToStep(1);
      })
      .catch(function (err) {
        console.error('Contract load error:', err);
        if (err && err.permanent) {
          showLoadError('Link inválido ou expirado', 'Não encontramos um contrato para este link. Fale com a unidade para receber um novo.', false);
        } else {
          showLoadError('Não conseguimos carregar', 'Verifique sua conexão e tente de novo. Se continuar, fale com a unidade.', true);
        }
      });
  }

  function renderContract() {
    var m = state.contract.signatureGymMember || {};
    var p = state.contract.plan || {};

    setText('assignName', m.name || '—');
    setText('assignCpf', formatCPF(m.cpf) || '—');
    setText('assignBirthDate', m.birth_date || '—');
    setText('assignAge', m.age ? '(' + m.age + ' anos)' : '');
    setText('assignPhone', formatPhone(m.phone) || '—');
    setText('assignEmail', m.email || '—');
    setText('assignUnitName', m.unitName || '—');
    setText('assignType', TYPE_LABELS[m.type] || m.type || '—');
    setText('assignStartDate', m.startDate || '—');

    setText('assignPlanName', p.name || '—');
    setText('assignPlanGroup', p.groupLabel || 'Plano');
    var price = formatMoney(p.priceFrom);
    setText('assignPlanPrice', price || '—');
    var mat = Number(p.matricula);
    setText('assignPlanMatricula', mat > 0 ? 'R$ ' + formatMoney(mat) : 'Grátis');

    var vnote = byId('assignTermsVersionNote');
    if (vnote) vnote.textContent = state.termsVersion ? 'Versão ' + state.termsVersion + ' dos termos.' : '';
  }

  /* ------------------------------------------------------------ termos */

  function loadTerms() {
    var url = state.contract && state.contract.termsUrl;
    var primary = url
      ? fetch(url).then(function (r) { if (!r.ok) throw new Error('terms ' + r.status); return r.text(); })
      : Promise.reject(new Error('sem termsUrl'));

    return primary
      .catch(function (err) {
        console.warn('Termos remotos indisponíveis, usando fallback:', err);
        return fetch(TERMS_FALLBACK).then(function (r) {
          if (!r.ok) throw new Error('fallback ' + r.status);
          return r.text();
        });
      })
      .then(function (text) { renderTerms(text); })
      .catch(function (err) {
        console.error('Terms load error:', err);
        renderTerms('');
        toast('Não conseguimos carregar os termos. Tente recarregar a página.', 'bad');
      });
  }

  function renderTerms(text) {
    var box = byId('assignTermsContent');
    if (!box) return;
    box.textContent = (text || '').trim() || 'Termos indisponíveis no momento.';
    var foot = byId('assignTermsProgress');
    if (foot) foot.hidden = false;
    box.addEventListener('scroll', onTermsScroll, { passive: true });
    // Termos curtos (sem rolagem) liberam o aceite direto
    w.requestAnimationFrame(onTermsScroll);
  }

  function onTermsScroll() {
    var box = byId('assignTermsContent');
    if (!box) return;
    var span = box.scrollHeight - box.clientHeight;
    var pct = span <= 4 ? 100 : Math.min(100, Math.round((box.scrollTop / span) * 100));
    var bar = byId('assignTermsScrollBar');
    if (bar) bar.style.width = pct + '%';
    if (pct >= 95 && !state.termsRead) {
      state.termsRead = true;
      var cb = byId('assignAcceptTerms');
      if (cb) cb.disabled = false;
      var wrap = byId('assignTermsBox');
      if (wrap) wrap.classList.add('is-read');
      setText('assignTermsHint', 'Leitura concluída. Marque o aceite abaixo.');
    }
  }

  function validateTerms() {
    if (!state.termsRead) {
      setErr('assignTermsErr', 'Role os termos até o final antes de aceitar.');
      var box = byId('assignTermsContent');
      if (box) {
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        try { box.focus({ preventScroll: true }); } catch (e) { box.focus(); }
      }
      return false;
    }
    if (!state.termsAccepted) {
      setErr('assignTermsErr', 'Marque a caixa de aceite para continuar.');
      return false;
    }
    return true;
  }

  /* ------------------------------------------------------------ assinatura */

  var sign = null;

  function setupSignature() {
    var canvas = byId('assignSignature');
    var wrap = byId('assignSignWrap');
    var status = byId('assignSignStatus');
    if (!canvas || !wrap) return;

    var ctx = canvas.getContext('2d');
    var strokes = [];
    var current = null;
    var drawing = false;
    var box = { w: 0, h: 0 };

    function ratio() { return Math.max(1, Math.min(3, w.devicePixelRatio || 1)); }

    function drawStrokes(c, scaleX, scaleY) {
      c.lineWidth = 2.2;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.strokeStyle = '#14141a';
      strokes.forEach(function (s) {
        if (!s.length) return;
        c.beginPath();
        c.moveTo(s[0].x * scaleX, s[0].y * scaleY);
        if (s.length === 1) c.lineTo(s[0].x * scaleX + 0.6, s[0].y * scaleY);
        for (var i = 1; i < s.length; i++) c.lineTo(s[i].x * scaleX, s[i].y * scaleY);
        c.stroke();
      });
    }

    function paint() {
      var r = ratio();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(r, r);
      drawStrokes(ctx, box.w, box.h);
      wrap.classList.toggle('has-ink', strokes.length > 0);
    }

    function fit() {
      var rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return false;
      var r = ratio();
      box.w = rect.width;
      box.h = rect.height;
      var nw = Math.round(rect.width * r), nh = Math.round(rect.height * r);
      if (canvas.width !== nw || canvas.height !== nh) { canvas.width = nw; canvas.height = nh; }
      paint();
      return true;
    }

    function pointFrom(ev) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: Math.min(1, Math.max(0, (ev.clientX - rect.left) / (rect.width || 1))),
        y: Math.min(1, Math.max(0, (ev.clientY - rect.top) / (rect.height || 1)))
      };
    }

    function setStatus(kind) {
      if (!status) return;
      status.classList.remove('is-saved', 'is-pending');
      if (kind === 'saved') {
        status.textContent = 'Assinatura salva.';
        status.classList.add('is-saved');
      } else if (kind === 'pending') {
        status.textContent = 'Assinatura feita, mas ainda não salva.';
        status.classList.add('is-pending');
      } else {
        status.textContent = 'Nenhuma assinatura salva ainda.';
      }
    }

    function invalidate() {
      if (state.signature) {
        state.signature = null;
        wrap.classList.remove('is-saved');
      }
    }

    function start(ev) {
      if (ev.button != null && ev.button !== 0) return;
      ev.preventDefault();
      if (!box.w && !fit()) return;
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      invalidate();
      drawing = true;
      current = [pointFrom(ev)];
      strokes.push(current);
      wrap.classList.add('is-active');
      wrap.classList.remove('has-error');
      setErr('assignSignErr', '');
      paint();
    }

    function move(ev) {
      if (!drawing || !current) return;
      ev.preventDefault();
      current.push(pointFrom(ev));
      paint();
    }

    function end(ev) {
      if (!drawing) return;
      drawing = false;
      current = null;
      try { if (ev && ev.pointerId != null) canvas.releasePointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      wrap.classList.remove('is-active');
      setStatus(strokes.length ? 'pending' : null);
    }

    function exportPng() {
      if (!strokes.length) return '';
      var minX = 1, minY = 1, maxX = 0, maxY = 0;
      strokes.forEach(function (s) {
        s.forEach(function (p) {
          if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        });
      });
      var pad = 0.04;
      minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
      maxX = Math.min(1, maxX + pad); maxY = Math.min(1, maxY + pad);
      var srcW = Math.max(0.08, maxX - minX) * box.w;
      var srcH = Math.max(0.08, maxY - minY) * box.h;
      var outW = 600;
      var outH = Math.max(120, Math.min(400, Math.round(outW * (srcH / srcW))));
      var scale = Math.min(outW / srcW, outH / srcH);
      var out = d.createElement('canvas');
      out.width = outW; out.height = outH;
      var oc = out.getContext('2d');
      oc.translate((outW - srcW * scale) / 2, (outH - srcH * scale) / 2);
      oc.scale(scale, scale);
      oc.translate(-minX * box.w, -minY * box.h);
      drawStrokes(oc, box.w, box.h);
      return out.toDataURL('image/png');
    }

    function save(silent) {
      if (!strokes.length) {
        wrap.classList.add('has-error');
        setErr('assignSignErr', 'Assine no quadro primeiro.');
        if (!silent) toast('Assine no quadro primeiro.', 'bad');
        return false;
      }
      state.signature = exportPng();
      wrap.classList.remove('has-error');
      wrap.classList.add('is-saved');
      setErr('assignSignErr', '');
      setStatus('saved');
      if (!silent) toast('Assinatura salva.', 'good');
      return true;
    }

    function clear() {
      strokes.length = 0;
      current = null;
      drawing = false;
      state.signature = null;
      wrap.classList.remove('has-ink', 'is-active', 'is-saved', 'has-error');
      setErr('assignSignErr', '');
      paint();
      setStatus(null);
    }

    function undo() {
      if (!strokes.length) return;
      strokes.pop();
      invalidate();
      paint();
      setStatus(strokes.length ? 'pending' : null);
    }

    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', end);

    byId('assignSignSave').addEventListener('click', function () { save(false); });
    byId('assignSignClear').addEventListener('click', clear);
    byId('assignSignUndo').addEventListener('click', undo);

    var resizeTimer = null;
    w.addEventListener('resize', function () {
      w.clearTimeout(resizeTimer);
      resizeTimer = w.setTimeout(fit, 120);
    });

    sign = {
      fit: fit,
      save: save,
      hasInk: function () { return strokes.length > 0; },
      markError: function () { wrap.classList.add('has-error'); }
    };
  }

  /* ------------------------------------------------------------ câmera */

  function camEl() { return byId('assignCam'); }
  function setCamMode(mode) {
    var el = camEl();
    if (el) el.dataset.mode = mode;
    var live = d.querySelector('[data-cam-live]');
    var prev = d.querySelector('[data-cam-preview]');
    var saved = d.querySelector('[data-cam-saved]');
    if (live) live.hidden = mode !== 'live' && mode !== 'error' && mode !== 'loading';
    if (prev) prev.hidden = mode !== 'preview';
    if (saved) saved.hidden = mode !== 'saved';
    if (live && mode === 'loading') live.hidden = true;
  }

  function setPhotoStatus(kind) {
    var el = byId('assignPhotoStatus');
    if (!el) return;
    el.classList.remove('is-saved', 'is-pending');
    if (kind === 'saved') {
      el.textContent = 'Foto salva. Essa é a foto que vai para a catraca.';
      el.classList.add('is-saved');
    } else if (kind === 'pending') {
      el.textContent = 'Gostou? Toque em "Usar esta foto". Se não, tire outra.';
      el.classList.add('is-pending');
    } else {
      el.textContent = 'Nenhuma foto salva ainda.';
    }
  }

  function startCamera() {
    var video = byId('assignCameraVideo');
    if (!video || state.stream || state.cameraStarting) {
      if (state.stream) setCamMode('live');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showCameraError('Este navegador não permite abrir a câmera.');
      return;
    }
    state.cameraStarting = true;
    setCamMode('loading');

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false
    }).then(function (stream) {
      state.stream = stream;
      video.srcObject = stream;
      var p = video.play();
      if (p && p.catch) p.catch(function () { /* autoplay bloqueado: o usuário toca no disparo */ });
      setCamMode('live');
    }).catch(function (err) {
      console.error('Camera access error:', err);
      var name = err && err.name;
      var msg = name === 'NotAllowedError' ? 'O acesso à câmera foi negado.'
        : name === 'NotFoundError' ? 'Nenhuma câmera foi encontrada neste aparelho.'
        : name === 'NotReadableError' ? 'A câmera está em uso por outro app.'
        : 'Não conseguimos abrir a câmera.';
      showCameraError(msg);
    }).finally(function () {
      state.cameraStarting = false;
    });
  }

  function stopCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach(function (t) { t.stop(); });
      state.stream = null;
    }
    var video = byId('assignCameraVideo');
    if (video) video.srcObject = null;
  }

  function showCameraError(msg) {
    setText('assignCamErrorText', msg);
    setCamMode('error');
  }

  function fitCanvasTo(canvas, srcW, srcH) {
    var scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(srcW, srcH));
    canvas.width = Math.round(srcW * scale);
    canvas.height = Math.round(srcH * scale);
  }

  function capturePhoto() {
    var video = byId('assignCameraVideo');
    var canvas = byId('assignPhotoCanvas');
    if (!video || !canvas || !video.videoWidth) {
      toast('A câmera ainda está abrindo. Tente de novo em um segundo.', 'bad');
      return;
    }
    fitCanvasTo(canvas, video.videoWidth, video.videoHeight);
    // Desenha o quadro real (não espelhado): a foto enviada mantém a orientação
    // verdadeira. Só a exibição é espelhada, para bater com o que a pessoa viu.
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    state.photoMirrored = true;
    canvas.classList.add('is-mirrored');
    flash();
    afterCapture();
  }

  function loadPhotoFile(file) {
    if (!file || !/^image\//.test(file.type)) {
      toast('Escolha um arquivo de imagem.', 'bad');
      return;
    }
    var canvas = byId('assignPhotoCanvas');
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      fitCanvasTo(canvas, img.naturalWidth, img.naturalHeight);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      state.photoMirrored = false;
      canvas.classList.remove('is-mirrored');
      afterCapture();
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      toast('Não conseguimos abrir essa imagem.', 'bad');
    };
    img.src = url;
  }

  function afterCapture() {
    state.photo = null;
    setErr('assignPhotoErr', '');
    setCamMode('preview');
    setPhotoStatus('pending');
  }

  function flash() {
    var el = camEl();
    if (!el) return;
    el.classList.remove('is-flash');
    void el.offsetWidth;
    el.classList.add('is-flash');
    w.setTimeout(function () { el.classList.remove('is-flash'); }, 400);
  }

  function savePhoto() {
    var canvas = byId('assignPhotoCanvas');
    if (!canvas || !canvas.width) return;
    state.photo = canvas.toDataURL('image/jpeg', PHOTO_QUALITY);
    setCamMode('saved');
    setPhotoStatus('saved');
    setErr('assignPhotoErr', '');
    stopCamera();
    toast('Foto salva.', 'good');
  }

  function retakePhoto() {
    state.photo = null;
    setPhotoStatus(null);
    setErr('assignPhotoErr', '');
    if (state.stream) setCamMode('live'); else startCamera();
  }

  function setupCamera() {
    byId('assignCameraCapture').addEventListener('click', capturePhoto);
    byId('assignPhotoSave').addEventListener('click', savePhoto);
    byId('assignPhotoRetake').addEventListener('click', retakePhoto);
    byId('assignPhotoRetake2').addEventListener('click', retakePhoto);
    byId('assignCameraRetry').addEventListener('click', function () { stopCamera(); startCamera(); });

    var file = byId('assignPhotoFile');
    function pick() { file.value = ''; file.click(); }
    byId('assignPhotoPick').addEventListener('click', pick);
    byId('assignPhotoPickAlt').addEventListener('click', pick);
    file.addEventListener('change', function () { loadPhotoFile(file.files && file.files[0]); });

    // A câmera é fechada se a pessoa trocar de aba por muito tempo; ao voltar, reabre.
    d.addEventListener('visibilitychange', function () {
      if (d.visibilityState !== 'visible' || state.step !== 4) return;
      var el = camEl();
      if (el && el.dataset.mode === 'live' && state.stream && state.stream.getVideoTracks().every(function (t) { return t.readyState === 'ended'; })) {
        stopCamera();
        startCamera();
      }
    });
    w.addEventListener('pagehide', stopCamera);
  }

  /* ------------------------------------------------------------ passos */

  function goToStep(n) {
    var leaving = state.step;
    state.step = n;
    clearErrors();

    all('.an-step').forEach(function (item) {
      var k = parseInt(item.dataset.step, 10);
      item.classList.toggle('is-current', k === n);
      item.classList.toggle('is-done', k < n);
    });
    all('.an-block').forEach(function (block) {
      block.hidden = parseInt(block.dataset.block, 10) !== n;
    });

    byId('assignPrev').hidden = n === 1;
    byId('assignNext').hidden = n === state.maxSteps;
    byId('assignSubmit').hidden = n !== state.maxSteps;

    if (n === 3 && sign) w.requestAnimationFrame(sign.fit);
    if (n === 4) {
      if (!state.photo) startCamera();
    } else if (leaving === 4 && !state.photo) {
      stopCamera();
    }

    if (leaving !== n) {
      var panel = byId('assignPanel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function nextStep() {
    if (state.step === 2 && !validateTerms()) return;
    if (state.step === 3) {
      // Continuar com tinta no quadro salva a assinatura automaticamente
      if (!state.signature && !(sign && sign.hasInk() && sign.save(true))) {
        if (sign) sign.markError();
        setErr('assignSignErr', 'Assine no quadro para continuar.');
        toast('Falta a sua assinatura.', 'bad');
        return;
      }
    }
    if (state.step < state.maxSteps) goToStep(state.step + 1);
  }

  function prevStep() {
    if (state.step > 1) goToStep(state.step - 1);
  }

  /* ------------------------------------------------------------ envio */

  function dataURLtoBlob(dataUrl) {
    return fetch(dataUrl).then(function (r) { return r.blob(); });
  }

  function setProgress(id, status) {
    var el = byId(id);
    if (!el) return;
    el.classList.remove('is-active', 'is-done');
    if (status) el.classList.add('is-' + status);
  }

  function uploadPhoto() {
    setProgress('assignProgressPhoto', 'active');
    return dataURLtoBlob(state.photo).then(function (blob) {
      var fd = new FormData();
      fd.append('file', blob, 'face.jpg');
      return fetch(API_BASE + encodeURIComponent(state.code) + '/photo', { method: 'POST', body: fd });
    }).then(function (res) {
      if (!res.ok) throw new Error('Não conseguimos enviar a foto (erro ' + res.status + ').');
      setProgress('assignProgressPhoto', 'done');
    });
  }

  function finalizeSignature(acceptedAt) {
    setProgress('assignProgressSign', 'active');
    var payload = {
      accepted_terms: true,
      terms_version: state.termsVersion,
      accepted_at: acceptedAt,
      signature: state.signature
    };
    return fetch(API_BASE + encodeURIComponent(state.code) + '/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) throw new Error('Não conseguimos registrar a assinatura (erro ' + res.status + ').');
      return res.json().catch(function () { return { success: true }; });
    }).then(function (result) {
      if (result && result.success === false) throw new Error(result.error || result.message || 'Erro ao finalizar.');
      setProgress('assignProgressSign', 'done');
    });
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    if (state.submitting) return;
    setErr('assignSubmitErr', '');

    if (!state.signature) { goToStep(3); setErr('assignSignErr', 'Assine no quadro para continuar.'); return; }
    if (!state.photo) {
      setErr('assignPhotoErr', 'Tire a foto e toque em "Usar esta foto".');
      toast('Falta a sua foto.', 'bad');
      return;
    }

    state.submitting = true;
    setProgress('assignProgressPhoto', null);
    setProgress('assignProgressSign', null);
    showScreen('stSubmitting');
    var acceptedAt = new Date().toISOString();

    uploadPhoto()
      .then(function () { return finalizeSignature(acceptedAt); })
      .then(function () {
        showScreen('stSuccess');
        var panel = byId('assignPanel');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .catch(function (err) {
        console.error('Submission error:', err);
        showScreen('stForm');
        goToStep(4);
        setErr('assignSubmitErr', (err && err.message ? err.message : 'Não conseguimos enviar agora.') + ' Verifique a conexão e tente de novo.');
        toast('Não conseguimos enviar agora. Tente de novo.', 'bad');
      })
      .finally(function () { state.submitting = false; });
  }

  /* ------------------------------------------------------------ init */

  function setupUI() {
    byId('assignNext').addEventListener('click', nextStep);
    byId('assignPrev').addEventListener('click', prevStep);
    byId('assignForm').addEventListener('submit', handleSubmit);
    byId('assignRetryBtn').addEventListener('click', loadContract);

    byId('assignAcceptTerms').addEventListener('change', function (e) {
      state.termsAccepted = e.target.checked;
      if (state.termsAccepted) setErr('assignTermsErr', '');
    });

    all('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  d.addEventListener('DOMContentLoaded', function () {
    setupUI();
    setupSignature();
    setupCamera();
    extractCode();
    loadContract();
  });
})(window, document);
