import React from 'react';
import { MapPin, Clock, Heart, Zap, Coffee, ShieldCheck, Star, CheckCircle, UserCheck } from 'lucide-react';
import { HelpRequest, RequestType } from '../types';

interface RequestCardProps {
  request: HelpRequest;
  onHelp: (id: string) => void;
  onResolve: (id: string) => void;
  currentUserId: string | undefined;
}

export const RequestCard: React.FC<RequestCardProps> = ({ request, onHelp, onResolve, currentUserId }) => {
  const isOwner = currentUserId === request.userId;
  const isCompleted = request.status === 'COMPLETED';

  const getTypeIcon = (type: RequestType) => {
    switch (type) {
      case RequestType.URGENCY: return <Zap size={16} className={isCompleted ? "text-slate-400" : "text-amber-500"} />;
      case RequestType.COMPANY: return <Coffee size={16} className={isCompleted ? "text-slate-400" : "text-rose-500"} />;
      case RequestType.BORROW: return <Heart size={16} className={isCompleted ? "text-slate-400" : "text-teal-500"} />;
      default: return <Star size={16} className={isCompleted ? "text-slate-400" : "text-indigo-500"} />;
    }
  };

  const getTypeColor = (type: RequestType) => {
    if (isCompleted) return 'bg-slate-100 text-slate-400 border-slate-200';
    switch (type) {
      case RequestType.URGENCY: return 'bg-amber-50 text-amber-700 border-amber-100';
      case RequestType.COMPANY: return 'bg-rose-50 text-rose-700 border-rose-100';
      case RequestType.BORROW: return 'bg-teal-50 text-teal-700 border-teal-100';
      default: return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    }
  };

  // Safe checks for location to prevent crashes with legacy data
  const userNeighborhood = request.user?.location?.neighborhood || request.user?.distance || 'Vizinhança';

  return (
    <div className={`rounded-3xl shadow-sm border mb-4 transition-all hover:shadow-md relative overflow-hidden ${isCompleted ? 'bg-slate-50 border-slate-100 opacity-90' : 'bg-white border-slate-100'}`}>
      
      {isCompleted && (
        <div className="absolute top-0 left-0 w-full h-1 bg-green-500 z-10"></div>
      )}

      <div className="p-5">
        {/* Header: User & Distance */}
        <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3">
            <img src={request.user.avatar} alt={request.user.name} className={`w-10 h-10 rounded-full object-cover border-2 shadow-sm ${isCompleted ? 'border-slate-200 grayscale' : 'border-white'}`} />
            <div>
                <h3 className={`text-sm font-bold ${isCompleted ? 'text-slate-500' : 'text-slate-800'}`}>
                    {request.user.name} {isOwner && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 ml-1 font-normal">(Você)</span>}
                </h3>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                <span className={`flex items-center gap-1 ${isCompleted ? 'text-slate-400' : 'text-yellow-500'}`}>
                    <Star size={10} fill="currentColor" /> {request.user.reputation?.kindness?.toFixed(1) || '5.0'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-0.5">
                    <MapPin size={10} /> {userNeighborhood}
                </span>
                </div>
            </div>
            </div>
            <div className="flex flex-col items-end gap-1">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5 ${getTypeColor(request.type)}`}>
                    {getTypeIcon(request.type)}
                    {request.type}
                </span>
                {isCompleted && <span className="text-[10px] font-bold text-green-600 flex items-center gap-1"><CheckCircle size={10}/> RESOLVIDO</span>}
            </div>
        </div>

        {/* Content */}
        <div className="mb-4">
            <h4 className={`text-lg font-bold mb-1 leading-tight ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{request.title}</h4>
            <p className={`text-sm leading-relaxed ${isCompleted ? 'text-slate-400' : 'text-slate-600'}`}>{request.description}</p>
        </div>
        
        {/* Safety Tip (if AI generated) */}
        {request.aiSafetyTip && !isCompleted && (
            <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100 flex gap-2 items-start">
                <ShieldCheck size={16} className="text-teal-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500 italic">"{request.aiSafetyTip}"</p>
            </div>
        )}

        {/* Footer: Action */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
            <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock size={12} /> {Math.floor((Date.now() - request.timestamp) / 60000)} min atrás
            </span>
            
            {isCompleted ? (
                <button disabled className="bg-slate-100 text-slate-400 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-not-allowed flex items-center gap-2">
                    <CheckCircle size={16} /> Concluído
                </button>
            ) : isOwner ? (
                <button 
                    onClick={() => onResolve(request.id)}
                    className="bg-green-100 text-green-700 hover:bg-green-200 border border-green-200 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-transform flex items-center gap-2"
                >
                    <CheckCircle size={16} /> Aceitar Ajuda
                </button>
            ) : (
                <button 
                    onClick={() => onHelp(request.id)}
                    className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-slate-200 active:scale-95 transition-transform flex items-center gap-2 hover:bg-slate-800"
                >
                    <UserCheck size={16} /> Oferecer Ajuda
                </button>
            )}
        </div>
      </div>
    </div>
  );
};