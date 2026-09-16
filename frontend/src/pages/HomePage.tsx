import { Link } from 'react-router-dom';
import { Film, ChevronRight, Clock, Shield, Users } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-hidden">
      {/* Film strip top */}
      <div className="h-2 bg-gradient-to-r from-[#e63946] via-[#f4a261] to-[#e63946]" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Film className="text-[#e63946]" size={28} />
          <span className="font-black tracking-widest text-sm uppercase text-zinc-400">
            VITSION
          </span>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 pt-16 pb-32 text-center">
        {/* Glow effect */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(230,57,70,0.15) 0%, transparent 70%)',
          }}
        />

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#e63946]/30 text-[#e63946] text-xs font-semibold tracking-widest uppercase mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#e63946] animate-pulse" />
          Recruitment 2024–25
        </div>

        <h1
          className="text-6xl md:text-8xl font-black tracking-tight mb-4 leading-none"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          VITSION
          <br />
          <span className="text-[#e63946]">MOVIE</span> MAKERS
        </h1>

        <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto mb-4 leading-relaxed">
          VIT's premier filmmaking club. Join us and be part of the stories we tell.
        </p>

        <p className="text-zinc-500 text-sm mb-12">
          Select your department preferences. Allocation is strictly first come, first served.
        </p>

        <Link
          to="/register"
          id="register-btn"
          className="inline-flex items-center gap-3 px-10 py-5 bg-[#e63946] hover:bg-[#c1121f] text-white font-bold text-lg rounded-xl transition-all duration-200 hover:scale-105 hover:shadow-[0_0_40px_rgba(230,57,70,0.4)] active:scale-95"
        >
          REGISTER FOR DEPARTMENT SELECTION
          <ChevronRight size={20} />
        </Link>

        <p className="text-zinc-600 text-xs mt-6">
          Only @vitstudent.ac.in emails are accepted
        </p>

        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-20">
          {[
            {
              icon: <Clock size={20} className="text-[#e63946]" />,
              title: 'First Come, First Served',
              desc: 'Seats are allocated in strict order of submission. Submit early.',
            },
            {
              icon: <Users size={20} className="text-[#e63946]" />,
              title: '3 Preferences',
              desc: "Choose 3 departments in order of preference. We'll place you in the best available.",
            },
            {
              icon: <Shield size={20} className="text-[#e63946]" />,
              title: 'Instant Confirmation',
              desc: "You'll receive your application number and department allocation immediately.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="p-6 rounded-xl border border-white/[0.07] bg-white/[0.03] text-left hover:border-white/[0.12] transition-colors"
            >
              <div className="mb-3">{card.icon}</div>
              <h3 className="font-semibold text-white text-sm mb-2">{card.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Departments */}
      <section className="border-t border-white/[0.06] bg-[#0c0c0e] py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-xs font-bold tracking-widest text-zinc-500 uppercase mb-8 text-center">
            DEPARTMENTS
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              'Outreach',
              'Creative',
              'Editorial',
              'Publicity',
              'Event Management',
              'Photography',
              'Editing',
              'Projects',
            ].map((dept) => (
              <div
                key={dept}
                className="px-4 py-3 rounded-lg border border-white/[0.06] text-center text-sm font-medium text-zinc-400 hover:text-white hover:border-[#e63946]/30 transition-colors cursor-default"
              >
                {dept}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8 text-center text-zinc-600 text-xs">
        <Film className="inline mb-1 text-[#e63946]" size={14} />
        <span className="ml-2">VITSION Movie Makers © {new Date().getFullYear()}</span>
      </footer>

      {/* Film strip bottom */}
      <div className="h-2 bg-gradient-to-r from-[#e63946] via-[#f4a261] to-[#e63946]" />
    </div>
  );
}
