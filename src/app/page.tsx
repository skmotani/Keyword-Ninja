import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen -mt-8 -mx-6">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 py-20 px-8 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl"></div>
        </div>

        <div className="relative max-w-6xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-blue-200 rounded-full px-4 py-1.5 mb-8 shadow-sm">
            <span className="text-blue-500">✨</span>
            <span className="text-sm font-medium text-gray-700">Powered by AI + Human Intelligence</span>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
                <span className="text-red-600 text-6xl lg:text-7xl block mb-4">MOTANI</span>
                Get <span className="text-blue-600">Found.</span><br />
                Grow <span className="text-blue-600">Faster.</span><br />
                Generate <span className="text-blue-600">Revenue.</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                AI-Powered SEO that puts your business where the money is.
                Increase relevant traffic and stay ahead in both traditional and AI-powered search.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/report/dashboard"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
                >
                  Open Dashboard
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link
                  href="/clients"
                  className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-all border border-gray-200 shadow-sm"
                >
                  View Clients
                </Link>
              </div>
            </div>

            {/* Right - Stats Card */}
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                    <div className="text-4xl font-bold text-blue-600 mb-1">AI</div>
                    <div className="text-sm text-gray-600">Powered Analysis</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl">
                    <div className="text-4xl font-bold text-green-600 mb-1">24/7</div>
                    <div className="text-sm text-gray-600">Monitoring</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl">
                    <div className="text-4xl font-bold text-purple-600 mb-1">360°</div>
                    <div className="text-sm text-gray-600">SERP Coverage</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl">
                    <div className="text-4xl font-bold text-amber-600 mb-1">B2B</div>
                    <div className="text-sm text-gray-600">Revenue Focus</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three Pillars Section */}
      <section className="py-20 px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Approach</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Three pillars that drive your digital success</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Analyze */}
            <div className="group relative bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-8 text-white overflow-hidden transition-all hover:scale-105 hover:shadow-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-6">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-3">Analyze</h3>
                <p className="text-blue-100 leading-relaxed">
                  Leveraging deep data analytics and intent modeling to understand your market, competitors, and customer search behavior.
                </p>
              </div>
            </div>

            {/* Automate */}
            <div className="group relative bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-8 text-white overflow-hidden transition-all hover:scale-105 hover:shadow-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-6">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-3">Automate</h3>
                <p className="text-emerald-100 leading-relaxed">
                  Utilizing AI to build digital infrastructure at lightning speed. Content, pages, and presence automated at scale.
                </p>
              </div>
            </div>

            {/* Dominate */}
            <div className="group relative bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl p-8 text-white overflow-hidden transition-all hover:scale-105 hover:shadow-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-6">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-3">Dominate</h3>
                <p className="text-purple-100 leading-relaxed">
                  Ensuring presence across SERP, Social, YouTube, and LLM Search. Be everywhere your customers are searching.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Founder Statement */}
      <section className="py-16 px-8 bg-gradient-to-r from-slate-900 to-slate-800">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12">
            <div className="absolute -top-4 left-8">
              <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                From the Founder
              </span>
            </div>
            <blockquote className="text-lg md:text-xl text-white/90 leading-relaxed italic mb-6">
              "We put your business where the money is. If a customer asks ChatGPT, Google, or YouTube
              for a product you sell, and they don't see your name, <span className="text-blue-400 font-semibold">you are losing money</span>.
              We use AI and Data Analytics to build your digital presence instantly so you get found,
              grow your brand authority, and <span className="text-green-400 font-semibold">generate actual B2B revenue</span>."
            </blockquote>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                M
              </div>
              <div>
                <div className="text-white font-semibold">Motani</div>
                <div className="text-white/60 text-sm">Founder & CEO</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Access Cards */}
      <section className="py-16 px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Quick Access</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/clients" className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all text-center">
              <div className="text-3xl mb-3">👥</div>
              <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">Clients</div>
            </Link>
            <Link href="/report/dashboard" className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all text-center">
              <div className="text-3xl mb-3">📊</div>
              <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">Dashboard</div>
            </Link>
            <Link href="/keywords/cluster-intent-studio" className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all text-center">
              <div className="text-3xl mb-3">🧠</div>
              <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">Cluster Studio</div>
            </Link>
            <Link href="/cms" className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all text-center">
              <div className="text-3xl mb-3">📝</div>
              <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">CMS</div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
