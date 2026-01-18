
import React, { useState } from 'react';

interface PaymentGateProps {
  onPaymentComplete: () => void;
}

export const PaymentGate: React.FC<PaymentGateProps> = ({ onPaymentComplete }) => {
  const [step, setStep] = useState<'info' | 'payment' | 'processing'>('info');
  const [formData, setFormData] = useState({ name: '', phone: '' });

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('payment');
  };

  const handleUploadComplete = () => {
    setStep('processing');
    setTimeout(() => {
      onPaymentComplete();
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
        
        {/* Header - Relaxing & Helpful */}
        <div className="bg-teal-600 p-8 text-white text-center relative overflow-hidden">
          <div className="absolute top-[-50%] left-[-20%] w-60 h-60 bg-white/10 rounded-full blur-3xl"></div>
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md border border-white/30">
            <span className="text-3xl">🌱</span>
          </div>
          <h2 className="text-2xl font-black mb-1">Growth Journey</h2>
          <p className="text-teal-100 text-sm font-medium">Continue your path to success with Thandar.</p>
        </div>

        <div className="p-6 lg:p-10">
          {step === 'info' && (
            <div className="space-y-6">
              <div className="bg-teal-50/50 p-5 rounded-2xl border border-teal-100/50">
                <h3 className="font-bold text-teal-900 text-sm mb-1 flex items-center gap-2">
                  <span className="text-base">🎁</span> အခမဲ့အချိန် ကုန်ဆုံးသွားပါပြီ။
                </h3>
                <p className="text-xs text-teal-700 leading-relaxed font-medium">
                  သန္တာနဲ့ နောက်ထပ် (၅) နာရီကြာ လေ့ကျင့်နိုင်ဖို့ Register ပြုလုပ်ပေးပါ။
                </p>
              </div>
              
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] ml-1">အမည် (Full Name)</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Eg. Ma Thandar"
                    className="w-full px-5 py-4 rounded-xl border-2 border-slate-50 focus:border-teal-500 focus:bg-white bg-slate-50 outline-none transition-all text-sm font-bold"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] ml-1">ဖုန်းနံပါတ် (Phone Number)</label>
                  <input 
                    required
                    type="tel" 
                    placeholder="09..."
                    className="w-full px-5 py-4 rounded-xl border-2 border-slate-50 focus:border-teal-500 focus:bg-white bg-slate-50 outline-none transition-all text-sm font-bold"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <button className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-sm hover:bg-black transition-all shadow-xl shadow-slate-200 mt-2">
                  Register & Continue ➡️
                </button>
              </form>
            </div>
          )}

          {step === 'payment' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="text-center">
                <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">Total Package</p>
                <p className="text-3xl font-black text-slate-900">30,000 MMK</p>
              </div>

              <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 flex items-start gap-4">
                 <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                   <span className="text-xl">💳</span>
                 </div>
                 <div className="space-y-1">
                   <p className="text-xs font-black text-indigo-900 uppercase">KBZ Pay Transfer</p>
                   <p className="text-[10px] text-indigo-600 font-bold">Name: THANDAR COACHING LTD.</p>
                   <p className="text-sm font-black text-indigo-950 tracking-wider">09 778 123 456</p>
                 </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 text-center uppercase tracking-widest">Screenshot တင်ပေးပါ</p>
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-100 rounded-2xl hover:bg-slate-50 cursor-pointer transition-all bg-slate-50/30">
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-2xl mb-1">📸</span>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-tight">Tap to Upload Receipt</p>
                  </div>
                  <input type="file" className="hidden" onChange={handleUploadComplete} />
                </label>
              </div>

              <button 
                onClick={() => setStep('info')}
                className="w-full text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-slate-600 transition-colors"
              >
                ← Change Details
              </button>
            </div>
          )}

          {step === 'processing' && (
            <div className="py-16 text-center space-y-4">
              <div className="relative mx-auto w-16 h-16">
                <div className="absolute inset-0 border-4 border-teal-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <h3 className="text-xl font-black text-slate-900">Checking... 🔎</h3>
              <p className="text-slate-500 text-xs font-medium max-w-[200px] mx-auto">ငွေပေးချေမှုကို စစ်ဆေးနေပါတယ်။ ခဏစောင့်ပေးပါနော်။</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
