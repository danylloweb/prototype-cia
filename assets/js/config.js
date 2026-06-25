/* ============================================================
   CIA DO CORPO — Configuração central / dados padrão (seed)
   Fonte única de verdade para o site público e o painel admin.
   A camada data-service.js sobrepõe esta seed com:
     backend API  >  localStorage (edições do admin)  >  esta seed
   ============================================================ */

window.CDC_DEFAULT_CONFIG = {
  meta: {
    version: 4,
    updatedAt: "2026-06-17",
    siteName: "Cia do Corpo",
    domain: "https://www.academiaciadocorpo.com",
    legalName: "ACADEMIA CIA DO CORPO LTDA",
    cnpj: "19.248.919/0001-27",
    email: "academiaciadocorpo2@gmail.com",
    partnerCentralWhatsapp: "5581989444888", // central que recebe "Quero ser parceiro"
    instagram: "https://www.instagram.com/academiaciadocorpo/",
    facebook: "https://www.facebook.com/ciadocorpope",
    yearsActive: 11,
    headOffice: "Av. Antônio da Costa Azevedo, 566 - Peixinhos, Olinda - PE, 53220-130",
    hours: [
      { d: "Segunda a Quinta", h: "5h às 23h" },
      { d: "Sexta-feira", h: "5h às 22h" },
      { d: "Sábado", h: "7h às 15h" },
      { d: "Domingo", h: "8h às 12h" }
    ]
  },

  /* IDs de telemetria — preencha com os reais no admin ou aqui */
  telemetry: {
    gtmId: "",          // ex: GTM-XXXXXXX
    ga4Id: "",          // ex: G-XXXXXXXXXX (se usar GA4 direto, sem GTM)
    metaPixelId: "",    // ex: 000000000000000
    clarityId: "",      // ex: xxxxxxxxxx
    capiEndpoint: "",   // endpoint server-side para Conversions API (opcional)
    consentRequired: true
  },

  /* Integrações / conexões de dados (editáveis no admin > Integrações).
     Os IDs de tag (gtm/ga4/pixel/clarity) acima entram em vigor no site
     assim que salvos. As conexões de API abaixo guardam credenciais/contas
     e ficam prontas para o sincronismo de dados (requer backend de coleta). */
  integrations: {
    googleAds:       { connected: false, accountId: "", customerId: "", devToken: "", note: "" },
    ga4:             { connected: false, propertyId: "", measurementId: "", apiSecret: "" },
    searchConsole:   { connected: false, siteUrl: "https://www.academiaciadocorpo.com/", note: "" },
    metaAds:         { connected: false, adAccountId: "", businessId: "", accessToken: "" },
    metaCapi:        { connected: false, datasetId: "", accessToken: "" },
    gtm:             { connected: false, containerId: "", apiKey: "" },
    googlePlaces:    { connected: false, apiKey: "", unitPlaceIds: {} }, // avaliações reais do Google por unidade
    custom:          []  // conexões adicionais definidas pela operação
  },

  /* Oferta principal (cabeçalho de campanha) */
  offer: {
    enabled: true,
    badge: "3 dias grátis",
    title: "Experimente 3 dias de aulas gratuitas",
    subtitle: "Sem compromisso. Escolha sua unidade e agende pelo WhatsApp."
  },

  /* Unidades — CRUD pelo admin */
  units: [
    {
      id: "avenida-norte", name: "Avenida Norte", tier: "standard", active: true,
      city: "Recife", neighborhood: "Casa Amarela",
      address: "Av. Norte Miguel Arraes de Alencar, 6350 - Casa Amarela, Recife - PE, 52071-035",
      phone: "(81) 98943-1738", whatsapp: "5581989431738",
      maps: "https://g.co/kgs/MDRq364", lat: -8.0186, lng: -34.9176,
      image: "https://static.wixstatic.com/media/837beb_499306147b234bbba67f42b5ece6e17b~mv2.png/v1/fill/w_900,h_560,al_c,q_85,enc_auto/AN.png"
    },
    {
      id: "ouro-preto", name: "Ouro Preto", tier: "standard", active: true,
      city: "Olinda", neighborhood: "Ouro Preto",
      address: "Av. Argentina Castelo Branco, 175 - Ouro Preto, Olinda - PE, 53370-540",
      phone: "(81) 98943-8592", whatsapp: "5581989438592",
      maps: "https://maps.app.goo.gl/zuVMjNU1khcbtVf59", lat: -8.0050, lng: -34.8550,
      image: "https://static.wixstatic.com/media/837beb_8f209da034064d0ba9628a9fd9d204ca~mv2.png/v1/fill/w_900,h_560,al_c,q_85,enc_auto/OP.png"
    },
    {
      id: "peixinhos", name: "Peixinhos", tier: "standard", active: true,
      city: "Olinda", neighborhood: "Peixinhos",
      address: "Av. Antônio da Costa Azevedo, 566 - Peixinhos, Olinda - PE, 53220-130",
      phone: "(81) 98944-4888", whatsapp: "5581989444888",
      maps: "https://maps.app.goo.gl/AtURzTjUgjaZowK16", lat: -8.0186, lng: -34.8839,
      image: "https://static.wixstatic.com/media/837beb_2eb8474fbd2a464eaf0460616efe4ebc~mv2.jpg/v1/fill/w_900,h_560,al_c,q_85,enc_auto/PX.jpg"
    },
    {
      id: "afogados", name: "Afogados", tier: "exclusive", active: true,
      city: "Recife", neighborhood: "Afogados",
      address: "R. São Miguel, 893 - Afogados, Recife - PE, 50850-000",
      phone: "(81) 98943-4807", whatsapp: "5581989434807",
      maps: "https://maps.app.goo.gl/oLBbLy97QV9abz8Z6", lat: -8.0769, lng: -34.9069,
      image: "https://static.wixstatic.com/media/837beb_41a09b408639439bb12a7153cc3ace0a~mv2.png/v1/fill/w_900,h_560,al_c,q_85,enc_auto/AFG.png"
    },
    {
      id: "agua-fria", name: "Água Fria", tier: "exclusive", active: true,
      city: "Recife", neighborhood: "Beberibe",
      address: "Av. Beberibe, 2600 - Beberibe, Recife - PE, 52130-035",
      phone: "(81) 98943-2074", whatsapp: "5581989432074",
      maps: "https://maps.app.goo.gl/67mnmfj3dFcoeNuq6", lat: -8.0086, lng: -34.8919,
      image: "https://static.wixstatic.com/media/837beb_f6a67ac9cc3c4ef99ca13852a6d51fac~mv2.png/v1/fill/w_900,h_560,al_c,q_85,enc_auto/AGUA.png"
    },
    {
      id: "bomba-do-hemeterio", name: "Bomba do Hemetério", tier: "exclusive", active: true,
      city: "Recife", neighborhood: "Bomba do Hemetério",
      address: "R. Padre Oliveira, 772 - Bomba do Hemetério, Recife - PE, 52080-130",
      phone: "(81) 98943-8666", whatsapp: "5581989438666",
      maps: "https://maps.app.goo.gl/9XnC4tkLJmyRwLpS8", lat: -8.0156, lng: -34.9039,
      image: "https://static.wixstatic.com/media/837beb_2c803543c9ed44bca7967e30d6a6b7e4~mv2.png/v1/fill/w_900,h_560,al_c,q_85,enc_auto/BOMBA.png"
    },
    {
      id: "areias", name: "Areias", tier: "standard", active: true,
      city: "Recife", neighborhood: "Areias - Estância",
      address: "R. Tucunaré, 55 - Areias, Recife - PE, 50771-510",
      phone: "(81) 98734-8391", whatsapp: "5581987348391",
      maps: "https://maps.app.goo.gl/tpCzs3X7ZokMmWkB9", lat: -8.0900, lng: -34.9250,
      image: "https://static.wixstatic.com/media/837beb_404fa4604f4f4a49b83a89f308971e71~mv2.jpg/v1/fill/w_900,h_560,al_c,q_85,enc_auto/AREIAS.jpg"
    }
  ],

  /* Popups / campanhas — gestão pelo admin */
  popups: [
    {
      id: "trial-3dias",
      active: true,
      name: "Entrada — Você ganhou 3 dias grátis",
      headline: "Você ganhou 3 dias grátis!",
      body: "Presente de boas-vindas: 3 dias de treino por nossa conta em qualquer unidade. Garanta agora pelo WhatsApp e venha conhecer a melhor estrutura de Recife e Olinda.",
      image: "https://static.wixstatic.com/media/837beb_e7ad92872603473f9464213607d84fe9~mv2.png/v1/fill/w_900,h_560,al_c,q_85,enc_auto/kv.png",
      ctaLabel: "Quero garantir meus 3 dias",
      ctaType: "whatsapp",          // whatsapp | link | scroll
      ctaTarget: "",               // se whatsapp vazio, usa unidade selecionada/padrão
      trigger: "time",             // time | scroll | exit | load
      triggerValue: 7,             // segundos (time) ou % (scroll)
      frequency: "session",        // session | daily | always
      pages: ["all"],              // all | index | unidades | planos ...
      startDate: "", endDate: "",  // agendamento opcional (YYYY-MM-DD)
      theme: "brand"               // brand | dark | light
    },
    {
      id: "exit-3dias",
      active: true,
      name: "Saída — Não perca os 3 dias",
      headline: "Espera! Não perca seus 3 dias grátis",
      body: "Antes de sair: seus 3 dias de treino gratuitos ainda estão valendo. Garanta agora pelo WhatsApp — é rápido e sem compromisso.",
      image: "assets/img/destaque-forca.avif",
      ctaLabel: "Quero garantir antes de sair",
      ctaType: "whatsapp", ctaTarget: "",
      trigger: "exit", triggerValue: 0,
      frequency: "session", pages: ["all"],
      startDate: "", endDate: "", theme: "dark"
    }
  ],

  /* Grade de aulas (fictícia — edite no admin > Grade de Aulas).
     unit: "all" vale para todas as unidades, ou use o id da unidade. */
  classesGrid: [
    { day: "Segunda", time: "06:00", name: "Funcional", unit: "all" },
    { day: "Segunda", time: "08:00", name: "Pilates", unit: "all" },
    { day: "Segunda", time: "18:00", name: "Muay Thai", unit: "all" },
    { day: "Segunda", time: "19:00", name: "Zumba", unit: "all" },
    { day: "Terça", time: "06:00", name: "HIIT", unit: "all" },
    { day: "Terça", time: "09:00", name: "Alongamento", unit: "all" },
    { day: "Terça", time: "18:00", name: "Jump", unit: "all" },
    { day: "Terça", time: "19:00", name: "Cross Training", unit: "all" },
    { day: "Quarta", time: "06:00", name: "Funcional", unit: "all" },
    { day: "Quarta", time: "18:00", name: "Muay Thai", unit: "all" },
    { day: "Quarta", time: "19:00", name: "Pump", unit: "all" },
    { day: "Quinta", time: "06:00", name: "HIIT", unit: "all" },
    { day: "Quinta", time: "18:00", name: "Ritbox", unit: "all" },
    { day: "Quinta", time: "19:00", name: "Zumba", unit: "all" },
    { day: "Sexta", time: "06:00", name: "Funcional", unit: "all" },
    { day: "Sexta", time: "17:00", name: "Step", unit: "all" },
    { day: "Sexta", time: "18:00", name: "Muay Thai", unit: "all" },
    { day: "Sábado", time: "09:00", name: "Cross Training", unit: "all" },
    { day: "Sábado", time: "10:00", name: "Alongamento", unit: "all" }
  ],

  testimonials: [
    { name: "Kassio Campos", role: "Aluno da Cia do Corpo", stars: 5, text: "Top de linha, super indico. É de equipamento a funcionários… show de bola! Parabéns!" },
    { name: "Gilberto Epifânio", role: "Aluno da Cia do Corpo", stars: 5, text: "Estrutura e maquinários excelentes! Atendimento impecável!" },
    { name: "Glauston Paes Siqueira", role: "Aluno da Cia do Corpo", stars: 5, text: "Essa academia é perfeita em tudo, principalmente o atendimento. São muito educados e atenciosos." }
  ],

  partners: ["LOCAPE", "SINTRAH", "AFPPE", "LP", "PROVINDER"],

  /* Clube da Parceria — diretório dinâmico e filtrável (editável no admin).
     Parceiros reais da Cia do Corpo. O WhatsApp do botão "Garantir benefício"
     é derivado do telefone (DDI 55). */
  partnerCategories: ["Saúde", "Beleza", "Moda", "Serviços", "Educação", "Viagem", "Pet"],
  partnersClub: [
    { name: "Farmácia Roval Olinda", category: "Saúde", benefit: "Desconto exclusivo para alunos", city: "Casa Caiada, Olinda", address: "Av. Doutor José Augusto Moreira, 491 - Casa Caiada, Olinda - PE", instagram: "rovalolinda", phone: "(81) 3011-2915", featured: true },
    { name: "Couto Odontologia", category: "Saúde", benefit: "Condição especial para alunos", city: "Peixinhos, Olinda", address: "Av. Presidente Kennedy, 3111 - Peixinhos, Olinda - PE", instagram: "coutodontologia", phone: "(81) 98866-8831", featured: true },
    { name: "Kumon Olinda", category: "Educação", benefit: "Bolsa e desconto para alunos", city: "Olinda", address: "Rua Francisco Ambrósio de Barros Leite, 131 - Olinda - PE", instagram: "kumonolinda", phone: "(81) 99694-9000", featured: true },
    { name: "Donna Lingerie", category: "Moda", benefit: "Desconto exclusivo para alunos", city: "Olinda", address: "Rua Francisco Ambrósio de Barros Leite, 131, loja 01", instagram: "donnalingerieof", phone: "(81) 99388-8641" },
    { name: "Tu Vens Trip", category: "Viagem", benefit: "Condições especiais para alunos", city: "Atendimento online", instagram: "tuvenstrip", phone: "(81) 99721-8362" },
    { name: "Lavanderia Jalavouriodoce", category: "Serviços", benefit: "Desconto para alunos", city: "Rio Doce, Olinda", address: "Av. das Garças, 90 - Rio Doce", instagram: "jalavouriodoce", phone: "(81) 99516-9238" },
    { name: "Pet Praia Olinda", category: "Pet", benefit: "Desconto exclusivo para alunos", city: "Casa Caiada, Olinda", address: "Rua Tomaz Antônio Guimarães, 21 - Casa Caiada", instagram: "petpraiaolinda", phone: "(81) 99710-7126" },
    { name: "Portal Stetic", category: "Beleza", benefit: "Condição especial para alunos", city: "Olinda", address: "Av. Doutor José Augusto Moreira, 975, casa 10", instagram: "portalstetic", phone: "(81) 98844-1496" },
    { name: "Esmalteria Juliana Morim", category: "Beleza", benefit: "Condição especial para alunos", city: "Jardim Atlântico, Olinda", address: "Rua Fritelaria, 45 - Jardim Atlântico", instagram: "esmalteriajulianamorim", phone: "(81) 99185-0914" },
    { name: "Espaço Day Sandrelly", category: "Beleza", benefit: "Condição especial para alunos", city: "Bairro Novo, Olinda", address: "Av. Presidente Getúlio Vargas, 1411 - Bairro Novo", instagram: "daysandrellybeleza", phone: "(81) 99713-0083" },
    { name: "Emídio Terceiro — dōTERRA", category: "Saúde", benefit: "Consultoria de bem-estar com desconto", city: "Atendimento online", instagram: "aromatizapernambuco", phone: "(81) 97913-8793" },
    { name: "ABOK Nutrition", category: "Saúde", benefit: "Desconto exclusivo para alunos", city: "Campo Grande", address: "Rua Jerônimo Vilela, 297 - Campo Grande", instagram: "aboknutrition", phone: "(81) 99423-1251" },
    { name: "Donatokeila Moda Feminina", category: "Moda", benefit: "Desconto exclusivo para alunos", city: "Atendimento online", instagram: "donatokeila_.moda_feminina", phone: "(81) 99699-9815" },
    { name: "Cia Imports", category: "Serviços", benefit: "Desconto para alunos", city: "Recife & Olinda", instagram: "ciaimports.br", phone: "(81) 99886-0935" },
    { name: "Publicité — Branding e Performance", category: "Serviços", benefit: "Condição especial para alunos", city: "Recife & Olinda", instagram: "publiciteoficial_", phone: "(81) 99843-3946" },
    { name: "RF Moda Fitness", category: "Moda", benefit: "Desconto exclusivo para alunos", city: "Casa Caiada, Olinda", address: "Av. Carlos de Lima Cavalcante, 2795, loja 04 - Casa Caiada", instagram: "rfmodafitnnes", phone: "(81) 98874-3412" },
    { name: "Farmácia São Severino", category: "Saúde", benefit: "Desconto exclusivo para alunos", city: "Rio Doce, Olinda", address: "Rua Estudante Claudio Uchoa Cavalcanti Filho, 01 - Rio Doce", instagram: "farmaciassaoseverino", phone: "(81) 98432-1686" },
    { name: "Barbearia START", category: "Beleza", benefit: "Condição especial para alunos", city: "Olinda", address: "Rua Caetano Ribeiro, 262", instagram: "barbeariastart", phone: "(81) 99985-4261" },
    { name: "Raphael Lima — Planos de Saúde", category: "Saúde", benefit: "Condições especiais em planos e seguros", city: "Atendimento online", instagram: "raphael.planosdesaude", phone: "(81) 99800-0219" },
    { name: "Akitem Imóvel", category: "Serviços", benefit: "Condição especial para alunos", city: "Jardim Atlântico, Olinda", address: "Av. Fagundes Varela, 365, sala 7 - Jardim Atlântico", instagram: "akitemimovel", phone: "(81) 99679-0310" },
    { name: "Lancerr Contabilidade", category: "Serviços", benefit: "Condição especial para alunos", city: "Casa Caiada, Olinda", address: "Rua Otaviano Pessoa Monteiro, 627, sala 10 - Casa Caiada", instagram: "lancerr.contabilidade", phone: "(81) 98822-7342" },
    { name: "Troca de Óleo Garagem", category: "Serviços", benefit: "Desconto para alunos", city: "Casa Caiada, Olinda", address: "Av. Gov. Carlos de Lima Cavalcante, 2295 - Casa Caiada", instagram: "trocadeoleo.garagem", phone: "(81) 99846-9643" }
   ],

   /* Planos — estrutura por unidade/tier. Valores específicos por grupo de unidades. */
   plans: {
     /* TIER EXCLUSIVE — Areias, Afogados, Água Fria, Bomba do Hemetério */
     "exclusive": {
       tier: "exclusive",
       unitsLabel: "Areias, Afogados, Água Fria, Bomba do Hemetério",
       unitIds: ["areias", "afogados", "agua-fria", "bomba-do-hemeterio"],
       items: [
         {
           id: "basic-plus", name: "Basic+", price: "R$ 109,99", period: "/mês",
           enrollment: "+ R$ 50,00", description: "Flexibilidade com recorrência segura",
           features: ["Musculação livre", "Aulas coletivas", "Artes marciais", "Acesso a 4 unidades", "Sem comprometer limite do cartão"],
           badges: [{ label: "Não compromete limite", type: "success" }],
           featured: false
         },
         {
           id: "annual-vip", name: "Anual VIP", price: "12x de R$ 99,90", total: "R$ 1.198,80",
           enrollment: "+ R$ 50,00", description: "Plano anual com melhor custo-benefício",
           features: ["Musculação livre", "Aulas coletivas", "Artes marciais", "Acesso a 4 unidades"],
           badges: [{ label: "Compromete limite do cartão", type: "warning" }, { label: "120 dias de carência", type: "info" }],
           featured: true
         },
         {
           id: "monthly", name: "Mensal", price: "R$ 150,00", period: "/mês",
           enrollment: "+ R$ 50,00", description: "Máxima flexibilidade",
           features: ["Musculação livre", "Aulas coletivas", "Artes marciais", "Acesso a 4 unidades"],
           badges: [],
           featured: false
         }
       ]
     },
     /* TIER STANDARD — Av. Norte, Ouro Preto, Peixinhos */
     "standard": {
       tier: "standard",
       unitsLabel: "Av. Norte, Ouro Preto, Peixinhos",
       unitIds: ["avenida-norte", "ouro-preto", "peixinhos"],
       items: [
         {
           id: "basic-plus", name: "Basic+", price: "R$ 129,99", period: "/mês",
           enrollment: "+ R$ 50,00", description: "Flexibilidade com recorrência segura",
           features: ["Musculação livre", "Aulas coletivas", "Artes marciais", "Acesso a TODAS as 7 unidades", "Sem comprometer limite", "30 dias de carência"],
           badges: [{ label: "Não compromete limite", type: "success" }, { label: "Carência 30 dias", type: "info" }],
           featured: false
         },
         {
           id: "annual-vip", name: "Anual VIP", price: "12x de R$ 109,90", total: "R$ 1.318,80",
           enrollment: "+ R$ 50,00", description: "Melhor custo-benefício para acesso total",
           features: ["Musculação livre", "Aulas coletivas", "Artes marciais", "Acesso a TODAS as 7 unidades"],
           badges: [{ label: "Compromete limite do cartão", type: "warning" }, { label: "120 dias de carência", type: "info" }],
           featured: true
         },
         {
           id: "monthly", name: "Mensal", price: "R$ 160,00", period: "/mês",
           enrollment: "+ R$ 50,00", description: "Máxima flexibilidade",
           features: ["Musculação livre", "Aulas coletivas", "Artes marciais", "Acesso a TODAS as 7 unidades"],
           badges: [],
           featured: false
         }
       ]
     }
   },

   /* Acesso ao painel admin (demo). Em produção use o backend + hash. */
   admin: {
     user: "admin",
     // senha padrão de demonstração: ciadocorpo2026  (troque no primeiro acesso)
     passHint: "ciadocorpo2026"
   }
 };
