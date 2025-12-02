import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { RequestCard } from './components/RequestCard';
import { AppScreen, HelpRequest, RequestType, User, AppNotification } from './types';
import { enhanceRequestContent, generateCommunityTip } from './services/geminiService';
import { dbService, isOnlineMode } from './services/databaseService';
import { MapPin, Bell, Shield, Heart, Zap, Loader2, Sparkles, Send, Award, ArrowRight, User as UserIcon, Share2, Users, CheckCircle2, CloudOff, CloudLightning, Filter, Home, Globe, Map, Copy } from 'lucide-react';

export default function App() {
  // --- STATE MANAGEMENT ---
  const [user, setUser] = useState<User | null>(null);
  
  // Onboarding States
  const [onboardingName, setOnboardingName] = useState('');
  const [onboardingHood, setOnboardingHood] = useState('');
  const [onboardingCity, setOnboardingCity] = useState('');
  const [onboardingState, setOnboardingState] = useState('');
  
  const [screen, setScreen] = useState<AppScreen>(AppScreen.FEED);
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [dailyTip, setDailyTip] = useState<string>('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // Filters - Hierarchy: Country -> State -> City -> Hood
  const [filterScope, setFilterScope] = useState<'GLOBAL' | 'STATE' | 'CITY' | 'HOOD'>('GLOBAL');
  const [filterCategory, setFilterCategory] = useState<'ALL' | RequestType>('ALL');

  // Create Request State
  const [newRequestTitle, setNewRequestTitle] = useState('');
  const [newRequestText, setNewRequestText] = useState('');
  const [newRequestType, setNewRequestType] = useState<RequestType>(RequestType.BORROW);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedData, setEnhancedData] = useState<{text: string, tip: string, encouragement: string} | null>(null);

  // Notifications
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // --- INITIALIZATION ---
  useEffect(() => {
    // 1. Load User
    const savedUser = dbService.getUser();
    
    // Check if user has the new location structure. If not, force re-login/update.
    if (savedUser && savedUser.location) {
      setUser(savedUser);
      setOnboardingHood(savedUser.location.neighborhood);
      setOnboardingCity(savedUser.location.city);
      setOnboardingState(savedUser.location.state);
      // Se tiver usuário, foca na cidade dele
      setFilterScope('CITY');
    } else {
        if(savedUser) dbService.clearLocal();
    }
    
    // 2. Load Requests
    loadRequests();

    // 3. Daily Tip
    generateCommunityTip().then(setDailyTip);

    // 4. Check notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Poll for updates if online and Notification Listener
  useEffect(() => {
      // Se não tiver user, ainda carregamos pedidos, mas sem notificações pessoais
      if (!user && isOnlineMode()) {
        const interval = setInterval(() => {
            loadRequests();
        }, 10000);
        return () => clearInterval(interval);
      }

      if (!user) return;
      
      const interval = setInterval(() => {
          if (isOnlineMode()) {
              loadRequests();
          }
      }, 10000);

      const subscription = dbService.subscribeToNotifications(user.id, (notification) => {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.play().catch(e => console.log('Audio play failed', e));
          
          triggerToast(`🔔 ${notification.message}`);
          
          // Enhanced Push Notification
          const title = notification.fromUserName 
            ? `${notification.fromUserName} ofereceu ajuda! 🤝` 
            : 'Nova interação no seu pedido';
            
          sendPushNotification(title, notification.message);
      });
      
      return () => {
          clearInterval(interval);
          if (subscription) subscription.unsubscribe();
      };
  }, [user]);

  const loadRequests = async () => {
      setIsLoadingRequests(true);
      const data = await dbService.getRequests();
      setRequests(data);
      setIsLoadingRequests(false);
  };

  // --- HANDLERS ---

  const requestNotifyPermission = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      new Notification('Liga Urbana', { 
        body: 'Notificações ativadas! Avisaremos quando alguém puder ajudar.',
        icon: 'https://cdn-icons-png.flaticon.com/512/3119/3119338.png'
      });
    }
  };

  const handleLogin = async () => {
    if (!onboardingName.trim() || !onboardingHood.trim() || !onboardingCity.trim()) return;
    setIsLoginLoading(true);
    
    const uniqueId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newUser: User = {
      id: uniqueId,
      name: onboardingName,
      avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${uniqueId}`,
      location: {
          neighborhood: onboardingHood,
          city: onboardingCity,
          state: onboardingState || 'BR',
          country: 'Brasil'
      },
      distance: '0m',
      reputation: { reliability: 5.0, speed: 5.0, kindness: 5.0, totalFavors: 0 }
    };
    
    await dbService.saveUser(newUser);
    setUser(newUser);
    setFilterScope('CITY'); // Switch view to local
    setIsLoginLoading(false);
    requestNotifyPermission();
  };

  const handleLogout = () => {
      dbService.clearLocal();
      setUser(null);
      setRequests([]);
      setOnboardingName('');
      setOnboardingHood('');
      setOnboardingCity('');
      setOnboardingState('');
      setScreen(AppScreen.FEED); // Volta pro inicio
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  };

  const sendPushNotification = (title: string, body: string) => {
      if (notificationPermission === 'granted') {
          try {
            new Notification(title, { 
                body, 
                icon: 'https://cdn-icons-png.flaticon.com/512/3119/3119338.png',
                vibrate: [200, 100, 200], // Padrão de vibração
                tag: 'liga-urbana-interaction', // Agrupa notificações similares
                renotify: true // Garante que vibre/toque mesmo se houver outra notificação antiga
            } as any);
          } catch(e) { console.log("Notification failed", e); }
      }
  };

  const handleOfferHelp = async (requestId: string) => {
    if (!user) {
        setScreen(AppScreen.CREATE); // Redirect to login/register flow
        triggerToast("Cadastre-se rapidinho para oferecer ajuda!");
        return;
    }
    const request = requests.find(r => r.id === requestId);
    if (!request) return;

    // Mensagem detalhada para o banco de dados e notificação
    const message = `${user.name} ofereceu ajuda no seu pedido: "${request.title}"`;

    const notification: AppNotification = {
        toUserId: request.userId,
        fromUserId: user.id,
        fromUserName: user.name,
        message: message,
        requestId: requestId,
        read: false,
        timestamp: Date.now()
    };

    await dbService.sendNotification(notification);
    triggerToast('Você ofereceu ajuda! O vizinho será notificado agora.');
  };

  const handleResolveRequest = async (requestId: string) => {
      const confirm = window.confirm("Você confirma que recebeu ajuda e quer encerrar este pedido?");
      if (!confirm) return;

      await dbService.updateRequestStatus(requestId, 'COMPLETED');
      setRequests(prev => prev.map(r => r.id === requestId ? {...r, status: 'COMPLETED'} : r));
      triggerToast('Que ótimo! Pedido concluído com sucesso.');
      sendPushNotification('Pedido Concluído', 'Parabéns por fortalecer a comunidade! +5 pontos de reputação.');
  };

  const handleShare = async () => {
    const cleanUrl = window.location.href; // Use full URL for preview context
    const locationStr = user?.location ? `${user.location.neighborhood}, ${user.location.city}` : 'nossa comunidade';
    
    const shareData = {
      title: 'Liga Urbana - Ajuda entre vizinhos',
      text: `Olá! Estou usando o *Liga Urbana* para conectar vizinhos e trocar ajuda aqui em ${locationStr}. Precisamos de gente confiável como você. \n\nEntre na nossa liga aqui:`,
      url: cleanUrl,
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        throw new Error("Share API not supported");
      }
    } catch (err) {
      try {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        triggerToast('Link copiado! Cole no WhatsApp dos vizinhos.');
      } catch (clipboardErr) {
        triggerToast('Não foi possível copiar automaticamente.');
      }
    }
  };
  
  const handleCopyLink = () => {
      const cleanUrl = window.location.href;
      navigator.clipboard.writeText(cleanUrl).then(() => {
          triggerToast('Link copiado com sucesso!');
      });
  };

  const handleCreateRequest = async () => {
    setIsEnhancing(true);
    const enhancement = await enhanceRequestContent(newRequestText, newRequestType);
    setEnhancedData({
        text: enhancement.improvedText,
        tip: enhancement.safetyTip,
        encouragement: enhancement.encouragement
    });
    setIsEnhancing(false);
  };

  const confirmPost = async () => {
    if (!enhancedData || !user) return;
    const locLabel = `${user.location.neighborhood}, ${user.location.city}`;
    const newRequest: HelpRequest = {
      id: Date.now().toString(),
      userId: user.id,
      user: user,
      type: newRequestType,
      title: newRequestTitle || (newRequestType === RequestType.URGENCY ? 'Pedido Urgente' : 'Novo Pedido'),
      description: enhancedData.text,
      timestamp: Date.now(),
      status: 'OPEN',
      locationLabel: locLabel,
      aiSafetyTip: enhancedData.tip
    };

    await dbService.createRequest(newRequest);
    setRequests(prev => [newRequest, ...prev]);
    setNewRequestText('');
    setNewRequestTitle('');
    setEnhancedData(null);
    setScreen(AppScreen.FEED);
    triggerToast('Pedido publicado com sucesso!');
  };

  const renderRegistration = () => (
    <div className="pb-32 pt-4 px-4 min-h-full flex flex-col items-center justify-center animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mb-6">
          <Heart className="w-10 h-10 text-teal-600" fill="currentColor" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2 text-center">Vamos criar seu perfil</h2>
        <p className="text-slate-500 mb-8 max-w-[260px] text-center text-sm">Para fazer um pedido ou oferecer ajuda, a comunidade precisa saber quem você é e onde está.</p>

        <div className="w-full max-w-sm space-y-4">
          <div className="text-left">
            <label className="text-xs font-bold text-slate-700 uppercase ml-1">Seu Nome</label>
            <input 
              type="text" 
              value={onboardingName}
              onChange={(e) => setOnboardingName(e.target.value)}
              placeholder="Ex: Ana Silva"
              className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl focus:border-teal-500 focus:outline-none transition-colors font-semibold text-slate-800"
            />
          </div>
          <div className="text-left">
            <label className="text-xs font-bold text-slate-700 uppercase ml-1">Bairro</label>
            <input 
              type="text" 
              value={onboardingHood}
              onChange={(e) => setOnboardingHood(e.target.value)}
              placeholder="Ex: Vila Madalena"
              className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl focus:border-teal-500 focus:outline-none transition-colors font-semibold text-slate-800"
            />
          </div>
          <div className="flex gap-3">
            <div className="text-left flex-[2]">
                <label className="text-xs font-bold text-slate-700 uppercase ml-1">Cidade</label>
                <input 
                type="text" 
                value={onboardingCity}
                onChange={(e) => setOnboardingCity(e.target.value)}
                placeholder="Ex: São Paulo"
                className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl focus:border-teal-500 focus:outline-none transition-colors font-semibold text-slate-800"
                />
            </div>
            <div className="text-left flex-1">
                <label className="text-xs font-bold text-slate-700 uppercase ml-1">UF</label>
                <input 
                type="text" 
                value={onboardingState}
                onChange={(e) => setOnboardingState(e.target.value.toUpperCase())}
                placeholder="SP"
                maxLength={2}
                className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl focus:border-teal-500 focus:outline-none transition-colors font-semibold text-slate-800 text-center"
                />
            </div>
          </div>
        </div>
        <div className="mt-8 pt-2 w-full max-w-sm">
            <button 
            onClick={handleLogin}
            disabled={!onboardingName || !onboardingHood || !onboardingCity || isLoginLoading}
            className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl transition-all flex items-center justify-center gap-2 ${
                (onboardingName && onboardingHood && onboardingCity) ? 'bg-slate-900 text-white translate-y-0' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            >
            {isLoginLoading ? <Loader2 className="animate-spin" /> : 'Salvar e Continuar'}
            </button>
      </div>
    </div>
  );

  const renderFeed = () => {
    const userLoc = user?.location;
    const locString = userLoc ? `${userLoc.neighborhood} - ${userLoc.city}` : 'Brasil (Visitante)';

    // --- FILTER LOGIC (Revised) ---
    const filteredRequests = requests.filter(req => {
        if (!req.user) return false;
        
        // Category Filter
        if (filterCategory !== 'ALL' && req.type !== filterCategory) return false;

        // Scope Filter (Hierarchy)
        if (filterScope === 'GLOBAL') return true; // Show Everything (Brazil)

        // Se não tiver user, só mostra global mesmo se tentar filtrar
        if (!userLoc) return true;

        const reqHood = req.user.location?.neighborhood?.toLowerCase() || '';
        const reqCity = req.user.location?.city?.toLowerCase() || '';
        const reqState = req.user.location?.state?.toLowerCase() || '';
        
        const myHood = userLoc?.neighborhood?.toLowerCase() || '';
        const myCity = userLoc?.city?.toLowerCase() || '';
        const myState = userLoc?.state?.toLowerCase() || '';

        if (filterScope === 'STATE') return reqState === myState;
        if (filterScope === 'CITY') return reqCity === myCity;
        if (filterScope === 'HOOD') return reqHood === myHood && reqCity === myCity;

        return true;
    });

    return (
    <div className="pb-32 pt-4 px-4 min-h-full">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">
             {user ? `Olá, ${user.name.split(' ')[0]}!` : 'Olá, Vizinho!'}
          </h1>
          <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={12} /> {locString}</p>
        </div>
        <div className="flex items-center gap-2">
            <div className={`px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 border ${isOnlineMode() ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                {isOnlineMode() ? <CloudLightning size={10} /> : <CloudOff size={10} />}
                {isOnlineMode() ? 'ONLINE' : 'OFFLINE'}
            </div>
            <button onClick={requestNotifyPermission} className={`relative p-2 rounded-full shadow-sm transition-colors ${notificationPermission === 'granted' ? 'bg-teal-50 text-teal-600' : 'bg-white text-slate-600'}`}>
                <Bell size={20} />
                {notificationPermission === 'granted' && <span className="absolute top-2 right-2.5 w-2 h-2 bg-teal-500 rounded-full"></span>}
            </button>
        </div>
      </div>

      {/* FILTER BAR - Hierarchy */}
      <div className="mb-6 space-y-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
             <button onClick={() => setFilterScope('GLOBAL')} className={`flex-shrink-0 flex items-center justify-center gap-1 px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterScope === 'GLOBAL' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}>
                  <Globe size={14} /> Brasil (Todos)
              </button>
              
              {user && (
                  <>
                    <button onClick={() => setFilterScope('STATE')} className={`flex-shrink-0 flex items-center justify-center gap-1 px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterScope === 'STATE' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}>
                        <Map size={14} /> Meu Estado
                    </button>
                    <button onClick={() => setFilterScope('CITY')} className={`flex-shrink-0 flex items-center justify-center gap-1 px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterScope === 'CITY' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}>
                        <MapPin size={14} /> Minha Cidade
                    </button>
                    <button onClick={() => setFilterScope('HOOD')} className={`flex-shrink-0 flex items-center justify-center gap-1 px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterScope === 'HOOD' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}>
                        <Home size={14} /> Meu Bairro
                    </button>
                  </>
              )}
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 border-t border-slate-100 pt-3">
              <button onClick={() => setFilterCategory('ALL')} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${filterCategory === 'ALL' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-500 border-slate-200'}`}>Todas</button>
              {Object.values(RequestType).map(type => (
                  <button key={type} onClick={() => setFilterCategory(type)} className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${filterCategory === type ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-white text-slate-500 border-slate-200'}`}>{type}</button>
              ))}
          </div>
      </div>

      <div className="bg-gradient-to-r from-teal-500 to-emerald-500 rounded-2xl p-4 mb-6 shadow-lg shadow-teal-100 text-white relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mb-1">Inspiração</p>
          <p className="text-sm font-medium leading-relaxed">"{dailyTip}"</p>
        </div>
        <Sparkles className="absolute -bottom-2 -right-2 text-white opacity-20 w-24 h-24" />
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-end mb-2">
            <h2 className="text-lg font-bold text-slate-800">
                {filterScope === 'GLOBAL' && "Em todo o Brasil"}
                {filterScope === 'STATE' && `No Estado (${user?.location.state})`}
                {filterScope === 'CITY' && `Em ${user?.location.city}`}
                {filterScope === 'HOOD' && `No Bairro ${user?.location.neighborhood}`}
            </h2>
            <span className="text-xs text-slate-400 font-medium">({filteredRequests.length})</span>
        </div>
        
        {isLoadingRequests ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-teal-500" size={32} /></div>
        ) : filteredRequests.length === 0 ? (
             <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                 <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"><Filter className="text-slate-300" size={24} /></div>
                 <p className="text-slate-800 font-bold">Nenhum pedido aqui</p>
                 <p className="text-sm text-slate-500 max-w-[200px] mx-auto mt-1">Expanda o filtro para "Cidade" ou "Brasil" para ver mais!</p>
             </div>
        ) : (
            filteredRequests.map(req => (
            <RequestCard key={req.id} request={req} onHelp={handleOfferHelp} onResolve={handleResolveRequest} currentUserId={user?.id} />
            ))
        )}
      </div>
    </div>
  )};

  const renderCreate = () => {
    // SE NÃO TEM USUÁRIO, MOSTRA O CADASTRO
    if (!user) return renderRegistration();

    return (
    <div className="pb-40 pt-4 px-4 min-h-full flex flex-col">
       <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold text-slate-800">Pedir Ajuda</h1>
        <button onClick={() => setScreen(AppScreen.FEED)} className="text-sm text-slate-500 font-medium">Cancelar</button>
      </div>
      {!enhancedData ? (
        <div className="flex-1 flex flex-col">
            <div className="grid grid-cols-2 gap-2 mb-4">
                {Object.values(RequestType).map(type => (
                    <button key={type} onClick={() => setNewRequestType(type)} className={`p-3 rounded-xl text-xs font-bold border transition-all ${newRequestType === type ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>{type}</button>
                ))}
            </div>
            <div className="mb-4">
                <label className="text-xs font-bold text-slate-700 uppercase ml-1 mb-1 block">Título</label>
                <input type="text" value={newRequestTitle} onChange={(e) => setNewRequestTitle(e.target.value)} placeholder="Ex: Empréstimo de Escada" className="w-full p-3 rounded-2xl bg-white border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none text-slate-800 font-bold" />
            </div>
            <label className="text-xs font-bold text-slate-700 uppercase ml-1 mb-1 block">Detalhes</label>
            <textarea value={newRequestText} onChange={(e) => setNewRequestText(e.target.value)} placeholder="Descreva o que você precisa..." className="w-full h-32 p-4 rounded-2xl bg-white border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none resize-none text-slate-700 placeholder:text-slate-300 mb-4 shadow-sm" />
            <div className="bg-blue-50 p-4 rounded-xl mb-6 flex items-start gap-3">
                <Sparkles className="text-blue-500 shrink-0 mt-0.5" size={18} />
                <p className="text-xs text-blue-700 leading-relaxed">Nossa IA ajudará a escrever seu pedido de forma gentil e segura.</p>
            </div>
            <button disabled={!newRequestText.trim() || !newRequestTitle.trim() || isEnhancing} onClick={handleCreateRequest} className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all mt-auto ${(!newRequestText.trim() || !newRequestTitle.trim()) ? 'bg-slate-300' : 'bg-gradient-to-r from-teal-500 to-teal-600 active:scale-95'}`}>
                {isEnhancing ? <Loader2 className="animate-spin" /> : <>Continuar <ArrowRight size={18} /></>}
            </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-teal-600"></div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">{newRequestTitle}</h3>
                <h4 className="text-[10px] font-bold text-teal-600 uppercase tracking-wider mb-2 flex items-center gap-2"><Sparkles size={12} /> Sugestão da Liga</h4>
                <p className="text-sm font-medium text-slate-600 mb-4 leading-relaxed">"{enhancedData.text}"</p>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex gap-2 items-center"><Shield size={16} className="text-slate-400" /><p className="text-xs text-slate-500 italic">{enhancedData.tip}</p></div>
             </div>
             <div className="bg-amber-50 p-4 rounded-2xl mb-8 text-center border border-amber-100"><p className="text-amber-700 font-bold text-sm">✨ {enhancedData.encouragement}</p></div>
             <div className="flex gap-3 mt-auto">
                <button onClick={() => setEnhancedData(null)} className="flex-1 py-4 rounded-2xl font-bold text-slate-500 bg-slate-100">Editar</button>
                <button onClick={confirmPost} className="flex-[2] py-4 rounded-2xl font-bold text-white bg-slate-900 shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2">Publicar <Send size={18} /></button>
             </div>
        </div>
      )}
    </div>
  )};

  const renderProfile = () => {
    // SE NÃO TEM USUÁRIO, MOSTRA O CADASTRO (OU PODE SER UM LOGIN)
    if (!user) return renderRegistration();

    return (
    <div className="pb-32 pt-4 px-4 min-h-full">
        <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-extrabold text-slate-800">Meu Perfil</h1>
            <button onClick={handleLogout} className="text-xs text-rose-500 font-bold bg-rose-50 px-3 py-2 rounded-lg">Sair</button>
        </div>
        {user && (
            <div className="flex flex-col items-center mb-8">
                <div className="relative">
                    <img src={user.avatar} alt="Me" className="w-24 h-24 rounded-full border-4 border-white shadow-lg mb-4 object-cover" />
                    <div className="absolute bottom-4 right-0 bg-teal-500 text-white p-1.5 rounded-full border-2 border-white"><Award size={16} /></div>
                </div>
                <h2 className="text-xl font-bold text-slate-800">{user.name}</h2>
                <p className="text-sm text-slate-500 flex items-center gap-1"><MapPin size={12} /> {user.location.neighborhood}, {user.location.city}</p>
            </div>
        )}
        <div className={`mb-8 p-4 rounded-2xl border flex items-center gap-3 ${isOnlineMode() ? 'bg-green-50 border-green-200' : 'bg-slate-100 border-slate-200'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isOnlineMode() ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>{isOnlineMode() ? <CloudLightning size={20} /> : <CloudOff size={20} />}</div>
            <div className="flex-1">
                <h4 className="font-bold text-sm text-slate-800">{isOnlineMode() ? 'Online' : 'Demo Local'}</h4>
                <p className="text-xs text-slate-500">{isOnlineMode() ? 'Conectado à comunidade real.' : 'Dados salvos apenas neste aparelho.'}</p>
            </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="bg-white p-3 rounded-2xl border border-slate-100 text-center shadow-sm"><p className="text-xs text-slate-400 font-bold uppercase mb-1">Favores</p><p className="text-xl font-black text-slate-800">{user?.reputation.totalFavors || 0}</p></div>
            <div className="bg-white p-3 rounded-2xl border border-slate-100 text-center shadow-sm"><p className="text-xs text-slate-400 font-bold uppercase mb-1">Gentileza</p><p className="text-xl font-black text-amber-500">{user?.reputation.kindness || 5.0}</p></div>
            <div className="bg-white p-3 rounded-2xl border border-slate-100 text-center shadow-sm"><p className="text-xs text-slate-400 font-bold uppercase mb-1">Confiança</p><p className="text-xl font-black text-teal-500">{user?.reputation.reliability || 5.0}</p></div>
        </div>
    </div>
  )};

  const renderCommunity = () => (
      <div className="pb-32 pt-4 px-4 flex flex-col items-center min-h-full">
          <div className="bg-teal-50 p-6 rounded-full mb-6 mt-10 relative"><Users className="w-16 h-16 text-teal-500" /><div className="absolute top-0 right-0 w-6 h-6 bg-rose-500 rounded-full border-4 border-white animate-bounce"></div></div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Comunidade Real</h2>
          <p className="text-slate-500 text-center max-w-xs mb-8">{isOnlineMode() ? 'Você está conectado! Convide vizinhos para fortalecer a rede.' : 'Modo local ativo.'}</p>
          
          <button onClick={handleShare} className="w-full max-w-xs bg-teal-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-teal-200 active:scale-95 transition-transform flex items-center justify-center gap-2 mb-6"><Share2 size={18} /> Convidar Vizinhos (WhatsApp)</button>
          
          {/* Seção Manual para copiar link */}
          <div className="w-full max-w-xs bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs text-slate-400 font-bold uppercase mb-2">Link do App</p>
              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-500 truncate flex-1 font-mono">{window.location.href}</span>
                  <button onClick={handleCopyLink} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200 text-slate-600 hover:text-teal-600 active:scale-95"><Copy size={16} /></button>
              </div>
          </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 max-w-md mx-auto shadow-2xl overflow-hidden relative">
      <main className="h-full overflow-y-auto no-scrollbar">
        {screen === AppScreen.FEED && renderFeed()}
        {screen === AppScreen.CREATE && renderCreate()}
        {screen === AppScreen.PROFILE && renderProfile()}
        {screen === AppScreen.COMMUNITY && renderCommunity()}
      </main>
      <Navigation currentScreen={screen} setScreen={setScreen} />
      {showToast && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 w-max max-w-[90%]">
            <CheckCircle2 size={20} className="text-teal-400 shrink-0" />
            <span className="text-sm font-bold truncate">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}