'use client';

import Link from 'next/link';
import Image from 'next/image';

const products = [
  {
    name: 'TPRS Twister',
    description: 'Experience the world\'s first one-step S/Z twisting technology, offering significant savings in cost, labor, & space while producing high-quality threads & twines.',
    href: 'https://meeraind.com/product/tprs-twisters',
    image: '/images/hub/textile_spinning_mac_e0e11a82.jpg',
    features: ['One-step S/Z twisting', 'Cost & labor savings', 'Space efficient', 'High-quality output'],
    applications: ['PPMF/Tapes & Twines', 'Technical Textiles', 'Fishnet Industry']
  },
  {
    name: 'Heavy Duty Twister/Cabler',
    description: 'Robust cabling machine for heavy-duty yarn and rope applications. Designed to handle high-tenacity yarns and multiple plies.',
    href: 'https://meeraind.com/product/ring-twister',
    image: '/images/hub/rope_cordage_manufac_52827f8c.jpg',
    features: ['Heavy-duty construction', 'High tension capacity', 'Multi-ply cabling', 'Variable speed control'],
    applications: ['Tire cord', 'Rope and cordage', 'Industrial yarn']
  },
  {
    name: 'Covering Machine',
    description: 'Precisely double cover elastic, spandex, and technical yarns like glass fiber at high speeds for all type of technical textile applications.',
    href: 'https://meeraind.com/product/covering-machine',
    image: '/images/hub/industrial_textile_m_6ab3d47d.jpg',
    features: ['Single and double covering', 'Elastane compatibility', 'Precision wrap control', 'High-speed operation'],
    applications: ['Technical Textiles', 'Spandex & Elastane', 'Glass Fiber Yarn']
  }
];

const relatedLinks = [
  { title: 'Industrial Yarn Applications', href: '/twisting-machines/applications/industrial-yarn', description: 'Explore industrial solutions' },
  { title: 'Rope & Cordage Applications', href: '/twisting-machines/applications/rope-cordage', description: 'Marine and industrial ropes' },
  { title: 'Cabler vs TFO Comparison', href: '/compare/cabler-vs-two-for-one-twister', description: 'Compare cabling technologies' }
];

export default function SpunYarnTwistersPage() {
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
            <span className="text-slate-900 font-medium">Spun Yarn Twisters</span>
          </nav>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-3 py-1 bg-purple-500/30 text-purple-200 text-xs font-medium rounded-full border border-purple-400/30">
                  PPMF/Tapes & Twines
                </span>
                <span className="px-3 py-1 bg-purple-500/30 text-purple-200 text-xs font-medium rounded-full border border-purple-400/30">
                  Technical Textiles
                </span>
                <span className="px-3 py-1 bg-purple-500/30 text-purple-200 text-xs font-medium rounded-full border border-purple-400/30">
                  Fishnet Industry
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6">Spun Yarn & TPRS Twisters</h1>
              <p className="text-xl text-slate-300 mb-8">
                Specialized machines for spun yarn and heavy-duty applications including cabling, 
                covering, and multi-ply twisting for industrial and technical textiles.
              </p>
              <div className="flex flex-wrap gap-4">
                <a 
                  href="https://meeraind.com/product/tprs-twisters" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-all transform hover:scale-105 shadow-lg"
                >
                  Explore Our Products
                </a>
                <Link 
                  href="/compare/cabler-vs-two-for-one-twister"
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg border border-white/30 transition-all"
                >
                  Compare Technologies
                </Link>
              </div>
            </div>
            <div className="relative h-80 rounded-2xl overflow-hidden shadow-2xl">
              <Image 
                src="/images/hub/textile_spinning_mac_e0e11a82.jpg" 
                alt="TPRS and spun yarn machinery"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </div>

      {/* About Section */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-orange-500 font-medium text-sm uppercase tracking-wider mb-2">Technology Overview</p>
            <h2 className="text-3xl font-bold text-slate-900 mb-6">About Spun Yarn Twisting</h2>
            <p className="text-slate-600 mb-4">
              Spun yarn twisters are specialized machines designed for processing staple fiber yarns, 
              heavy-duty industrial yarns, and technical textiles. These machines offer precise tension 
              control and gentle yarn handling to maintain fiber integrity while achieving consistent 
              twist quality.
            </p>
            <p className="text-slate-600 mb-6">
              The TPRS (Two-Plying-cum-Reverse-Twisting System) represents Meera Industries' patented 
              innovation that combines two processing steps into one, dramatically reducing costs and 
              floor space requirements.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-2xl font-bold text-slate-900">50%</div>
                <div className="text-sm text-slate-600">Space Savings</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-2xl font-bold text-slate-900">1-Step</div>
                <div className="text-sm text-slate-600">S/Z Twisting</div>
              </div>
            </div>
          </div>
          <div className="relative h-80 rounded-2xl overflow-hidden shadow-lg">
            <Image 
              src="/images/hub/rope_cordage_manufac_67adb301.jpg" 
              alt="Heavy duty twisting"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </div>

      {/* Products Section */}
      <div className="bg-slate-50 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-orange-500 font-medium text-sm uppercase tracking-wider mb-2">Product Range</p>
            <h2 className="text-3xl font-bold text-slate-900">Our Spun Yarn Twister Range</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {products.map((product) => (
              <div key={product.name} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200 hover:shadow-xl transition-all group">
                <div className="relative h-48">
                  <Image 
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-6">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {product.applications.slice(0, 2).map((app) => (
                      <span key={app} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                        {app}
                      </span>
                    ))}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{product.name}</h3>
                  <p className="text-slate-600 text-sm mb-4">{product.description}</p>
                  
                  <div className="mb-4">
                    <div className="space-y-1">
                      {product.features.slice(0, 3).map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                          <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>

                  <a 
                    href={product.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    View Details
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Related Resources */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <p className="text-orange-500 font-medium text-sm uppercase tracking-wider mb-2">Learn More</p>
          <h2 className="text-3xl font-bold text-slate-900">Related Resources</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {relatedLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group bg-white rounded-2xl p-6 border border-slate-200 hover:border-orange-300 hover:shadow-lg transition-all"
            >
              <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-orange-600 transition-colors">{link.title}</h3>
              <p className="text-slate-600 text-sm mb-4">{link.description}</p>
              <span className="inline-flex items-center gap-2 text-orange-600 font-medium text-sm">
                Read more
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-slate-900 to-purple-900 text-white py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to Upgrade Your Twisting Operations?
          </h2>
          <p className="text-slate-300 mb-6">
            Contact Meera Industries for customized spun yarn and TPRS solutions tailored to your specific requirements.
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
