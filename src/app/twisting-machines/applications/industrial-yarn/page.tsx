'use client';

import Link from 'next/link';
import Image from 'next/image';

const features = [
  { title: 'High Tension Capacity', description: 'Robust machines designed to handle heavy industrial yarns with greater tension requirements.' },
  { title: 'Precision Twist Control', description: 'Electronic systems maintain ±2% twist tolerance for consistent quality throughout production.' },
  { title: 'High-Speed Operation', description: 'TFO technology delivers 10,000-15,000 RPM for maximum productivity.' },
  { title: 'Robust Construction', description: 'Heavy-duty components ensure reliable operation with minimal downtime.' }
];

const applications = [
  { title: 'Tire Cord Manufacturing', description: 'Nylon, polyester, and rayon cords for tire reinforcement with 350-500 TPM precision.' },
  { title: 'Conveyor Belt Reinforcement', description: 'Multi-ply constructions for mining, manufacturing, and logistics applications.' },
  { title: 'Hose & Belt Reinforcement', description: 'Hydraulic hoses and automotive belts requiring flexibility under pressure.' },
  { title: 'Geotextiles & Construction', description: 'Soil stabilization, drainage systems, and erosion control applications.' }
];

export default function IndustrialYarnPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <div className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/twisting-machines" className="text-slate-600 hover:text-orange-600 transition-colors">Twisting Machines</Link>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-slate-600">Applications</span>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-slate-900 font-medium">Industrial Yarn</span>
          </nav>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="px-3 py-1 bg-blue-500/30 text-blue-200 text-xs font-medium rounded-full border border-blue-400/30">
                Industrial Applications
              </span>
              <h1 className="text-4xl md:text-5xl font-bold mt-4 mb-6">Industrial Yarn Twisting Solutions</h1>
              <p className="text-xl text-slate-300 mb-8">
                High-performance twisting solutions for tire cord production, conveyor belts, 
                hose reinforcement, and technical textile applications requiring exceptional strength and durability.
              </p>
              <div className="flex flex-wrap gap-4">
                <a 
                  href="https://meeraind.com/product/tprs-twisters" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-all transform hover:scale-105 shadow-lg"
                >
                  View Industrial Machines
                </a>
                <a 
                  href="https://meeraind.com/contact" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg border border-white/30 transition-all"
                >
                  Request Quote
                </a>
              </div>
            </div>
            <div className="relative h-80 rounded-2xl overflow-hidden shadow-2xl">
              <Image 
                src="/images/hub/industrial_yarn_spoo_7565ea41.jpg" 
                alt="Industrial yarn manufacturing"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Introduction */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="max-w-3xl">
          <p className="text-orange-500 font-medium text-sm uppercase tracking-wider mb-2">Overview</p>
          <h2 className="text-3xl font-bold text-slate-900 mb-6">Understanding Industrial Yarn Twisting</h2>
          <p className="text-slate-600 text-lg mb-4">
            Industrial yarn represents one of the most demanding sectors in the textile industry, requiring 
            exceptional strength, durability, and consistency. Unlike consumer textiles where aesthetics 
            play a primary role, industrial yarns must meet stringent performance specifications that 
            directly impact the safety and functionality of end products.
          </p>
          <p className="text-slate-600 text-lg">
            The twisting process is fundamental to achieving these performance characteristics. When yarns 
            are twisted, the individual fibers or filaments are bound together through mechanical interlocking, 
            creating a structure that distributes stress more evenly across the yarn cross-section.
          </p>
        </div>
      </div>

      {/* Applications Grid */}
      <div className="bg-slate-50 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-orange-500 font-medium text-sm uppercase tracking-wider mb-2">Applications</p>
            <h2 className="text-3xl font-bold text-slate-900">Key Industrial Yarn Applications</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {applications.map((app) => (
              <div key={app.title} className="bg-white rounded-2xl p-8 border border-slate-200 hover:shadow-lg transition-all">
                <h3 className="text-xl font-bold text-slate-900 mb-3">{app.title}</h3>
                <p className="text-slate-600">{app.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Machine Requirements */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <p className="text-orange-500 font-medium text-sm uppercase tracking-wider mb-2">Machine Requirements</p>
          <h2 className="text-3xl font-bold text-slate-900">What Industrial Yarn Production Demands</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <div key={feature.title} className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-6 border border-slate-200">
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-slate-600 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recommended Machines */}
      <div className="bg-slate-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-orange-400 font-medium text-sm uppercase tracking-wider mb-2">Recommended Machines</p>
            <h2 className="text-3xl font-bold">Machines for Industrial Yarn Production</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <a 
              href="https://meeraind.com/product/tprs-twisters"
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white/10 rounded-2xl p-8 border border-white/20 hover:bg-white/20 transition-all"
            >
              <h3 className="text-2xl font-bold mb-3">TPRS Twister Machine</h3>
              <p className="text-slate-300 mb-4">High-speed TFO machine ideal for tire cord and technical yarn production with speeds up to 15,000 RPM.</p>
              <span className="inline-flex items-center gap-2 text-orange-400 font-medium">
                View Product
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </span>
            </a>
            <a 
              href="https://meeraind.com/product/ring-twister"
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white/10 rounded-2xl p-8 border border-white/20 hover:bg-white/20 transition-all"
            >
              <h3 className="text-2xl font-bold mb-3">Heavy Duty Cabler Machine</h3>
              <p className="text-slate-300 mb-4">Robust cabling machine for multi-ply constructions used in conveyor belts and heavy industrial applications.</p>
              <span className="inline-flex items-center gap-2 text-orange-400 font-medium">
                View Product
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* Related Links */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <p className="text-orange-500 font-medium text-sm uppercase tracking-wider mb-2">Related Resources</p>
          <h2 className="text-3xl font-bold text-slate-900">Explore More</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <Link href="/compare/tfo-vs-ring-twister" className="group bg-white rounded-2xl p-6 border border-slate-200 hover:border-orange-300 hover:shadow-lg transition-all">
            <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-orange-600">TFO vs Ring Twister</h3>
            <p className="text-slate-600 text-sm mb-4">Compare technologies for your application</p>
            <span className="text-orange-600 font-medium text-sm">Learn more →</span>
          </Link>
          <Link href="/guides/yarn-twist-calculation" className="group bg-white rounded-2xl p-6 border border-slate-200 hover:border-orange-300 hover:shadow-lg transition-all">
            <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-orange-600">Yarn Twist Calculation</h3>
            <p className="text-slate-600 text-sm mb-4">Calculate optimal twist for your yarn</p>
            <span className="text-orange-600 font-medium text-sm">Learn more →</span>
          </Link>
          <Link href="/twisting-machines/applications/rope-cordage" className="group bg-white rounded-2xl p-6 border border-slate-200 hover:border-orange-300 hover:shadow-lg transition-all">
            <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-orange-600">Rope & Cordage</h3>
            <p className="text-slate-600 text-sm mb-4">Heavy-duty twisting applications</p>
            <span className="text-orange-600 font-medium text-sm">Learn more →</span>
          </Link>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-900 text-white py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to Optimize Your Industrial Yarn Production?
          </h2>
          <p className="text-slate-300 mb-6">
            Contact Meera Industries to discuss your specific requirements and find the ideal twisting solution.
          </p>
          <a 
            href="https://meeraind.com/contact" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-all transform hover:scale-105 shadow-lg"
          >
            Request Custom Quote
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
