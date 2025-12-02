import { createClient } from '@supabase/supabase-js';
import { HelpRequest, User, RequestType, AppNotification } from '../types';

// --- CONFIGURAÇÃO DO MODO REAL ---
// ⚠️ IMPORTANTE: A URL já está configurada.
// AGORA FALTA A CHAVE: Vá no Supabase > Project Settings > API e copie a chave "anon" "public".
const SUPABASE_URL = 'https://sbtxrxgacmvnamaxnqhm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidHhyeGdhY212bmFtYXhucWhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3MDYwNzIsImV4cCI6MjA4MDI4MjA3Mn0.poNOJYV02WWScShEaXAXqhFSsKZBpM1rgHHrtL09qhQ'; 

let supabase: any = null;

// Só inicializa se a chave estiver preenchida corretamente
if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (e) {
    console.error("Falha ao inicializar Supabase Client", e);
  }
}

// Verifica se estamos em modo online
export const isOnlineMode = () => !!supabase;

// --- DADOS FICTÍCIOS (SEED) ---
// Usados apenas se o banco estiver vazio ou desconectado
const SEED_REQUESTS: HelpRequest[] = [
  {
    id: 'seed_1',
    userId: 'user_marta',
    user: {
      id: 'user_marta',
      name: 'Dona Marta',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marta&backgroundColor=b6e3f4',
      location: { neighborhood: 'Vila Madalena', city: 'São Paulo', state: 'SP', country: 'Brasil' },
      distance: '120m',
      reputation: { reliability: 4.9, speed: 4.5, kindness: 5.0, totalFavors: 42 }
    },
    type: RequestType.BORROW,
    title: 'Alguém tem uma furadeira?',
    description: 'Preciso pendurar um quadro novo na sala. Prometo devolver em 1 hora! Posso oferecer um bolo de fubá em troca.',
    timestamp: Date.now() - 3600000 * 2, // 2 hours ago
    status: 'OPEN',
    locationLabel: 'Vila Madalena, São Paulo',
    aiSafetyTip: 'Marque a devolução em um local público ou na portaria.'
  },
  {
    id: 'seed_2',
    userId: 'user_joao',
    user: {
      id: 'user_joao',
      name: 'Sr. João',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Joao&backgroundColor=ffdfbf',
      location: { neighborhood: 'Pinheiros', city: 'São Paulo', state: 'SP', country: 'Brasil' },
      distance: '350m',
      reputation: { reliability: 5.0, speed: 4.0, kindness: 5.0, totalFavors: 128 }
    },
    type: RequestType.COMPANY,
    title: 'Companhia para caminhada',
    description: 'O médico mandou caminhar, mas ir sozinho é chato. Alguém anima uma volta no quarteirão às 17h?',
    timestamp: Date.now() - 3600000 * 5, // 5 hours ago
    status: 'OPEN',
    locationLabel: 'Pinheiros, São Paulo',
    aiSafetyTip: 'Encontrem-se em um local movimentado e durante o dia.'
  }
];

// --- SERVIÇOS UNIFICADOS ---

export const dbService = {
  
  // --- AUTENTICAÇÃO REAL ---
  
  async registerUser(email: string, password: string, userData: Partial<User>): Promise<{ user: User | null, error: string | null }> {
    if (!supabase) return { user: null, error: "Conexão com banco de dados não configurada." };

    try {
      // 1. Cria usuário na Auth do Supabase (Compatível com v1 e v2)
      const response = await supabase.auth.signUp({
        email,
        password,
      });

      const authUser = response.user || response.data?.user;
      const authError = response.error;

      if (authError) return { user: null, error: authError.message };
      if (!authUser) return { user: null, error: "Erro ao criar conta." };

      // 2. Prepara dados do perfil público
      const newUser: User = {
        id: authUser.id,
        email: email,
        name: userData.name || 'Vizinho',
        avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${authUser.id}`,
        location: userData.location || { neighborhood: '', city: '', state: '', country: 'Brasil' },
        distance: '0m',
        reputation: { reliability: 5.0, speed: 5.0, kindness: 5.0, totalFavors: 0 }
      };

      // 3. Salva perfil na tabela pública 'users'
      const { error: dbError } = await supabase.from('users').insert(newUser);
      
      if (dbError) {
          console.error("Erro ao salvar perfil:", dbError);
      }

      // Salva sessão localmente para persistência rápida
      localStorage.setItem('liga_user', JSON.stringify(newUser));
      return { user: newUser, error: null };

    } catch (e: any) {
      return { user: null, error: e.message || "Erro desconhecido" };
    }
  },

  async loginUser(email: string, password: string): Promise<{ user: User | null, error: string | null }> {
    if (!supabase) return { user: null, error: "Conexão com banco de dados não configurada." };

    try {
      // 1. Login na Auth (Compatível com v1 e v2)
      let response;
      if (typeof supabase.auth.signInWithPassword === 'function') {
        response = await supabase.auth.signInWithPassword({ email, password });
      } else {
        response = await supabase.auth.signIn({ email, password });
      }
      
      const authUser = response.user || response.data?.user;
      const authError = response.error;

      if (authError) return { user: null, error: "E-mail ou senha incorretos." };
      if (!authUser) return { user: null, error: "Erro no login." };

      // 2. Busca dados do perfil na tabela pública
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profileError || !profileData) {
         return { user: null, error: "Perfil não encontrado. Tente criar conta novamente." };
      }

      const user = profileData as User;
      localStorage.setItem('liga_user', JSON.stringify(user));
      return { user, error: null };

    } catch (e: any) {
      return { user: null, error: e.message };
    }
  },

  async logout(): Promise<void> {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem('liga_user');
    localStorage.removeItem('liga_requests');
  },

  getUser(): User | null {
    const local = localStorage.getItem('liga_user');
    return local ? JSON.parse(local) : null;
  },

  // --- PEDIDOS ---

  async createRequest(request: HelpRequest): Promise<void> {
    const current = this.getLocalRequests();
    localStorage.setItem('liga_requests', JSON.stringify([request, ...current]));

    if (isOnlineMode() && supabase) {
      try {
        const { error } = await supabase.from('requests').insert(request);
        if (error) console.error('Erro Supabase (Request):', error.message);
      } catch (e) {
        console.error('Erro de Conexão (Request):', e);
      }
    }
  },

  async updateRequestStatus(requestId: string, status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED'): Promise<void> {
    const localRequests = this.getLocalRequests();
    const updatedLocal = localRequests.map(r => r.id === requestId ? { ...r, status } : r);
    localStorage.setItem('liga_requests', JSON.stringify(updatedLocal));

    if (isOnlineMode() && supabase) {
      try {
        await supabase.from('requests').update({ status }).eq('id', requestId);
      } catch (e) {
        console.error('Erro Update Status:', e);
      }
    }
  },

  // --- NOTIFICAÇÕES ---

  async sendNotification(notification: AppNotification): Promise<void> {
    if (isOnlineMode() && supabase) {
      try {
        await supabase.from('notifications').insert(notification);
      } catch (e) { console.error('Erro Notification:', e); }
    }
  },

  subscribeToNotifications(userId: string, onMessage: (n: AppNotification) => void): any {
      if (!isOnlineMode() || !supabase) return null;
      
      // Tenta usar a API v2 (channel), se não existir usa v1 (from.on)
      if (supabase.channel) {
          return supabase
              .channel('notifications_channel')
              .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'notifications', filter: `toUserId=eq.${userId}` }, 
                (payload: any) => {
                  if(payload.new) onMessage(payload.new as AppNotification);
                }
              )
              .subscribe();
      } else {
          // Fallback v1
          return supabase
              .from(`notifications:toUserId=eq.${userId}`)
              .on('INSERT', (payload: any) => {
                  if(payload.new) onMessage(payload.new as AppNotification);
              })
              .subscribe();
      }
  },

  // --- LISTAGEM ---

  async getRequests(): Promise<HelpRequest[]> {
    let cloudRequests: HelpRequest[] = [];

    if (isOnlineMode() && supabase) {
      try {
        const { data, error } = await supabase
          .from('requests')
          .select('*')
          .order('timestamp', { ascending: false });
        
        if (!error && data) cloudRequests = data as HelpRequest[];
      } catch (e) { console.warn('Erro fetch requests:', e); }
    }

    // Sanitização para evitar erros com dados antigos ou incompletos
    cloudRequests = cloudRequests.map(req => {
        const safeUser = req.user || { 
            id: 'unknown', name: 'Usuário', avatar: '', 
            location: { neighborhood: '', city: '', state: '', country: '' }, 
            reputation: { reliability: 5, speed: 5, kindness: 5, totalFavors: 0 },
            distance: '0m'
        };
        
        if (!safeUser.location) safeUser.location = { neighborhood: 'Indefinido', city: 'Indefinido', state: '', country: '' };
        if (!safeUser.distance) safeUser.distance = '0m';

        return { ...req, user: safeUser };
    });

    const localRequests = this.getLocalRequests();
    const cloudIds = new Set(cloudRequests.map(r => r.id));
    
    // Mescla pedidos locais não sincronizados com os da nuvem
    const mergedRequests = [...localRequests.filter(r => !cloudIds.has(r.id)), ...cloudRequests];
    mergedRequests.sort((a, b) => b.timestamp - a.timestamp);

    // Se estiver vazio, retorna seed para não ficar tela branca
    return mergedRequests.length === 0 ? SEED_REQUESTS : mergedRequests;
  },

  getLocalRequests(): HelpRequest[] {
    const local = localStorage.getItem('liga_requests');
    return local ? JSON.parse(local) : [];
  },
  
  clearLocal(): void {
      localStorage.removeItem('liga_user');
      localStorage.removeItem('liga_requests');
      localStorage.removeItem('liga_hood');
  }
};