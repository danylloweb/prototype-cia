/**
 * Assign Page - Digital Signature Flow
 * Handles contract loading, terms acceptance, signature capture, and photo submission
 */

class AssignmentFlow {
  constructor() {
    this.currentStep = 1;
    this.maxSteps = 4;
    this.code = null;
    this.contractData = null;
    this.termsScrolled = false;
    this.signatureData = null;
    this.photoData = null;
    this.acceptedTerms = false;
    this.termsVersion = null;
    this.termsText = null;
    this.strokes = [];
    this.isDrawing = false;
    this.camera = null;
    this.cameraStream = null;

    this.init();
  }

  async init() {
    this.extractCode();
    await this.loadContractData();
    this.setupUI();
    this.setupSignatureCanvas();
    this.setupCamera();
  }

  extractCode() {
    const params = new URLSearchParams(window.location.search);
    this.code = params.get('code');

    if (!this.code) {
      this.showError('Código de contrato não fornecido', 'O link de assinatura é inválido ou expirou.');
      return false;
    }

    return true;
  }

  async loadContractData() {
    if (!this.code) return;

    try {
      this.showState('stLoading');

      const response = await fetch(`http://localhost:8005/signature/${this.code}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error('Falha ao carregar contrato');
      }

      this.contractData = result.data;
      this.termsVersion = result.data.termsVersion;

      // Load terms document
      await this.loadTerms();

      this.displayContractInfo();
      this.showState('stForm');
    } catch (error) {
      console.error('Contract load error:', error);
      this.showError('Erro ao carregar contrato', error.message);
    }
  }

  async loadTerms() {
    if (!this.contractData?.termsUrl) {
      throw new Error('URL de termos não fornecida');
    }

    try {
      const response = await fetch(this.contractData.termsUrl);
      if (!response.ok) throw new Error('Falha ao carregar termos');

      this.termsText = await response.text();
      this.renderTerms();
    } catch (error) {
      console.error('Terms load error from S3:', error);
      console.log('Attempting to load fallback terms...');
      
      try {
        const fallbackResponse = await fetch('/assets/terms-default.txt');
        if (!fallbackResponse.ok) throw new Error('Falha ao carregar termos padrão');

        this.termsText = await fallbackResponse.text();
        this.renderTerms();
        this.showToast('Usando versão padrão dos termos.', 'info');
      } catch (fallbackError) {
        console.error('Fallback terms load error:', fallbackError);
        this.showToast('Erro ao carregar termos. Tente novamente.', 'error');
        throw fallbackError;
      }
    }
  }

  renderTerms() {
    const termsContent = document.getElementById('assignTermsContent');
    if (!termsContent) return;

    termsContent.innerHTML = `
      <div class="assign-terms-text">
        ${this.escapeHtml(this.termsText).replace(/\n/g, '<br>')}
      </div>
    `;

    const progressBar = document.getElementById('assignTermsProgress');
    if (progressBar) {
      progressBar.hidden = false;
    }

    // Add scroll listener
    termsContent.addEventListener('scroll', () => this.handleTermsScroll());
  }

  handleTermsScroll() {
    const termsContent = document.getElementById('assignTermsContent');
    if (!termsContent) return;

    const scrollPercentage = (termsContent.scrollTop / (termsContent.scrollHeight - termsContent.clientHeight)) * 100;
    const scrollBar = document.getElementById('assignTermsScrollBar');

    if (scrollBar) {
      scrollBar.style.width = Math.min(scrollPercentage, 100) + '%';
    }

    // Enable checkbox when fully scrolled
    if (scrollPercentage >= 95) {
      this.termsScrolled = true;
      const checkbox = document.getElementById('assignAcceptTerms');
      if (checkbox) {
        checkbox.disabled = false;
      }
    }
  }

  displayContractInfo() {
    const data = this.contractData.signatureGymMember;
    const plan = this.contractData.plan;

    // Member info
    this.setElementText('assignUnitName', data.unitName || '—');
    this.setElementText('assignName', data.name || '—');
    this.setElementText('assignEmail', data.email || '—');
    this.setElementText('assignCpf', this.formatCPF(data.cpf) || '—');
    this.setElementText('assignPhone', this.formatPhone(data.phone) || '—');
    this.setElementText('assignBirthDate', data.birth_date || '—');
    this.setElementText('assignAge', data.age ? `${data.age} anos` : '—');
    this.setElementText('assignType', data.type === 'monthly' ? 'Mensal' : data.type || '—');
    this.setElementText('assignStartDate', data.startDate || '—');

    // Plan info
    this.setElementText('assignPlanName', plan.name || '—');
    this.setElementText('assignPlanGroup', plan.groupLabel || '—');
    this.setElementText('assignPlanPrice', plan.priceFrom ? `R$ ${plan.priceFrom.toFixed(2)}` : '—');
    this.setElementText('assignPlanMatricula', plan.matricula ? `R$ ${plan.matricula.toFixed(2)}` : 'Grátis');
  }

  setupUI() {
    // Navigation
    document.getElementById('assignNext')?.addEventListener('click', () => this.nextStep());
    document.getElementById('assignPrev')?.addEventListener('click', () => this.prevStep());
    document.getElementById('assignSubmit')?.addEventListener('click', (e) => this.handleSubmit(e));

    // Terms checkbox
    document.getElementById('assignAcceptTerms')?.addEventListener('change', (e) => {
      this.acceptedTerms = e.target.checked;
    });

    // Year in footer
    document.querySelectorAll('[data-year]').forEach(el => {
      el.textContent = new Date().getFullYear();
    });

    // Retry button
    document.getElementById('assignRetryBtn')?.addEventListener('click', () => {
      this.loadContractData();
    });
  }

  setupSignatureCanvas() {
    const canvas = document.getElementById('assignSignature');
    if (!canvas) return;

    // Set canvas resolution
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;

    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';

    // Touch and mouse events
    canvas.addEventListener('pointerdown', (e) => this.startDrawing(e, canvas, ctx));
    canvas.addEventListener('pointermove', (e) => this.draw(e, canvas, ctx));
    canvas.addEventListener('pointerup', () => this.stopDrawing(canvas));
    canvas.addEventListener('pointerleave', () => this.stopDrawing(canvas));

    // Buttons
    document.getElementById('assignSignSave')?.addEventListener('click', () => this.saveSignature(canvas));
    document.getElementById('assignSignClear')?.addEventListener('click', () => this.clearSignature(canvas, ctx));
    document.getElementById('assignSignUndo')?.addEventListener('click', () => this.undoStroke(canvas, ctx));
  }

  startDrawing(e, canvas, ctx) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * window.devicePixelRatio / window.devicePixelRatio;
    const y = (e.clientY - rect.top) * window.devicePixelRatio / window.devicePixelRatio;

    this.isDrawing = true;
    this.strokes.push([]);

    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  draw(e, canvas, ctx) {
    if (!this.isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * window.devicePixelRatio / window.devicePixelRatio;
    const y = (e.clientY - rect.top) * window.devicePixelRatio / window.devicePixelRatio;

    ctx.lineTo(x, y);
    ctx.stroke();

    const currentStroke = this.strokes[this.strokes.length - 1];
    if (currentStroke) {
      currentStroke.push({ x, y });
    }
  }

  stopDrawing(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.closePath();
    this.isDrawing = false;
  }

  undoStroke(canvas, ctx) {
    if (this.strokes.length === 0) return;

    this.strokes.pop();
    this.redrawSignature(canvas, ctx);
  }

  clearSignature(canvas, ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.strokes = [];
    this.signatureData = null;
    this.updateSignatureStatus();
  }

  redrawSignature(canvas, ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.strokes.forEach(stroke => {
      if (stroke.length === 0) return;

      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);

      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }

      ctx.stroke();
      ctx.closePath();
    });

    this.updateSignatureStatus();
  }

  saveSignature(canvas) {
    if (this.strokes.length === 0) {
      this.showError('Assinatura vazia', 'Por favor, assine no quadro antes de continuar.');
      return;
    }

    this.signatureData = canvas.toDataURL('image/png');
    this.showToast('Assinatura salva com sucesso!', 'success');
    this.updateSignatureStatus(true);
  }

  updateSignatureStatus(saved = false) {
    const status = document.getElementById('assignSignStatus');
    if (!status) return;

    if (saved) {
      status.textContent = '✓ Assinatura salva';
      status.style.color = 'var(--success-color, #28a745)';
    } else {
      status.textContent = this.strokes.length > 0 ? 'Assinatura não salva' : 'Nenhuma assinatura salva ainda.';
      status.style.color = '';
    }
  }

  async setupCamera() {
    const video = document.getElementById('assignCameraVideo');
    if (!video) return;

    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      video.srcObject = this.cameraStream;
      video.play();

      document.getElementById('assignCameraCapture')?.addEventListener('click', () => this.capturePhoto(video));
      document.getElementById('assignPhotoRetake')?.addEventListener('click', () => this.retakePhoto());
      document.getElementById('assignPhotoSave')?.addEventListener('click', () => this.savePhoto());
    } catch (error) {
      console.error('Camera access error:', error);
      this.showCameraError();
    }
  }

  capturePhoto(video) {
    const canvas = document.getElementById('assignPhotoCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    document.getElementById('assignCameraContainer').hidden = true;
    document.getElementById('assignPhotoPreview').hidden = false;
  }

  retakePhoto() {
    document.getElementById('assignCameraContainer').hidden = false;
    document.getElementById('assignPhotoPreview').hidden = true;
  }

  savePhoto() {
    const canvas = document.getElementById('assignPhotoCanvas');
    if (!canvas) return;

    this.photoData = canvas.toDataURL('image/png');
    this.showToast('Foto salva com sucesso!', 'success');
    document.getElementById('assignPhotoPreview').hidden = true;
    document.getElementById('assignCameraContainer').hidden = false;
  }

  showCameraError() {
    const container = document.getElementById('assignCameraContainer');
    if (!container) return;

    container.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 48px; height: 48px; margin: 0 auto 1rem; color: #dc3545;">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v5M12 16h.01"/>
        </svg>
        <p style="color: #666; margin-bottom: 1rem;">Não conseguimos acessar a câmera.</p>
        <p style="font-size: 0.9rem; color: #999;">Verifique se permitiu acesso à câmera neste navegador.</p>
      </div>
    `;
  }

  nextStep() {
    if (this.currentStep === 2 && !this.validateTerms()) {
      return;
    }

    if (this.currentStep === 3 && !this.signatureData) {
      this.showError('Assinatura necessária', 'Por favor, assine no quadro e clique em "Salvar assinatura".');
      return;
    }

    if (this.currentStep === 4 && !this.photoData) {
      this.showError('Foto necessária', 'Por favor, tire uma foto e clique em "Usar esta foto".');
      return;
    }

    if (this.currentStep < this.maxSteps) {
      this.currentStep++;
      this.updateStepUI();
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.updateStepUI();
    }
  }

  updateStepUI() {
    // Update step indicators
    document.querySelectorAll('.an-step').forEach(step => {
      const stepNum = parseInt(step.dataset.step);
      step.classList.toggle('is-current', stepNum === this.currentStep);
      step.classList.toggle('is-completed', stepNum < this.currentStep);
    });

    // Update blocks
    document.querySelectorAll('.an-block').forEach(block => {
      const blockNum = parseInt(block.dataset.block);
      block.hidden = blockNum !== this.currentStep;
    });

    // Update buttons
    const prevBtn = document.getElementById('assignPrev');
    const nextBtn = document.getElementById('assignNext');
    const submitBtn = document.getElementById('assignSubmit');

    if (prevBtn) prevBtn.hidden = this.currentStep === 1;
    if (nextBtn) nextBtn.hidden = this.currentStep === this.maxSteps;
    if (submitBtn) submitBtn.hidden = this.currentStep !== this.maxSteps;

    // Scroll to top
    document.querySelector('.an-panel')?.scrollIntoView({ behavior: 'smooth' });
  }

  validateTerms() {
    if (!this.acceptedTerms) {
      this.showError('Termos não aceitos', 'Por favor, aceite os termos para continuar.');
      return false;
    }

    if (!this.termsScrolled) {
      this.showError('Leia os termos', 'Por favor, role até o final dos termos antes de aceitar.');
      return false;
    }

    return true;
  }

  async handleSubmit(e) {
    e.preventDefault();

    if (!this.signatureData || !this.photoData) {
      this.showError('Dados incompletos', 'Por favor, complete todos os campos obrigatórios.');
      return;
    }

    this.showState('stSubmitting');
    const acceptedAt = new Date().toISOString();

    try {
      // Step 1: Upload photo
      await this.uploadPhoto();

      // Step 2: Finalize signature
      await this.finalizeSignature(acceptedAt);

      // Success
      this.showState('stSuccess');
      this.cleanupCamera();
    } catch (error) {
      console.error('Submission error:', error);
      this.showState('stForm');
      this.showError('Erro ao enviar dados', error.message);
    }
  }

  async uploadPhoto() {
    this.updateProgressStep('assignProgressPhoto', 'active');

    const formData = new FormData();
    const blob = await this.dataURLtoBlob(this.photoData);
    formData.append('file', blob, 'face.png');

    const response = await fetch(`/signature/${this.code}/photo`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Erro ao enviar foto: HTTP ${response.status}`);
    }

    this.updateProgressStep('assignProgressPhoto', 'done');
  }

  async finalizeSignature(acceptedAt) {
    this.updateProgressStep('assignProgressSign', 'active');

    const payload = {
      accepted_terms: true,
      terms_version: this.termsVersion,
      accepted_at: acceptedAt,
      signature: this.signatureData
    };

    const response = await fetch(`/signature/${this.code}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Erro ao finalizar: HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Erro desconhecido');
    }

    this.updateProgressStep('assignProgressSign', 'done');
  }

  updateProgressStep(elementId, status) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.classList.remove('is-active', 'is-done');
    if (status !== 'pending') {
      element.classList.add(`is-${status}`);
    }
  }

  cleanupCamera() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
    }
  }

  showState(stateId) {
    document.querySelectorAll('[id^="st"]').forEach(section => {
      section.hidden = section.id !== stateId;
    });
  }

  showError(title, message) {
    const errorTitle = document.getElementById('assignErrorTitle');
    const errorText = document.getElementById('assignErrorText');

    if (errorTitle) errorTitle.textContent = title;
    if (errorText) errorText.textContent = message;

    this.showState('stError');
  }

  showToast(message, type = 'info') {
    const toastsContainer = document.getElementById('assignToasts');
    if (!toastsContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      padding: 1rem;
      margin: 0.5rem;
      border-radius: 0.5rem;
      background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#007bff'};
      color: white;
      font-size: 0.9rem;
      animation: slideIn 0.3s ease-out;
    `;

    toastsContainer.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  // Utility methods
  async dataURLtoBlob(dataUrl) {
    const response = await fetch(dataUrl);
    return response.blob();
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  setElementText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  }

  formatCPF(cpf) {
    if (!cpf) return '';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  formatPhone(phone) {
    if (!phone) return '';
    if (phone.length === 11) {
      return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new AssignmentFlow();
});

// Add animation keyframes
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);
