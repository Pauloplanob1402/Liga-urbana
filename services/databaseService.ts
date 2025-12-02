import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { HelpRequest, User, RequestType, AppNotification } from '../types';

// --- CONFIGURAÇÃO DO MODO REAL ---
// Credenciais fornecidas pelo usuário
const SUPABASE_URL = 'https://kprmhutqdbgnlrdqzoys.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwcm1odXRxZGJnbmxyZHF6b3lzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1NDg4MzMsImV4cCI6MjA4MDEyNDgzM30.FqcTxisHMQ-9r_7-irXPUO8jQU0h2Sx9_5oKeV0nQTE';

let supabase: SupabaseClient | null = null;

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

// --- SERVIÇOS UNIFICADOS ---

export const dbService = {
  // Salvar Usuário com Fallback de Segurança
  async saveUser(user: User): Promise<void> {
    // 1. Sempre salva localmente
    localStorage.setItem('liga_user', JSON.stringify(user));

    if (isOnlineMode() && supabase) {
      try {
        // Tenta salvar o usuário completo
        const { error } = await supabase.from('users').upsert(user);
        
        // Se der erro de coluna faltando (Schema desatualizado), tenta salvar versão compatível
        if (error) {
            console.warn('Tentativa de salvar user falhou, tentando modo de compatibilidade...', error.message);
            if (error.message.includes('location')) {
                // Remove o campo novo 'location' e tenta salvar o resto
                // @ts-ignore
                const { location, ...legacyUser } = user;
                const { error: legacyError } = await supabase.from('users').upsert(legacyUser);
                if (!legacyError) {
                    console.log('Usuário salvo em modo de compatibilidade (sem location na nuvem). Rode o SQL de migração!');
                }
            }
        }
      } catch (e) {
        console.error('Erro de Conexão (User):', e);
      }
    }
  },

  getUser(): User | null {
    const local = localStorage.getItem('liga_user');
    return local ? JSON.parse(local) : null;
  },

  // Criar Pedido
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

  // Atualizar Status
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

  // Notificações
  async sendNotification(notification: AppNotification): Promise<void> {
    if (isOnlineMode() && supabase) {
      try {
        await supabase.from('notifications').insert(notification);
      } catch (e) { console.error('Erro Notification:', e); }
    }
  },

  subscribeToNotifications(userId: string, onMessage: (n: AppNotification) => void): RealtimeChannel | null {
      if (!isOnlineMode() || !supabase) return null;
      return supabase
          .channel('notifications_channel')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `toUserId=eq.${userId}` }, 
          (payload) => payload.new && onMessage(payload.new as AppNotification))
          .subscribe();
  },

  // Listar Pedidos
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

    // Sanitização para evitar travamento com dados antigos
    cloudRequests = cloudRequests.map(req => {
        // Se o usuário ou localização vierem quebrados do banco, preenchemos com padrão
        const safeUser = req.user || { 
            id: 'unknown', name: 'Usuário', avatar: '', 
            location: { neighborhood: '', city: '', state: '', country: '' }, 
            reputation: { reliability: 5, speed: 5, kindness: 5, totalFavors: 0 },
            distance: '0m'
        };
        
        // Garante que location existe
        if (!safeUser.location) {
            safeUser.location = { neighborhood: 'Indefinido', city: 'Indefinido', state: '', country: '' };
        }
        
        // Garante que distance existe
        if (!safeUser.distance) {
            safeUser.distance = '0m';
        }

        return { ...req, user: safeUser };
    });

    // Merge com locais
    const localRequests = this.getLocalRequests();
    const cloudIds = new Set(cloudRequests.map(r => r.id));
    const mergedRequests = [...localRequests.filter(r => !cloudIds.has(r.id)), ...cloudRequests];
    mergedRequests.sort((a, b) => b.timestamp - a.timestamp);

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