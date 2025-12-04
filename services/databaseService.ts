
import { createClient } from '@supabase/supabase-js';
import { HelpRequest, User, RequestType, AppNotification, UserLocation } from '../types';

// --- CONFIGURAÇÃO DO MODO REAL ---
// ⚠️ IMPORTANTE: A URL já está configurada.
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

export const dbService = {
  
  // --- AUTENTICAÇÃO SIMPLES (SEM SENHA) ---
  
  async registerSimpleUser(name: string, location: UserLocation): Promise<User> {
      // 1. Gera um ID único baseado no tempo e aleatoriedade
      const uniqueId = 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      
      // 2. Cria o objeto do usuário
      const newUser: User = {
          id: uniqueId,
          name: name,
          avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${uniqueId}`,
          location: location,
          distance: '0m',
          reputation: { reliability: 5.0, speed: 5.0, kindness: 5.0, totalFavors: 0 }
      };

      // 3. Salva no Supabase (se online) para outros verem
      if (supabase) {
          try {
              // Tenta salvar na tabela pública 'users'
              const { error } = await supabase.from('users').insert(newUser);
              if (error) console.error("Erro ao salvar usuário na nuvem:", error);
          } catch (e) {
              console.warn("Modo offline: usuário salvo apenas localmente.");
          }
      }

      // 4. Salva localmente (Login persistente)
      localStorage.setItem('liga_user', JSON.stringify(newUser));
      return newUser;
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
