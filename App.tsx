
import React, { useState, useRef, useEffect } from 'react';
import { InterviewSession } from './services/geminiService.ts';
import { Message, ConnectionStatus, UserStats } from './types.ts';
import { Waveform } from './components/Waveform.tsx';
import { PaymentGate } from './components/PaymentGate.tsx';

const FREE_TRIAL_LIMIT_MS = 3 * 60 * 1000; // 3 minutes
const PAID_TIME_LIMIT_MS = 5 * 60 * 60 * 1000; // 5 hours

const CoachAvatar: React.FC<{ isSpeaking: boolean }> = ({ isSpeaking }) => (
  <div className="relative shrink-0 group">
    <div className={`w-20 h-20 lg:w-24 lg:h-24 bg-gradient-to-tr from-teal-50 to-teal-100 rounded-[2.5rem] flex items-center justify-center transition-all duration-700 shadow-sm border border-teal-200/50 ${isSpeaking ? 'scale-110 rotate-3 shadow-teal-200/50' : 'hover:scale-105'}`}>
      <div className={`text-5xl lg:text-6xl transition-transform duration-500 ${isSpeaking ? 'animate-bounce' : 'group-hover:rotate-12'}`}>
        👩‍💼
      </div>
      {/* Animated glow when speaking */}
      {isSpeaking && (
        <div className="absolute inset-0 bg-teal-400/20 rounded-[2.5rem] animate-ping -z-10"></div>
      )}
    </div>
    <div className="absolute -bottom-2 -right-2 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100 flex items-center gap-1">
      <span className="text-xs font-black text-teal-600 uppercase tracking-tighter">Coach</span>
      <span className="text-[10px]">✨</span>
    </div>
  </div>
);

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.IDLE);
  const [transcripts, setTranscripts] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);
  
  const [userStats, setUserStats] = useState<UserStats>(() => {
    try {
      const saved = localStorage.getItem('thandar_user_stats');
      return saved ? JSON.parse(saved) : { accumulatedTimeMs: 0, isPaid: false };
    } catch (e) {
      return { accumulatedTimeMs: 0, isPaid: false };
    }
  });

  const sessionRef = useRef<InterviewSession | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  useEffect(() => {
    localStorage.setItem('thandar_user_stats', JSON.stringify(userStats));
  }, [userStats]);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setNeedsKey(!hasKey);
      }
    };
    checkKey();
  }, []);

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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setNeedsKey(false);
      handleStart(); // Auto-start after selection
    }
  };

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

    // Check key again before starting
    if (window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        setNeedsKey(true);
        return;
      }
    }

    setError(null);
    setStatus(ConnectionStatus.CONNECTING);
    
    try {
      const session = new InterviewSession();
      sessionRef.current = session;

      await session.start({
        onTranscription: (text, isUser) => {
          setTranscripts(prev => {
            const last = prev[prev.length - 1];
            const role = isUser ? 'user' : 'assistant';
            if (last && last.role === role) {
              const updated = [...prev];
              updated[updated.length - 1] = { ...last, text: last.text + text };
              return updated;
            } else {
              return [...prev, { role, text }];
            }
          });
        },
        onTurnComplete: () => {},
        onSpeaking: (speaking) => setIsSpeaking(speaking),
        onError: (err) => {
          console.error(err);
          setError('ချိတ်ဆက်မှု အဆင်မပြေပါ။ API Key သို့မဟုတ် အင်တာနက်ကို စစ်ဆေးပေးပါ။');
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
    <div className="min-h-screen bg-[#FDFEFF] flex flex-col items-center p-4 lg:p-12 font-sans selection:bg-teal-100 overflow-x-hidden">
      {showPayment && <PaymentGate onPaymentComplete={handlePaymentComplete} />}
      
      <div className="fixed top-[-5%] left-[-5%] w-[30%] h-[30%] bg-teal-50/60 rounded-full blur-[100px] -z-10 animate-pulse"></div>
      <div className="fixed bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-indigo-50/60 rounded-full blur-[100px] -z-10"></div>

      <header className="w-full max-w-6xl flex flex-col md:flex-row items-center justify-between mb-8 lg:mb-12 bg-white/40 backdrop-blur-xl p-8 rounded-[3rem] border border-white/60 shadow-sm">
        <div className="flex items-center space-x-6 w-full md:w-auto mb-6 md:mb-0">
          <CoachAvatar isSpeaking={isSpeaking} />
          <div className="overflow-hidden">
            <h1 className="text-2xl lg:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Thandar <span className="text-teal-500 font-medium text-lg lg:text-2xl hidden sm:inline">(သန္တာ)</span>
            </h1>
            <p className="text-slate-500 font-bold flex items-center gap-2 text-sm lg:text-base">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              အလုပ်အကိုင်လမ်းပြ အကြံပေးပညာရှင် 🤝
            </p>
          </div>
        </div>
        
        <div className="flex flex-row items-center justify-between w-full md:w-auto md:flex-col md:items-end gap-3">
          <div className={`px-5 py-2 rounded-2xl text-[10px] lg:text-xs font-black uppercase tracking-widest flex items-center gap-2 ${userStats.isPaid ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'}`}>
            {userStats.isPaid ? '💎 Premium Coaching' : '🌱 Trial Mode'}
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ကျန်ရှိသည့် အချိန် (Remaining)</p>
            <p className="text-base lg:text-xl font-black text-teal-600 tabular-nums">{formatRemaining()}</p>
          </div>
        </div>
      </header>

      <main className="w-full max-w-6xl flex flex-col lg:flex-row gap-8 lg:gap-12 mb-12">
        <section className="flex-1 bg-white rounded-[3rem] shadow-2xl shadow-slate-100 border border-slate-100 flex flex-col overflow-hidden min-h-[600px] lg:min-h-[850px]">
          <div className="px-8 py-6 bg-slate-50/30 border-b border-slate-50 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <span className="text-xl">💬</span>
              <h2 className="font-black text-slate-800 text-xs lg:text-sm tracking-widest uppercase">Live Transcript (ပြောဆိုမှုမှတ်တမ်း)</h2>
            </div>
            <button 
              onClick={() => setTranscripts([])}
              className="text-[10px] font-bold text-slate-300 hover:text-rose-500 transition-all uppercase tracking-widest px-3 py-1 rounded-full hover:bg-rose-50"
            >
              Reset 🔄
            </button>
          </div>
          
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-8 lg:p-12 space-y-8 lg:space-y-10 bg-[radial-gradient(#f1f5f9_1.5px,transparent_1.5px)] [background-size:32px:32px]"
          >
            {transcripts.length === 0 && (status === ConnectionStatus.IDLE || status === ConnectionStatus.ERROR) && (
              <div className="h-full flex flex-col items-center justify-center text-center py-10 lg:py-20 opacity-0 animate-in fade-in slide-in-from-bottom-4 duration-1000 fill-mode-forwards">
                <div className="flex gap-4 mb-8">
                  <div className="w-16 h-16 lg:w-20 lg:h-20 bg-teal-50 rounded-2xl flex items-center justify-center shadow-sm animate-bounce [animation-delay:0.1s]">
                    <span className="text-3xl lg:text-4xl">💼</span>
                  </div>
                  <div className="w-16 h-16 lg:w-20 lg:h-20 bg-indigo-50 rounded-2xl flex items-center justify-center shadow-sm animate-bounce [animation-delay:0.3s]">
                    <span className="text-3xl lg:text-4xl">🔍</span>
                  </div>
                  <div className="w-16 h-16 lg:w-20 lg:h-20 bg-amber-50 rounded-2xl flex items-center justify-center shadow-sm animate-bounce [animation-delay:0.5s]">
                    <span className="text-3xl lg:text-4xl">🚀</span>
                  </div>
                </div>
                
                <h3 className="text-2xl lg:text-4xl font-black text-slate-900 mb-6 px-4">အဆင်သင့်ဖြစ်ပြီလား?</h3>
                
                <div className="space-y-6 max-w-xl mx-auto px-6">
                  <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-2 h-full bg-teal-500"></div>
                    <p className="text-lg lg:text-2xl font-black text-slate-800 leading-tight mb-2">
                      Tell me what job preparation you want or what job are you looking for?
                    </p>
                    <p className="text-base lg:text-xl font-bold text-teal-600 leading-relaxed">
                      ဘယ်လို အလုပ်အကိုင်မျိုးအတွက် ပြင်ဆင်ချင်ပါသလဲ? ဒါမှမဟုတ် ဘယ်လို အလုပ်မျိုးကို ရှာဖွေနေတာလဲ?
                    </p>
                  </div>
                  
                  <p className="text-slate-500 text-sm lg:text-base font-medium leading-relaxed">
                    "သင့်ရဲ့ အလုပ်အကိုင် အခွင့်အလမ်းတွေကို မြှင့်တင်ဖို့ အဆင်သင့်ဖြစ်ပြီလား? သန္တာက သင့်ကို ကူညီဖို့ အဆင်သင့် စောင့်နေပါတယ်။"
                  </p>
                </div>

                <div className="mt-12 px-8 py-4 bg-teal-50 text-teal-700 rounded-full font-black text-sm lg:text-base animate-pulse shadow-sm border border-teal-100 flex items-center gap-3">
                  <span>စတင်ရန် အောက်က ခလုတ်ကို နှိပ်ပါ</span>
                  <span className="text-xl">👇</span>
                </div>
              </div>
            )}
            
            {transcripts.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-4 duration-500`}>
                <div className={`max-w-[85%] lg:max-w-[75%] px-7 py-5 lg:px-9 lg:py-6 rounded-3xl lg:rounded-[2.5rem] text-base lg:text-xl leading-relaxed shadow-sm transition-all ${
                  msg.role === 'user' 
                    ? 'bg-slate-900 text-white rounded-tr-none shadow-xl shadow-slate-200' 
                    : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
                }`}>
                  {msg.text}
                </div>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-3 px-4">
                  {msg.role === 'user' ? 'သင့်အသံ (Your Voice)' : 'သန္တာ (Coach Thandar)'}
                </span>
              </div>
            ))}
          </div>

          <div className="p-8 lg:p-12 bg-white border-t-2 border-slate-50">
            <div className="max-w-md mx-auto mb-8 lg:mb-12">
              <Waveform isActive={isSpeaking} color="bg-teal-500" />
            </div>
            
            <div className="flex flex-col items-center space-y-8">
              {error && (
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-rose-50 text-rose-600 px-6 py-3 rounded-2xl text-xs font-black border border-rose-100 text-center">
                    ⚠️ {error}
                  </div>
                  {(error.includes('Key') || error.includes('API')) && (
                    <button 
                      onClick={handleSelectKey}
                      className="px-6 py-2 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 transition-colors"
                    >
                      API Key ရွေးချယ်ရန် (Select Key)
                    </button>
                  )}
                </div>
              )}
              
              <div className="w-full flex justify-center">
                {needsKey ? (
                  <button
                    onClick={handleSelectKey}
                    className="group relative flex items-center justify-center w-full max-w-lg h-20 lg:h-24 rounded-3xl font-black text-xl lg:text-3xl bg-amber-500 text-white hover:bg-amber-600 transition-all transform active:scale-95 shadow-2xl"
                  >
                    <span className="relative z-10 flex items-center gap-4 text-center px-4 leading-tight">
                      API Key ရွေးချယ်ပေးပါ 🔑
                    </span>
                  </button>
                ) : status !== ConnectionStatus.ACTIVE ? (
                  <button
                    disabled={status === ConnectionStatus.CONNECTING}
                    onClick={handleStart}
                    className="group relative flex items-center justify-center w-full max-w-lg h-20 lg:h-24 rounded-3xl font-black text-xl lg:text-3xl bg-slate-900 text-white hover:bg-black transition-all transform active:scale-95 shadow-2xl hover:shadow-teal-100"
                  >
                    <span className="relative z-10 flex items-center gap-4 text-center px-4 leading-tight">
                      {status === ConnectionStatus.CONNECTING ? (
                        <>ချိတ်ဆက်နေသည်... <span className="animate-spin text-teal-400">⏳</span></>
                      ) : (
                        <>အသံဖြင့် စတင်လေ့ကျင့်ရန် 🎤</>
                      )}
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={handleStop}
                    className="group relative flex items-center justify-center w-full max-w-lg h-20 lg:h-24 bg-rose-50 text-rose-600 border-2 border-rose-100 rounded-3xl font-black text-xl lg:text-3xl hover:bg-rose-600 hover:text-white transition-all transform active:scale-95 shadow-xl shadow-rose-100"
                  >
                    လေ့ကျင့်မှု ရပ်နားမည် 👋
                  </button>
                )}
              </div>
              <p className="text-[10px] lg:text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-teal-500 animate-pulse' : 'bg-slate-200'}`}></span>
                {isSpeaking ? "သန္တာက စကားပြောနေပါသည်" : "သင့်စကားသံကို နားထောင်ရန် အဆင်သင့်ဖြစ်ပါသည်"}
              </p>
            </div>
          </div>
        </section>

        <aside className="w-full lg:w-[420px] space-y-8">
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10 rotate-12">
              <span className="text-9xl">🌿</span>
            </div>
            <h3 className="font-black text-slate-900 mb-8 text-xl uppercase tracking-widest flex items-center gap-3">
              <span className="bg-teal-50 text-teal-600 p-2 rounded-xl text-sm">💡</span> အကြံပြုချက်များ
            </h3>
            <div className="space-y-6">
               {[
                 { t: "Body Language", d: "အသံကို တည်တည်ငြိမ်ငြိမ်ထားပြီး ယုံကြည်မှုရှိစွာ ဖြေကြားပါ။" },
                 { t: "The Hook", d: "သင့်အကြောင်း စတင်မိတ်ဆက်ရာတွင် စိတ်ဝင်စားစရာကောင်းသော အချက်များဖြင့် စတင်ပါ။" },
                 { t: "Closing", d: "အင်တာဗျူးအပြီးတွင် မေးခွန်းပြန်မေးရန် အမြဲပြင်ဆင်ထားပါ။" }
               ].map((tip, idx) => (
                 <div key={idx} className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-50 transition-all hover:bg-white hover:shadow-md hover:border-teal-50 group">
                   <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mb-2 group-hover:scale-110 origin-left transition-transform">{tip.t}</p>
                   <p className="text-sm text-slate-600 font-medium leading-relaxed">{tip.d}</p>
                 </div>
               ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden group">
            <div className="absolute top-[-30%] right-[-30%] w-64 h-64 bg-teal-500/10 rounded-full blur-[80px] group-hover:bg-teal-500/20 transition-all duration-1000"></div>
            <h3 className="font-black text-2xl mb-4 relative z-10 flex items-center gap-3">
               ပရီမီယံ ရယူရန် 🔓
            </h3>
            <p className="text-slate-400 leading-relaxed text-sm mb-8 relative z-10 font-medium">
              သန္တာနှင့် နောက်ထပ် (၅) နာရီကြာ အပြင်းအထန် လေ့ကျင့်နိုင်ရန် (၃၀,၀၀၀) ကျပ်ဖြင့် ပရီမီယံ ဝယ်ယူနိုင်ပါသည်။
            </p>
            <button 
              onClick={() => setShowPayment(true)}
              className="w-full py-5 bg-teal-500 text-white rounded-2xl font-black text-base hover:bg-teal-400 transition-all shadow-xl shadow-teal-900/40 relative z-10 hover:scale-105 active:scale-95"
            >
              {userStats.isPaid ? 'ပရီမီယံ ရယူပြီးပါပြီ ✨' : 'ယခုပဲ ပရီမီယံသို့ မြှင့်တင်ပါ'}
            </button>
          </div>
        </aside>
      </main>

      <footer className="mt-auto py-12 text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] text-center w-full border-t border-slate-100">
        Myanmar AI Coach &middot; Thandar Assistant &middot; MM-PRO-2024
      </footer>
    </div>
  );
};

export default App;
