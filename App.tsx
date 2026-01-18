
import React, { useState, useRef, useEffect } from 'react';
import { InterviewSession } from './services/geminiService';
import { Message, ConnectionStatus, UserStats } from './types';
import { Waveform } from './components/Waveform';
import { PaymentGate } from './components/PaymentGate';

const FREE_TRIAL_LIMIT_MS = 3 * 60 * 1000; // 3 minutes
const PAID_TIME_LIMIT_MS = 5 * 60 * 60 * 1000; // 5 hours

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.IDLE);
  const [transcripts, setTranscripts] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  
  const [userStats, setUserStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem('thandar_user_stats');
    return saved ? JSON.parse(saved) : { accumulatedTimeMs: 0, isPaid: false };
  });

  const sessionRef = useRef<InterviewSession | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  useEffect(() => {
    localStorage.setItem('thandar_user_stats', JSON.stringify(userStats));
  }, [userStats]);

  useEffect(() => {
    if (status === ConnectionStatus.ACTIVE) {
      lastUpdateRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        const now = Date.now();
        const delta = now - lastUpdateRef.current;
        lastUpdateRef.current = now;

        setUserStats(prev => {
          const newTime = prev.accumulatedTimeMs + delta;
          const limit = prev.isPaid ? (FREE_TRIAL_LIMIT_MS + PAID_TIME_LIMIT_MS) : FREE_TRIAL_LIMIT_MS;
          
          if (newTime >= limit) {
            handleStop();
            setShowPayment(true);
          }
          
          return { ...prev, accumulatedTimeMs: newTime };
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, userStats.isPaid]);

  const handlePaymentComplete = () => {
    setUserStats(prev => ({ ...prev, isPaid: true }));
    setShowPayment(false);
  };

  const handleStart = async () => {
    const limit = userStats.isPaid ? (FREE_TRIAL_LIMIT_MS + PAID_TIME_LIMIT_MS) : FREE_TRIAL_LIMIT_MS;
    if (userStats.accumulatedTimeMs >= limit) {
      setShowPayment(true);
      return;
    }

    setError(null);
    setStatus(ConnectionStatus.CONNECTING);
    const session = new InterviewSession();
    sessionRef.current = session;

    try {
      await session.start({
        onTranscription: (text, isUser) => {
          setTranscripts(prev => {
            const last = prev[prev.length - 1];
            const role = isUser ? 'user' : 'assistant';
            if (last && last.role === role) {
              return [...prev.slice(0, -1), { role, text: last.text + text }];
            } else {
              return [...prev, { role, text }];
            }
          });
        },
        onTurnComplete: () => {},
        onSpeaking: (speaking) => setIsSpeaking(speaking),
        onError: (err) => {
          console.error(err);
          setError('မိုက်ခရိုဖုန်း ချိတ်ဆက်မှု အဆင်မပြေပါ။ ပြန်လည်ကြိုးစားပေးပါ။');
          setStatus(ConnectionStatus.ERROR);
        },
        onClose: () => {
          setStatus(ConnectionStatus.IDLE);
          setIsSpeaking(false);
        }
      });
      setStatus(ConnectionStatus.ACTIVE);
    } catch (e) {
      console.error(e);
      setStatus(ConnectionStatus.ERROR);
      setError("ချိတ်ဆက်မှု အမှားအယွင်းရှိနေပါသည်။");
    }
  };

  const handleStop = () => {
    if (sessionRef.current) {
      sessionRef.current.stop();
      sessionRef.current = null;
    }
    setStatus(ConnectionStatus.IDLE);
    setIsSpeaking(false);
  };

  const formatRemaining = () => {
    const limit = userStats.isPaid ? (FREE_TRIAL_LIMIT_MS + PAID_TIME_LIMIT_MS) : FREE_TRIAL_LIMIT_MS;
    const remainingMs = Math.max(0, limit - userStats.accumulatedTimeMs);
    const mins = Math.floor(remainingMs / 60000);
    const secs = Math.floor((remainingMs % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center p-4 lg:p-10 font-sans selection:bg-teal-100 overflow-x-hidden">
      {showPayment && <PaymentGate onPaymentComplete={handlePaymentComplete} />}
      
      {/* Background soft blobs for relaxing feel */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-50 rounded-full blur-[120px] -z-10 animate-pulse opacity-50"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-50 rounded-full blur-[120px] -z-10 animate-pulse opacity-50"></div>

      {/* Header - Compact for Mobile */}
      <header className="w-full max-w-7xl flex flex-col md:flex-row items-center justify-between mb-6 lg:mb-10 bg-white/80 backdrop-blur-md p-6 lg:p-8 rounded-[2rem] shadow-sm border border-slate-100 transition-all hover:shadow-md">
        <div className="flex items-center space-x-4 lg:space-x-6 w-full md:w-auto mb-4 md:mb-0">
          <div className="relative shrink-0">
            <div className={`w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-teal-400 to-teal-600 rounded-3xl flex items-center justify-center text-white text-3xl lg:text-4xl font-black transition-all duration-700 shadow-lg ${isSpeaking ? 'scale-105 shadow-teal-200' : ''}`}>
              T
            </div>
            {status === ConnectionStatus.ACTIVE && (
              <span className={`absolute -bottom-1 -right-1 w-5 h-5 lg:w-6 lg:h-6 border-4 border-white rounded-full transition-colors duration-300 ${isSpeaking ? 'bg-teal-500 animate-pulse' : 'bg-green-500'}`}></span>
            )}
          </div>
          <div className="overflow-hidden">
            <h1 className="text-xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Thandar <span className="hidden sm:inline">(သန္တာ)</span> 🌿
            </h1>
            <p className="text-sm lg:text-lg text-slate-500 font-medium truncate">Helpful Career Coach</p>
          </div>
        </div>
        
        <div className="flex flex-row items-center justify-between w-full md:w-auto space-x-4">
          <div className="text-left md:text-right shrink-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Remaining</p>
            <p className="text-sm lg:text-lg font-black text-teal-600">{formatRemaining()}</p>
          </div>
          <div className={`px-4 py-2 rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-widest flex items-center gap-1 shrink-0 ${userStats.isPaid ? 'bg-teal-50 text-teal-600' : 'bg-amber-50 text-amber-600'}`}>
            {userStats.isPaid ? '✨ Premium' : '🔓 Trial'}
          </div>
        </div>
      </header>

      {/* Main Experience - Responsive Layout */}
      <main className="w-full max-w-7xl flex flex-col lg:flex-row gap-6 lg:gap-10 mb-10">
        
        {/* Chat Panel */}
        <section className="flex-1 bg-white rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col overflow-hidden min-h-[500px] lg:min-h-[800px]">
          <div className="px-6 py-4 lg:p-8 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${status === ConnectionStatus.ACTIVE ? 'bg-teal-500 animate-ping' : 'bg-slate-300'}`}></div>
              <h2 className="font-bold text-slate-800 text-xs lg:text-sm tracking-wide uppercase">Practice Space 💬</h2>
            </div>
            <button 
              onClick={() => setTranscripts([])}
              className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest"
            >
              Clear
            </button>
          </div>
          
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-6 lg:space-y-8 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]"
          >
            {transcripts.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center py-10 lg:py-20 animate-in fade-in duration-700">
                <div className="w-20 h-20 lg:w-28 lg:h-28 bg-teal-50 rounded-[2.5rem] flex items-center justify-center mb-6 lg:mb-8 rotate-3 shadow-inner">
                  <span className="text-4xl lg:text-6xl">🎙️</span>
                </div>
                <h3 className="text-2xl lg:text-3xl font-black text-slate-900 mb-2">စတင်ဖို့ အဆင်သင့်ပဲလား?</h3>
                <p className="text-slate-500 text-sm lg:text-lg leading-relaxed max-w-sm mx-auto">
                  Start Voice Session ကို နှိပ်ပြီး သန္တာနဲ့ အင်တာဗျူး လေ့ကျင့်နိုင်ပါတယ်။
                </p>
              </div>
            )}
            
            {transcripts.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                <div className={`max-w-[90%] lg:max-w-[80%] px-5 py-3 lg:px-8 lg:py-4 rounded-2xl lg:rounded-[2rem] text-sm lg:text-lg leading-relaxed shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-teal-600 text-white rounded-tr-none shadow-teal-100' 
                    : 'bg-slate-50 text-slate-800 rounded-tl-none border border-slate-100'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <div className="p-6 lg:p-10 bg-white border-t border-slate-50">
            <div className="max-w-md mx-auto mb-6 lg:mb-8">
              <Waveform isActive={isSpeaking} color="bg-teal-500" />
            </div>
            
            <div className="flex flex-col items-center space-y-6">
              {error && <div className="text-rose-500 font-bold text-xs bg-rose-50 px-4 py-2 rounded-full border border-rose-100">{error}</div>}
              
              <div className="w-full flex justify-center">
                {status !== ConnectionStatus.ACTIVE ? (
                  <button
                    disabled={status === ConnectionStatus.CONNECTING}
                    onClick={handleStart}
                    className="group relative flex items-center justify-center w-full max-w-md h-16 lg:h-20 rounded-2xl lg:rounded-[1.5rem] font-black text-lg lg:text-2xl bg-slate-900 text-white hover:bg-black transition-all transform active:scale-95 shadow-xl hover:shadow-2xl overflow-hidden"
                  >
                    <span className="relative z-10">{status === ConnectionStatus.CONNECTING ? 'Connecting... ⏳' : 'Start Coaching Session 🚀'}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleStop}
                    className="group relative flex items-center justify-center w-full max-w-md h-16 lg:h-20 bg-rose-50 text-rose-600 border-2 border-rose-100 rounded-2xl lg:rounded-[1.5rem] font-black text-lg lg:text-2xl hover:bg-rose-600 hover:text-white transition-all transform active:scale-95 shadow-lg"
                  >
                    End Session 👋
                  </button>
                )}
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${isSpeaking ? 'bg-teal-500 animate-pulse' : 'bg-slate-300'}`}></span>
                {isSpeaking ? "Coach Thandar is speaking" : "Waiting for your voice"}
              </p>
            </div>
          </div>
        </section>

        {/* Sidebar */}
        <aside className="w-full lg:w-[380px] space-y-6">
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <span className="text-8xl">💡</span>
            </div>
            <h3 className="font-black text-slate-900 mb-6 text-lg uppercase tracking-wider flex items-center gap-2">
              <span className="text-teal-500">✨</span> Coach Tips
            </h3>
            <div className="space-y-4">
               {[
                 { t: "Confidence", d: "Keep eye contact and speak clearly." },
                 { t: "STAR Method", d: "Situation, Task, Action, Result." },
                 { t: "Preparation", d: "Research the company thoroughly." }
               ].map((tip, idx) => (
                 <div key={idx} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                   <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mb-1">{tip.t}</p>
                   <p className="text-xs text-slate-600 font-medium leading-relaxed">{tip.d}</p>
                 </div>
               ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-8 rounded-[2rem] shadow-2xl text-white relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-20%] w-40 h-40 bg-teal-500/20 rounded-full blur-3xl"></div>
            <h3 className="font-black text-xl mb-4 relative z-10 flex items-center gap-2">
               Premium Access 👑
            </h3>
            <p className="text-slate-400 leading-relaxed text-sm mb-6 relative z-10">
              Get 5 hours of intensive coaching for only 30,000 MMK.
            </p>
            <button 
              onClick={() => setShowPayment(true)}
              className="w-full py-4 bg-teal-500 text-white rounded-xl font-black text-sm hover:bg-teal-400 transition-all shadow-lg shadow-teal-900/50"
            >
              {userStats.isPaid ? 'Already Premium ✨' : 'Unlock Full Access 🔓'}
            </button>
          </div>
        </aside>
      </main>

      <footer className="mt-auto py-10 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] text-center w-full border-t border-slate-100">
        Professional Myanmar Coach &middot; Thandar AI &middot; 2024
      </footer>
    </div>
  );
};

export default App;
